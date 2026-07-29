-- Harden incoming-call notification creation (user_id + created_by + enum casts).
-- Applied remotely as fix_incoming_call_notify_trigger; kept here for local parity.

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
