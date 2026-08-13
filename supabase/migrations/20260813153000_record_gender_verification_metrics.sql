alter table public.gender_verification_sessions
  add column if not exists client_metrics jsonb;

drop function if exists public.complete_gender_verification_session(
  uuid,
  integer,
  numeric,
  boolean,
  numeric
);

create or replace function public.complete_gender_verification_session(
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
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_session public.gender_verification_sessions%rowtype;
  v_passed boolean := false;
  v_min_gender_confidence constant numeric := 0.6;
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
    client_metrics = p_client_metrics,
    status = case when v_passed then 'verified' else 'failed' end,
    failure_reason = case
      when v_passed then null
      when p_detected_blinks < v_session.required_blinks then 'natural_blinks_incomplete'
      when coalesce(p_liveness_score, 0) < v_min_liveness_score then 'liveness_failed'
      when coalesce(p_gender_detected, false) = false then 'gender_not_female'
      else 'gender_confidence_low'
    end,
    verified_at = case when v_passed then now() else null end
  where id = p_session_id;

  if v_passed then
    update public.profiles
    set
      gender = true,
      is_verified = true,
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
    'message', 'Verification did not confirm verified-female access.'
  );
end;
$$;

grant execute on function public.complete_gender_verification_session(
  uuid,
  integer,
  numeric,
  boolean,
  numeric,
  jsonb
) to authenticated;
