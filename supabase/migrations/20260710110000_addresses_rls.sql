-- Buyer delivery addresses — users manage their own shipping addresses.

ALTER TABLE public.addresses ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'addresses'
      AND policyname = 'addresses_select_own'
  ) THEN
    CREATE POLICY addresses_select_own
      ON public.addresses
      FOR SELECT
      TO authenticated
      USING (user_id = auth.uid());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'addresses'
      AND policyname = 'addresses_insert_own'
  ) THEN
    CREATE POLICY addresses_insert_own
      ON public.addresses
      FOR INSERT
      TO authenticated
      WITH CHECK (user_id = auth.uid());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'addresses'
      AND policyname = 'addresses_update_own'
  ) THEN
    CREATE POLICY addresses_update_own
      ON public.addresses
      FOR UPDATE
      TO authenticated
      USING (user_id = auth.uid())
      WITH CHECK (user_id = auth.uid());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'addresses'
      AND policyname = 'addresses_delete_own'
  ) THEN
    CREATE POLICY addresses_delete_own
      ON public.addresses
      FOR DELETE
      TO authenticated
      USING (user_id = auth.uid());
  END IF;
END $$;
