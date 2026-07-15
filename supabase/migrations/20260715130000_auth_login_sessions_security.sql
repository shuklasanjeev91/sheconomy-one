-- Multi-device login sessions + suspicious-login alerts for SHEconomy Auth.

CREATE TABLE IF NOT EXISTS public.auth_login_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  auth_session_id text,
  device_id text NOT NULL,
  device_label text,
  platform text NOT NULL DEFAULT 'web',
  user_agent text,
  ip text,
  geo jsonb,
  is_suspicious boolean NOT NULL DEFAULT false,
  revoked_at timestamptz,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, device_id)
);

CREATE INDEX IF NOT EXISTS auth_login_sessions_user_active_idx
  ON public.auth_login_sessions (user_id, revoked_at, last_seen_at DESC);

ALTER TABLE public.auth_login_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS auth_login_sessions_select_own ON public.auth_login_sessions;
CREATE POLICY auth_login_sessions_select_own
  ON public.auth_login_sessions
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS auth_login_sessions_update_own ON public.auth_login_sessions;
CREATE POLICY auth_login_sessions_update_own
  ON public.auth_login_sessions
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

INSERT INTO public.notification_templates (
  template_key, platform, category, title_template, message_template,
  email_subject_template, email_body_template, sms_template,
  push_title_template, push_body_template, whatsapp_template,
  action_url_template, default_channels, default_priority, is_active
)
VALUES (
  'security_login_alert', 'app', 'security',
  'New sign-in to your account',
  'We noticed a sign-in from {{device_label}} ({{platform}}). If this wasn''t you, sign out other devices.',
  'New sign-in to your SHEconomy account',
  '<p>We noticed a sign-in from <strong>{{device_label}}</strong> ({{platform}}).</p><p>If this wasn''t you, <a href="{{action_url}}">review your sessions</a> and sign out other devices.</p>',
  'SHEconomy security: new sign-in from {{device_label}}. {{action_url}}',
  'New sign-in',
  '{{device_label}} just signed in to your account',
  'Security alert: new SHEconomy sign-in from {{device_label}}. {{action_url}}',
  '{{action_url}}',
  ARRAY['in_app', 'email', 'push'], 8, true
)
ON CONFLICT (template_key) DO UPDATE SET
  title_template = EXCLUDED.title_template,
  message_template = EXCLUDED.message_template,
  email_subject_template = EXCLUDED.email_subject_template,
  email_body_template = EXCLUDED.email_body_template,
  sms_template = EXCLUDED.sms_template,
  push_title_template = EXCLUDED.push_title_template,
  push_body_template = EXCLUDED.push_body_template,
  whatsapp_template = EXCLUDED.whatsapp_template,
  action_url_template = EXCLUDED.action_url_template,
  default_channels = EXCLUDED.default_channels,
  default_priority = EXCLUDED.default_priority,
  is_active = true,
  updated_at = now();

CREATE OR REPLACE FUNCTION public.record_auth_login_session(
  p_device_id text,
  p_device_label text DEFAULT NULL,
  p_platform text DEFAULT 'web',
  p_user_agent text DEFAULT NULL,
  p_auth_session_id text DEFAULT NULL,
  p_provider text DEFAULT NULL,
  p_ip text DEFAULT NULL,
  p_geo jsonb DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_existing public.auth_login_sessions%ROWTYPE;
  v_row public.auth_login_sessions%ROWTYPE;
  v_is_suspicious boolean := false;
  v_known_count integer := 0;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_device_id IS NULL OR length(trim(p_device_id)) = 0 THEN
    RAISE EXCEPTION 'device_id required';
  END IF;

  SELECT * INTO v_existing
  FROM public.auth_login_sessions
  WHERE user_id = v_user_id AND device_id = p_device_id
  LIMIT 1;

  SELECT count(*) INTO v_known_count
  FROM public.auth_login_sessions
  WHERE user_id = v_user_id
    AND revoked_at IS NULL
    AND device_id <> p_device_id;

  -- Unknown device while other active sessions exist → suspicious.
  IF v_existing.id IS NULL AND v_known_count > 0 THEN
    v_is_suspicious := true;
  ELSIF v_existing.id IS NOT NULL
        AND p_ip IS NOT NULL
        AND v_existing.ip IS NOT NULL
        AND split_part(p_ip, '.', 1) || '.' || split_part(p_ip, '.', 2)
            IS DISTINCT FROM
            split_part(v_existing.ip, '.', 1) || '.' || split_part(v_existing.ip, '.', 2)
        AND v_known_count > 0 THEN
    v_is_suspicious := true;
  END IF;

  INSERT INTO public.auth_login_sessions AS s (
    user_id, auth_session_id, device_id, device_label, platform,
    user_agent, ip, geo, is_suspicious, revoked_at, last_seen_at
  )
  VALUES (
    v_user_id, p_auth_session_id, p_device_id, p_device_label, coalesce(p_platform, 'web'),
    p_user_agent, p_ip, p_geo, v_is_suspicious, NULL, now()
  )
  ON CONFLICT (user_id, device_id) DO UPDATE SET
    auth_session_id = coalesce(EXCLUDED.auth_session_id, s.auth_session_id),
    device_label = coalesce(EXCLUDED.device_label, s.device_label),
    platform = coalesce(EXCLUDED.platform, s.platform),
    user_agent = coalesce(EXCLUDED.user_agent, s.user_agent),
    ip = coalesce(EXCLUDED.ip, s.ip),
    geo = coalesce(EXCLUDED.geo, s.geo),
    is_suspicious = CASE WHEN EXCLUDED.is_suspicious THEN true ELSE s.is_suspicious END,
    revoked_at = NULL,
    last_seen_at = now()
  RETURNING * INTO v_row;

  BEGIN
    PERFORM public.update_login_info(
      user_id := v_user_id,
      ip_address := p_ip,
      device_information := jsonb_build_object(
        'device_id', p_device_id,
        'device_label', p_device_label,
        'platform', p_platform,
        'user_agent', p_user_agent,
        'provider', p_provider
      ),
      location_info := p_geo
    );
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  INSERT INTO public.auth_audit_logs (action, user_id, identifier, ip, provider, user_agent, meta)
  VALUES (
    CASE WHEN v_is_suspicious THEN 'login_suspicious' ELSE 'login_success' END,
    v_user_id,
    p_device_id,
    p_ip,
    p_provider,
    p_user_agent,
    jsonb_build_object(
      'device_label', p_device_label,
      'platform', p_platform,
      'session_id', v_row.id,
      'is_suspicious', v_is_suspicious
    )
  );

  IF v_is_suspicious THEN
    BEGIN
      PERFORM public.create_notification_from_template(
        p_recipient_id := v_user_id,
        p_template_key := 'security_login_alert',
        p_variables := jsonb_build_object(
          'device_label', coalesce(p_device_label, 'a new device'),
          'platform', coalesce(p_platform, 'web'),
          'action_url', '/settings/security'
        ),
        p_context_type := 'auth_login_session',
        p_context_id := v_row.id::text
      );
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END IF;

  RETURN jsonb_build_object(
    'session', to_jsonb(v_row),
    'is_suspicious', v_is_suspicious
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.revoke_auth_login_session(p_session_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.auth_login_sessions
  SET revoked_at = now()
  WHERE id = p_session_id
    AND user_id = auth.uid()
    AND revoked_at IS NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.revoke_other_auth_login_sessions(p_keep_device_id text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.auth_login_sessions
  SET revoked_at = now()
  WHERE user_id = auth.uid()
    AND revoked_at IS NULL
    AND device_id IS DISTINCT FROM p_keep_device_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.revoke_all_auth_login_sessions()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.auth_login_sessions
  SET revoked_at = now()
  WHERE user_id = auth.uid()
    AND revoked_at IS NULL;
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_auth_login_session(
  text, text, text, text, text, text, text, jsonb
) TO authenticated;

GRANT EXECUTE ON FUNCTION public.revoke_auth_login_session(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_other_auth_login_sessions(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_all_auth_login_sessions() TO authenticated;
