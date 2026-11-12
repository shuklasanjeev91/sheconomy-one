-- Drop Shiprocket wallet product; add Easyship per-shop shipping credit ledger.

-- ---------------------------------------------------------------------------
-- 1. Remove Shiprocket wallet
-- ---------------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_notify_shiprocket_wallet_low ON public.shiprocket_wallet_mirrors;
DROP FUNCTION IF EXISTS public.notify_shiprocket_wallet_low();

DROP TABLE IF EXISTS public.shiprocket_wallet_debits CASCADE;
DROP TABLE IF EXISTS public.shiprocket_wallet_mirrors CASCADE;

UPDATE public.notification_templates
SET is_active = false, updated_at = now()
WHERE template_key = 'shiprocket_wallet_low_seller' AND is_active = true;

-- ---------------------------------------------------------------------------
-- 2. Easyship shipping credit ledger
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.easyship_shipping_credits (
  shop_id uuid PRIMARY KEY REFERENCES public.shops(id) ON DELETE CASCADE,
  balance_amount numeric(14, 2) NOT NULL DEFAULT 0 CHECK (balance_amount >= 0),
  currency text NOT NULL DEFAULT 'INR',
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.easyship_shipping_credit_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  entry_type text NOT NULL CHECK (
    entry_type IN ('credit_from_order', 'debit_label', 'topup', 'adjustment')
  ),
  amount numeric(14, 2) NOT NULL CHECK (amount > 0),
  currency text NOT NULL DEFAULT 'INR',
  easyship_shipment_id text,
  idempotency_key text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT easyship_shipping_credit_ledger_idem_uidx UNIQUE (idempotency_key)
);

CREATE INDEX IF NOT EXISTS easyship_shipping_credit_ledger_shop_created_idx
  ON public.easyship_shipping_credit_ledger (shop_id, created_at DESC);

CREATE INDEX IF NOT EXISTS easyship_shipping_credit_ledger_order_idx
  ON public.easyship_shipping_credit_ledger (order_id)
  WHERE order_id IS NOT NULL;

ALTER TABLE public.easyship_shipping_credits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.easyship_shipping_credit_ledger ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS easyship_shipping_credits_select_owner ON public.easyship_shipping_credits;
CREATE POLICY easyship_shipping_credits_select_owner
  ON public.easyship_shipping_credits
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.shops s
      WHERE s.id = easyship_shipping_credits.shop_id
        AND s.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS easyship_shipping_credit_ledger_select_owner ON public.easyship_shipping_credit_ledger;
CREATE POLICY easyship_shipping_credit_ledger_select_owner
  ON public.easyship_shipping_credit_ledger
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.shops s
      WHERE s.id = easyship_shipping_credit_ledger.shop_id
        AND s.user_id = auth.uid()
    )
  );

GRANT SELECT ON public.easyship_shipping_credits TO authenticated;
GRANT SELECT ON public.easyship_shipping_credit_ledger TO authenticated;
GRANT ALL ON public.easyship_shipping_credits TO service_role;
GRANT ALL ON public.easyship_shipping_credit_ledger TO service_role;

COMMENT ON TABLE public.easyship_shipping_credits IS
  'Per-shop prepaid shipping credit for Easyship labels. Cash DDP remittance stays on platform Airwallex; this ledger gates label purchase.';
COMMENT ON TABLE public.easyship_shipping_credit_ledger IS
  'Append-only ledger for Easyship shipping credits (order credit, label debit, topup, adjustment).';

-- Credit seller from buyer-paid shipping on a paid order (idempotent).
CREATE OR REPLACE FUNCTION public.easyship_credit_shipping_from_order(p_order_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order record;
  v_amount numeric(14, 2);
  v_currency text;
  v_key text;
  v_meta jsonb;
  v_easyship jsonb;
  v_existing uuid;
BEGIN
  -- Invoked by service_role edges and SECURITY DEFINER paid-order trigger.
  SELECT o.id, o.shop_id, o.shipping_amount, o.currency, o.order_metadata, o.order_status
  INTO v_order
  FROM public.orders o
  WHERE o.id = p_order_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'order_not_found');
  END IF;

  v_key := 'credit_from_order:' || p_order_id::text;
  SELECT id INTO v_existing
  FROM public.easyship_shipping_credit_ledger
  WHERE idempotency_key = v_key;
  IF v_existing IS NOT NULL THEN
    RETURN jsonb_build_object('ok', true, 'duplicate', true, 'ledger_id', v_existing);
  END IF;

  v_meta := coalesce(v_order.order_metadata, '{}'::jsonb);
  v_easyship := v_meta->'easyship';
  v_amount := coalesce(
    nullif((v_easyship->>'shipment_charge')::numeric, 0),
    nullif((v_easyship->>'shipping_amount')::numeric, 0),
    nullif((v_meta->'shipping_info'->>'shipment_charge')::numeric, 0),
    nullif((v_order.shipping_amount)::numeric, 0),
    0
  );
  v_currency := upper(coalesce(
    nullif(trim(v_easyship->>'currency'), ''),
    nullif(trim(v_order.currency), ''),
    'INR'
  ));

  IF v_amount <= 0 THEN
    RETURN jsonb_build_object('ok', true, 'skipped', true, 'reason', 'zero_shipping');
  END IF;

  INSERT INTO public.easyship_shipping_credits (shop_id, balance_amount, currency, updated_at)
  VALUES (v_order.shop_id, v_amount, v_currency, now())
  ON CONFLICT (shop_id) DO UPDATE
  SET
    balance_amount = public.easyship_shipping_credits.balance_amount + EXCLUDED.balance_amount,
    currency = EXCLUDED.currency,
    updated_at = now();

  INSERT INTO public.easyship_shipping_credit_ledger (
    shop_id, order_id, entry_type, amount, currency, idempotency_key, payload
  ) VALUES (
    v_order.shop_id,
    p_order_id,
    'credit_from_order',
    v_amount,
    v_currency,
    v_key,
    jsonb_build_object(
      'order_status', v_order.order_status,
      'easyship', v_easyship,
      'shipping_amount', v_order.shipping_amount
    )
  );

  RETURN jsonb_build_object(
    'ok', true,
    'shop_id', v_order.shop_id,
    'amount', v_amount,
    'currency', v_currency
  );
END;
$$;

REVOKE ALL ON FUNCTION public.easyship_credit_shipping_from_order(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.easyship_credit_shipping_from_order(uuid) TO service_role;

-- Debit shop credit when an Easyship label is purchased.
CREATE OR REPLACE FUNCTION public.easyship_debit_shipping_for_label(
  p_shop_id uuid,
  p_order_id uuid,
  p_amount numeric,
  p_easyship_shipment_id text DEFAULT NULL,
  p_idempotency_key text DEFAULT NULL,
  p_payload jsonb DEFAULT '{}'::jsonb,
  p_currency text DEFAULT 'INR'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_amount numeric(14, 2) := round(coalesce(p_amount, 0)::numeric, 2);
  v_key text;
  v_existing uuid;
  v_balance numeric(14, 2);
  v_currency text := upper(coalesce(nullif(trim(p_currency), ''), 'INR'));
BEGIN
  IF v_amount <= 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_amount');
  END IF;

  v_key := coalesce(
    nullif(trim(p_idempotency_key), ''),
    'debit_label:' || coalesce(p_easyship_shipment_id, p_order_id::text) || ':' || v_amount::text
  );

  SELECT id INTO v_existing
  FROM public.easyship_shipping_credit_ledger
  WHERE idempotency_key = v_key;
  IF v_existing IS NOT NULL THEN
    RETURN jsonb_build_object('ok', true, 'duplicate', true, 'ledger_id', v_existing);
  END IF;

  INSERT INTO public.easyship_shipping_credits (shop_id, balance_amount, currency, updated_at)
  VALUES (p_shop_id, 0, v_currency, now())
  ON CONFLICT (shop_id) DO NOTHING;

  SELECT balance_amount INTO v_balance
  FROM public.easyship_shipping_credits
  WHERE shop_id = p_shop_id
  FOR UPDATE;

  IF coalesce(v_balance, 0) < v_amount THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'insufficient_credit',
      'balance', coalesce(v_balance, 0),
      'required', v_amount
    );
  END IF;

  UPDATE public.easyship_shipping_credits
  SET balance_amount = balance_amount - v_amount, updated_at = now()
  WHERE shop_id = p_shop_id;

  INSERT INTO public.easyship_shipping_credit_ledger (
    shop_id, order_id, entry_type, amount, currency, easyship_shipment_id, idempotency_key, payload
  ) VALUES (
    p_shop_id,
    p_order_id,
    'debit_label',
    v_amount,
    v_currency,
    nullif(trim(p_easyship_shipment_id), ''),
    v_key,
    coalesce(p_payload, '{}'::jsonb)
  );

  RETURN jsonb_build_object(
    'ok', true,
    'shop_id', p_shop_id,
    'amount', v_amount,
    'balance_after', coalesce(v_balance, 0) - v_amount
  );
END;
$$;

REVOKE ALL ON FUNCTION public.easyship_debit_shipping_for_label(uuid, uuid, numeric, text, text, jsonb, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.easyship_debit_shipping_for_label(uuid, uuid, numeric, text, text, jsonb, text) TO service_role;

-- Manual / admin top-up of seller shipping credit.
CREATE OR REPLACE FUNCTION public.easyship_topup_shipping_credit(
  p_shop_id uuid,
  p_amount numeric,
  p_idempotency_key text,
  p_currency text DEFAULT 'INR',
  p_payload jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_amount numeric(14, 2) := round(coalesce(p_amount, 0)::numeric, 2);
  v_key text := nullif(trim(p_idempotency_key), '');
  v_existing uuid;
  v_currency text := upper(coalesce(nullif(trim(p_currency), ''), 'INR'));
BEGIN
  IF v_amount <= 0 OR v_key IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_args');
  END IF;

  SELECT id INTO v_existing
  FROM public.easyship_shipping_credit_ledger
  WHERE idempotency_key = v_key;
  IF v_existing IS NOT NULL THEN
    RETURN jsonb_build_object('ok', true, 'duplicate', true, 'ledger_id', v_existing);
  END IF;

  INSERT INTO public.easyship_shipping_credits (shop_id, balance_amount, currency, updated_at)
  VALUES (p_shop_id, v_amount, v_currency, now())
  ON CONFLICT (shop_id) DO UPDATE
  SET
    balance_amount = public.easyship_shipping_credits.balance_amount + EXCLUDED.balance_amount,
    currency = EXCLUDED.currency,
    updated_at = now();

  INSERT INTO public.easyship_shipping_credit_ledger (
    shop_id, entry_type, amount, currency, idempotency_key, payload
  ) VALUES (
    p_shop_id,
    'topup',
    v_amount,
    v_currency,
    v_key,
    coalesce(p_payload, '{}'::jsonb)
  );

  RETURN jsonb_build_object('ok', true, 'shop_id', p_shop_id, 'amount', v_amount);
END;
$$;

REVOKE ALL ON FUNCTION public.easyship_topup_shipping_credit(uuid, numeric, text, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.easyship_topup_shipping_credit(uuid, numeric, text, text, jsonb) TO service_role;

-- Low shipping-credit notify (≤ 100 in shop currency units).
CREATE OR REPLACE FUNCTION public.notify_easyship_shipping_credit_low()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner uuid;
  v_shop_name text;
  v_threshold numeric := 100;
  v_prev numeric;
BEGIN
  IF NEW.balance_amount IS NULL THEN
    RETURN NEW;
  END IF;

  v_prev := COALESCE(OLD.balance_amount, NEW.balance_amount + 1);
  IF NOT (
    NEW.balance_amount <= v_threshold
    AND (TG_OP = 'INSERT' OR v_prev > v_threshold)
  ) THEN
    RETURN NEW;
  END IF;

  SELECT s.user_id, s.shop_name
  INTO v_owner, v_shop_name
  FROM public.shops s
  WHERE s.id = NEW.shop_id;

  IF v_owner IS NULL THEN
    RETURN NEW;
  END IF;

  PERFORM public.create_notification_idempotent(
    'easyship_shipping_credit_low_seller',
    v_owner,
    'easyship_credit_low:' || NEW.shop_id::text || ':' || to_char(timezone('utc', now()), 'YYYY-MM-DD'),
    jsonb_build_object(
      'balance', to_char(NEW.balance_amount, 'FM999999990.00'),
      'currency', COALESCE(NEW.currency, 'INR'),
      'shop_name', COALESCE(v_shop_name, 'Your shop')
    ),
    'shop',
    NEW.shop_id,
    NULL,
    NULL,
    4,
    NULL,
    'easyship_shipping_credit_trigger'
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_easyship_shipping_credit_low ON public.easyship_shipping_credits;
CREATE TRIGGER trg_notify_easyship_shipping_credit_low
  AFTER INSERT OR UPDATE OF balance_amount ON public.easyship_shipping_credits
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_easyship_shipping_credit_low();

INSERT INTO public.notification_templates (
  template_key,
  category,
  platform,
  title_template,
  message_template,
  action_url_template,
  default_channels,
  default_priority,
  is_active
)
VALUES (
  'easyship_shipping_credit_low_seller',
  'transactional',
  'marketplace',
  'Shipping credit running low',
  'Your Easyship shipping credit is {{balance}} {{currency}}. Recharge under Vendor → Shipping credit before processing more shipments.',
  '/vendor/wallet',
  ARRAY['in_app', 'push', 'email']::text[],
  4,
  true
)
ON CONFLICT (template_key) DO UPDATE SET
  title_template = EXCLUDED.title_template,
  message_template = EXCLUDED.message_template,
  action_url_template = EXCLUDED.action_url_template,
  is_active = true,
  updated_at = now();

-- Auto-credit triggers live in 20261030170000_easyship_credit_trigger_and_checkout_meta.sql
-- (orders use order_status / order_payments.payment_status, not payment_status).
