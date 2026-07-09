-- Allow public read of profile career details for non-deleted profiles.
-- Needed so authenticated users can view another member's experience, education, skills, and languages.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'experiences'
      AND policyname = 'public_profile_experiences_select'
  ) THEN
    CREATE POLICY public_profile_experiences_select
      ON public.experiences
      FOR SELECT
      TO anon, authenticated
      USING (
        EXISTS (
          SELECT 1
          FROM public.profiles p
          WHERE p.id = experiences.user_id
            AND COALESCE(p.is_deleted, false) = false
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'education'
      AND policyname = 'public_profile_education_select'
  ) THEN
    CREATE POLICY public_profile_education_select
      ON public.education
      FOR SELECT
      TO anon, authenticated
      USING (
        EXISTS (
          SELECT 1
          FROM public.profiles p
          WHERE p.id = education.user_id
            AND COALESCE(p.is_deleted, false) = false
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'skills'
      AND policyname = 'public_profile_skills_select'
  ) THEN
    CREATE POLICY public_profile_skills_select
      ON public.skills
      FOR SELECT
      TO anon, authenticated
      USING (
        EXISTS (
          SELECT 1
          FROM public.profiles p
          WHERE p.id = skills.user_id
            AND COALESCE(p.is_deleted, false) = false
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'languages'
      AND policyname = 'public_profile_languages_select'
  ) THEN
    CREATE POLICY public_profile_languages_select
      ON public.languages
      FOR SELECT
      TO anon, authenticated
      USING (
        EXISTS (
          SELECT 1
          FROM public.profiles p
          WHERE p.id = languages.user_id
            AND COALESCE(p.is_deleted, false) = false
        )
      );
  END IF;
END $$;
