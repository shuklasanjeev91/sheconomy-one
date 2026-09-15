-- Existing runtime builds use direct participant insert/update during OTA
-- rollout. Preserve that path, but never let a removed row restore itself.

DROP POLICY IF EXISTS mp_insert ON public.meeting_participants;
DROP POLICY IF EXISTS mp_update ON public.meeting_participants;

CREATE POLICY mp_insert ON public.meeting_participants
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND status <> 'removed'
  );

CREATE POLICY mp_update ON public.meeting_participants
  FOR UPDATE TO authenticated
  USING (
    (auth.uid() = user_id AND status <> 'removed')
    OR EXISTS (
      SELECT 1
      FROM public.meetings
      WHERE meetings.id = meeting_participants.meeting_id
        AND meetings.host_id = auth.uid()
    )
  )
  WITH CHECK (
    (auth.uid() = user_id AND status <> 'removed')
    OR EXISTS (
      SELECT 1
      FROM public.meetings
      WHERE meetings.id = meeting_participants.meeting_id
        AND meetings.host_id = auth.uid()
    )
  );
