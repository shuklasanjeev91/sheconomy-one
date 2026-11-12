-- Restore PayU SHEPay as the only commerce payout / order gate.
-- Airwallex Connected Account KYC was temporary; point all gates back at shop_payu_kyc.

CREATE OR REPLACE FUNCTION public.shop_airwallex_kyc_allows_orders(p_shop_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  -- Compatibility shim: atomic_marketplace_checkout still calls this name.
  -- Delegate to PayU KYC so Airwallex rows no longer affect order create.
  SELECT public.shop_payu_kyc_allows_orders(p_shop_id);
$$;

COMMENT ON FUNCTION public.shop_airwallex_kyc_allows_orders(uuid) IS
  'Deprecated name. Delegates to shop_payu_kyc_allows_orders (PayU-only commerce).';

CREATE OR REPLACE FUNCTION public.orders_require_payu_kyc()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- orders.shop_id may be null on some historical rows; only gate when present.
  IF NEW.shop_id IS NOT NULL AND NOT public.shop_payu_kyc_allows_orders(NEW.shop_id) THEN
    RAISE EXCEPTION 'This shop is not ready to accept orders yet. Payout verification is still pending.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS orders_require_payu_kyc_trg ON public.orders;
CREATE TRIGGER orders_require_payu_kyc_trg
  BEFORE INSERT ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.orders_require_payu_kyc();
