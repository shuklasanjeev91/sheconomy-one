-- Allow co-hosts to edit meeting details and cancel meetings (Zoom-style).
-- Prefer is_meeting_host_or_co_host so co-hosts work from My Meetings without
-- needing an admitted participant row (meeting_actor_role requires admitted).

CREATE OR REPLACE FUNCTION public.update_meeting_schedule_secure(
  meeting_id_input uuid,
  title_input text,
  description_input text DEFAULT NULL,
  scheduled_at_input timestamptz DEFAULT NULL,
  scheduled_end_at_input timestamptz DEFAULT NULL,
  time_zone_input text DEFAULT NULL,
  max_participants_input integer DEFAULT NULL,
  is_recurring_input boolean DEFAULT NULL,
  repeat_input text DEFAULT NULL,
  security_settings_input jsonb DEFAULT NULL,
  meeting_options_input jsonb DEFAULT NULL,
  invitees_input jsonb DEFAULT NULL,
  convert_to_scheduled_input boolean DEFAULT false
)
RETURNS public.meetings
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  meeting_row public.meetings;
  next_status text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED';
  END IF;
  IF NOT public.is_meeting_host_or_co_host(meeting_id_input) THEN
    RAISE EXCEPTION 'HOST_REQUIRED';
  END IF;

  SELECT * INTO meeting_row
  FROM public.meetings
  WHERE id = meeting_id_input
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'MEETING_NOT_FOUND';
  END IF;
  IF meeting_row.status = 'cancelled' THEN
    RAISE EXCEPTION 'MEETING_CLOSED';
  END IF;

  IF scheduled_at_input IS NOT NULL
    AND scheduled_end_at_input IS NOT NULL
    AND scheduled_end_at_input <= scheduled_at_input
  THEN
    RAISE EXCEPTION 'INVALID_TIME_RANGE';
  END IF;

  IF time_zone_input IS NOT NULL AND (
    time_zone_input = '' OR time_zone_input NOT LIKE '%/%'
    OR NOT EXISTS (SELECT 1 FROM pg_timezone_names WHERE name = time_zone_input)
  ) THEN
    RAISE EXCEPTION 'INVALID_TIMEZONE';
  END IF;

  IF max_participants_input IS NOT NULL
    AND (max_participants_input < 2 OR max_participants_input > 500)
  THEN
    RAISE EXCEPTION 'INVALID_CAPACITY';
  END IF;

  next_status := meeting_row.status;
  IF convert_to_scheduled_input
    AND meeting_row.status IN ('instant', 'ended')
    AND scheduled_at_input IS NOT NULL
    AND scheduled_at_input > now()
  THEN
    next_status := 'scheduled';
  END IF;

  UPDATE public.meetings
  SET
    title = coalesce(nullif(trim(title_input), ''), meeting_row.title),
    description = CASE
      WHEN description_input IS NULL THEN meeting_row.description
      ELSE nullif(trim(description_input), '')
    END,
    scheduled_at = coalesce(scheduled_at_input, meeting_row.scheduled_at),
    scheduled_end_at = coalesce(scheduled_end_at_input, meeting_row.scheduled_end_at),
    time_zone = coalesce(time_zone_input, meeting_row.time_zone),
    max_participants = coalesce(max_participants_input, meeting_row.max_participants),
    is_recurring = coalesce(is_recurring_input, meeting_row.is_recurring),
    repeat = CASE
      WHEN is_recurring_input IS FALSE THEN NULL
      WHEN repeat_input IS NULL THEN meeting_row.repeat
      ELSE nullif(repeat_input, '')
    END,
    security_settings = coalesce(security_settings_input, meeting_row.security_settings),
    meeting_options = coalesce(meeting_options_input, meeting_row.meeting_options),
    invitees = coalesce(invitees_input, meeting_row.invitees),
    status = next_status,
    -- Rescheduling a future instant/ended meeting clears the prior live timestamps.
    started_at = CASE
      WHEN next_status = 'scheduled' THEN NULL
      ELSE meeting_row.started_at
    END,
    ended_at = CASE
      WHEN next_status = 'scheduled' THEN NULL
      ELSE meeting_row.ended_at
    END,
    updated_at = now()
  WHERE id = meeting_id_input
  RETURNING * INTO meeting_row;

  RETURN meeting_row;
END;
$function$;

CREATE OR REPLACE FUNCTION public.cancel_meeting_secure(meeting_id_input uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED';
  END IF;
  IF NOT public.is_meeting_host_or_co_host(meeting_id_input) THEN
    RAISE EXCEPTION 'HOST_REQUIRED';
  END IF;
  UPDATE public.meetings
  SET status = 'cancelled', ended_at = now(), updated_at = now()
  WHERE id = meeting_id_input;
  UPDATE public.meeting_rooms SET is_active = false, ended_at = now()
  WHERE meeting_id = meeting_id_input;
END;
$function$;
