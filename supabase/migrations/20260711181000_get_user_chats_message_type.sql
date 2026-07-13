-- Surface the last message's type in the chat list so poll/event previews
-- can render a distinct label + icon.
drop function if exists public.get_user_chats(uuid);

create or replace function public.get_user_chats(p_user_id uuid)
returns table(
  chat_id uuid,
  chat_name text,
  chat_type text,
  last_message text,
  last_message_time timestamp with time zone,
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
  last_seen timestamp with time zone,
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
