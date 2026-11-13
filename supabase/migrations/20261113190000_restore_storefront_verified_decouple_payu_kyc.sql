-- 20261113140000 set shops.verified = false for every shop without payu_verified KYC.
-- That emptied the public storefront (RLS public_read_active_listings requires verified shops).
-- Selling / checkout stays gated by shop_payu_kyc_allows_orders; catalog visibility does not.

COMMENT ON FUNCTION public.shop_payu_kyc_allows_orders(uuid) IS
  'True only when the shop has payu_verified KYC. Missing KYC blocks checkout/orders, not catalog visibility.';

-- Restore storefront visibility for active shops. PayU KYC continues to block orders only.
UPDATE public.shops
SET
  verified = true,
  updated_at = now()
WHERE is_active IS TRUE
  AND coalesce(verified, false) = false;
