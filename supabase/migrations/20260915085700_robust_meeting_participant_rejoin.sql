-- Robust meeting participant reconnects:
-- - one durable row per user/meeting
-- - session ids prevent stale tabs from marking a fresh session as left
-- - previously admitted participants remain admitted after refresh/reconnect
-- - host removals require explicit host authorization before rejoin

ALTER TABLE public.meeting_participants
  ADD COLUMN IF NOT EXISTS session_id uuid,
  ADD COLUMN IF NOT EXISTS last_seen_at timestamptz;

ALTER TABLE public.meeting_participants
  DROP CONSTRAINT IF EXISTS meeting_participants_status_check;

ALTER TABLE public.meeting_participants
  ADD CONSTRAINT meeting_participants_status_check
  CHECK (status = ANY (ARRAY['waiting', 'admitted', 'rejected', 'left', 'removed']));

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
  next_status text;
  joined_time timestamptz;
BEGIN
  IF actor_id IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED';
  END IF;

  SELECT *
  INTO meeting_row
  FROM public.meetings
  WHERE id = meeting_id_input;

  IF meeting_row.id IS NULL THEN
    RAISE EXCEPTION 'MEETING_NOT_FOUND';
  END IF;

  IF meeting_row.status = 'cancelled' THEN
    RAISE EXCEPTION 'MEETING_CANCELLED';
  END IF;

  SELECT *
  INTO existing_row
  FROM public.meeting_participants
  WHERE meeting_id = meeting_id_input
    AND user_id = actor_id
  FOR UPDATE;

  IF existing_row.status = 'removed' THEN
    RAISE EXCEPTION 'PARTICIPANT_REMOVED';
  END IF;

  waiting_room_enabled :=
    COALESCE((meeting_row.security_settings->>'waitingRoom')::boolean, false)
    OR COALESCE((meeting_row.security_settings->>'waiting_room')::boolean, false);

  next_status := CASE
    WHEN meeting_row.host_id = actor_id THEN 'admitted'
    WHEN existing_row.status = 'admitted' THEN 'admitted'
    WHEN existing_row.status = 'left' AND existing_row.joined_at IS NOT NULL THEN 'admitted'
    WHEN waiting_room_enabled THEN 'waiting'
    ELSE 'admitted'
  END;

  joined_time := CASE WHEN next_status = 'admitted' THEN now() ELSE existing_row.joined_at END;

  INSERT INTO public.meeting_participants (
    meeting_id,
    user_id,
    is_host,
    status,
    joined_at,
    left_at,
    is_muted,
    is_video_off,
    session_id,
    last_seen_at
  )
  VALUES (
    meeting_id_input,
    actor_id,
    meeting_row.host_id = actor_id,
    next_status,
    joined_time,
    NULL,
    false,
    false,
    session_id_input,
    now()
  )
  ON CONFLICT (meeting_id, user_id)
  DO UPDATE SET
    is_host = EXCLUDED.is_host,
    status = EXCLUDED.status,
    joined_at = CASE
      WHEN EXCLUDED.status = 'admitted' THEN COALESCE(meeting_participants.joined_at, EXCLUDED.joined_at)
      ELSE meeting_participants.joined_at
    END,
    left_at = NULL,
    session_id = EXCLUDED.session_id,
    last_seen_at = now()
  RETURNING * INTO result_row;

  RETURN result_row;
END;
$function$;

CREATE OR REPLACE FUNCTION public.leave_meeting_participant(
  meeting_id_input uuid,
  session_id_input uuid
)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
  UPDATE public.meeting_participants
  SET
    status = 'left',
    left_at = now(),
    last_seen_at = now()
  WHERE meeting_id = meeting_id_input
    AND user_id = auth.uid()
    AND session_id = session_id_input
    AND status <> 'removed';
$function$;

CREATE OR REPLACE FUNCTION public.update_meeting_participant_media(
  meeting_id_input uuid,
  session_id_input uuid,
  is_muted_input boolean DEFAULT NULL,
  is_video_off_input boolean DEFAULT NULL
)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
  UPDATE public.meeting_participants
  SET
    is_muted = COALESCE(is_muted_input, is_muted),
    is_video_off = COALESCE(is_video_off_input, is_video_off),
    last_seen_at = now()
  WHERE meeting_id = meeting_id_input
    AND user_id = auth.uid()
    AND session_id = session_id_input
    AND status = 'admitted';
$function$;

REVOKE ALL ON FUNCTION public.join_meeting_participant(uuid, uuid) FROM public, anon;
REVOKE ALL ON FUNCTION public.leave_meeting_participant(uuid, uuid) FROM public, anon;
REVOKE ALL ON FUNCTION public.update_meeting_participant_media(uuid, uuid, boolean, boolean) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.join_meeting_participant(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.leave_meeting_participant(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_meeting_participant_media(uuid, uuid, boolean, boolean) TO authenticated;

-- Participant lifecycle writes now go through the guarded functions above.
DROP POLICY IF EXISTS mp_insert ON public.meeting_participants;
DROP POLICY IF EXISTS mp_update ON public.meeting_participants;
DROP POLICY IF EXISTS mp_delete ON public.meeting_participants;

-- Keep older runtime builds able to join during OTA rollout, while a removed
-- row cannot update itself back into the room.
CREATE POLICY mp_insert ON public.meeting_participants
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND status <> 'removed'
  );

CREATE POLICY mp_update ON public.meeting_participants
  FOR UPDATE TO authenticated
  USING (
    (
      auth.uid() = user_id
      AND status <> 'removed'
    )
    OR EXISTS (
        SELECT 1
        FROM public.meetings
        WHERE meetings.id = meeting_participants.meeting_id
          AND meetings.host_id = auth.uid()
      )
  )
  WITH CHECK (
    (
      auth.uid() = user_id
      AND status <> 'removed'
    )
    OR EXISTS (
        SELECT 1
        FROM public.meetings
        WHERE meetings.id = meeting_participants.meeting_id
          AND meetings.host_id = auth.uid()
      )
  );

CREATE POLICY mp_delete ON public.meeting_participants
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.meetings
      WHERE meetings.id = meeting_participants.meeting_id
        AND meetings.host_id = auth.uid()
    )
  );
