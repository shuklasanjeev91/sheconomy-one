-- Allow co-hosts to update meeting invitees (in-meeting invite panel).
CREATE OR REPLACE FUNCTION public.update_meeting_invitees_secure(
  meeting_id_input uuid,
  invitees_input jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
BEGIN
  IF public.meeting_actor_role(meeting_id_input) NOT IN ('host', 'co_host') THEN
    RAISE EXCEPTION 'HOST_REQUIRED';
  END IF;
  IF jsonb_typeof(coalesce(invitees_input, '[]'::jsonb)) <> 'array' THEN
    RAISE EXCEPTION 'INVALID_INVITEES';
  END IF;
  UPDATE public.meetings
  SET invitees = invitees_input, updated_at = now()
  WHERE id = meeting_id_input;
END;
$function$;
