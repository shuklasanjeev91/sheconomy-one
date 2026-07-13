-- Group management, conversation archiving, and group avatars.
--
-- 1. Adds `is_archived` to conversation_participants (per-user archive state).
-- 2. Extends get_user_chats to return `is_archived` and a group avatar
--    (stored in conversations.metadata->>'avatar_url').
-- 3. Adds RPCs to manage group membership, roles, and group info.

-- ---------------------------------------------------------------------------
-- 1. Archive column
-- ---------------------------------------------------------------------------
alter table public.conversation_participants
  add column if not exists is_archived boolean not null default false;

-- ---------------------------------------------------------------------------
-- 2. get_user_chats: add is_archived + group avatar
-- ---------------------------------------------------------------------------
drop function if exists public.get_user_chats(uuid);

create or replace function public.get_user_chats(p_user_id uuid)
returns table(
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
  is_archived boolean,
  current_user_role text,
  last_message_sender_name text,
  last_seen timestamptz,
  other_user_role text,
  last_message_type text
)
language sql
stable
security definer
set search_path to 'public'
as $function$
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
          coalesce((select mr.read_at from public.message_reads mr where mr.conversation_id = c.id and mr.user_id = p_user_id), '1970-01-01'::timestamptz),
          coalesce(me_cp.cleared_at, '1970-01-01'::timestamptz)
        )
    ) as unread_count,
    coalesce(
      case
        when coalesce(c.conversation_type, 'direct') = 'group' then c.metadata->>'avatar_url'
        else other_p.avatar_url
      end,
      ''
    ) as avatar_url,
    other_p.id as other_user_id,
    coalesce(other_p.full_name, other_p.username, '') as other_user_name,
    coalesce(other_p.avatar_url, '') as other_user_avatar,
    coalesce(other_p.is_online, false) as is_online,
    coalesce(me_cp.is_pinned, false) as is_pinned,
    coalesce(me_cp.is_muted, false) as is_muted,
    coalesce(me_cp.is_archived, false) as is_archived,
    coalesce(me_cp.role, 'member') as current_user_role,
    coalesce(sender_p.full_name, sender_p.username, '') as last_message_sender_name,
    other_p.last_seen as last_seen,
    coalesce(other_cp.role, 'member') as other_user_role,
    coalesce(lm.message_type, 'text') as last_message_type
  from public.conversations c
  inner join public.conversation_participants me_cp
    on me_cp.conversation_id = c.id and me_cp.user_id = p_user_id
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
    where cp.conversation_id = c.id and cp.user_id <> p_user_id
    order by cp.joined_at nulls last
    limit 1
  ) other_cp on true
  left join public.profiles other_p on other_p.id = other_cp.user_id
  where auth.uid() = p_user_id
  order by coalesce(me_cp.is_pinned, false) desc, coalesce(lm.created_at, c.updated_at, c.created_at) desc nulls last;
$function$;

grant execute on function public.get_user_chats(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Group management RPCs
-- ---------------------------------------------------------------------------

-- Add one or more members to a group. Owners/admins can always add; regular
-- members can add only when `members_can_add` is enabled on the conversation.
create or replace function public.add_group_participants(
  p_conversation_id uuid,
  p_user_ids uuid[]
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_actor uuid := auth.uid();
  v_role text;
  v_members_can_add boolean;
  v_uid uuid;
begin
  select role into v_role
  from public.conversation_participants
  where conversation_id = p_conversation_id and user_id = v_actor;

  if v_role is null then
    raise exception 'You are not a participant of this conversation';
  end if;

  select coalesce(members_can_add, false) into v_members_can_add
  from public.conversations where id = p_conversation_id;

  if v_role not in ('owner', 'admin') and not v_members_can_add then
    raise exception 'You do not have permission to add members';
  end if;

  foreach v_uid in array p_user_ids loop
    insert into public.conversation_participants (conversation_id, user_id, role, joined_at)
    select p_conversation_id, v_uid, 'member', now()
    where not exists (
      select 1 from public.conversation_participants
      where conversation_id = p_conversation_id and user_id = v_uid
    );
  end loop;

  update public.conversations set updated_at = now() where id = p_conversation_id;
end;
$$;

-- Remove a member (owner/admin) or leave the group (self). If the owner leaves,
-- ownership transfers to the next admin, then the oldest remaining member.
create or replace function public.remove_group_participant(
  p_conversation_id uuid,
  p_user_id uuid
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_actor uuid := auth.uid();
  v_role text;
  v_owner uuid;
  v_new_owner uuid;
begin
  select role into v_role
  from public.conversation_participants
  where conversation_id = p_conversation_id and user_id = v_actor;

  if v_role is null then
    raise exception 'You are not a participant of this conversation';
  end if;

  if p_user_id <> v_actor and v_role not in ('owner', 'admin') then
    raise exception 'You do not have permission to remove members';
  end if;

  select owner_id into v_owner from public.conversations where id = p_conversation_id;

  if p_user_id = v_owner then
    if p_user_id <> v_actor then
      raise exception 'The group owner cannot be removed';
    end if;
    -- Owner is leaving: hand ownership to the next admin / oldest member.
    select cp.user_id into v_new_owner
    from public.conversation_participants cp
    where cp.conversation_id = p_conversation_id and cp.user_id <> v_owner
    order by (cp.role = 'admin') desc, cp.joined_at asc nulls last
    limit 1;

    if v_new_owner is not null then
      update public.conversations set owner_id = v_new_owner where id = p_conversation_id;
      update public.conversation_participants set role = 'owner'
      where conversation_id = p_conversation_id and user_id = v_new_owner;
    end if;
  end if;

  delete from public.conversation_participants
  where conversation_id = p_conversation_id and user_id = p_user_id;

  update public.conversations set updated_at = now() where id = p_conversation_id;
end;
$$;

-- Update a group's title and/or avatar (owner/admin only).
create or replace function public.update_group_info(
  p_conversation_id uuid,
  p_title text default null,
  p_avatar_url text default null
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_role text;
begin
  select role into v_role
  from public.conversation_participants
  where conversation_id = p_conversation_id and user_id = auth.uid();

  if v_role not in ('owner', 'admin') then
    raise exception 'You do not have permission to edit this group';
  end if;

  update public.conversations
  set
    title = coalesce(nullif(trim(p_title), ''), title),
    metadata = case
      when p_avatar_url is not null
        then coalesce(metadata, '{}'::jsonb) || jsonb_build_object('avatar_url', p_avatar_url)
      else metadata
    end,
    updated_at = now()
  where id = p_conversation_id;
end;
$$;

-- Promote/demote a member between 'admin' and 'member' (owner only).
create or replace function public.set_group_participant_role(
  p_conversation_id uuid,
  p_user_id uuid,
  p_role text
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_role text;
begin
  select role into v_role
  from public.conversation_participants
  where conversation_id = p_conversation_id and user_id = auth.uid();

  if v_role <> 'owner' then
    raise exception 'Only the group owner can change roles';
  end if;

  if p_role not in ('admin', 'member') then
    raise exception 'Invalid role';
  end if;

  update public.conversation_participants
  set role = p_role
  where conversation_id = p_conversation_id
    and user_id = p_user_id
    and role <> 'owner';
end;
$$;

grant execute on function public.add_group_participants(uuid, uuid[]) to authenticated;
grant execute on function public.remove_group_participant(uuid, uuid) to authenticated;
grant execute on function public.update_group_info(uuid, text, text) to authenticated;
grant execute on function public.set_group_participant_role(uuid, uuid, text) to authenticated;
