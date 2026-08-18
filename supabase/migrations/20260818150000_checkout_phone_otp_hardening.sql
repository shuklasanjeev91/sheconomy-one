-- ─────────────────────────────────────────────────────────────────────────────
-- Harden checkout phone verification
--
-- 1. Per-user daily send counter columns (SMS cost / harassment mitigation).
-- 2. Guard trigger so a client can never forge profiles.phone_verified.
--
-- Since checkout readiness now trusts profiles.phone_verified, and owner RLS
-- lets a member update any column on their own row, a member could otherwise
-- PATCH phone_verified = true and skip the OTP. This trigger only lets a
-- non-privileged client set phone_verified = true when it matches the phone
-- Supabase Auth has actually confirmed. The service-role edge function and
-- platform admins remain trusted.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.checkout_phone_verifications
  ADD COLUMN IF NOT EXISTS send_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS send_window_started_at timestamptz;

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
  auth_confirmed_phone text;
BEGIN
  -- Nothing to guard unless the flag is being set true.
  IF NEW.phone_verified IS NOT TRUE THEN
    RETURN NEW;
  END IF;

  -- Service role (edge functions) is fully trusted.
  IF jwt_role = 'service_role' THEN
    RETURN NEW;
  END IF;

  -- Platform admins may manage verification manually.
  IF caller IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.profiles a WHERE a.id = caller AND a.role = 'A'
  ) THEN
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

DROP TRIGGER IF EXISTS trg_enforce_profile_phone_verified ON public.profiles;
CREATE TRIGGER trg_enforce_profile_phone_verified
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.enforce_profile_phone_verified();
