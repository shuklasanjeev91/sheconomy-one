-- Allow marketplace orders while Airwallex KYC is in progress (draft → awx_pending).
-- Only rejected shops are blocked. Settlement / Funds Split still require Connected Account.
-- No row remains allowed (shops that have not started KYC).

CREATE OR REPLACE FUNCTION public.shop_airwallex_kyc_allows_orders(p_shop_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT NOT EXISTS (
    SELECT 1 FROM public.shop_airwallex_kyc k
    WHERE k.shop_id = p_shop_id
      AND k.status = 'rejected'
  );
$$;

COMMENT ON FUNCTION public.shop_airwallex_kyc_allows_orders(uuid) IS
  'True when the shop has no Airwallex KYC row, or KYC is not rejected. Funds Split still needs a Connected Account.';
