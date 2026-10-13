-- Human verification asks for one natural blink instead of two (or three).
-- Clients already pass p_required_blinks; this only aligns the defaults so a
-- session created without the argument matches the app.

alter table public.gender_verification_sessions
  alter column required_blinks set default 1;

create or replace function public.create_gender_verification_session(
  p_required_blinks integer default 1
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_session_id uuid;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  update public.gender_verification_sessions
  set
    status = 'failed',
    failure_reason = 'superseded',
    verified_at = now()
  where user_id = v_user_id
    and status = 'pending';

  insert into public.gender_verification_sessions (
    user_id,
    status,
    challenge_types,
    required_blinks,
    expires_at
  )
  values (
    v_user_id,
    'pending',
    array['blink'],
    greatest(coalesce(p_required_blinks, 1), 1),
    now() + interval '15 minutes'
  )
  returning id into v_session_id;

  return v_session_id;
end;
$$;

grant execute on function public.create_gender_verification_session(integer) to authenticated;
