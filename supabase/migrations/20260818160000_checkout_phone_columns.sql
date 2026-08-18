-- ─────────────────────────────────────────────────────────────────────────────
-- Give the checkout-verified number its own home on profiles.
--
-- `profiles.phone` is policed by check_unique_profile_contact(), which raises
-- 'This phone number is already registered with another account.' whenever the
-- number exists on another profile. Writing the OTP-verified number there
-- therefore failed for exactly the shoppers this flow was built for — people
-- who share a mobile with another account — which is the same dead end the
-- Supabase Auth uniqueness rule created.
--
-- checkout_phone is a delivery contact, not an account identity, so it is
-- deliberately exempt from the one-account-per-phone rule. profiles.phone
-- keeps its meaning and its uniqueness guarantee.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS checkout_phone text,
  ADD COLUMN IF NOT EXISTS checkout_phone_verified_at timestamptz;

COMMENT ON COLUMN public.profiles.checkout_phone IS
  'Mobile verified over the checkout-phone-otp edge function. May be shared with other profiles; never client-writable.';
COMMENT ON COLUMN public.profiles.checkout_phone_verified_at IS
  'When checkout_phone passed OTP verification. Drives checkout readiness.';

-- Owner RLS lets a member update any column on their own row, so these two
-- columns need the same forgery guard phone_verified already has: only the
-- service-role edge function (and platform admins) may write them.
CREATE OR REPLACE FUNCTION public.enforce_profile_phone_verified()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  claims jsonb := nullif(current_setting('request.jwt.claims', true), '')::jsonb;
  jwt_role text := coalesce(claims ->> 'role', '');
  caller uuid := auth.uid();
  privileged boolean := false;
  auth_confirmed_phone text;
BEGIN
  -- Service role (edge functions) is fully trusted; so are platform admins,
  -- who may manage verification manually.
  IF jwt_role = 'service_role' THEN
    privileged := true;
  ELSIF caller IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.profiles a WHERE a.id = caller AND a.role = 'A'
  ) THEN
    privileged := true;
  END IF;

  -- Silently pin the checkout columns for everyone else rather than raising,
  -- so ordinary profile edits that round-trip the whole row still succeed.
  IF NOT privileged THEN
    IF TG_OP = 'INSERT' THEN
      NEW.checkout_phone := NULL;
      NEW.checkout_phone_verified_at := NULL;
    ELSE
      NEW.checkout_phone := OLD.checkout_phone;
      NEW.checkout_phone_verified_at := OLD.checkout_phone_verified_at;
    END IF;
  END IF;

  IF privileged OR NEW.phone_verified IS NOT TRUE THEN
    RETURN NEW;
  END IF;

  -- Trusted if the profile phone matches the Auth-confirmed phone.
  SELECT CASE WHEN u.phone_confirmed_at IS NOT NULL THEN u.phone ELSE NULL END
    INTO auth_confirmed_phone
  FROM auth.users u
  WHERE u.id = NEW.id;

  IF auth_confirmed_phone IS NOT NULL
     AND regexp_replace(coalesce(NEW.phone, ''), '\D', '', 'g')
         = regexp_replace(auth_confirmed_phone, '\D', '', 'g') THEN
    RETURN NEW;
  END IF;

  -- Otherwise keep an existing verification only while the number is unchanged;
  -- any phone change by a non-privileged client drops the flag (prevents
  -- "verify A over OTP, then swap to B" from carrying the flag over).
  IF TG_OP = 'UPDATE'
     AND coalesce(OLD.phone_verified, false)
     AND regexp_replace(coalesce(NEW.phone, ''), '\D', '', 'g')
         = regexp_replace(coalesce(OLD.phone, ''), '\D', '', 'g') THEN
    RETURN NEW;
  END IF;

  NEW.phone_verified := false;
  RETURN NEW;
END;
$$;
