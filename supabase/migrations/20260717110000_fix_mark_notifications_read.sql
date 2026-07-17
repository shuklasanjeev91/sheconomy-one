-- The unread badge counts `read = false`, but mark_notification_read only set
-- read_at, and mark_all_notifications_read updated a nonexistent is_read
-- column keyed on user_id. Result: the counter never cleared after reading.

-- Backfill rows that were opened (read_at set) but never flagged read.
update public.notifications
set read = true
where read = false
  and read_at is not null;

create or replace function public.mark_notification_read(
  p_notification_id uuid,
  p_user_id uuid default null
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  -- Prefer the authenticated user so callers cannot mark others' rows.
  v_user_id uuid := coalesce(auth.uid(), p_user_id);
begin
  update public.notifications
  set
    read = true,
    read_at = coalesce(read_at, now()),
    updated_at = now()
  where id = p_notification_id
    and recipient_id = v_user_id
    and (read = false or read_at is null);

  if found then
    insert into public.notification_events (notification_id, event_type, channel, status)
    values (p_notification_id, 'read', 'in_app', 'success');
    return true;
  end if;

  return false;
end;
$$;

create or replace function public.mark_all_notifications_read(p_user_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_count integer;
  v_user_id uuid := coalesce(auth.uid(), p_user_id);
begin
  update public.notifications
  set
    read = true,
    read_at = coalesce(read_at, now()),
    updated_at = now()
  where recipient_id = v_user_id
    and read = false;

  get diagnostics updated_count = row_count;
  return updated_count;
end;
$$;
