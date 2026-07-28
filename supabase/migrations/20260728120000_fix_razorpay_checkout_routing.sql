-- Fix: allow buyers to read shop payment routing at checkout
-- AND backfill shop_commerce_settings for already-connected Razorpay accounts.
--
-- Root cause: three compounding bugs
--   1. payment_mode CHECK constraint only allowed ('own_gateway','shepay').
--      razorpay-connect wrote 'direct', so every INSERT/UPDATE was rejected
--      and the row was never created / updated.
--   2. shop_commerce_settings had no permissive SELECT policy, so buyers
--      received 0 rows at checkout and fell back to the "SHEPay" default.
--   3. razorpay-connect never checked the upsert error, so failures were silent.
--
-- The atomic_marketplace_checkout DB function already uses
--   WHEN routing_mode IN ('direct', 'seller_direct') THEN 'direct'
-- so 'direct' is the correct value — we just expand the constraint to allow it.

-- 1. Expand the payment_mode CHECK to also accept 'direct'
--    ('own_gateway' | 'shepay' | 'direct')
ALTER TABLE public.shop_commerce_settings
  DROP CONSTRAINT IF EXISTS shop_commerce_settings_payment_mode_check;

ALTER TABLE public.shop_commerce_settings
  ADD CONSTRAINT shop_commerce_settings_payment_mode_check
  CHECK (payment_mode IN ('own_gateway', 'shepay', 'direct'));

-- 2. Allow any authenticated or anonymous caller to read routing fields.
--    shop_commerce_settings holds only non-sensitive display / routing info;
--    real credentials live in shop_payment_accounts (service-role only).

ALTER TABLE public.shop_commerce_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "shop_commerce_settings_anon_read"          ON public.shop_commerce_settings;
DROP POLICY IF EXISTS "shop_commerce_settings_authenticated_read" ON public.shop_commerce_settings;
DROP POLICY IF EXISTS "shop_commerce_settings_public_read"        ON public.shop_commerce_settings;

-- Buyers, storefronts, and anonymous visitors all need to see payment routing.
CREATE POLICY "shop_commerce_settings_anon_read"
  ON public.shop_commerce_settings
  FOR SELECT TO anon
  USING (true);

CREATE POLICY "shop_commerce_settings_authenticated_read"
  ON public.shop_commerce_settings
  FOR SELECT TO authenticated
  USING (true);

-- 3. Backfill for every shop that already has a connected Razorpay account.
--    Upserts so re-running is always safe.
INSERT INTO public.shop_commerce_settings (
  shop_id,
  payment_connected,
  payment_mode,
  payment_gateway,
  payment_gateway_key_id,
  updated_at
)
SELECT
  spa.shop_id,
  true,
  'direct',
  'razorpay',
  spa.merchant_id,
  now()
FROM public.shop_payment_accounts spa
WHERE spa.provider = 'razorpay'
  AND spa.status   = 'connected'
ON CONFLICT (shop_id) DO UPDATE
  SET payment_connected      = true,
      payment_mode           = 'direct',
      payment_gateway        = 'razorpay',
      payment_gateway_key_id = EXCLUDED.payment_gateway_key_id,
      updated_at             = now();
