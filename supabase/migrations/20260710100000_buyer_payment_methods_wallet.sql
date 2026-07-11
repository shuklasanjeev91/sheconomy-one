-- Wallet-style saved payment methods (cards + UPI).

ALTER TABLE public.buyer_payment_methods
  ADD COLUMN IF NOT EXISTS method_type text NOT NULL DEFAULT 'card'
    CHECK (method_type IN ('card', 'upi')),
  ADD COLUMN IF NOT EXISTS card_type text
    CHECK (card_type IS NULL OR card_type IN ('credit', 'debit')),
  ADD COLUMN IF NOT EXISTS upi_id text,
  ADD COLUMN IF NOT EXISTS cardholder_name text;

CREATE INDEX IF NOT EXISTS buyer_payment_methods_user_id_idx
  ON public.buyer_payment_methods (user_id);

ALTER TABLE public.buyer_payment_methods ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'buyer_payment_methods'
      AND policyname = 'buyer_payment_methods_select_own'
  ) THEN
    CREATE POLICY buyer_payment_methods_select_own
      ON public.buyer_payment_methods
      FOR SELECT
      TO authenticated
      USING (user_id = auth.uid());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'buyer_payment_methods'
      AND policyname = 'buyer_payment_methods_insert_own'
  ) THEN
    CREATE POLICY buyer_payment_methods_insert_own
      ON public.buyer_payment_methods
      FOR INSERT
      TO authenticated
      WITH CHECK (user_id = auth.uid());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'buyer_payment_methods'
      AND policyname = 'buyer_payment_methods_update_own'
  ) THEN
    CREATE POLICY buyer_payment_methods_update_own
      ON public.buyer_payment_methods
      FOR UPDATE
      TO authenticated
      USING (user_id = auth.uid())
      WITH CHECK (user_id = auth.uid());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'buyer_payment_methods'
      AND policyname = 'buyer_payment_methods_delete_own'
  ) THEN
    CREATE POLICY buyer_payment_methods_delete_own
      ON public.buyer_payment_methods
      FOR DELETE
      TO authenticated
      USING (user_id = auth.uid());
  END IF;
END $$;
