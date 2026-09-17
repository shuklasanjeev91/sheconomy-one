-- Host leave: transfer to co-host, else any eligible admitted participant,
-- otherwise end the meeting (respecting host_leave_behavior).

CREATE OR REPLACE FUNCTION public.leave_meeting_participant(
  meeting_id_input uuid,
  session_id_input uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  actor_id uuid := auth.uid();
  actor_role text := public.meeting_actor_role(meeting_id_input);
  leave_behavior text;
  next_host uuid;
BEGIN
  IF actor_id IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;

  IF actor_role = 'host' THEN
    SELECT host_leave_behavior INTO leave_behavior
    FROM public.meeting_moderation_settings
    WHERE meeting_id = meeting_id_input;

    leave_behavior := coalesce(leave_behavior, 'end');

    IF leave_behavior = 'transfer_to_co_host' THEN
      -- Prefer an admitted co-host.
      SELECT mr.user_id INTO next_host
      FROM public.meeting_roles mr
      JOIN public.meeting_participants mp
        ON mp.meeting_id = mr.meeting_id AND mp.user_id = mr.user_id
      WHERE mr.meeting_id = meeting_id_input
        AND mr.role = 'co_host'
        AND mp.status = 'admitted'
        AND mr.user_id <> actor_id
      ORDER BY mr.assigned_at
      LIMIT 1;

      -- Otherwise assign any other admitted participant as the new host.
      IF next_host IS NULL THEN
        SELECT mp.user_id INTO next_host
        FROM public.meeting_participants mp
        WHERE mp.meeting_id = meeting_id_input
          AND mp.status = 'admitted'
          AND mp.user_id <> actor_id
        ORDER BY mp.joined_at NULLS LAST, mp.created_at NULLS LAST
        LIMIT 1;
      END IF;
    END IF;

    IF next_host IS NOT NULL THEN
      PERFORM public.transfer_meeting_host(meeting_id_input, next_host);
    ELSE
      -- No successor (or behavior is "end") — end for everyone.
      PERFORM public.end_meeting_secure(meeting_id_input);
      RETURN;
    END IF;
  END IF;

  UPDATE public.meeting_participants
  SET status = 'left', left_at = now(), last_seen_at = now()
  WHERE meeting_id = meeting_id_input
    AND user_id = actor_id
    AND session_id = session_id_input
    AND status <> 'removed';
END;
$function$;
