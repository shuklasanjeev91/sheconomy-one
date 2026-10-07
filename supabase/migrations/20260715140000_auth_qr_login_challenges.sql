-- Cross-device QR login: web creates a challenge; signed-in mobile approves; web redeems session.

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

CREATE TABLE IF NOT EXISTS public.auth_qr_login_challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  device_code text NOT NULL UNIQUE,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'consumed', 'expired')),
  redeem_token_hash text,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '2 minutes'),
  approved_at timestamptz,
  consumed_at timestamptz
);

CREATE INDEX IF NOT EXISTS auth_qr_login_challenges_status_idx
  ON public.auth_qr_login_challenges (status, expires_at);

ALTER TABLE public.auth_qr_login_challenges ENABLE ROW LEVEL SECURITY;

-- No direct table access; RPCs are SECURITY DEFINER.
DROP POLICY IF EXISTS auth_qr_login_challenges_deny_all ON public.auth_qr_login_challenges;
CREATE POLICY auth_qr_login_challenges_deny_all
  ON public.auth_qr_login_challenges
  FOR ALL TO authenticated, anon
  USING (false)
  WITH CHECK (false);

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

CREATE OR REPLACE FUNCTION public.approve_qr_login_challenge(p_device_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_row public.auth_qr_login_challenges%ROWTYPE;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_row
  FROM public.auth_qr_login_challenges
  WHERE device_code = p_device_code
  FOR UPDATE;

  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'Unknown login code';
  END IF;

  IF v_row.expires_at < now() OR v_row.status = 'expired' THEN
    UPDATE public.auth_qr_login_challenges SET status = 'expired' WHERE id = v_row.id;
    RAISE EXCEPTION 'Login code expired';
  END IF;

  IF v_row.status <> 'pending' THEN
    RAISE EXCEPTION 'Login code already used';
  END IF;

  UPDATE public.auth_qr_login_challenges
  SET status = 'approved',
      user_id = v_user_id,
      approved_at = now()
  WHERE id = v_row.id;

  RETURN jsonb_build_object('ok', true, 'id', v_row.id);
END;
$$;

CREATE OR REPLACE FUNCTION public.poll_qr_login_challenge(p_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.auth_qr_login_challenges%ROWTYPE;
BEGIN
  SELECT * INTO v_row
  FROM public.auth_qr_login_challenges
  WHERE id = p_id;

  IF v_row.id IS NULL THEN
    RETURN jsonb_build_object('status', 'unknown');
  END IF;

  IF v_row.expires_at < now() AND v_row.status = 'pending' THEN
    UPDATE public.auth_qr_login_challenges SET status = 'expired' WHERE id = v_row.id;
    RETURN jsonb_build_object('status', 'expired');
  END IF;

  RETURN jsonb_build_object(
    'status', v_row.status,
    'expires_at', v_row.expires_at,
    'user_id', v_row.user_id
  );
END;
$$;

-- Marks challenge consumed after Edge Function redeem. Service-role / SECURITY DEFINER only.
CREATE OR REPLACE FUNCTION public.mark_qr_login_challenge_consumed(p_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.auth_qr_login_challenges
  SET status = 'consumed', consumed_at = now()
  WHERE id = p_id
    AND status = 'approved';
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_qr_login_challenge() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.approve_qr_login_challenge(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.poll_qr_login_challenge(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mark_qr_login_challenge_consumed(uuid) TO service_role;
