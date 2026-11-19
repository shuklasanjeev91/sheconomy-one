-- Unblock marketplace checkout: 0 of ~1394 active shops are payu_verified, so the
-- forced KYC gate (20261113140000) made every online/COD checkout fail.
--
-- Platform SHEPay already collects on the parent MID and parks seller funds in
-- shepay_pending_settlements (awaiting_child) until PayU child KYC is connected.
-- Buyers must be able to pay; sellers still need KYC to receive settlements.

CREATE OR REPLACE FUNCTION public.shop_payu_kyc_allows_orders(p_shop_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT true;
$$;

COMMENT ON FUNCTION public.shop_payu_kyc_allows_orders(uuid) IS
  'Checkout is always allowed. Seller payouts stay held until PayU child KYC is payu_verified.';

-- Keep the Airwallex shim in sync (delegates to PayU helper).
CREATE OR REPLACE FUNCTION public.shop_airwallex_kyc_allows_orders(p_shop_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.shop_payu_kyc_allows_orders(p_shop_id);
$$;
