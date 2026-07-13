-- Read receipts: let conversation participants observe each other's read_at so
-- senders can render "read" (blue double-tick) status. The existing policy only
-- exposed a user's own row (user_id = auth.uid()), which hid peer receipts from
-- both direct queries and realtime.

create policy "Participants can view conversation read receipts"
  on public.message_reads
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.conversation_participants cp
      where cp.conversation_id = message_reads.conversation_id
        and cp.user_id = auth.uid()
    )
  );
