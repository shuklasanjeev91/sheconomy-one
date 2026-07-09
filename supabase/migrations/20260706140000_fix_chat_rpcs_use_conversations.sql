-- Chat RPCs referenced legacy table "chat_rooms". The live schema uses "conversations".

create unique index if not exists message_reads_conversation_user_uidx
  on public.message_reads (conversation_id, user_id)
  where conversation_id is not null and user_id is not null;

create unique index if not exists typing_indicators_conversation_user_uidx
  on public.typing_indicators (conversation_id, user_id)
  where conversation_id is not null and user_id is not null;

create or replace function public.create_direct_conversation(p_other_user_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_conversation_id uuid;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if p_other_user_id is null or p_other_user_id = v_user_id then
    raise exception 'Invalid user';
  end if;

  select c.id
  into v_conversation_id
  from public.conversations c
  where coalesce(c.conversation_type, 'direct') = 'direct'
    and exists (
      select 1
      from public.conversation_participants cp
      where cp.conversation_id = c.id
        and cp.user_id = v_user_id
    )
    and exists (
      select 1
      from public.conversation_participants cp
      where cp.conversation_id = c.id
        and cp.user_id = p_other_user_id
    )
    and (
      select count(*)
      from public.conversation_participants cp
      where cp.conversation_id = c.id
    ) = 2
  limit 1;

  if v_conversation_id is not null then
    return v_conversation_id;
  end if;

  insert into public.conversations (conversation_type, owner_id)
  values ('direct', v_user_id)
  returning id into v_conversation_id;

  insert into public.conversation_participants (conversation_id, user_id, role)
  values
    (v_conversation_id, v_user_id, 'member'),
    (v_conversation_id, p_other_user_id, 'member');

  return v_conversation_id;
end;
$$;

create or replace function public.create_group_conversation(
  p_participant_ids uuid[],
  p_title text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_conversation_id uuid;
  v_participant_id uuid;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  insert into public.conversations (conversation_type, title, owner_id)
  values ('group', nullif(trim(p_title), ''), v_user_id)
  returning id into v_conversation_id;

  insert into public.conversation_participants (conversation_id, user_id, role)
  select v_conversation_id, v_user_id, 'owner'
  where not exists (
    select 1
    from public.conversation_participants cp
    where cp.conversation_id = v_conversation_id
      and cp.user_id = v_user_id
  );

  foreach v_participant_id in array coalesce(p_participant_ids, array[]::uuid[])
  loop
    if v_participant_id is null or v_participant_id = v_user_id then
      continue;
    end if;

    insert into public.conversation_participants (conversation_id, user_id, role)
    select v_conversation_id, v_participant_id, 'member'
    where not exists (
      select 1
      from public.conversation_participants cp
      where cp.conversation_id = v_conversation_id
        and cp.user_id = v_participant_id
    );
  end loop;

  return v_conversation_id;
end;
$$;

create or replace function public.get_user_chats(p_user_id uuid)
returns table (
  chat_id uuid,
  chat_name text,
  chat_type text,
  last_message text,
  last_message_time timestamptz,
  unread_count bigint,
  avatar_url text,
  other_user_id uuid,
  other_user_name text,
  other_user_avatar text,
  is_online boolean,
  is_pinned boolean,
  is_muted boolean,
  current_user_role text,
  last_message_sender_name text,
  last_seen timestamptz,
  other_user_role text
)
language sql
security definer
set search_path = public
stable
as $$
  select
    c.id as chat_id,
    case
      when coalesce(c.conversation_type, 'direct') = 'group' then coalesce(c.title, 'Group chat')
      else coalesce(other_p.full_name, other_p.username, 'Chat')
    end as chat_name,
    coalesce(c.conversation_type, 'direct') as chat_type,
    coalesce(lm.content, '') as last_message,
    coalesce(lm.created_at, c.updated_at, c.created_at) as last_message_time,
    (
      select count(*)::bigint
      from public.messages m
      where m.conversation_id = c.id
        and m.sender_id is distinct from p_user_id
        and m.created_at > coalesce(
          (
            select mr.read_at
            from public.message_reads mr
            where mr.conversation_id = c.id
              and mr.user_id = p_user_id
          ),
          '1970-01-01'::timestamptz
        )
    ) as unread_count,
    coalesce(other_p.avatar_url, '') as avatar_url,
    other_p.id as other_user_id,
    coalesce(other_p.full_name, other_p.username, '') as other_user_name,
    coalesce(other_p.avatar_url, '') as other_user_avatar,
    coalesce(other_p.is_online, false) as is_online,
    false as is_pinned,
    false as is_muted,
    coalesce(me_cp.role, 'member') as current_user_role,
    coalesce(sender_p.full_name, sender_p.username, '') as last_message_sender_name,
    other_p.last_seen as last_seen,
    coalesce(other_cp.role, 'member') as other_user_role
  from public.conversations c
  inner join public.conversation_participants me_cp
    on me_cp.conversation_id = c.id
   and me_cp.user_id = p_user_id
  left join public.messages lm on lm.id = c.last_message_id
  left join public.profiles sender_p on sender_p.id = lm.sender_id
  left join lateral (
    select cp.user_id, cp.role
    from public.conversation_participants cp
    where cp.conversation_id = c.id
      and cp.user_id <> p_user_id
    order by cp.joined_at nulls last
    limit 1
  ) other_cp on true
  left join public.profiles other_p on other_p.id = other_cp.user_id
  where auth.uid() = p_user_id
  order by coalesce(lm.created_at, c.updated_at, c.created_at) desc nulls last;
$$;

create or replace function public.get_user_conversations(
  current_user_id uuid,
  search_query text default null
)
returns table (
  conversation_id uuid,
  other_user_id uuid,
  other_user_name text,
  other_user_avatar text,
  last_message text,
  last_message_at timestamptz,
  last_message_type text,
  unread_count bigint,
  is_sender boolean
)
language sql
security definer
set search_path = public
stable
as $$
  select
    c.id as conversation_id,
    other_p.id as other_user_id,
    coalesce(other_p.full_name, other_p.username, 'Member') as other_user_name,
    coalesce(other_p.avatar_url, '') as other_user_avatar,
    coalesce(lm.content, '') as last_message,
    coalesce(lm.created_at, c.updated_at, c.created_at) as last_message_at,
    coalesce(lm.message_type, 'text') as last_message_type,
    (
      select count(*)::bigint
      from public.messages m
      where m.conversation_id = c.id
        and m.sender_id is distinct from current_user_id
        and m.created_at > coalesce(
          (
            select mr.read_at
            from public.message_reads mr
            where mr.conversation_id = c.id
              and mr.user_id = current_user_id
          ),
          '1970-01-01'::timestamptz
        )
    ) as unread_count,
    coalesce(lm.sender_id = current_user_id, false) as is_sender
  from public.conversations c
  inner join public.conversation_participants me_cp
    on me_cp.conversation_id = c.id
   and me_cp.user_id = current_user_id
  left join public.messages lm on lm.id = c.last_message_id
  left join lateral (
    select cp.user_id
    from public.conversation_participants cp
    where cp.conversation_id = c.id
      and cp.user_id <> current_user_id
    order by cp.joined_at nulls last
    limit 1
  ) other_cp on true
  left join public.profiles other_p on other_p.id = other_cp.user_id
  where auth.uid() = current_user_id
    and (
      search_query is null
      or trim(search_query) = ''
      or coalesce(other_p.full_name, '') ilike '%' || trim(search_query) || '%'
      or coalesce(other_p.username, '') ilike '%' || trim(search_query) || '%'
      or coalesce(lm.content, '') ilike '%' || trim(search_query) || '%'
    )
  order by coalesce(lm.created_at, c.updated_at, c.created_at) desc nulls last;
$$;

create or replace function public.send_message_with_status(
  p_chat_room_id uuid,
  p_sender_id uuid,
  p_content text,
  p_message_type text default 'text',
  p_file_url text default null,
  p_file_name text default null,
  p_file_size integer default null,
  p_file_type text default null,
  p_reply_to_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
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

  insert into public.messages (
    conversation_id,
    sender_id,
    content,
    message_type,
    media_url,
    file_name,
    file_size,
    media_type,
    status
  )
  values (
    p_chat_room_id,
    p_sender_id,
    coalesce(p_content, ''),
    coalesce(p_message_type, 'text'),
    p_file_url,
    p_file_name,
    p_file_size,
    p_file_type,
    'sent'
  )
  returning id into v_message_id;

  update public.conversations
  set
    last_message_id = v_message_id,
    updated_at = now()
  where id = p_chat_room_id;

  return v_message_id;
end;
$$;

create or replace function public.send_message(
  p_chat_room_id uuid,
  p_sender_id uuid,
  p_content text,
  p_message_type text default 'text',
  p_file_url text default null,
  p_file_name text default null,
  p_file_size integer default null,
  p_file_type text default null,
  p_reply_to_id uuid default null
)
returns uuid
language sql
security definer
set search_path = public
as $$
  select public.send_message_with_status(
    p_chat_room_id,
    p_sender_id,
    p_content,
    p_message_type,
    p_file_url,
    p_file_name,
    p_file_size,
    p_file_type,
    p_reply_to_id
  );
$$;

create or replace function public.mark_messages_as_read(
  p_chat_room_id uuid,
  p_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is distinct from p_user_id then
    raise exception 'Not authorized';
  end if;

  if not exists (
    select 1
    from public.conversation_participants cp
    where cp.conversation_id = p_chat_room_id
      and cp.user_id = p_user_id
  ) then
    raise exception 'Not a conversation participant';
  end if;

  insert into public.message_reads (conversation_id, user_id, read_at)
  values (p_chat_room_id, p_user_id, now())
  on conflict (conversation_id, user_id)
  do update set read_at = excluded.read_at;
end;
$$;

create or replace function public.set_typing_indicator(
  p_chat_room_id uuid,
  p_user_id uuid,
  p_is_typing boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is distinct from p_user_id then
    raise exception 'Not authorized';
  end if;

  if not exists (
    select 1
    from public.conversation_participants cp
    where cp.conversation_id = p_chat_room_id
      and cp.user_id = p_user_id
  ) then
    return;
  end if;

  if coalesce(p_is_typing, false) then
    insert into public.typing_indicators (conversation_id, user_id, is_typing, updated_at)
    values (p_chat_room_id, p_user_id, true, now())
    on conflict (conversation_id, user_id)
    do update set is_typing = true, updated_at = now();
  else
    delete from public.typing_indicators
    where conversation_id = p_chat_room_id
      and user_id = p_user_id;
  end if;
end;
$$;

grant execute on function public.create_direct_conversation(uuid) to authenticated;
grant execute on function public.create_group_conversation(uuid[], text) to authenticated;
grant execute on function public.get_user_chats(uuid) to authenticated;
grant execute on function public.get_user_conversations(uuid, text) to authenticated;
grant execute on function public.send_message_with_status(uuid, uuid, text, text, text, text, integer, text, uuid) to authenticated;
grant execute on function public.send_message(uuid, uuid, text, text, text, text, integer, text, uuid) to authenticated;
grant execute on function public.mark_messages_as_read(uuid, uuid) to authenticated;
grant execute on function public.set_typing_indicator(uuid, uuid, boolean) to authenticated;
