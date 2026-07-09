-- Ensure every meeting has a short LiveKit room_id (e.g. "ubz29f")

create or replace function public.generate_livekit_room_id()
returns text
language plpgsql
as $$
declare
  candidate text;
begin
  loop
    candidate := lower(substr(encode(gen_random_bytes(4), 'hex'), 1, 6));
    exit when not exists (
      select 1 from public.meetings where room_id = candidate
    );
  end loop;
  return candidate;
end;
$$;

create or replace function public.ensure_meeting_room_id()
returns trigger
language plpgsql
as $$
begin
  if new.room_id is null or btrim(new.room_id) = '' then
    new.room_id := public.generate_livekit_room_id();
  end if;
  return new;
end;
$$;

drop trigger if exists meetings_ensure_room_id on public.meetings;

create trigger meetings_ensure_room_id
before insert or update on public.meetings
for each row
execute function public.ensure_meeting_room_id();

-- Backfill meetings missing room_id
do $$
declare
  meeting_row record;
  new_room_id text;
begin
  for meeting_row in
    select id from public.meetings where room_id is null or btrim(room_id) = ''
  loop
    new_room_id := public.generate_livekit_room_id();
    update public.meetings
    set room_id = new_room_id
    where id = meeting_row.id;
  end loop;
end;
$$;

-- Keep one meeting_rooms row per meeting (prefer row matching meetings.room_id)
with ranked as (
  select
    mr.id,
    row_number() over (
      partition by mr.meeting_id
      order by (mr.room_code = m.room_id) desc, mr.activated_at desc nulls last, mr.created_at desc
    ) as rn
  from public.meeting_rooms mr
  join public.meetings m on m.id = mr.meeting_id
)
delete from public.meeting_rooms
where id in (select id from ranked where rn > 1);

-- Align meeting_rooms.room_code with meetings.room_id
update public.meeting_rooms mr
set room_code = m.room_id
from public.meetings m
where mr.meeting_id = m.id
  and m.room_id is not null
  and mr.room_code is distinct from m.room_id;

create or replace function public.ensure_meeting_room_id_rpc(meeting_id_input uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  meeting_row public.meetings%rowtype;
  result_room_id text;
begin
  select * into meeting_row from public.meetings where id = meeting_id_input;
  if not found then
    raise exception 'Meeting not found';
  end if;

  if meeting_row.room_id is not null and btrim(meeting_row.room_id) <> '' then
    return meeting_row.room_id;
  end if;

  result_room_id := public.generate_livekit_room_id();
  update public.meetings set room_id = result_room_id where id = meeting_id_input;

  update public.meeting_rooms
  set room_code = result_room_id
  where meeting_id = meeting_id_input;

  if not found then
    insert into public.meeting_rooms (meeting_id, host_id, room_code, is_active)
    values (meeting_id_input, meeting_row.host_id, result_room_id, meeting_row.status in ('instant', 'active'));
  end if;

  return result_room_id;
end;
$$;

grant execute on function public.ensure_meeting_room_id_rpc(uuid) to authenticated;
