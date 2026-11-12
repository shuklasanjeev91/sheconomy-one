-- Point atomic checkout KYC gate at PayU directly (drop Airwallex function name).
-- Also disable Airwallex KYC row enforcement — marketplace is PayU SHEPay only.

DO $$
DECLARE
  def text;
BEGIN
  SELECT pg_get_functiondef(p.oid) INTO def
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'atomic_marketplace_checkout'
  LIMIT 1;

  IF def IS NULL THEN
    RAISE EXCEPTION 'atomic_marketplace_checkout not found';
  END IF;

  IF position('shop_airwallex_kyc_allows_orders' in def) > 0 THEN
    def := replace(def, 'shop_airwallex_kyc_allows_orders', 'shop_payu_kyc_allows_orders');
    EXECUTE def;
  END IF;
END $$;

DROP TRIGGER IF EXISTS shop_airwallex_kyc_enforce_trg ON public.shop_airwallex_kyc;

COMMENT ON FUNCTION public.shop_airwallex_kyc_allows_orders(uuid) IS
  'Deprecated. Prefer shop_payu_kyc_allows_orders. Kept as a PayU delegate for older callers.';
