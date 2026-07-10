-- Public LinkedIn-style profile sections: readable career data for non-deleted profiles.
-- Adds SELECT policies (owner + public) and a SECURITY DEFINER RPC used by the app.

DO $$
BEGIN
  ALTER TABLE public.experiences ENABLE ROW LEVEL SECURITY;
  ALTER TABLE public.education ENABLE ROW LEVEL SECURITY;
  ALTER TABLE public.skills ENABLE ROW LEVEL SECURITY;
  ALTER TABLE public.languages ENABLE ROW LEVEL SECURITY;
EXCEPTION
  WHEN undefined_table THEN NULL;
END $$;

-- Owner can read own rows (required for UPDATE and direct client queries).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'experiences' AND policyname = 'owner_experiences_select'
  ) THEN
    CREATE POLICY owner_experiences_select
      ON public.experiences FOR SELECT TO authenticated
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'education' AND policyname = 'owner_education_select'
  ) THEN
    CREATE POLICY owner_education_select
      ON public.education FOR SELECT TO authenticated
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'skills' AND policyname = 'owner_skills_select'
  ) THEN
    CREATE POLICY owner_skills_select
      ON public.skills FOR SELECT TO authenticated
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'languages' AND policyname = 'owner_languages_select'
  ) THEN
    CREATE POLICY owner_languages_select
      ON public.languages FOR SELECT TO authenticated
      USING (auth.uid() = user_id);
  END IF;
END $$;

-- Anyone can read career sections for active (non-deleted) profiles.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'experiences' AND policyname = 'public_profile_experiences_select'
  ) THEN
    CREATE POLICY public_profile_experiences_select
      ON public.experiences FOR SELECT TO anon, authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.id = experiences.user_id AND COALESCE(p.is_deleted, false) = false
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'education' AND policyname = 'public_profile_education_select'
  ) THEN
    CREATE POLICY public_profile_education_select
      ON public.education FOR SELECT TO anon, authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.id = education.user_id AND COALESCE(p.is_deleted, false) = false
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'skills' AND policyname = 'public_profile_skills_select'
  ) THEN
    CREATE POLICY public_profile_skills_select
      ON public.skills FOR SELECT TO anon, authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.id = skills.user_id AND COALESCE(p.is_deleted, false) = false
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'languages' AND policyname = 'public_profile_languages_select'
  ) THEN
    CREATE POLICY public_profile_languages_select
      ON public.languages FOR SELECT TO anon, authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.id = languages.user_id AND COALESCE(p.is_deleted, false) = false
        )
      );
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.get_profile_details(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile public.profiles%ROWTYPE;
BEGIN
  SELECT *
  INTO v_profile
  FROM public.profiles
  WHERE id = p_user_id
    AND COALESCE(is_deleted, false) = false;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  RETURN jsonb_build_object(
    'experiences',
      COALESCE(
        (
          SELECT jsonb_agg(row_to_json(e) ORDER BY e.is_current DESC, e.start_date DESC NULLS LAST)
          FROM (
            SELECT
              id,
              title,
              company_name,
              employment_type,
              location,
              location_type,
              start_date,
              end_date,
              is_current,
              description,
              industry,
              skills
            FROM public.experiences
            WHERE user_id = p_user_id
          ) e
        ),
        '[]'::jsonb
      ),
    'education',
      COALESCE(
        (
          SELECT jsonb_agg(row_to_json(ed) ORDER BY ed.start_year DESC NULLS LAST)
          FROM (
            SELECT
              id,
              school,
              degree,
              field_of_study,
              start_year,
              end_year,
              grade,
              activities,
              description,
              location,
              school_logo_url,
              skills
            FROM public.education
            WHERE user_id = p_user_id
          ) ed
        ),
        '[]'::jsonb
      ),
    'skills',
      COALESCE(
        (
          SELECT jsonb_agg(row_to_json(s) ORDER BY s.endorsements_count DESC NULLS LAST, s.skill_name ASC)
          FROM (
            SELECT
              id,
              skill_name,
              proficiency_level,
              years_of_experience,
              endorsements_count
            FROM public.skills
            WHERE user_id = p_user_id
          ) s
        ),
        '[]'::jsonb
      ),
    'languages',
      COALESCE(
        (
          SELECT jsonb_agg(row_to_json(l) ORDER BY l.language_name ASC)
          FROM (
            SELECT id, language_name, proficiency
            FROM public.languages
            WHERE user_id = p_user_id
          ) l
        ),
        '[]'::jsonb
      ),
    'interests', COALESCE(to_jsonb(v_profile.interests), '[]'::jsonb),
    'socialLinks',
      jsonb_build_object(
        'websiteUrl', v_profile.website_url,
        'portfolioUrl', v_profile.portfolio_url,
        'instagramUrl', v_profile.instagram_url,
        'twitterUrl', v_profile.twitter_url,
        'youtubeUrl', v_profile.youtube_url,
        'githubUrl', v_profile.github_url
      ),
    'profileCompletion', v_profile.profile_completion_percentage
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_profile_details(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_profile_details(uuid) TO anon, authenticated;
