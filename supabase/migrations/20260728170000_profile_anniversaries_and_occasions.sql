-- LinkedIn-style milestones: marriage anniversary + connection celebration feed helper.
-- date_of_birth already exists on profiles.

alter table public.profiles
  add column if not exists marriage_anniversary date;

comment on column public.profiles.marriage_anniversary is
  'Optional wedding / marriage anniversary (month+day used for network reminders).';

create or replace function public.connection_occasions_today(p_user_id uuid default auth.uid())
returns table (
  user_id uuid,
  full_name text,
  username text,
  avatar_url text,
  occasion text,
  label text,
  years integer,
  company_name text
)
language sql
stable
security definer
set search_path = public
as $$
  with accepted as (
    select
      case
        when c.sender_id = p_user_id then c.receiver_id
        else c.sender_id
      end as peer_id
    from public.connections c
    where c.status = 'accepted'
      and p_user_id is not null
      and (c.sender_id = p_user_id or c.receiver_id = p_user_id)
  ),
  peers as (
    select distinct peer_id from accepted
  ),
  today as (
    select
      extract(month from (now() at time zone 'utc'))::int as m,
      extract(day from (now() at time zone 'utc'))::int as d,
      extract(year from (now() at time zone 'utc'))::int as y
  ),
  birthdays as (
    select
      p.id as user_id,
      p.full_name,
      p.username,
      p.avatar_url,
      'birthday'::text as occasion,
      'Birthday'::text as label,
      case
        when p.date_of_birth is null then null
        else greatest(0, (select y from today) - extract(year from p.date_of_birth)::int)
      end as years,
      null::text as company_name
    from public.profiles p
    join peers pe on pe.peer_id = p.id
    cross join today t
    where p.date_of_birth is not null
      and extract(month from p.date_of_birth)::int = t.m
      and extract(day from p.date_of_birth)::int = t.d
  ),
  marriages as (
    select
      p.id as user_id,
      p.full_name,
      p.username,
      p.avatar_url,
      'marriage_anniversary'::text as occasion,
      'Marriage anniversary'::text as label,
      case
        when p.marriage_anniversary is null then null
        else greatest(1, (select y from today) - extract(year from p.marriage_anniversary)::int)
      end as years,
      null::text as company_name
    from public.profiles p
    join peers pe on pe.peer_id = p.id
    cross join today t
    where p.marriage_anniversary is not null
      and extract(month from p.marriage_anniversary)::int = t.m
      and extract(day from p.marriage_anniversary)::int = t.d
  ),
  jobs as (
    select
      p.id as user_id,
      p.full_name,
      p.username,
      p.avatar_url,
      'work_anniversary'::text as occasion,
      'Work anniversary'::text as label,
      greatest(1, (select y from today) - extract(year from e.start_date)::int) as years,
      e.company_name
    from public.experiences e
    join public.profiles p on p.id = e.user_id
    join peers pe on pe.peer_id = e.user_id
    cross join today t
    where coalesce(e.is_current, false) is true
      and e.start_date is not null
      and extract(month from e.start_date)::int = t.m
      and extract(day from e.start_date)::int = t.d
      and extract(year from e.start_date)::int < t.y
  )
  select * from birthdays
  union all
  select * from marriages
  union all
  select * from jobs
  order by occasion, full_name nulls last;
$$;

revoke all on function public.connection_occasions_today(uuid) from public;
grant execute on function public.connection_occasions_today(uuid) to authenticated;
