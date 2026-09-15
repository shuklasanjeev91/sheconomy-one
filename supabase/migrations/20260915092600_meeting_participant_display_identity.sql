-- Per-meeting display identity. Email remains private in auth and is never
-- copied into meeting participant rows.

ALTER TABLE public.meeting_participants
  ADD COLUMN IF NOT EXISTS display_name text;

ALTER TABLE public.meeting_participants
  DROP CONSTRAINT IF EXISTS meeting_participants_display_name_length;

ALTER TABLE public.meeting_participants
  ADD CONSTRAINT meeting_participants_display_name_length
  CHECK (display_name IS NULL OR char_length(display_name) BETWEEN 1 AND 80);

CREATE OR REPLACE FUNCTION public.set_meeting_participant_display_name(
  meeting_id_input uuid,
  session_id_input uuid,
  display_name_input text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  cleaned_name text := left(trim(display_name_input), 80);
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED';
  END IF;
  IF cleaned_name = ''
    OR cleaned_name ~* '^user_[a-z0-9]+$'
    OR cleaned_name ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  THEN
    RAISE EXCEPTION 'DISPLAY_NAME_INVALID';
  END IF;

  UPDATE public.meeting_participants
  SET
    display_name = cleaned_name,
    last_seen_at = now()
  WHERE meeting_id = meeting_id_input
    AND user_id = auth.uid()
    AND session_id = session_id_input
    AND status <> 'removed';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'PARTICIPANT_SESSION_NOT_FOUND';
  END IF;
END;
$function$;

REVOKE ALL ON FUNCTION public.set_meeting_participant_display_name(uuid, uuid, text)
  FROM public, anon;
GRANT EXECUTE ON FUNCTION public.set_meeting_participant_display_name(uuid, uuid, text)
  TO authenticated;
