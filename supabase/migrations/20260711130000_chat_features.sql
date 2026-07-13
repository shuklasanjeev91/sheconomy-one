-- Chat features: replies, edits, deletes, pin/mute, clear chat.
-- Reactions already have a table (public.message_reactions) with correct RLS.

-- ---------------------------------------------------------------------------
-- 1) Message columns: reply target, soft-delete tombstone, edit marker.
-- ---------------------------------------------------------------------------
alter table public.messages
  add column if not exists reply_to_id uuid references public.messages(id) on delete set null,
  add column if not exists deleted_at timestamptz,
  add column if not exists edited_at timestamptz;

create index if not exists messages_reply_to_id_idx on public.messages(reply_to_id);

-- ---------------------------------------------------------------------------
-- 2) Per-participant conversation preferences (pin / mute / clear).
--    Updated directly by the owning user (conversation_participants_update_own).
-- ---------------------------------------------------------------------------
alter table public.conversation_participants
  add column if not exists is_pinned boolean not null default false,
  add column if not exists is_muted boolean not null default false,
  add column if not exists cleared_at timestamptz;

-- ---------------------------------------------------------------------------
-- 3) send_message_with_status now persists reply_to_id.
-- ---------------------------------------------------------------------------
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

  -- Reply target must live in the same conversation.
  if p_reply_to_id is not null and not exists (
    select 1 from public.messages m
    where m.id = p_reply_to_id and m.conversation_id = p_chat_room_id
  ) then
    p_reply_to_id := null;
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
    reply_to_id,
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
    p_reply_to_id,
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

-- ---------------------------------------------------------------------------
-- 4) get_user_chats: surface real pin/mute state, honour cleared_at, and
--    order pinned conversations first. Signature is unchanged.
-- ---------------------------------------------------------------------------
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
        and m.deleted_at is null
        and m.created_at > greatest(
          coalesce(
            (
              select mr.read_at
              from public.message_reads mr
              where mr.conversation_id = c.id
                and mr.user_id = p_user_id
            ),
            '1970-01-01'::timestamptz
          ),
          coalesce(me_cp.cleared_at, '1970-01-01'::timestamptz)
        )
    ) as unread_count,
    coalesce(other_p.avatar_url, '') as avatar_url,
    other_p.id as other_user_id,
    coalesce(other_p.full_name, other_p.username, '') as other_user_name,
    coalesce(other_p.avatar_url, '') as other_user_avatar,
    coalesce(other_p.is_online, false) as is_online,
    coalesce(me_cp.is_pinned, false) as is_pinned,
    coalesce(me_cp.is_muted, false) as is_muted,
    coalesce(me_cp.role, 'member') as current_user_role,
    coalesce(sender_p.full_name, sender_p.username, '') as last_message_sender_name,
    other_p.last_seen as last_seen,
    coalesce(other_cp.role, 'member') as other_user_role
  from public.conversations c
  inner join public.conversation_participants me_cp
    on me_cp.conversation_id = c.id
   and me_cp.user_id = p_user_id
  left join lateral (
    select m.content, m.created_at, m.message_type, m.sender_id
    from public.messages m
    where m.conversation_id = c.id
      and m.deleted_at is null
      and m.created_at > coalesce(me_cp.cleared_at, '1970-01-01'::timestamptz)
    order by m.created_at desc
    limit 1
  ) lm on true
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
  order by
    coalesce(me_cp.is_pinned, false) desc,
    coalesce(lm.created_at, c.updated_at, c.created_at) desc nulls last;
$$;

grant execute on function public.send_message_with_status(uuid, uuid, text, text, text, text, integer, text, uuid) to authenticated;
grant execute on function public.get_user_chats(uuid) to authenticated;
