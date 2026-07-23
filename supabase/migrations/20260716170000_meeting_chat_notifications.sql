-- Notify admitted Co-Work participants when someone posts in meeting chat.

INSERT INTO public.notification_templates (
  template_key, platform, category, title_template, message_template,
  email_subject_template, email_body_template, sms_template,
  push_title_template, push_body_template, whatsapp_template,
  action_url_template, default_channels, default_priority, is_active
)
VALUES
(
  'meeting_chat_message', 'cowork', 'co-work',
  '{{sender_name}} in {{meeting_title}}',
  '{{message_preview}}',
  NULL,
  NULL,
  NULL,
  '{{sender_name}} in meeting',
  '{{message_preview}}',
  NULL,
  '{{action_url}}',
  ARRAY['in_app', 'push']::text[],
  3,
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

CREATE OR REPLACE FUNCTION public.notify_meeting_chat_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_meeting record;
  v_sender_name text;
  v_preview text;
  v_action_url text;
  v_recipient uuid;
BEGIN
  IF NEW.is_deleted IS TRUE THEN
    RETURN NEW;
  END IF;

  IF NEW.message_type IS DISTINCT FROM 'text' AND NEW.message_type IS DISTINCT FROM 'question' THEN
    RETURN NEW;
  END IF;

  SELECT id, title, meeting_code
  INTO v_meeting
  FROM public.meetings
  WHERE id = NEW.meeting_id;

  IF v_meeting.id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(NULLIF(full_name, ''), NULLIF(username, ''), 'Someone')
  INTO v_sender_name
  FROM public.profiles
  WHERE id = NEW.sender_id;

  v_preview := left(regexp_replace(coalesce(NEW.message_text, ''), '\s+', ' ', 'g'), 120);
  IF v_preview IS NULL OR length(trim(v_preview)) = 0 THEN
    RETURN NEW;
  END IF;

  v_action_url := '/co-work/meeting/' || v_meeting.meeting_code || '/live';

  -- status=admitted is enough; leave() sets status to 'left'.
  -- Do not require left_at IS NULL (some rows are inconsistently admitted+left_at).
  FOR v_recipient IN
    SELECT DISTINCT mp.user_id
    FROM public.meeting_participants mp
    WHERE mp.meeting_id = NEW.meeting_id
      AND mp.user_id IS DISTINCT FROM NEW.sender_id
      AND mp.status = 'admitted'
  LOOP
    PERFORM public.create_notification_from_template(
      p_template_key := 'meeting_chat_message',
      p_recipient_id := v_recipient,
      p_variables := jsonb_build_object(
        'sender_name', coalesce(v_sender_name, 'Someone'),
        'meeting_title', coalesce(v_meeting.title, 'Co-Work'),
        'message_preview', v_preview,
        'action_url', v_action_url,
        'meeting_id', NEW.meeting_id::text,
        'message_id', NEW.id::text
      ),
      p_context_type := 'meeting',
      p_context_id := NEW.meeting_id,
      p_parent_context_type := NULL,
      p_parent_context_id := NULL,
      p_override_channels := ARRAY['push']::text[],
      p_override_priority := 3,
      p_scheduled_for := NULL
    );
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_meeting_chat_message ON public.meeting_chat_messages;
CREATE TRIGGER trg_notify_meeting_chat_message
  AFTER INSERT ON public.meeting_chat_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_meeting_chat_message();
