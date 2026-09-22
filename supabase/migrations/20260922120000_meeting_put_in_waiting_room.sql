-- Zoom-style: host/co-host can send an admitted participant back to the waiting room.

ALTER TABLE public.meeting_control_events
  DROP CONSTRAINT IF EXISTS meeting_control_events_action_check;

ALTER TABLE public.meeting_control_events
  ADD CONSTRAINT meeting_control_events_action_check
  CHECK (
    action IN (
      'request_mute',
      'force_mute',
      'ask_to_unmute',
      'stop_video',
      'mute_all',
      'ask_all_to_mute',
      'ask_all_to_unmute',
      'removed',
      'remove_all_except_host',
      'meeting_ended',
      'put_in_waiting_room'
    )
  );

CREATE OR REPLACE FUNCTION public.moderate_meeting_participants(
  meeting_id_input uuid,
  action_input text,
  target_user_id_input uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  actor_id uuid := auth.uid();
  actor_role text := public.meeting_actor_role(meeting_id_input);
  event_id uuid;
BEGIN
  IF actor_role NOT IN ('host', 'co_host') THEN RAISE EXCEPTION 'MODERATOR_REQUIRED'; END IF;
  IF action_input NOT IN (
    'request_mute', 'force_mute', 'ask_to_unmute', 'stop_video',
    'mute_all', 'ask_all_to_mute', 'ask_all_to_unmute',
    'remove', 'remove_all_except_host', 'put_in_waiting_room'
  ) THEN RAISE EXCEPTION 'INVALID_ACTION'; END IF;

  IF action_input IN (
    'request_mute', 'force_mute', 'ask_to_unmute', 'stop_video',
    'remove', 'put_in_waiting_room'
  ) THEN
    IF target_user_id_input IS NULL OR target_user_id_input = actor_id THEN
      RAISE EXCEPTION 'INVALID_TARGET';
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM public.meeting_participants
      WHERE meeting_id = meeting_id_input
        AND user_id = target_user_id_input
        AND status = 'admitted'
    ) THEN RAISE EXCEPTION 'TARGET_NOT_ADMITTED'; END IF;
    IF actor_role = 'co_host'
       AND (SELECT role FROM public.meeting_roles
            WHERE meeting_id = meeting_id_input AND user_id = target_user_id_input) IN ('host', 'co_host')
    THEN RAISE EXCEPTION 'COHOST_CANNOT_MODERATE_PEER'; END IF;
  END IF;

  IF action_input IN ('mute_all', 'remove_all_except_host') AND actor_role <> 'host' THEN
    RAISE EXCEPTION 'HOST_REQUIRED';
  END IF;

  IF action_input = 'force_mute' THEN
    UPDATE public.meeting_participants
    SET is_muted = true, last_seen_at = now()
    WHERE meeting_id = meeting_id_input
      AND user_id = target_user_id_input
      AND status = 'admitted';
  ELSIF action_input = 'stop_video' THEN
    UPDATE public.meeting_participants
    SET is_video_off = true, last_seen_at = now()
    WHERE meeting_id = meeting_id_input
      AND user_id = target_user_id_input
      AND status = 'admitted';
  ELSIF action_input = 'mute_all' THEN
    UPDATE public.meeting_participants
    SET is_muted = true, last_seen_at = now()
    WHERE meeting_id = meeting_id_input
      AND status = 'admitted'
      AND user_id <> actor_id;
  ELSIF action_input = 'remove' THEN
    UPDATE public.meeting_participants
    SET status = 'removed', left_at = now(), reviewed_at = now(), reviewed_by = actor_id
    WHERE meeting_id = meeting_id_input
      AND user_id = target_user_id_input
      AND status = 'admitted';
  ELSIF action_input = 'put_in_waiting_room' THEN
    UPDATE public.meeting_participants
    SET
      status = 'waiting',
      left_at = NULL,
      reviewed_at = NULL,
      reviewed_by = NULL,
      session_id = NULL,
      last_seen_at = now()
    WHERE meeting_id = meeting_id_input
      AND user_id = target_user_id_input
      AND status = 'admitted';
  ELSIF action_input = 'remove_all_except_host' THEN
    UPDATE public.meeting_participants
    SET status = 'removed', left_at = now(), reviewed_at = now(), reviewed_by = actor_id
    WHERE meeting_id = meeting_id_input
      AND status = 'admitted'
      AND user_id <> actor_id
      AND user_id NOT IN (
        SELECT user_id FROM public.meeting_roles
        WHERE meeting_id = meeting_id_input AND role = 'host'
      );
  END IF;

  INSERT INTO public.meeting_control_events (meeting_id, actor_id, target_user_id, action)
  VALUES (
    meeting_id_input,
    actor_id,
    CASE
      WHEN action_input IN (
        'request_mute', 'force_mute', 'ask_to_unmute', 'stop_video',
        'remove', 'put_in_waiting_room'
      )
        THEN target_user_id_input
      ELSE NULL
    END,
    CASE
      WHEN action_input = 'remove' THEN 'removed'
      ELSE action_input
    END
  )
  RETURNING id INTO event_id;

  RETURN event_id;
END;
$function$;
