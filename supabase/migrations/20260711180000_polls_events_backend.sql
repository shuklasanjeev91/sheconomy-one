-- Backend for chat polls + events and community poll voting.

-- 1. Carry an optional metadata payload through the chat send RPC (poll/event data).
drop function if exists public.send_message_with_status(uuid, uuid, text, text, text, text, integer, text, uuid);

create or replace function public.send_message_with_status(
  p_chat_room_id uuid,
  p_sender_id uuid,
  p_content text,
  p_message_type text default 'text',
  p_file_url text default null,
  p_file_name text default null,
  p_file_size integer default null,
  p_file_type text default null,
  p_reply_to_id uuid default null,
  p_metadata jsonb default null
)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_user_id uuid := auth.uid();
  v_message_id uuid;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if p_sender_id is distinct from v_user_id then
    raise exception 'Sender mismatch';
  end if;

  if not exists (
    select 1
    from public.conversation_participants cp
    where cp.conversation_id = p_chat_room_id
      and cp.user_id = v_user_id
  ) then
    raise exception 'Not a conversation participant';
  end if;

  if p_reply_to_id is not null and not exists (
    select 1 from public.messages m
    where m.id = p_reply_to_id and m.conversation_id = p_chat_room_id
  ) then
    p_reply_to_id := null;
  end if;

  insert into public.messages (
    conversation_id, sender_id, content, message_type, media_url,
    file_name, file_size, media_type, reply_to_id, status, metadata
  )
  values (
    p_chat_room_id, p_sender_id, coalesce(p_content, ''), coalesce(p_message_type, 'text'),
    p_file_url, p_file_name, p_file_size, p_file_type, p_reply_to_id, 'sent', p_metadata
  )
  returning id into v_message_id;

  update public.conversations
  set last_message_id = v_message_id, updated_at = now()
  where id = p_chat_room_id;

  return v_message_id;
end;
$function$;

-- 2. Votes for chat poll messages (one per user per message; changeable).
create table if not exists public.message_poll_votes (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.messages(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  option_index integer not null,
  created_at timestamptz not null default now(),
  unique (message_id, user_id)
);

alter table public.message_poll_votes enable row level security;

create policy "message_poll_votes_select" on public.message_poll_votes
  for select to authenticated
  using (
    exists (
      select 1
      from public.messages m
      join public.conversation_participants cp on cp.conversation_id = m.conversation_id
      where m.id = message_poll_votes.message_id and cp.user_id = auth.uid()
    )
  );

create policy "message_poll_votes_insert" on public.message_poll_votes
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1
      from public.messages m
      join public.conversation_participants cp on cp.conversation_id = m.conversation_id
      where m.id = message_poll_votes.message_id and cp.user_id = auth.uid()
    )
  );

create policy "message_poll_votes_update" on public.message_poll_votes
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "message_poll_votes_delete" on public.message_poll_votes
  for delete to authenticated
  using (user_id = auth.uid());

-- Realtime so vote bars update live.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'message_poll_votes'
  ) then
    alter publication supabase_realtime add table public.message_poll_votes;
  end if;
end $$;

-- 3. Toggle a chat poll vote (single choice; re-tapping the same option clears it).
create or replace function public.cast_message_poll_vote(
  p_message_id uuid,
  p_user_id uuid,
  p_option_index integer
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_user uuid := auth.uid();
  v_existing integer;
begin
  if v_user is null or v_user is distinct from p_user_id then
    raise exception 'Not authenticated';
  end if;

  if not exists (
    select 1
    from public.messages m
    join public.conversation_participants cp on cp.conversation_id = m.conversation_id
    where m.id = p_message_id and cp.user_id = v_user
  ) then
    raise exception 'Not a conversation participant';
  end if;

  select option_index into v_existing
  from public.message_poll_votes
  where message_id = p_message_id and user_id = p_user_id;

  if v_existing is not null and v_existing = p_option_index then
    delete from public.message_poll_votes where message_id = p_message_id and user_id = p_user_id;
    return;
  end if;

  insert into public.message_poll_votes (message_id, user_id, option_index)
  values (p_message_id, p_user_id, p_option_index)
  on conflict (message_id, user_id)
  do update set option_index = excluded.option_index, created_at = now();
end;
$function$;

-- 4. Toggle a community poll vote, keeping option/poll counters in sync.
create or replace function public.cast_poll_vote(
  p_poll_id uuid,
  p_option_id uuid,
  p_user_id uuid
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_user uuid := auth.uid();
  v_existing uuid;
begin
  if v_user is null or v_user is distinct from p_user_id then
    raise exception 'Not authenticated';
  end if;

  select option_id into v_existing
  from public.poll_votes
  where poll_id = p_poll_id and user_id = p_user_id
  limit 1;

  if v_existing is not null then
    delete from public.poll_votes where poll_id = p_poll_id and user_id = p_user_id;
    update public.poll_options set vote_count = greatest(0, coalesce(vote_count, 0) - 1) where id = v_existing;
    update public.polls set total_votes = greatest(0, coalesce(total_votes, 0) - 1) where id = p_poll_id;
    if v_existing = p_option_id then
      return;
    end if;
  end if;

  insert into public.poll_votes (poll_id, option_id, user_id) values (p_poll_id, p_option_id, p_user_id);
  update public.poll_options set vote_count = coalesce(vote_count, 0) + 1 where id = p_option_id;
  update public.polls set total_votes = coalesce(total_votes, 0) + 1 where id = p_poll_id;
end;
$function$;
