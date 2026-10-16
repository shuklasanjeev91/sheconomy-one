-- profiles.gender is the female flag: true when verification reads female,
-- false otherwise. A confidence floor was rejecting real women before this
-- column was ever written, so access now follows the female boolean plus
-- blinks and liveness.

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
  v_is_female boolean := coalesce(p_gender_detected, false);
  v_passed boolean := false;
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
    and v_is_female;

  update public.gender_verification_sessions
  set
    detected_blinks = p_detected_blinks,
    liveness_score = p_liveness_score,
    gender_detected = v_is_female,
    gender_confidence = p_gender_confidence,
    client_metrics = p_client_metrics,
    status = case when v_passed then 'verified' else 'failed' end,
    failure_reason = case
      when v_passed then null
      when p_detected_blinks < v_session.required_blinks then 'natural_blinks_incomplete'
      when coalesce(p_liveness_score, 0) < v_min_liveness_score then 'liveness_failed'
      when not v_is_female then 'gender_not_female'
      else 'gender_confidence_low'
    end,
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
  where id = v_user_id;

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
