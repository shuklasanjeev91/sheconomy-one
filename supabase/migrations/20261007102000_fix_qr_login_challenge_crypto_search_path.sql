-- Fix QR login challenge generation when pgcrypto lives in the `extensions` schema.

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

CREATE OR REPLACE FUNCTION public.create_qr_login_challenge()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_code text;
  v_id uuid;
  v_expires timestamptz := now() + interval '2 minutes';
BEGIN
  -- Expire stale pending rows opportunistically.
  UPDATE public.auth_qr_login_challenges
  SET status = 'expired'
  WHERE status = 'pending' AND expires_at < now();

  v_code := encode(extensions.gen_random_bytes(16), 'hex');
  INSERT INTO public.auth_qr_login_challenges (device_code, expires_at)
  VALUES (v_code, v_expires)
  RETURNING id INTO v_id;

  RETURN jsonb_build_object(
    'id', v_id,
    'device_code', v_code,
    'expires_at', v_expires
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_qr_login_challenge() TO anon, authenticated;
