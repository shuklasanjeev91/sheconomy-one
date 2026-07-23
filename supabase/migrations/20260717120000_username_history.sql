-- Profile links in notifications/emails embed the username at send time, so a
-- rename breaks every old /profile/<handle> link ("Profile not found").
-- Track prior usernames so old links keep resolving to the same profile.

create table if not exists public.username_history (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  username text not null,
  changed_at timestamptz not null default now()
);

create unique index if not exists username_history_username_profile_idx
  on public.username_history (lower(username), profile_id);
create index if not exists username_history_username_idx
  on public.username_history (lower(username));

alter table public.username_history enable row level security;

-- Usernames are public identifiers (profile pages are public), so reads are open.
drop policy if exists username_history_select on public.username_history;
create policy username_history_select on public.username_history
  for select using (true);

-- Record the old handle whenever a profile's username changes.
create or replace function public.record_username_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.username is distinct from new.username
     and old.username is not null
     and btrim(old.username) <> '' then
    insert into public.username_history (profile_id, username)
    values (old.id, old.username)
    on conflict (lower(username), profile_id)
      do update set changed_at = now();
  end if;
  return new;
end;
$$;

drop trigger if exists trg_profiles_username_history on public.profiles;
create trigger trg_profiles_username_history
  after update of username on public.profiles
  for each row
  execute function public.record_username_change();

-- Backfill from notification payloads that captured the username at send time
-- (covers renames that happened before this trigger existed).
insert into public.username_history (profile_id, username)
select distinct
  (n.data ->> 'profile_id')::uuid,
  n.data ->> 'username'
from public.notifications n
join public.profiles p on p.id = (n.data ->> 'profile_id')::uuid
where n.data ->> 'profile_id' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  and coalesce(btrim(n.data ->> 'username'), '') <> ''
  and lower(p.username) is distinct from lower(n.data ->> 'username')
on conflict (lower(username), profile_id) do nothing;
