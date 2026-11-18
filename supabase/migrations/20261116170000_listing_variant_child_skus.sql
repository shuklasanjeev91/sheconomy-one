-- Marketplace parent/child listing SKUs:
-- listing_variations gains absolute price/tax/HSN; listing_images can bind to a child SKU.
-- Legacy price_adjustment path remains for rows without absolute price.

ALTER TABLE public.listing_variations
  ADD COLUMN IF NOT EXISTS price numeric,
  ADD COLUMN IF NOT EXISTS mrp numeric,
  ADD COLUMN IF NOT EXISTS tax_percent numeric,
  ADD COLUMN IF NOT EXISTS price_includes_tax boolean,
  ADD COLUMN IF NOT EXISTS hsn_code text;

COMMENT ON COLUMN public.listing_variations.price IS
  'Absolute child-SKU unit price. When set, checkout prefers this over listing.price + price_adjustment.';
COMMENT ON COLUMN public.listing_variations.mrp IS
  'Child-SKU MRP / list price for display.';
COMMENT ON COLUMN public.listing_variations.tax_percent IS
  'Child-SKU GST/tax percent. Falls back to listings.tax_percent when null.';
COMMENT ON COLUMN public.listing_variations.price_includes_tax IS
  'Whether child price includes tax. Falls back to listings.price_includes_tax when null.';
COMMENT ON COLUMN public.listing_variations.hsn_code IS
  'Child-SKU HSN/SAC. Falls back to listing product_info/metadata when null.';

ALTER TABLE public.listing_images
  ADD COLUMN IF NOT EXISTS variation_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'listing_images_variation_id_fkey'
  ) THEN
    ALTER TABLE public.listing_images
      ADD CONSTRAINT listing_images_variation_id_fkey
      FOREIGN KEY (variation_id)
      REFERENCES public.listing_variations(id)
      ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS listing_images_listing_variation_idx
  ON public.listing_images (listing_id, variation_id);

COMMENT ON COLUMN public.listing_images.variation_id IS
  'Optional child-SKU gallery. NULL = parent/listing gallery.';

-- 4-arg kept for legacy callers; 5-arg prefers absolute child price.
-- DROP first: CREATE OR REPLACE cannot remove/change parameter defaults
-- (a prior 5-arg overload may already exist with DEFAULT NULL).
DROP FUNCTION IF EXISTS public.commerce_cart_line_unit_price(jsonb, numeric, numeric, numeric, numeric);
DROP FUNCTION IF EXISTS public.commerce_cart_line_unit_price(jsonb, numeric, numeric, numeric);

CREATE FUNCTION public.commerce_cart_line_unit_price(
  p_metadata jsonb,
  p_cart_unit numeric,
  p_listing_price numeric,
  p_variant_adj numeric
)
RETURNS numeric
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN coalesce(p_metadata->>'bundle_id', '') <> '' THEN p_cart_unit
    ELSE p_listing_price + coalesce(p_variant_adj, 0)
  END;
$$;

CREATE FUNCTION public.commerce_cart_line_unit_price(
  p_metadata jsonb,
  p_cart_unit numeric,
  p_listing_price numeric,
  p_variant_adj numeric,
  p_variant_price numeric DEFAULT NULL
)
RETURNS numeric
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN coalesce(p_metadata->>'bundle_id', '') <> '' THEN p_cart_unit
    WHEN p_variant_price IS NOT NULL THEN p_variant_price
    ELSE p_listing_price + coalesce(p_variant_adj, 0)
  END;
$$;

-- Point checkout call sites at the 5-arg overload (absolute child price).
DO $$
DECLARE
  def text;
  r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN ('atomic_marketplace_checkout', 'commerce_cart_bogo_discount')
      AND pg_get_functiondef(p.oid) LIKE '%commerce_cart_line_unit_price(ci.item_metadata, ci.unit_price, l.price, lv.price_adjustment)%'
  LOOP
    def := pg_get_functiondef(r.sig);
    def := replace(
      def,
      'commerce_cart_line_unit_price(ci.item_metadata, ci.unit_price, l.price, lv.price_adjustment)',
      'commerce_cart_line_unit_price(ci.item_metadata, ci.unit_price, l.price, lv.price_adjustment, lv.price)'
    );
    def := replace(
      def,
      '''unit_price'', l.price + coalesce(lv.price_adjustment, 0)',
      '''unit_price'', coalesce(lv.price, l.price + coalesce(lv.price_adjustment, 0))'
    );
    EXECUTE def;
  END LOOP;
END $$;
