-- Backfill SEO-friendly shop and listing slugs (replaces generic values like my-shop-24).

CREATE OR REPLACE FUNCTION public.ensure_unique_shop_slug(
  p_shop_id uuid,
  p_base_slug text
)
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  v_slug text := lower(trim(p_base_slug));
  v_candidate text := v_slug;
  v_suffix integer := 1;
BEGIN
  IF v_slug IS NULL OR v_slug = '' THEN
    RETURN NULL;
  END IF;

  WHILE EXISTS (
    SELECT 1
    FROM shops s
    WHERE s.slug = v_candidate
      AND s.id <> p_shop_id
  ) LOOP
    v_suffix := v_suffix + 1;
    v_candidate := v_slug || '-' || v_suffix::text;
  END LOOP;

  RETURN v_candidate;
END;
$$;

CREATE OR REPLACE FUNCTION public.ensure_unique_listing_slug(
  p_listing_id uuid,
  p_shop_id uuid,
  p_base_slug text
)
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  v_slug text := lower(trim(p_base_slug));
  v_candidate text := v_slug;
  v_suffix integer := 1;
BEGIN
  IF v_slug IS NULL OR v_slug = '' THEN
    RETURN NULL;
  END IF;

  WHILE EXISTS (
    SELECT 1
    FROM listings l
    WHERE l.slug = v_candidate
      AND l.id <> p_listing_id
  ) LOOP
    v_suffix := v_suffix + 1;
    v_candidate := v_slug || '-' || v_suffix::text;
  END LOOP;

  RETURN v_candidate;
END;
$$;

UPDATE shops s
SET
  slug = public.ensure_unique_shop_slug(
    s.id,
    COALESCE(
      NULLIF(public.slugify(s.shop_name), ''),
      'shop-' || substring(s.id::text, 1, 8)
    )
  ),
  updated_at = NOW()
WHERE s.slug IS NULL
   OR s.slug = ''
   OR s.slug ~* '^(my-)?shop-?[0-9]+$'
   OR s.slug = s.id::text;

UPDATE listings l
SET
  slug = public.ensure_unique_listing_slug(
    l.id,
    l.shop_id,
    COALESCE(
      NULLIF(public.generate_listing_slug(l.shop_id, l.title), ''),
      NULLIF(public.slugify(l.title), ''),
      'listing-' || substring(l.id::text, 1, 8)
    )
  ),
  updated_at = NOW()
WHERE l.slug IS NULL
   OR l.slug = ''
   OR l.slug ~* '^(listing|product|item)-?[0-9]+$'
   OR l.slug = l.id::text;
