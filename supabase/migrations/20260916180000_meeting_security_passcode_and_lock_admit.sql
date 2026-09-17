-- Meeting security: passcode verify RPC + block admit-while-locked.

CREATE OR REPLACE FUNCTION public.verify_meeting_passcode(
  meeting_id_input uuid,
  passcode_input text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  actor_id uuid := auth.uid();
  settings jsonb;
  stored text;
  require_code boolean;
BEGIN
  IF actor_id IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;

  SELECT security_settings INTO settings
  FROM public.meetings
  WHERE id = meeting_id_input;

  IF settings IS NULL THEN
    RAISE EXCEPTION 'MEETING_NOT_FOUND';
  END IF;

  stored := nullif(btrim(coalesce(settings->>'passcode', '')), '');
  require_code := coalesce((settings->>'requirePasscode')::boolean, false)
    OR coalesce((settings->>'require_passcode')::boolean, false)
    OR stored IS NOT NULL;

  IF NOT require_code THEN
    RETURN true;
  END IF;

  -- Hosts always pass (they own the room).
  IF public.meeting_actor_role(meeting_id_input) = 'host' THEN
    RETURN true;
  END IF;

  IF stored IS NULL THEN
    RETURN NOT require_code;
  END IF;

  RETURN stored = btrim(coalesce(passcode_input, ''));
END;
$function$;

REVOKE ALL ON FUNCTION public.verify_meeting_passcode(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.verify_meeting_passcode(uuid, text) TO authenticated;

-- Admit must respect lock: locked meetings cannot accept new participants.
CREATE OR REPLACE FUNCTION public.review_meeting_participant(
  participant_id_input uuid,
  decision_input text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  actor_id uuid := auth.uid();
  participant_row public.meeting_participants;
  room_locked boolean := false;
BEGIN
  SELECT * INTO participant_row
  FROM public.meeting_participants
  WHERE id = participant_id_input
  FOR UPDATE;
  IF participant_row.id IS NULL THEN RAISE EXCEPTION 'PARTICIPANT_NOT_FOUND'; END IF;
  IF public.meeting_actor_role(participant_row.meeting_id) NOT IN ('host', 'co_host') THEN
    RAISE EXCEPTION 'MODERATOR_REQUIRED';
  END IF;
  IF decision_input NOT IN ('admit', 'reject', 'allow_rejoin') THEN
    RAISE EXCEPTION 'INVALID_DECISION';
  END IF;

  IF decision_input = 'admit' THEN
    SELECT coalesce(is_locked, false) INTO room_locked
    FROM public.meeting_moderation_settings
    WHERE meeting_id = participant_row.meeting_id;
    IF coalesce(room_locked, false) THEN
      RAISE EXCEPTION 'MEETING_LOCKED';
    END IF;
  END IF;

  UPDATE public.meeting_participants
  SET status = CASE
      WHEN decision_input = 'admit' THEN 'admitted'
      WHEN decision_input = 'reject' THEN 'rejected'
      ELSE 'waiting'
    END,
    joined_at = CASE WHEN decision_input = 'admit' THEN now() ELSE joined_at END,
    left_at = CASE WHEN decision_input = 'reject' THEN now() ELSE NULL END,
    reviewed_at = CASE WHEN decision_input = 'allow_rejoin' THEN NULL ELSE now() END,
    reviewed_by = CASE WHEN decision_input = 'allow_rejoin' THEN NULL ELSE actor_id END,
    session_id = CASE WHEN decision_input = 'allow_rejoin' THEN NULL ELSE session_id END
  WHERE id = participant_id_input;
END;
$function$;
