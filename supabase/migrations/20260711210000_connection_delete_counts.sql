-- Keep profiles.connections_count accurate when a connection is deleted.
--
-- The existing `update_connection_counts` trigger only fires on UPDATE (status
-- transitions to/from 'accepted'). Removing a connection (disconnect) or
-- withdrawing a request deletes the row instead, which previously left the
-- denormalized `connections_count` stale. This adds an AFTER DELETE trigger
-- that decrements both parties' counts when an *accepted* connection is removed.

create or replace function public.decrement_connection_counts_on_delete()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if OLD.status = 'accepted' then
    update public.profiles
    set connections_count = greatest(coalesce(connections_count, 0) - 1, 0)
    where id = OLD.sender_id or id = OLD.receiver_id;
  end if;
  return OLD;
end;
$$;

drop trigger if exists trigger_decrement_connection_counts on public.connections;

create trigger trigger_decrement_connection_counts
  after delete on public.connections
  for each row
  execute function public.decrement_connection_counts_on_delete();
