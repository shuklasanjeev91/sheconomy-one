-- Meeting chat system messages + private chat setting support.

ALTER TABLE public.meeting_chat_messages
  ADD COLUMN IF NOT EXISTS audience text,
  ADD COLUMN IF NOT EXISTS recipient_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS system_event_type text;

UPDATE public.meeting_chat_messages
SET audience = coalesce(audience, 'everyone')
WHERE audience IS NULL;

ALTER TABLE public.meeting_chat_messages
  ALTER COLUMN audience SET DEFAULT 'everyone';

DO $$
BEGIN
  ALTER TABLE public.meeting_chat_messages
    DROP CONSTRAINT IF EXISTS meeting_chat_messages_audience_check;
  ALTER TABLE public.meeting_chat_messages
    ADD CONSTRAINT meeting_chat_messages_audience_check
    CHECK (audience IN ('everyone', 'private', 'hosts', 'system'));
EXCEPTION WHEN others THEN
  NULL;
END $$;

CREATE OR REPLACE FUNCTION public.insert_meeting_system_chat(
  meeting_id_input uuid,
  message_text_input text,
  system_event_type_input text,
  actor_id_input uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  host_id_value uuid;
  sender_id_value uuid;
  message_id uuid;
BEGIN
  SELECT host_id INTO host_id_value FROM public.meetings WHERE id = meeting_id_input;
  IF host_id_value IS NULL THEN
    RETURN NULL;
  END IF;

  sender_id_value := coalesce(actor_id_input, host_id_value);

  INSERT INTO public.meeting_chat_messages (
    meeting_id,
    sender_id,
    message_text,
    message_type,
    audience,
    system_event_type,
    recipient_id
  ) VALUES (
    meeting_id_input,
    sender_id_value,
    message_text_input,
    'system',
    'system',
    system_event_type_input,
    NULL
  )
  RETURNING id INTO message_id;

  RETURN message_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.meeting_participant_system_chat()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  display_name_value text;
  event_type text;
  message_text text;
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.status IS NOT DISTINCT FROM NEW.status THEN
    RETURN NEW;
  END IF;

  SELECT coalesce(
    nullif(trim(NEW.display_name), ''),
    nullif(trim(p.full_name), ''),
    nullif(trim(p.username), ''),
    'Someone'
  )
  INTO display_name_value
  FROM public.profiles p
  WHERE p.id = NEW.user_id;

  display_name_value := coalesce(display_name_value, 'Someone');

  IF TG_OP = 'INSERT' AND NEW.status = 'admitted' THEN
    event_type := 'participant_joined';
    message_text := display_name_value || ' joined';
  ELSIF TG_OP = 'UPDATE' AND OLD.status = 'waiting' AND NEW.status = 'admitted' THEN
    event_type := 'participant_admitted';
    message_text := display_name_value || ' was admitted';
  ELSIF TG_OP = 'UPDATE'
        AND NEW.status = 'admitted'
        AND OLD.status IN ('left', 'rejected') THEN
    event_type := 'participant_joined';
    message_text := display_name_value || ' joined';
  ELSIF TG_OP = 'UPDATE' AND NEW.status = 'left' AND OLD.status = 'admitted' THEN
    event_type := 'participant_left';
    message_text := display_name_value || ' left';
  ELSE
    RETURN NEW;
  END IF;

  PERFORM public.insert_meeting_system_chat(
    NEW.meeting_id,
    message_text,
    event_type,
    NEW.user_id
  );

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_meeting_participant_system_chat ON public.meeting_participants;
CREATE TRIGGER trg_meeting_participant_system_chat
  AFTER INSERT OR UPDATE OF status ON public.meeting_participants
  FOR EACH ROW
  EXECUTE FUNCTION public.meeting_participant_system_chat();

CREATE OR REPLACE FUNCTION public.meeting_control_system_chat()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
BEGIN
  IF NEW.action = 'mute_all' THEN
    PERFORM public.insert_meeting_system_chat(
      NEW.meeting_id,
      'Host muted all participants',
      'mute_all',
      NEW.actor_id
    );
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_meeting_control_system_chat ON public.meeting_control_events;
CREATE TRIGGER trg_meeting_control_system_chat
  AFTER INSERT ON public.meeting_control_events
  FOR EACH ROW
  EXECUTE FUNCTION public.meeting_control_system_chat();

REVOKE ALL ON FUNCTION public.insert_meeting_system_chat(uuid, text, text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.insert_meeting_system_chat(uuid, text, text, uuid) TO service_role;
