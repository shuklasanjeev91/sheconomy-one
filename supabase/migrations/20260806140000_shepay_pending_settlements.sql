-- Hold vendor settlement amounts on the platform parent merchant until the shop
-- connects a SHEPay (PayU) child merchant; then release via Automate split.

CREATE TABLE IF NOT EXISTS public.shepay_pending_settlements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL REFERENCES public.shops (id) ON DELETE CASCADE,
  checkout_group_id uuid REFERENCES public.commerce_checkout_groups (id) ON DELETE SET NULL,
  payment_step_id uuid REFERENCES public.commerce_checkout_payment_steps (id) ON DELETE SET NULL,
  payu_id text NOT NULL,
  txnid text,
  amount numeric(12, 2) NOT NULL CHECK (amount > 0),
  currency text NOT NULL DEFAULT 'INR',
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'releasing', 'released', 'failed')),
  child_merchant_key text,
  child_mid text,
  error_message text,
  release_payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  released_at timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS shepay_pending_settlements_shop_payu_uidx
  ON public.shepay_pending_settlements (shop_id, payu_id);

CREATE INDEX IF NOT EXISTS shepay_pending_settlements_shop_status_idx
  ON public.shepay_pending_settlements (shop_id, status);

CREATE INDEX IF NOT EXISTS shepay_pending_settlements_status_idx
  ON public.shepay_pending_settlements (status)
  WHERE status = 'pending';

ALTER TABLE public.shepay_pending_settlements ENABLE ROW LEVEL SECURITY;

-- Shop owners can read their own held settlements (no insert/update from client).
DROP POLICY IF EXISTS shepay_pending_settlements_select_owner ON public.shepay_pending_settlements;
CREATE POLICY shepay_pending_settlements_select_owner
  ON public.shepay_pending_settlements
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.shops s
      WHERE s.id = shepay_pending_settlements.shop_id
        AND s.user_id = auth.uid()
    )
  );

GRANT SELECT ON public.shepay_pending_settlements TO authenticated;
GRANT ALL ON public.shepay_pending_settlements TO service_role;

COMMENT ON TABLE public.shepay_pending_settlements IS
  'SHEPay amounts held on the parent merchant until the shop connects a PayU child merchant, then auto-split/released.';
