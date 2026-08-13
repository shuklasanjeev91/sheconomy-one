-- Soften the shared liveness floor to match the client
-- (`GENDER_VERIFICATION.minLivenessScore = 0.7`) and default new sessions to
-- 2 blinks so the server stays aligned with the shorter, easier UX.

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
  -- Mirrors GENDER_VERIFICATION.minGenderConfidence on the client.
  v_min_gender_confidence constant numeric := 0.6;
  -- Mirrors GENDER_VERIFICATION.minLivenessScore on the client.
  v_min_liveness_score constant numeric := 0.7;
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
    and coalesce(p_liveness_score, 0) >= v_min_liveness_score
    and coalesce(p_gender_detected, false) = true
    and coalesce(p_gender_confidence, 0) >= v_min_gender_confidence;

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
      'message', 'Human verification completed successfully.'
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

create or replace function public.create_gender_verification_session(
  p_required_blinks integer default 2
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
    greatest(coalesce(p_required_blinks, 2), 1),
    now() + interval '15 minutes'
  )
  returning id into v_session_id;

  return v_session_id;
end;
$$;

grant execute on function public.complete_gender_verification_session(uuid, integer, numeric, boolean, numeric) to authenticated;
grant execute on function public.create_gender_verification_session(integer) to authenticated;
