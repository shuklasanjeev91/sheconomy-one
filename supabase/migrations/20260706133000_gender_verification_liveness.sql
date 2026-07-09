-- Gender verification sessions + RPC helpers for face liveness flow.

create table if not exists public.gender_verification_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  required_blinks integer not null default 3,
  detected_blinks integer not null default 0,
  liveness_score numeric,
  gender_confidence numeric,
  gender_detected boolean,
  challenge_types text[] not null default array['blink', 'face_position']::text[],
  status text not null default 'pending',
  failure_reason text,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  verified_at timestamptz
);

create index if not exists gender_verification_sessions_user_id_idx
  on public.gender_verification_sessions (user_id, created_at desc);

alter table public.gender_verification_sessions enable row level security;

drop policy if exists "Users read own gender verification sessions" on public.gender_verification_sessions;
create policy "Users read own gender verification sessions"
  on public.gender_verification_sessions
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users insert own gender verification sessions" on public.gender_verification_sessions;
create policy "Users insert own gender verification sessions"
  on public.gender_verification_sessions
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Users update own gender verification sessions" on public.gender_verification_sessions;
create policy "Users update own gender verification sessions"
  on public.gender_verification_sessions
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create or replace function public.create_gender_verification_session(p_required_blinks integer default 3)
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

  insert into public.gender_verification_sessions (
    user_id,
    required_blinks,
    expires_at,
    status
  ) values (
    v_user_id,
    greatest(coalesce(p_required_blinks, 3), 1),
    now() + interval '15 minutes',
    'pending'
  )
  returning id into v_session_id;

  return v_session_id;
end;
$$;

create or replace function public.complete_gender_verification_session(
  p_session_id uuid,
  p_detected_blinks integer,
  p_liveness_score numeric,
  p_gender_detected boolean,
  p_gender_confidence numeric
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_session public.gender_verification_sessions%rowtype;
  v_passed boolean := false;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select *
  into v_session
  from public.gender_verification_sessions
  where id = p_session_id
    and user_id = v_user_id
  for update;

  if not found then
    return jsonb_build_object('success', false, 'message', 'Verification session not found.');
  end if;

  if v_session.status <> 'pending' then
    return jsonb_build_object('success', false, 'message', 'Verification session is no longer active.');
  end if;

  if v_session.expires_at < now() then
    update public.gender_verification_sessions
    set status = 'expired', failure_reason = 'Session expired'
    where id = p_session_id;

    return jsonb_build_object('success', false, 'message', 'Verification session expired. Please try again.');
  end if;

  v_passed :=
    p_detected_blinks >= v_session.required_blinks
    and coalesce(p_liveness_score, 0) >= 0.72
    and coalesce(p_gender_detected, false) = true
    and coalesce(p_gender_confidence, 0) >= 0.62;

  update public.gender_verification_sessions
  set
    detected_blinks = p_detected_blinks,
    liveness_score = p_liveness_score,
    gender_detected = p_gender_detected,
    gender_confidence = p_gender_confidence,
    status = case when v_passed then 'verified' else 'failed' end,
    failure_reason = case when v_passed then null else 'Liveness or gender checks did not pass' end,
    verified_at = case when v_passed then now() else null end
  where id = p_session_id;

  if v_passed then
    update public.profiles
    set
      gender = true,
      gender_verification_method = 'face_liveness',
      gender_verified_at = now(),
      last_verification_attempt = now()
    where id = v_user_id;

    return jsonb_build_object(
      'success', true,
      'verified', true,
      'message', 'Gender verification completed successfully.'
    );
  end if;

  update public.profiles
  set last_verification_attempt = now()
  where id = v_user_id;

  return jsonb_build_object(
    'success', false,
    'verified', false,
    'message', 'Verification failed. Ensure good lighting, face visibility, and natural blinks.'
  );
end;
$$;

grant execute on function public.create_gender_verification_session(integer) to authenticated;
grant execute on function public.complete_gender_verification_session(uuid, integer, numeric, boolean, numeric) to authenticated;
