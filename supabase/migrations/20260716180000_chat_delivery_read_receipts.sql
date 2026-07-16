-- WhatsApp-style receipts:
--   sent      → single tick (server accepted)
--   delivered → double tick (peer device received)
--   read      → blue double tick (peer opened the chat)

-- Stop auto-marking delivered on INSERT — that was not a real device ACK.
create or replace function public.update_message_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  return new;
end;
$$;

-- Peer device received messages in this conversation (not yet read).
create or replace function public.mark_messages_as_delivered(
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

  update public.messages m
  set status = 'delivered'
  where m.conversation_id = p_chat_room_id
    and m.sender_id is distinct from p_user_id
    and m.status = 'sent'
    and m.deleted_at is null;

  insert into public.message_status (message_id, user_id, status, timestamp)
  select m.id, p_user_id, 'delivered', now()
  from public.messages m
  where m.conversation_id = p_chat_room_id
    and m.sender_id is distinct from p_user_id
    and m.deleted_at is null
  on conflict (message_id, user_id) do update
  set
    status = case
      when public.message_status.status = 'read' then 'read'
      else 'delivered'
    end,
    timestamp = now();
end;
$$;

-- Peer opened the chat — mark read + blue ticks for the sender.
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

  update public.messages m
  set status = 'read'
  where m.conversation_id = p_chat_room_id
    and m.sender_id is distinct from p_user_id
    and m.status in ('sent', 'delivered')
    and m.deleted_at is null;

  insert into public.message_status (message_id, user_id, status, timestamp)
  select m.id, p_user_id, 'read', now()
  from public.messages m
  where m.conversation_id = p_chat_room_id
    and m.sender_id is distinct from p_user_id
    and m.deleted_at is null
  on conflict (message_id, user_id) do update
  set status = 'read', timestamp = now();
end;
$$;

grant execute on function public.mark_messages_as_delivered(uuid, uuid) to authenticated;
grant execute on function public.mark_messages_as_read(uuid, uuid) to authenticated;
