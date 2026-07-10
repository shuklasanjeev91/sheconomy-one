-- Allow authenticated users to manage their own profile career sections.

DO $$
BEGIN
  ALTER TABLE public.experiences ENABLE ROW LEVEL SECURITY;
  ALTER TABLE public.education ENABLE ROW LEVEL SECURITY;
  ALTER TABLE public.skills ENABLE ROW LEVEL SECURITY;
  ALTER TABLE public.languages ENABLE ROW LEVEL SECURITY;
EXCEPTION
  WHEN undefined_table THEN NULL;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'experiences' AND policyname = 'owner_experiences_insert'
  ) THEN
    CREATE POLICY owner_experiences_insert
      ON public.experiences FOR INSERT TO authenticated
      WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'experiences' AND policyname = 'owner_experiences_update'
  ) THEN
    CREATE POLICY owner_experiences_update
      ON public.experiences FOR UPDATE TO authenticated
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'experiences' AND policyname = 'owner_experiences_delete'
  ) THEN
    CREATE POLICY owner_experiences_delete
      ON public.experiences FOR DELETE TO authenticated
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'education' AND policyname = 'owner_education_insert'
  ) THEN
    CREATE POLICY owner_education_insert
      ON public.education FOR INSERT TO authenticated
      WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'education' AND policyname = 'owner_education_update'
  ) THEN
    CREATE POLICY owner_education_update
      ON public.education FOR UPDATE TO authenticated
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'education' AND policyname = 'owner_education_delete'
  ) THEN
    CREATE POLICY owner_education_delete
      ON public.education FOR DELETE TO authenticated
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'skills' AND policyname = 'owner_skills_insert'
  ) THEN
    CREATE POLICY owner_skills_insert
      ON public.skills FOR INSERT TO authenticated
      WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'skills' AND policyname = 'owner_skills_update'
  ) THEN
    CREATE POLICY owner_skills_update
      ON public.skills FOR UPDATE TO authenticated
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'skills' AND policyname = 'owner_skills_delete'
  ) THEN
    CREATE POLICY owner_skills_delete
      ON public.skills FOR DELETE TO authenticated
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'languages' AND policyname = 'owner_languages_insert'
  ) THEN
    CREATE POLICY owner_languages_insert
      ON public.languages FOR INSERT TO authenticated
      WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'languages' AND policyname = 'owner_languages_update'
  ) THEN
    CREATE POLICY owner_languages_update
      ON public.languages FOR UPDATE TO authenticated
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'languages' AND policyname = 'owner_languages_delete'
  ) THEN
    CREATE POLICY owner_languages_delete
      ON public.languages FOR DELETE TO authenticated
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'profiles' AND policyname = 'owner_profiles_update'
  ) THEN
    CREATE POLICY owner_profiles_update
      ON public.profiles FOR UPDATE TO authenticated
      USING (auth.uid() = id)
      WITH CHECK (auth.uid() = id);
  END IF;
END $$;
