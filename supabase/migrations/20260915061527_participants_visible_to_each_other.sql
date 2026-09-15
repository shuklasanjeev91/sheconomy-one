-- Let people in a meeting see each other in the participants panel.
--
-- mp_select only matched a caller's own row unless they were the host, so every
-- guest saw "1 joined" while the host saw the full roster. Admitted guests now
-- also see the other admitted guests.
--
-- The waiting room stays host-only: a pending guest still sees just their own
-- row, so nobody can read the queue before the host admits them.

-- A policy on meeting_participants cannot subquery meeting_participants without
-- recursing, so the membership probe runs as SECURITY DEFINER. It reads the
-- caller from auth.uid() rather than taking a user id, so it can only ever
-- answer "am I in this meeting" and not be used to probe other people.
CREATE OR REPLACE FUNCTION public.is_admitted_meeting_participant(meeting_id_input uuid)
  RETURNS boolean
  LANGUAGE sql
  SECURITY DEFINER
  STABLE
  SET search_path = public, pg_temp
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.meeting_participants
    WHERE meeting_id = meeting_id_input
      AND user_id = auth.uid()
      AND status = 'admitted'
  );
$function$;

REVOKE ALL ON FUNCTION public.is_admitted_meeting_participant(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.is_admitted_meeting_participant(uuid) TO authenticated;

DROP POLICY IF EXISTS mp_select ON public.meeting_participants;

CREATE POLICY mp_select ON public.meeting_participants
  FOR SELECT
  USING (
    -- Your own row, whatever state it is in.
    auth.uid() = user_id
    -- The host sees everyone, including the waiting queue.
    OR EXISTS (
      SELECT 1
      FROM public.meetings m
      WHERE m.id = meeting_participants.meeting_id
        AND m.host_id = auth.uid()
    )
    -- Admitted guests see the other admitted guests.
    OR (
      meeting_participants.status = 'admitted'
      AND public.is_admitted_meeting_participant(meeting_participants.meeting_id)
    )
  );

DROP FUNCTION IF EXISTS public.is_admitted_meeting_participant(uuid, uuid);
