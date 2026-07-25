-- Ensure offline devices can receive push for every product surface / tab.
-- 1) Add `push` to any active template that lacks it
-- 2) Clamp default_priority into chk_priority_range (1..5)
-- 3) Harden create_notification_from_template (user_id + priority clamp)

UPDATE public.notification_templates
SET
  default_channels = CASE
    WHEN default_channels IS NULL THEN ARRAY['in_app', 'push']::text[]
    WHEN NOT ('push' = ANY (default_channels)) THEN default_channels || ARRAY['push']::text[]
    ELSE default_channels
  END,
  default_priority = LEAST(GREATEST(COALESCE(default_priority, 3), 1), 5),
  updated_at = now()
WHERE is_active = true;

-- Incoming calls stay max priority within allowed range.
UPDATE public.notification_templates
SET
  default_priority = 5,
  default_channels = ARRAY['in_app', 'push']::text[],
  updated_at = now()
WHERE template_key = 'incoming_call';

CREATE OR REPLACE FUNCTION public.create_notification_from_template(
  p_template_key character varying,
  p_recipient_id uuid,
  p_variables jsonb DEFAULT '{}'::jsonb,
  p_context_type character varying DEFAULT NULL::character varying,
  p_context_id uuid DEFAULT NULL::uuid,
  p_parent_context_type character varying DEFAULT NULL::character varying,
  p_parent_context_id uuid DEFAULT NULL::uuid,
  p_override_channels text[] DEFAULT NULL::text[],
  p_override_priority integer DEFAULT NULL::integer,
  p_scheduled_for timestamp with time zone DEFAULT NULL::timestamp with time zone
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_template public.notification_templates%ROWTYPE;
  v_notification_id UUID;
  v_title TEXT;
  v_message TEXT;
  v_action_url TEXT;
  v_channels TEXT[];
  v_priority INTEGER;
  v_prefs RECORD;
BEGIN
  SELECT * INTO v_template
  FROM public.notification_templates
  WHERE template_key = p_template_key AND is_active = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Template not found: %', p_template_key;
  END IF;

  SELECT * INTO v_prefs
  FROM public.get_user_notification_preferences(
    p_recipient_id,
    v_template.platform,
    v_template.category,
    p_template_key
  );

  IF v_prefs.frequency = 'disabled' THEN
    RETURN NULL;
  END IF;

  v_title := public.substitute_template_variables(v_template.title_template, p_variables);
  v_message := public.substitute_template_variables(v_template.message_template, p_variables);

  IF v_template.action_url_template IS NOT NULL THEN
    v_action_url := public.substitute_template_variables(v_template.action_url_template, p_variables);
  END IF;

  v_channels := COALESCE(p_override_channels, v_template.default_channels);
  v_priority := LEAST(GREATEST(COALESCE(p_override_priority, v_template.default_priority, 3), 1), 5);

  -- Offline delivery depends on push remaining enabled unless the user opted out.
  IF COALESCE(v_prefs.in_app_enabled, true) IS NOT TRUE THEN
    v_channels := array_remove(v_channels, 'in_app');
  END IF;
  IF COALESCE(v_prefs.email_enabled, true) IS NOT TRUE THEN
    v_channels := array_remove(v_channels, 'email');
  END IF;
  IF COALESCE(v_prefs.sms_enabled, false) IS NOT TRUE THEN
    v_channels := array_remove(v_channels, 'sms');
  END IF;
  IF COALESCE(v_prefs.push_enabled, true) IS NOT TRUE THEN
    v_channels := array_remove(v_channels, 'push');
  END IF;
  IF COALESCE(v_prefs.whatsapp_enabled, false) IS NOT TRUE THEN
    v_channels := array_remove(v_channels, 'whatsapp');
  END IF;

  IF array_length(v_channels, 1) IS NULL THEN
    RETURN NULL;
  END IF;

  INSERT INTO public.notifications (
    recipient_id,
    user_id,
    context_type,
    context_id,
    parent_context_type,
    parent_context_id,
    type,
    template_id,
    category,
    title,
    message,
    data,
    action_url,
    priority,
    channels,
    platform,
    scheduled_for
  ) VALUES (
    p_recipient_id,
    p_recipient_id,
    p_context_type,
    p_context_id,
    p_parent_context_type,
    p_parent_context_id,
    p_template_key,
    v_template.id,
    v_template.category,
    v_title,
    v_message,
    p_variables,
    v_action_url,
    v_priority,
    v_channels,
    v_template.platform,
    p_scheduled_for
  ) RETURNING id INTO v_notification_id;

  INSERT INTO public.notification_events (
    notification_id,
    event_type,
    channel,
    status
  ) VALUES (
    v_notification_id,
    'created',
    'system',
    'success'
  );

  RETURN v_notification_id;
END;
$$;
