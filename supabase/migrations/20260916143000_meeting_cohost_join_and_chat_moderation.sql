-- Co-host join + chat moderation hardening.
-- 1) Known co-hosts skip the waiting room on join / rejoin.
-- 2) Host/co-host can soft-delete meeting chat messages.

CREATE OR REPLACE FUNCTION public.join_meeting_participant(
  meeting_id_input uuid,
  session_id_input uuid
)
RETURNS public.meeting_participants
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  actor_id uuid := auth.uid();
  meeting_row public.meetings;
  existing_row public.meeting_participants;
  result_row public.meeting_participants;
  waiting_room_enabled boolean;
  room_locked boolean;
  next_status text;
  joined_time timestamptz;
  actor_is_co_host boolean := false;
BEGIN
  IF actor_id IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;
  SELECT * INTO meeting_row FROM public.meetings WHERE id = meeting_id_input;
  IF meeting_row.id IS NULL THEN RAISE EXCEPTION 'MEETING_NOT_FOUND'; END IF;
  IF meeting_row.status = 'cancelled'
     OR (meeting_row.status = 'ended' AND meeting_row.host_id <> actor_id) THEN
    RAISE EXCEPTION 'MEETING_CLOSED';
  END IF;

  SELECT * INTO existing_row FROM public.meeting_participants
  WHERE meeting_id = meeting_id_input AND user_id = actor_id FOR UPDATE;
  IF existing_row.status = 'removed' THEN RAISE EXCEPTION 'PARTICIPANT_REMOVED'; END IF;

  IF to_regclass('public.meeting_roles') IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1 FROM public.meeting_roles
      WHERE meeting_id = meeting_id_input
        AND user_id = actor_id
        AND role = 'co_host'
    ) INTO actor_is_co_host;
  END IF;

  SELECT is_locked INTO room_locked
  FROM public.meeting_moderation_settings WHERE meeting_id = meeting_id_input;
  IF coalesce(room_locked, false)
     AND meeting_row.host_id <> actor_id
     AND NOT actor_is_co_host
     AND existing_row.status IS DISTINCT FROM 'admitted' THEN
    RAISE EXCEPTION 'MEETING_LOCKED';
  END IF;

  waiting_room_enabled :=
    coalesce((meeting_row.security_settings->>'waitingRoom')::boolean, false)
    OR coalesce((meeting_row.security_settings->>'waiting_room')::boolean, false);
  next_status := CASE
    WHEN meeting_row.host_id = actor_id THEN 'admitted'
    WHEN actor_is_co_host THEN 'admitted'
    WHEN existing_row.status = 'admitted' THEN 'admitted'
    WHEN existing_row.status = 'left' AND existing_row.joined_at IS NOT NULL THEN 'admitted'
    WHEN waiting_room_enabled THEN 'waiting'
    ELSE 'admitted'
  END;
  joined_time := CASE WHEN next_status = 'admitted' THEN now() ELSE existing_row.joined_at END;

  INSERT INTO public.meeting_participants (
    meeting_id, user_id, is_host, status, joined_at, left_at,
    is_muted, is_video_off, session_id, last_seen_at
  ) VALUES (
    meeting_id_input, actor_id, meeting_row.host_id = actor_id, next_status,
    joined_time, NULL, false, false, session_id_input, now()
  )
  ON CONFLICT (meeting_id, user_id) DO UPDATE SET
    is_host = EXCLUDED.is_host,
    status = EXCLUDED.status,
    joined_at = CASE WHEN EXCLUDED.status = 'admitted'
      THEN coalesce(meeting_participants.joined_at, EXCLUDED.joined_at)
      ELSE meeting_participants.joined_at END,
    left_at = NULL,
    session_id = EXCLUDED.session_id,
    last_seen_at = now()
  RETURNING * INTO result_row;
  RETURN result_row;
END;
$function$;

CREATE OR REPLACE FUNCTION public.soft_delete_meeting_chat_message(
  message_id_input uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  actor_id uuid := auth.uid();
  message_row public.meeting_chat_messages;
BEGIN
  IF actor_id IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;

  SELECT * INTO message_row
  FROM public.meeting_chat_messages
  WHERE id = message_id_input
  FOR UPDATE;

  IF message_row.id IS NULL THEN RAISE EXCEPTION 'MESSAGE_NOT_FOUND'; END IF;
  IF message_row.is_deleted IS TRUE THEN RETURN; END IF;
  IF message_row.audience = 'system' THEN RAISE EXCEPTION 'SYSTEM_MESSAGE'; END IF;

  IF message_row.sender_id <> actor_id
     AND NOT public.is_meeting_host_or_co_host(message_row.meeting_id, actor_id) THEN
    RAISE EXCEPTION 'MODERATOR_REQUIRED';
  END IF;

  UPDATE public.meeting_chat_messages
  SET is_deleted = true
  WHERE id = message_id_input;
END;
$function$;

REVOKE ALL ON FUNCTION public.join_meeting_participant(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.soft_delete_meeting_chat_message(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.join_meeting_participant(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.soft_delete_meeting_chat_message(uuid) TO authenticated;
