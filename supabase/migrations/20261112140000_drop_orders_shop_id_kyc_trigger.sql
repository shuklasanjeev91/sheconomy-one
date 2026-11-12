-- orders has no shop_id column. The BEFORE INSERT trigger orders_require_payu_kyc_trg
-- was incorrectly re-added by 20261103120000 and crashes checkout with:
--   Order creation failed: record "new" has no field 'shop_id'
--
-- PayU KYC is already enforced in create_customer_order() (via listing.shop_id)
-- and atomic_marketplace_checkout() per shop. Drop the broken orders trigger.

DROP TRIGGER IF EXISTS orders_require_payu_kyc_trg ON public.orders;

CREATE OR REPLACE FUNCTION public.orders_require_payu_kyc()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Intentionally a no-op. Kept so older migration history that CREATE OR REPLACE
  -- this function does not reintroduce NEW.shop_id access if re-applied.
  -- KYC gating lives on create_customer_order + atomic_marketplace_checkout.
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.orders_require_payu_kyc() IS
  'Deprecated no-op. orders has no shop_id; KYC is enforced in create_customer_order and atomic_marketplace_checkout.';
