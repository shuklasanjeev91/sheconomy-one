-- Allow multi-word search terms (e.g. AI-expanded brand queries) to match when
-- any significant token matches shop_name / title / description, not only the
-- full phrase as a contiguous ILIKE substring.

CREATE OR REPLACE FUNCTION public.search_listings(
  p_search_term text DEFAULT NULL::text,
  p_listing_type listing_type_enum DEFAULT NULL::listing_type_enum,
  p_shop_id uuid DEFAULT NULL::uuid,
  p_min_price numeric DEFAULT NULL::numeric,
  p_max_price numeric DEFAULT NULL::numeric,
  p_tags text[] DEFAULT NULL::text[],
  p_is_featured boolean DEFAULT NULL::boolean,
  p_limit integer DEFAULT 50,
  p_offset integer DEFAULT 0
)
RETURNS TABLE(
  id uuid,
  title text,
  description text,
  listing_type listing_type_enum,
  price numeric,
  shop_name character varying,
  shop_verified boolean,
  primary_image_url text,
  is_featured boolean,
  slug text,
  created_at timestamp with time zone
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
  RETURN QUERY
  SELECT
    l.id,
    l.title,
    l.description,
    l.listing_type,
    l.price,
    s.shop_name,
    s.verified,
    (
      SELECT li.image_url
      FROM public.listing_images li
      WHERE li.listing_id = l.id AND li.is_primary = true
      LIMIT 1
    ) AS primary_image_url,
    l.is_featured,
    l.slug,
    l.created_at
  FROM public.listings l
  JOIN public.shops s ON l.shop_id = s.id
  WHERE l.is_active = true
    AND l.listing_status = 'active'
    AND s.is_active = true
    AND s.verified = true
    AND (
      p_search_term IS NULL
      OR (
        l.title ILIKE '%' || p_search_term || '%'
        OR l.description ILIKE '%' || p_search_term || '%'
        OR s.shop_name ILIKE '%' || p_search_term || '%'
        OR EXISTS (
          SELECT 1
          FROM unnest(regexp_split_to_array(btrim(p_search_term), '\s+')) AS token
          WHERE length(token) >= 3
            AND (
              s.shop_name ILIKE '%' || token || '%'
              OR l.title ILIKE '%' || token || '%'
              OR l.description ILIKE '%' || token || '%'
            )
        )
      )
    )
    AND (p_listing_type IS NULL OR l.listing_type = p_listing_type)
    AND (p_shop_id IS NULL OR l.shop_id = p_shop_id)
    AND (p_min_price IS NULL OR l.price >= p_min_price)
    AND (p_max_price IS NULL OR l.price <= p_max_price)
    AND (p_tags IS NULL OR l.tags && p_tags)
    AND (p_is_featured IS NULL OR l.is_featured = p_is_featured)
  ORDER BY
    CASE WHEN p_search_term IS NOT NULL THEN
      ts_rank(
        to_tsvector(
          'english',
          coalesce(l.title, '') || ' ' || coalesce(l.description, '') || ' ' || coalesce(s.shop_name, '')
        ),
        plainto_tsquery('english', p_search_term)
      )
    ELSE 0
    END DESC,
    CASE
      WHEN p_search_term IS NOT NULL AND s.shop_name ILIKE '%' || split_part(btrim(p_search_term), ' ', 1) || '%'
        THEN 1
      ELSE 0
    END DESC,
    l.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$function$;
