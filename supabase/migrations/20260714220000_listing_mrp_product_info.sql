-- Marketplace pricing + legal/manufacturing product details (marketplace/marketplace).

ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS mrp numeric,
  ADD COLUMN IF NOT EXISTS price_includes_tax boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS tax_percent numeric,
  ADD COLUMN IF NOT EXISTS product_info jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.listings.mrp IS
  'Maximum Retail Price (MRP). Selling price remains listings.price.';
COMMENT ON COLUMN public.listings.price_includes_tax IS
  'When true, the selling price is inclusive of all applicable taxes (GST etc).';
COMMENT ON COLUMN public.listings.tax_percent IS
  'Declared tax/GST percent for shopper display (e.g. 5, 12, 18).';
COMMENT ON COLUMN public.listings.product_info IS
  'Manufacturing and legal product details: brand, manufacturer, origin, HSN, net qty, care, etc.';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'listings_mrp_non_negative'
  ) THEN
    ALTER TABLE public.listings
      ADD CONSTRAINT listings_mrp_non_negative CHECK (mrp IS NULL OR mrp >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'listings_tax_percent_range'
  ) THEN
    ALTER TABLE public.listings
      ADD CONSTRAINT listings_tax_percent_range
      CHECK (tax_percent IS NULL OR (tax_percent >= 0 AND tax_percent <= 100));
  END IF;
END $$;

-- Prefer inclusive pricing for existing active listings (marketplace default in India).
UPDATE public.listings
SET price_includes_tax = true
WHERE price_includes_tax IS DISTINCT FROM true;
