-- Force every seller to complete PayU KYC before accepting orders.
-- Legacy loophole: shops with no shop_payu_kyc row were allowed through.
-- Storefront visibility stays on shops.verified — do not clear it here
-- (see 20261113190000_restore_storefront_verified_decouple_payu_kyc.sql).

CREATE OR REPLACE FUNCTION public.shop_payu_kyc_allows_orders(p_shop_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.shop_payu_kyc k
    WHERE k.shop_id = p_shop_id
      AND k.status = 'payu_verified'
  );
$$;

COMMENT ON FUNCTION public.shop_payu_kyc_allows_orders(uuid) IS
  'True only when the shop has payu_verified KYC. Missing KYC blocks checkout/orders, not catalog visibility.';

REVOKE ALL ON FUNCTION public.shop_payu_kyc_allows_orders(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.shop_payu_kyc_allows_orders(uuid) TO authenticated, service_role;
