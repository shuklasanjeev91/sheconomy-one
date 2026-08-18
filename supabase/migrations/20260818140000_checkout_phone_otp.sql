-- ─────────────────────────────────────────────────────────────────────────────
-- Checkout phone verification (decoupled from Supabase Auth)
--
-- Context: checkout used to verify the shopper's mobile by binding it to the
-- auth user (updateUser({ phone })). Supabase enforces one confirmed phone per
-- auth.users row globally, so a number already confirmed on another account is
-- rejected before any SMS is sent, dead-ending checkout.
--
-- This table backs our own OTP: the checkout-phone-otp edge function (service
-- role) stores a hashed code here, then on success marks profiles.phone_verified
-- for the current user. A contact phone can be shared across accounts, so this
-- never touches auth and imposes no global uniqueness.
--
-- Access: service role only. RLS is enabled with no anon/authenticated policies,
-- so the codes are unreadable to clients (deny-by-default).
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.checkout_phone_verifications (
  user_id      uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  phone        text NOT NULL,
  code_hash    text NOT NULL,
  expires_at   timestamptz NOT NULL,
  attempts     integer NOT NULL DEFAULT 0,
  last_sent_at timestamptz NOT NULL DEFAULT now(),
  verified_at  timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.checkout_phone_verifications ENABLE ROW LEVEL SECURITY;

-- No policies on purpose: only the service-role edge function may read/write.

COMMENT ON TABLE public.checkout_phone_verifications IS
  'Hashed checkout mobile OTPs. Written only by the checkout-phone-otp edge function (service role); RLS denies all client access.';
