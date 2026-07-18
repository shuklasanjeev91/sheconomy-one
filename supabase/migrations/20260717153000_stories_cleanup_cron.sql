-- Periodic hard-delete of stories past the 24h grace window after expiry.
-- Media objects are removed by the cleanup-expired-stories edge function
-- (invoke with the service role, or schedule it in the Supabase dashboard).

create or replace function public.cleanup_expired_stories_rows()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  deleted_count integer;
begin
  delete from public.stories
  where expires_at is not null
    and expires_at < now() - interval '1 day';
  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$$;

revoke all on function public.cleanup_expired_stories_rows() from public, anon, authenticated;
grant execute on function public.cleanup_expired_stories_rows() to service_role;

select cron.unschedule(jobid)
from cron.job
where jobname = 'cleanup-expired-stories-rows';

select cron.schedule(
  'cleanup-expired-stories-rows',
  '20 */6 * * *',
  $$select public.cleanup_expired_stories_rows();$$
);
