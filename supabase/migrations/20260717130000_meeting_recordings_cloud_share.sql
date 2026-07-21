-- Cloud meeting recordings: lifecycle, host ownership, revocable share tokens.

alter table public.meeting_recordings
  alter column recording_url drop not null;

alter table public.meeting_recordings
  alter column recording_url set default '';

alter table public.meeting_recordings
  add column if not exists host_id uuid references public.profiles(id) on delete set null,
  add column if not exists storage_path text,
  add column if not exists error_message text,
  add column if not exists share_token_hash text,
  add column if not exists share_created_at timestamptz,
  add column if not exists share_revoked_at timestamptz,
  add column if not exists started_at timestamptz,
  add column if not exists ended_at timestamptz,
  add column if not exists layout text default 'grid';

update public.meeting_recordings mr
set host_id = m.host_id
from public.meetings m
where m.id = mr.meeting_id
  and mr.host_id is null;

update public.meeting_recordings
set recording_url = coalesce(recording_url, '')
where recording_url is null;

update public.meeting_recordings
set status = case
  when status in ('starting', 'recording', 'processing', 'ready', 'failed') then status
  when status = 'completed' then 'ready'
  when status = 'error' then 'failed'
  else 'processing'
end;

alter table public.meeting_recordings
  drop constraint if exists meeting_recordings_status_check;

alter table public.meeting_recordings
  add constraint meeting_recordings_status_check
  check (status in ('starting', 'recording', 'processing', 'ready', 'failed'));

create unique index if not exists meeting_recordings_one_active_per_meeting
  on public.meeting_recordings (meeting_id)
  where status in ('starting', 'recording');

create unique index if not exists meeting_recordings_share_token_hash_uidx
  on public.meeting_recordings (share_token_hash)
  where share_token_hash is not null;

create index if not exists meeting_recordings_host_id_idx
  on public.meeting_recordings (host_id);

create index if not exists meeting_recordings_recording_sid_idx
  on public.meeting_recordings (recording_sid)
  where recording_sid is not null;

alter table public.meeting_recordings enable row level security;

drop policy if exists mr_read on public.meeting_recordings;
drop policy if exists "Hosts can select meeting recordings" on public.meeting_recordings;
create policy "Hosts can select meeting recordings"
  on public.meeting_recordings
  for select
  to authenticated
  using (
    host_id = (select auth.uid())
    or exists (
      select 1
      from public.meetings m
      where m.id = meeting_recordings.meeting_id
        and m.host_id = (select auth.uid())
    )
  );

drop policy if exists "Participants can see active recording indicator" on public.meeting_recordings;
create policy "Participants can see active recording indicator"
  on public.meeting_recordings
  for select
  to authenticated
  using (
    status in ('starting', 'recording')
    and exists (
      select 1
      from public.meeting_participants mp
      where mp.meeting_id = meeting_recordings.meeting_id
        and mp.user_id = (select auth.uid())
        and coalesce(mp.status, '') in ('admitted', 'joined')
    )
  );

-- Mutations go through service-role Edge Functions only.
revoke insert, update, delete on public.meeting_recordings from authenticated, anon;
grant select on public.meeting_recordings to authenticated;

do $$
begin
  if exists (
    select 1 from pg_publication where pubname = 'supabase_realtime'
  ) and not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'meeting_recordings'
  ) then
    execute 'alter publication supabase_realtime add table public.meeting_recordings';
  end if;
end $$;
