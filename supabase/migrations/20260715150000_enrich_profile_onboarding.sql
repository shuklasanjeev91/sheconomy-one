-- Profile onboarding enrichment: locale fields, intents, richer auth metadata upsert, completion weights.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS timezone text,
  ADD COLUMN IF NOT EXISTS country_code text,
  ADD COLUMN IF NOT EXISTS member_intents text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS onboarding_completed_at timestamptz;

CREATE OR REPLACE FUNCTION public.upsert_profile_for_auth_user(
  p_id uuid,
  p_email text,
  p_phone text,
  p_email_confirmed_at timestamp with time zone,
  p_phone_confirmed_at timestamp with time zone,
  p_raw_user_meta_data jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  user_gender BOOLEAN;
  generated_username TEXT;
  generated_referral TEXT;
  user_full_name TEXT;
  user_avatar TEXT;
  user_role CHAR(1);
  is_email_verified BOOLEAN;
  is_phone_verified BOOLEAN;
  user_account_status VARCHAR;
  normalized_email TEXT;
  normalized_phone TEXT;
  meta jsonb := COALESCE(p_raw_user_meta_data, '{}'::jsonb);
BEGIN
  IF auth.role() = 'authenticated' AND auth.uid() IS DISTINCT FROM p_id THEN
    RAISE EXCEPTION 'not authorized to upsert another user profile';
  END IF;

  normalized_email := NULLIF(TRIM(p_email), '');
  normalized_phone := NULLIF(TRIM(p_phone), '');

  user_gender := COALESCE((meta->>'gender')::boolean, false);

  user_full_name := NULLIF(TRIM(COALESCE(
    meta->>'full_name',
    meta->>'name',
    CONCAT_WS(' ', NULLIF(TRIM(meta->>'given_name'), ''), NULLIF(TRIM(meta->>'family_name'), '')),
    ''
  )), '');

  user_avatar := NULLIF(TRIM(COALESCE(
    meta->>'avatar_url',
    meta->>'picture',
    meta->>'picture_url',
    meta->>'avatar',
    ''
  )), '');

  IF user_full_name IS NULL AND normalized_email IS NOT NULL THEN
    user_full_name := SPLIT_PART(normalized_email, '@', 1);
  END IF;

  IF user_full_name IS NULL AND normalized_phone IS NOT NULL THEN
    user_full_name := 'user_' || RIGHT(REGEXP_REPLACE(normalized_phone, '\D', '', 'g'), 4);
  END IF;

  user_role := COALESCE(LEFT(meta->>'role', 1), 'U')::CHAR(1);
  is_email_verified := p_email_confirmed_at IS NOT NULL;
  is_phone_verified := p_phone_confirmed_at IS NOT NULL;
  user_account_status := CASE
    WHEN is_email_verified OR is_phone_verified THEN 'active'
    ELSE 'pending'
  END;

  generated_username := public.generate_unique_username();
  generated_referral := public.generate_referral_code();

  INSERT INTO public.profiles (
    id, role, gender, is_verified, email_verified, phone_verified,
    username, full_name, avatar_url, referral_code, email, phone,
    account_status, created_at, updated_at
  )
  VALUES (
    p_id, user_role, user_gender, false, is_email_verified, is_phone_verified,
    generated_username, COALESCE(user_full_name, generated_username), user_avatar,
    generated_referral, normalized_email, normalized_phone,
    user_account_status, now(), now()
  )
  ON CONFLICT (id) DO UPDATE
  SET
    email = COALESCE(EXCLUDED.email, public.profiles.email),
    phone = COALESCE(EXCLUDED.phone, public.profiles.phone),
    email_verified = public.profiles.email_verified OR EXCLUDED.email_verified,
    phone_verified = public.profiles.phone_verified OR EXCLUDED.phone_verified,
    account_status = CASE
      WHEN EXCLUDED.email_verified OR EXCLUDED.phone_verified THEN 'active'
      ELSE public.profiles.account_status
    END,
    full_name = COALESCE(NULLIF(TRIM(public.profiles.full_name), ''), EXCLUDED.full_name),
    avatar_url = COALESCE(NULLIF(TRIM(public.profiles.avatar_url), ''), EXCLUDED.avatar_url),
    updated_at = now();
END;
$$;

CREATE OR REPLACE FUNCTION public.calculate_profile_completion(profile_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  completion_score INTEGER := 0;
  total_fields INTEGER := 14;
  profile_record public.profiles%ROWTYPE;
BEGIN
  SELECT * INTO profile_record FROM public.profiles WHERE id = profile_id;

  IF NOT FOUND THEN
    RETURN 0;
  END IF;

  SELECT
    CASE WHEN profile_record.full_name IS NOT NULL AND profile_record.full_name != '' THEN 2 ELSE 0 END +
    CASE WHEN profile_record.username IS NOT NULL AND profile_record.username != '' THEN 1 ELSE 0 END +
    CASE WHEN profile_record.avatar_url IS NOT NULL AND profile_record.avatar_url != '' THEN 1 ELSE 0 END +
    CASE WHEN profile_record.bio IS NOT NULL AND profile_record.bio != '' THEN 1 ELSE 0 END +
    CASE WHEN COALESCE(profile_record.phone_verified, false) THEN 1
         WHEN profile_record.phone IS NOT NULL AND profile_record.phone != '' THEN 1
         ELSE 0 END +
    CASE WHEN EXISTS(SELECT 1 FROM public.addresses WHERE user_id = profile_id AND city IS NOT NULL) THEN 1 ELSE 0 END +
    CASE WHEN EXISTS(SELECT 1 FROM public.addresses WHERE user_id = profile_id AND state IS NOT NULL) THEN 1 ELSE 0 END +
    CASE WHEN EXISTS(SELECT 1 FROM public.addresses WHERE user_id = profile_id AND address_line_1 IS NOT NULL) THEN 1 ELSE 0 END +
    CASE WHEN profile_record.date_of_birth IS NOT NULL THEN 1 ELSE 0 END +
    CASE WHEN profile_record.occupation IS NOT NULL AND profile_record.occupation != '' THEN 1 ELSE 0 END +
    CASE WHEN profile_record.interests IS NOT NULL AND cardinality(profile_record.interests) > 0 THEN 1 ELSE 0 END +
    CASE WHEN profile_record.timezone IS NOT NULL AND profile_record.timezone != '' THEN 1 ELSE 0 END +
    CASE WHEN profile_record.country_code IS NOT NULL AND profile_record.country_code != '' THEN 1 ELSE 0 END +
    CASE WHEN profile_record.member_intents IS NOT NULL AND cardinality(profile_record.member_intents) > 0 THEN 1 ELSE 0 END
  INTO completion_score;

  RETURN LEAST(100, (completion_score * 100 / total_fields));
END;
$$;
