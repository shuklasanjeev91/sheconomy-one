-- Force every seller to complete PayU KYC before accepting orders or staying storefront-visible.
-- Legacy loophole: shops with no shop_payu_kyc row were allowed through.

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
  'True only when the shop has payu_verified KYC. Missing KYC blocks checkout.';

REVOKE ALL ON FUNCTION public.shop_payu_kyc_allows_orders(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.shop_payu_kyc_allows_orders(uuid) TO authenticated, service_role;

-- Un-verify shops that are not PayU-verified so listings leave the storefront until KYC completes.
UPDATE public.shops s
SET
  verified = false,
  updated_at = now()
WHERE coalesce(s.verified, false) = true
  AND NOT EXISTS (
    SELECT 1
    FROM public.shop_payu_kyc k
    WHERE k.shop_id = s.id
      AND k.status = 'payu_verified'
  );
