-- Let a signed-in member on a computer (or any device without a camera) hand
-- human verification to a phone. The QR encodes a one-time token. The phone
-- opens that URL and runs the camera check for the account that created it,
-- without signing in as that account.

create table if not exists public.gender_verification_handoffs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  token_hash text not null unique,
  status text not null default 'pending'
    check (status in ('pending', 'opened', 'verified', 'expired')),
  session_id uuid references public.gender_verification_sessions(id) on delete set null,
  failure_reason text,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  opened_at timestamptz,
  verified_at timestamptz
);

create index if not exists gender_verification_handoffs_user_idx
  on public.gender_verification_handoffs (user_id, created_at desc);

alter table public.gender_verification_handoffs enable row level security;

create or replace function public.create_gender_verification_handoff()
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_user_id uuid := auth.uid();
  v_token text;
  v_id uuid;
  v_expires timestamptz := now() + interval '15 minutes';
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  update public.gender_verification_handoffs
  set status = 'expired'
  where user_id = v_user_id
    and status in ('pending', 'opened');

  v_token := encode(extensions.gen_random_bytes(24), 'hex');

  insert into public.gender_verification_handoffs (
    user_id,
    token_hash,
    status,
    expires_at
  ) values (
    v_user_id,
    encode(extensions.digest(convert_to(v_token, 'utf8'), 'sha256'), 'hex'),
    'pending',
    v_expires
  )
  returning id into v_id;

  return jsonb_build_object(
    'id', v_id,
    'token', v_token,
    'expires_at', v_expires
  );
end;
$$;

create or replace function public.poll_gender_verification_handoff(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_row public.gender_verification_handoffs%rowtype;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select *
  into v_row
  from public.gender_verification_handoffs
  where id = p_id
    and user_id = v_user_id
  for update;

  if not found then
    return jsonb_build_object('status', 'missing');
  end if;

  if v_row.status in ('pending', 'opened') and v_row.expires_at < now() then
    update public.gender_verification_handoffs
    set status = 'expired'
    where id = p_id;
    v_row.status := 'expired';
  end if;

  return jsonb_build_object(
    'status', v_row.status,
    'failure_reason', v_row.failure_reason
  );
end;
$$;

create or replace function public.start_gender_verification_handoff(p_token text)
returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_hash text;
  v_handoff public.gender_verification_handoffs%rowtype;
  v_session_id uuid;
begin
  if p_token is null or length(trim(p_token)) < 16 then
    raise exception 'Verification link is invalid';
  end if;

  v_hash := encode(extensions.digest(convert_to(trim(p_token), 'utf8'), 'sha256'), 'hex');

  select *
  into v_handoff
  from public.gender_verification_handoffs
  where token_hash = v_hash
  for update;

  if not found then
    raise exception 'Verification link is invalid';
  end if;

  if v_handoff.status = 'verified' then
    raise exception 'Verification already completed';
  end if;

  if v_handoff.status = 'expired' or v_handoff.expires_at < now() then
    update public.gender_verification_handoffs
    set status = 'expired'
    where id = v_handoff.id;
    raise exception 'Verification link expired';
  end if;

  update public.gender_verification_sessions
  set
    status = 'failed',
    failure_reason = 'superseded',
    verified_at = now()
  where user_id = v_handoff.user_id
    and status = 'pending';

  insert into public.gender_verification_sessions (
    user_id,
    status,
    challenge_types,
    required_blinks,
    expires_at
  ) values (
    v_handoff.user_id,
    'pending',
    array['blink'],
    1,
    least(v_handoff.expires_at, now() + interval '15 minutes')
  )
  returning id into v_session_id;

  update public.gender_verification_handoffs
  set
    status = 'opened',
    session_id = v_session_id,
    opened_at = coalesce(opened_at, now()),
    failure_reason = null
  where id = v_handoff.id;

  return v_session_id;
end;
$$;

create or replace function public.complete_gender_verification_handoff(
  p_token text,
  p_session_id uuid,
  p_detected_blinks integer,
  p_liveness_score numeric,
  p_gender_detected boolean,
  p_gender_confidence numeric,
  p_client_metrics jsonb default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_hash text;
  v_handoff public.gender_verification_handoffs%rowtype;
  v_session public.gender_verification_sessions%rowtype;
  v_is_female boolean := coalesce(p_gender_detected, false);
  v_passed boolean := false;
  v_min_liveness_score constant numeric := 0.7;
  v_reason text;
begin
  if p_token is null or length(trim(p_token)) < 16 then
    return jsonb_build_object('success', false, 'message', 'Verification link is invalid');
  end if;

  v_hash := encode(extensions.digest(convert_to(trim(p_token), 'utf8'), 'sha256'), 'hex');

  select *
  into v_handoff
  from public.gender_verification_handoffs
  where token_hash = v_hash
  for update;

  if not found then
    return jsonb_build_object('success', false, 'message', 'Verification link is invalid');
  end if;

  if v_handoff.expires_at < now() or v_handoff.status = 'expired' then
    update public.gender_verification_handoffs
    set status = 'expired'
    where id = v_handoff.id;
    return jsonb_build_object('success', false, 'message', 'Verification link expired');
  end if;

  if v_handoff.status = 'verified' then
    return jsonb_build_object('success', false, 'message', 'Verification already completed');
  end if;

  select *
  into v_session
  from public.gender_verification_sessions
  where id = p_session_id
    and user_id = v_handoff.user_id
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
    and coalesce(p_liveness_score, 0) >= v_min_liveness_score
    and v_is_female;

  v_reason := case
    when v_passed then null
    when p_detected_blinks < v_session.required_blinks then 'natural_blinks_incomplete'
    when coalesce(p_liveness_score, 0) < v_min_liveness_score then 'liveness_failed'
    when not v_is_female then 'gender_not_female'
    else 'gender_confidence_low'
  end;

  update public.gender_verification_sessions
  set
    detected_blinks = p_detected_blinks,
    liveness_score = p_liveness_score,
    gender_detected = v_is_female,
    gender_confidence = p_gender_confidence,
    client_metrics = p_client_metrics,
    status = case when v_passed then 'verified' else 'failed' end,
    failure_reason = v_reason,
    verified_at = case when v_passed then now() else null end
  where id = p_session_id;

  update public.profiles
  set
    gender = v_is_female,
    is_verified = case
      when v_passed then true
      when not v_is_female then false
      else is_verified
    end,
    gender_verification_method = case
      when v_passed then 'face_liveness'
      else gender_verification_method
    end,
    gender_verified_at = case
      when v_passed then now()
      else gender_verified_at
    end,
    last_verification_attempt = now()
  where id = v_handoff.user_id;

  update public.gender_verification_handoffs
  set
    status = case when v_passed then 'verified' else 'opened' end,
    failure_reason = v_reason,
    verified_at = case when v_passed then now() else null end,
    session_id = p_session_id
  where id = v_handoff.id;

  if v_passed then
    return jsonb_build_object(
      'success', true,
      'verified', true,
      'message', 'Human verification completed successfully.'
    );
  end if;

  return jsonb_build_object(
    'success', false,
    'verified', false,
    'message', case
      when not v_is_female then 'Verification did not confirm verified-female access.'
      else 'Verification did not confirm a live person. Please try again.'
    end
  );
end;
$$;

revoke all on function public.create_gender_verification_handoff() from public;
revoke all on function public.poll_gender_verification_handoff(uuid) from public;
revoke all on function public.start_gender_verification_handoff(text) from public;
revoke all on function public.complete_gender_verification_handoff(text, uuid, integer, numeric, boolean, numeric, jsonb) from public;

grant execute on function public.create_gender_verification_handoff() to authenticated;
grant execute on function public.poll_gender_verification_handoff(uuid) to authenticated;
grant execute on function public.start_gender_verification_handoff(text) to anon, authenticated;
grant execute on function public.complete_gender_verification_handoff(text, uuid, integer, numeric, boolean, numeric, jsonb) to anon, authenticated;
