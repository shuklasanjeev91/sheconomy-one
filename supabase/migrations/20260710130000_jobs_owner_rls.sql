-- Job postings — authenticated users can create and manage their own listings.

ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'jobs'
      AND policyname = 'jobs_select_active'
  ) THEN
    CREATE POLICY jobs_select_active
      ON public.jobs
      FOR SELECT
      TO authenticated, anon
      USING (coalesce(is_active, true) = true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'jobs'
      AND policyname = 'jobs_insert_own'
  ) THEN
    CREATE POLICY jobs_insert_own
      ON public.jobs
      FOR INSERT
      TO authenticated
      WITH CHECK (posted_by = auth.uid());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'jobs'
      AND policyname = 'jobs_update_own'
  ) THEN
    CREATE POLICY jobs_update_own
      ON public.jobs
      FOR UPDATE
      TO authenticated
      USING (posted_by = auth.uid())
      WITH CHECK (posted_by = auth.uid());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'jobs'
      AND policyname = 'jobs_delete_own'
  ) THEN
    CREATE POLICY jobs_delete_own
      ON public.jobs
      FOR DELETE
      TO authenticated
      USING (posted_by = auth.uid());
  END IF;
END $$;
