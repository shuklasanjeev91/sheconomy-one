-- Incoming call push: ring devices when the app is backgrounded / killed.
-- Also fire dispatch immediately for high-priority notifications (calls).
-- priority must be 1..5 (chk_priority_range). Use max = 5 for calls.

INSERT INTO public.notification_templates (
  template_key, platform, category, title_template, message_template,
  email_subject_template, email_body_template, sms_template,
  push_title_template, push_body_template, whatsapp_template,
  action_url_template, default_channels, default_priority, is_active
)
VALUES (
  'incoming_call', 'chat', 'calls',
  '{{caller_name}} is calling…',
  '{{call_label}}',
  NULL, NULL, NULL,
  '{{caller_name}} is calling…',
  '{{call_label}} · Tap to answer',
  NULL,
  '/chat',
  ARRAY['in_app', 'push']::text[],
  5,
  true
)
ON CONFLICT (template_key) DO UPDATE SET
  platform = EXCLUDED.platform,
  category = EXCLUDED.category,
  title_template = EXCLUDED.title_template,
  message_template = EXCLUDED.message_template,
  push_title_template = EXCLUDED.push_title_template,
  push_body_template = EXCLUDED.push_body_template,
  action_url_template = EXCLUDED.action_url_template,
  default_channels = EXCLUDED.default_channels,
  default_priority = EXCLUDED.default_priority,
  is_active = true,
  updated_at = now();

CREATE OR REPLACE FUNCTION public.notify_incoming_call()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_name text;
  call_label text;
  action_path text;
BEGIN
  IF NEW.status IS DISTINCT FROM 'ringing' THEN
    RETURN NEW;
  END IF;
  IF NEW.meeting_code IS NULL OR length(trim(NEW.meeting_code)) = 0 THEN
    RETURN NEW;
  END IF;

  SELECT coalesce(nullif(trim(full_name), ''), nullif(trim(username), ''), 'Someone')
    INTO caller_name
  FROM public.profiles
  WHERE id = NEW.caller_id;

  caller_name := coalesce(caller_name, 'Someone');
  call_label := CASE
    WHEN lower(coalesce(NEW.call_type::text, 'audio')) = 'video' THEN 'Incoming video call'
    ELSE 'Incoming voice call'
  END;

  action_path := '/chat/call/' || NEW.meeting_code
    || '?type=' || CASE WHEN lower(coalesce(NEW.call_type::text, 'audio')) = 'video' THEN 'video' ELSE 'audio' END
    || '&callId=' || NEW.id::text
    || '&ring=1';

  INSERT INTO public.notifications (
    recipient_id,
    user_id,
    context_type,
    context_id,
    type,
    category,
    title,
    message,
    data,
    action_url,
    priority,
    channels,
    platform,
    created_by
  ) VALUES (
    NEW.receiver_id,
    NEW.receiver_id,
    'call',
    NEW.id,
    'incoming_call',
    'calls',
    caller_name || ' is calling…',
    call_label,
    jsonb_build_object(
      'caller_name', caller_name,
      'call_label', call_label,
      'call_id', NEW.id::text,
      'meeting_code', NEW.meeting_code,
      'call_type', coalesce(NEW.call_type::text, 'audio'),
      'notification_kind', 'incoming_call',
      'action_url', action_path
    ),
    action_path,
    5,
    ARRAY['in_app', 'push']::text[],
    'chat',
    NEW.caller_id
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING '[notify_incoming_call] %', SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_incoming_call ON public.calls;
CREATE TRIGGER trg_notify_incoming_call
  AFTER INSERT ON public.calls
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_incoming_call();

-- Immediately invoke the dispatcher for high-priority / call notifications.
CREATE OR REPLACE FUNCTION public.dispatch_notification_immediately()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_secret text;
BEGIN
  IF NEW.recipient_id IS NULL THEN
    RETURN NEW;
  END IF;
  IF NOT (
    NEW.type = 'incoming_call'
    OR coalesce(NEW.priority, 0) >= 5
  ) THEN
    RETURN NEW;
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM unnest(COALESCE(NEW.channels, ARRAY[]::text[])) AS c
    WHERE lower(c) = 'push'
  ) THEN
    RETURN NEW;
  END IF;

  BEGIN
    SELECT decrypted_secret INTO v_secret
    FROM vault.decrypted_secrets
    WHERE name = 'notification_cron_secret'
    LIMIT 1;

    IF v_secret IS NULL OR length(trim(v_secret)) = 0 THEN
      RETURN NEW;
    END IF;

    PERFORM net.http_post(
      url := 'https://zsaqrrzwygzwrlzgymxk.supabase.co/functions/v1/dispatch-notifications',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-cron-secret', v_secret
      ),
      body := jsonb_build_object('limit', 20, 'notification_id', NEW.id)
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING '[dispatch_notification_immediately] %', SQLERRM;
  END;

  RETURN NEW;
END;
$$;
