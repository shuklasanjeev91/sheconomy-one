-- Unified platform wallets (user + shop) + referral rewards.
-- Shop wallets absorb EasyShip shipping credit balances; labels/ads/checkout debit here.
-- Idempotent: safe to re-run in the SQL editor if objects already exist.

DO $$ BEGIN
  CREATE TYPE public.platform_wallet_owner_type AS ENUM ('user', 'shop');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.platform_wallet_ledger_type AS ENUM (
    'topup',
    'spend_shipping',
    'spend_ads',
    'spend_checkout',
    'referral_credit',
    'referral_clawback',
    'adjustment',
    'migration'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.platform_wallet_topup_status AS ENUM (
    'pending',
    'processing',
    'completed',
    'failed',
    'cancelled'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.referral_program_type AS ENUM ('buyer_buyer', 'seller_seller');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.referral_reward_status AS ENUM (
    'pending',
    'credited',
    'clawed_back',
    'cancelled'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.platform_wallets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_type public.platform_wallet_owner_type NOT NULL,
  owner_id uuid NOT NULL,
  currency text NOT NULL DEFAULT 'INR',
  available_balance numeric(14, 2) NOT NULL DEFAULT 0 CHECK (available_balance >= 0),
  held_balance numeric(14, 2) NOT NULL DEFAULT 0 CHECK (held_balance >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_type, owner_id)
);

CREATE INDEX IF NOT EXISTS platform_wallets_owner_idx
  ON public.platform_wallets (owner_type, owner_id);

CREATE TABLE IF NOT EXISTS public.platform_wallet_topups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id uuid NOT NULL REFERENCES public.platform_wallets (id) ON DELETE CASCADE,
  owner_type public.platform_wallet_owner_type NOT NULL,
  owner_id uuid NOT NULL,
  initiated_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  amount numeric(14, 2) NOT NULL CHECK (amount > 0),
  currency text NOT NULL DEFAULT 'INR',
  status public.platform_wallet_topup_status NOT NULL DEFAULT 'pending',
  provider text NOT NULL DEFAULT 'payu',
  txnid text NOT NULL,
  gateway_transaction_id text,
  checkout_url text,
  failure_reason text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (txnid)
);

CREATE INDEX IF NOT EXISTS platform_wallet_topups_wallet_idx
  ON public.platform_wallet_topups (wallet_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.platform_wallet_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id uuid NOT NULL REFERENCES public.platform_wallets (id) ON DELETE CASCADE,
  owner_type public.platform_wallet_owner_type NOT NULL,
  owner_id uuid NOT NULL,
  entry_type public.platform_wallet_ledger_type NOT NULL,
  amount numeric(14, 2) NOT NULL CHECK (amount > 0),
  currency text NOT NULL DEFAULT 'INR',
  direction text NOT NULL CHECK (direction IN ('credit', 'debit')),
  balance_after numeric(14, 2),
  idempotency_key text NOT NULL,
  topup_id uuid REFERENCES public.platform_wallet_topups (id) ON DELETE SET NULL,
  order_id uuid REFERENCES public.orders (id) ON DELETE SET NULL,
  shop_id uuid REFERENCES public.shops (id) ON DELETE SET NULL,
  campaign_id uuid,
  referral_reward_id uuid,
  description text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (idempotency_key)
);

CREATE INDEX IF NOT EXISTS platform_wallet_ledger_wallet_idx
  ON public.platform_wallet_ledger (wallet_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.referral_rewards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  program public.referral_program_type NOT NULL,
  referrer_user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  referee_user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  referrer_shop_id uuid REFERENCES public.shops (id) ON DELETE SET NULL,
  referee_shop_id uuid REFERENCES public.shops (id) ON DELETE SET NULL,
  qualifying_order_id uuid REFERENCES public.orders (id) ON DELETE SET NULL,
  amount numeric(14, 2) NOT NULL CHECK (amount > 0),
  currency text NOT NULL DEFAULT 'INR',
  beneficiary_owner_type public.platform_wallet_owner_type NOT NULL,
  beneficiary_owner_id uuid NOT NULL,
  status public.referral_reward_status NOT NULL DEFAULT 'pending',
  credited_at timestamptz,
  clawed_back_at timestamptz,
  idempotency_key text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (idempotency_key)
);

CREATE INDEX IF NOT EXISTS referral_rewards_referrer_idx
  ON public.referral_rewards (referrer_user_id, created_at DESC);

ALTER TABLE public.platform_wallet_ledger
  DROP CONSTRAINT IF EXISTS platform_wallet_ledger_referral_reward_id_fkey;
ALTER TABLE public.platform_wallet_ledger
  ADD CONSTRAINT platform_wallet_ledger_referral_reward_id_fkey
  FOREIGN KEY (referral_reward_id) REFERENCES public.referral_rewards (id) ON DELETE SET NULL;

ALTER TABLE public.platform_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_wallet_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_wallet_topups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referral_rewards ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.platform_wallet_is_owner(
  p_owner_type public.platform_wallet_owner_type,
  p_owner_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN p_owner_type = 'user' THEN p_owner_id = auth.uid()
    WHEN p_owner_type = 'shop' THEN EXISTS (
      SELECT 1 FROM public.shops s WHERE s.id = p_owner_id AND s.user_id = auth.uid()
    )
    ELSE false
  END;
$$;

DROP POLICY IF EXISTS platform_wallets_select_own ON public.platform_wallets;
CREATE POLICY platform_wallets_select_own ON public.platform_wallets
  FOR SELECT TO authenticated
  USING (public.platform_wallet_is_owner(owner_type, owner_id));

DROP POLICY IF EXISTS platform_wallet_ledger_select_own ON public.platform_wallet_ledger;
CREATE POLICY platform_wallet_ledger_select_own ON public.platform_wallet_ledger
  FOR SELECT TO authenticated
  USING (public.platform_wallet_is_owner(owner_type, owner_id));

DROP POLICY IF EXISTS platform_wallet_topups_select_own ON public.platform_wallet_topups;
CREATE POLICY platform_wallet_topups_select_own ON public.platform_wallet_topups
  FOR SELECT TO authenticated
  USING (public.platform_wallet_is_owner(owner_type, owner_id));

DROP POLICY IF EXISTS referral_rewards_select_own ON public.referral_rewards;
CREATE POLICY referral_rewards_select_own ON public.referral_rewards
  FOR SELECT TO authenticated
  USING (referrer_user_id = auth.uid() OR referee_user_id = auth.uid());

-- Get or create wallet
CREATE OR REPLACE FUNCTION public.platform_wallet_get_or_create(
  p_owner_type public.platform_wallet_owner_type,
  p_owner_id uuid,
  p_currency text DEFAULT 'INR'
)
RETURNS public.platform_wallets
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.platform_wallets%ROWTYPE;
  v_currency text := upper(coalesce(nullif(trim(p_currency), ''), 'INR'));
BEGIN
  IF p_owner_id IS NULL THEN
    RAISE EXCEPTION 'owner_id required';
  END IF;

  INSERT INTO public.platform_wallets (owner_type, owner_id, currency)
  VALUES (p_owner_type, p_owner_id, v_currency)
  ON CONFLICT (owner_type, owner_id) DO NOTHING;

  SELECT * INTO v_row
  FROM public.platform_wallets
  WHERE owner_type = p_owner_type AND owner_id = p_owner_id;

  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.platform_wallet_get_or_create(public.platform_wallet_owner_type, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.platform_wallet_get_or_create(public.platform_wallet_owner_type, uuid, text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.platform_wallet_credit(
  p_owner_type public.platform_wallet_owner_type,
  p_owner_id uuid,
  p_amount numeric,
  p_entry_type public.platform_wallet_ledger_type,
  p_idempotency_key text,
  p_currency text DEFAULT 'INR',
  p_description text DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb,
  p_topup_id uuid DEFAULT NULL,
  p_order_id uuid DEFAULT NULL,
  p_shop_id uuid DEFAULT NULL,
  p_campaign_id uuid DEFAULT NULL,
  p_referral_reward_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_amount numeric(14, 2) := round(coalesce(p_amount, 0)::numeric, 2);
  v_key text := nullif(trim(p_idempotency_key), '');
  v_wallet public.platform_wallets%ROWTYPE;
  v_existing uuid;
  v_ledger_id uuid;
BEGIN
  IF v_amount <= 0 OR v_key IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_args');
  END IF;

  SELECT id INTO v_existing FROM public.platform_wallet_ledger WHERE idempotency_key = v_key;
  IF v_existing IS NOT NULL THEN
    RETURN jsonb_build_object('ok', true, 'duplicate', true, 'ledger_id', v_existing);
  END IF;

  v_wallet := public.platform_wallet_get_or_create(p_owner_type, p_owner_id, p_currency);

  UPDATE public.platform_wallets
  SET available_balance = available_balance + v_amount, updated_at = now()
  WHERE id = v_wallet.id
  RETURNING * INTO v_wallet;

  INSERT INTO public.platform_wallet_ledger (
    wallet_id, owner_type, owner_id, entry_type, amount, currency, direction,
    balance_after, idempotency_key, topup_id, order_id, shop_id, campaign_id,
    referral_reward_id, description, metadata
  ) VALUES (
    v_wallet.id, p_owner_type, p_owner_id, p_entry_type, v_amount,
    upper(coalesce(nullif(trim(p_currency), ''), v_wallet.currency)),
    'credit', v_wallet.available_balance, v_key, p_topup_id, p_order_id, p_shop_id,
    p_campaign_id, p_referral_reward_id, p_description, coalesce(p_metadata, '{}'::jsonb)
  )
  RETURNING id INTO v_ledger_id;

  RETURN jsonb_build_object(
    'ok', true,
    'wallet_id', v_wallet.id,
    'ledger_id', v_ledger_id,
    'balance', v_wallet.available_balance,
    'amount', v_amount
  );
END;
$$;

REVOKE ALL ON FUNCTION public.platform_wallet_credit(
  public.platform_wallet_owner_type, uuid, numeric, public.platform_wallet_ledger_type,
  text, text, text, jsonb, uuid, uuid, uuid, uuid, uuid
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.platform_wallet_credit(
  public.platform_wallet_owner_type, uuid, numeric, public.platform_wallet_ledger_type,
  text, text, text, jsonb, uuid, uuid, uuid, uuid, uuid
) TO service_role;

CREATE OR REPLACE FUNCTION public.platform_wallet_debit(
  p_owner_type public.platform_wallet_owner_type,
  p_owner_id uuid,
  p_amount numeric,
  p_entry_type public.platform_wallet_ledger_type,
  p_idempotency_key text,
  p_currency text DEFAULT 'INR',
  p_description text DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb,
  p_order_id uuid DEFAULT NULL,
  p_shop_id uuid DEFAULT NULL,
  p_campaign_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_amount numeric(14, 2) := round(coalesce(p_amount, 0)::numeric, 2);
  v_key text := nullif(trim(p_idempotency_key), '');
  v_wallet public.platform_wallets%ROWTYPE;
  v_existing uuid;
  v_ledger_id uuid;
BEGIN
  IF v_amount <= 0 OR v_key IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_args');
  END IF;

  SELECT id INTO v_existing FROM public.platform_wallet_ledger WHERE idempotency_key = v_key;
  IF v_existing IS NOT NULL THEN
    RETURN jsonb_build_object('ok', true, 'duplicate', true, 'ledger_id', v_existing);
  END IF;

  v_wallet := public.platform_wallet_get_or_create(p_owner_type, p_owner_id, p_currency);

  SELECT * INTO v_wallet
  FROM public.platform_wallets
  WHERE id = v_wallet.id
  FOR UPDATE;

  IF v_wallet.available_balance < v_amount THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'insufficient_credit',
      'balance', v_wallet.available_balance,
      'required', v_amount
    );
  END IF;

  UPDATE public.platform_wallets
  SET available_balance = available_balance - v_amount, updated_at = now()
  WHERE id = v_wallet.id
  RETURNING * INTO v_wallet;

  INSERT INTO public.platform_wallet_ledger (
    wallet_id, owner_type, owner_id, entry_type, amount, currency, direction,
    balance_after, idempotency_key, order_id, shop_id, campaign_id, description, metadata
  ) VALUES (
    v_wallet.id, p_owner_type, p_owner_id, p_entry_type, v_amount,
    upper(coalesce(nullif(trim(p_currency), ''), v_wallet.currency)),
    'debit', v_wallet.available_balance, v_key, p_order_id, p_shop_id, p_campaign_id,
    p_description, coalesce(p_metadata, '{}'::jsonb)
  )
  RETURNING id INTO v_ledger_id;

  -- Keep EasyShip credit mirror in sync during cutover (no second balance check).
  IF p_entry_type = 'spend_shipping' AND p_owner_type = 'shop' THEN
    INSERT INTO public.easyship_shipping_credits (shop_id, balance_amount, currency, updated_at)
    VALUES (p_owner_id, 0, v_wallet.currency, now())
    ON CONFLICT (shop_id) DO NOTHING;

    UPDATE public.easyship_shipping_credits
    SET
      balance_amount = greatest(0, balance_amount - v_amount),
      currency = v_wallet.currency,
      updated_at = now()
    WHERE shop_id = p_owner_id;

    INSERT INTO public.easyship_shipping_credit_ledger (
      shop_id, order_id, entry_type, amount, currency, easyship_shipment_id, idempotency_key, payload
    ) VALUES (
      p_owner_id,
      p_order_id,
      'debit_label',
      v_amount,
      v_wallet.currency,
      nullif(trim(coalesce(p_metadata->>'easyship_shipment_id', '')), ''),
      'mirror:' || v_key,
      coalesce(p_metadata, '{}'::jsonb)
    )
    ON CONFLICT (idempotency_key) DO NOTHING;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'wallet_id', v_wallet.id,
    'ledger_id', v_ledger_id,
    'balance', v_wallet.available_balance,
    'amount', v_amount
  );
END;
$$;

REVOKE ALL ON FUNCTION public.platform_wallet_debit(
  public.platform_wallet_owner_type, uuid, numeric, public.platform_wallet_ledger_type,
  text, text, text, jsonb, uuid, uuid, uuid
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.platform_wallet_debit(
  public.platform_wallet_owner_type, uuid, numeric, public.platform_wallet_ledger_type,
  text, text, text, jsonb, uuid, uuid, uuid
) TO service_role;

-- Authenticated debit for checkout (user wallet only, own wallet).
CREATE OR REPLACE FUNCTION public.platform_wallet_pay_checkout(
  p_amount numeric,
  p_order_id uuid,
  p_idempotency_key text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_key text;
BEGIN
  IF v_user IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'unauthorized');
  END IF;
  v_key := coalesce(
    nullif(trim(p_idempotency_key), ''),
    'checkout:' || coalesce(p_order_id::text, 'none') || ':' || round(coalesce(p_amount, 0)::numeric, 2)::text || ':' || v_user::text
  );
  RETURN public.platform_wallet_debit(
    'user',
    v_user,
    p_amount,
    'spend_checkout',
    v_key,
    'INR',
    'Checkout payment',
    jsonb_build_object('order_id', p_order_id),
    p_order_id,
    NULL,
    NULL
  );
END;
$$;

REVOKE ALL ON FUNCTION public.platform_wallet_pay_checkout(numeric, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.platform_wallet_pay_checkout(numeric, uuid, text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.platform_wallet_complete_topup(
  p_txnid text,
  p_gateway_transaction_id text DEFAULT NULL,
  p_provider_response jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_topup public.platform_wallet_topups%ROWTYPE;
  v_credit jsonb;
BEGIN
  SELECT * INTO v_topup
  FROM public.platform_wallet_topups
  WHERE txnid = nullif(trim(p_txnid), '')
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'topup_not_found');
  END IF;

  IF v_topup.status = 'completed' THEN
    RETURN jsonb_build_object('ok', true, 'duplicate', true, 'topup_id', v_topup.id);
  END IF;

  UPDATE public.platform_wallet_topups
  SET
    status = 'completed',
    gateway_transaction_id = coalesce(nullif(trim(p_gateway_transaction_id), ''), gateway_transaction_id),
    metadata = coalesce(metadata, '{}'::jsonb) || coalesce(p_provider_response, '{}'::jsonb),
    paid_at = now(),
    updated_at = now()
  WHERE id = v_topup.id
  RETURNING * INTO v_topup;

  v_credit := public.platform_wallet_credit(
    v_topup.owner_type,
    v_topup.owner_id,
    v_topup.amount,
    'topup',
    'topup:' || v_topup.txnid,
    v_topup.currency,
    'PayU wallet top-up',
    jsonb_build_object('txnid', v_topup.txnid),
    v_topup.id,
    NULL, NULL, NULL, NULL
  );

  RETURN jsonb_build_object('ok', true, 'topup_id', v_topup.id, 'credit', v_credit);
END;
$$;

REVOKE ALL ON FUNCTION public.platform_wallet_complete_topup(text, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.platform_wallet_complete_topup(text, text, jsonb) TO service_role;

-- Migrate EasyShip balances into shop wallets
INSERT INTO public.platform_wallets (owner_type, owner_id, currency, available_balance, updated_at)
SELECT 'shop'::public.platform_wallet_owner_type, c.shop_id, coalesce(c.currency, 'INR'),
       greatest(coalesce(c.balance_amount, 0), 0), now()
FROM public.easyship_shipping_credits c
ON CONFLICT (owner_type, owner_id) DO UPDATE
SET
  available_balance = EXCLUDED.available_balance,
  currency = EXCLUDED.currency,
  updated_at = now()
WHERE public.platform_wallets.available_balance = 0
  AND EXCLUDED.available_balance > 0;

INSERT INTO public.platform_wallet_ledger (
  wallet_id, owner_type, owner_id, entry_type, amount, currency, direction,
  balance_after, idempotency_key, description, metadata
)
SELECT
  w.id,
  'shop',
  w.owner_id,
  'migration',
  w.available_balance,
  w.currency,
  'credit',
  w.available_balance,
  'migrate:easyship:' || w.owner_id::text,
  'Migrated from EasyShip shipping credit',
  jsonb_build_object('source', 'easyship_shipping_credits')
FROM public.platform_wallets w
WHERE w.owner_type = 'shop'
  AND w.available_balance > 0
ON CONFLICT (idempotency_key) DO NOTHING;

-- Wrap EasyShip topup to also credit platform wallet
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
  v_platform jsonb;
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
    p_shop_id, 'topup', v_amount, v_currency, v_key, coalesce(p_payload, '{}'::jsonb)
  );

  v_platform := public.platform_wallet_credit(
    'shop', p_shop_id, v_amount, 'topup', 'platform:' || v_key, v_currency,
    'Shipping / wallet top-up', coalesce(p_payload, '{}'::jsonb),
    NULL, NULL, p_shop_id, NULL, NULL
  );

  RETURN jsonb_build_object('ok', true, 'shop_id', p_shop_id, 'amount', v_amount, 'platform', v_platform);
END;
$$;

-- Referral: credit on first paid order (buyer↔buyer)
CREATE OR REPLACE FUNCTION public.referral_try_credit_buyer_first_order(p_order_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order public.orders%ROWTYPE;
  v_referee uuid;
  v_referrer uuid;
  v_prior int;
  v_reward_id uuid;
  v_amount numeric(14, 2) := 50;
  v_key_ref text;
  v_key_ree text;
  v_credit jsonb;
BEGIN
  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'order_not_found');
  END IF;

  v_referee := v_order.user_id;
  IF v_referee IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'no_buyer');
  END IF;

  SELECT referred_by INTO v_referrer FROM public.profiles WHERE id = v_referee;
  IF v_referrer IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'skipped', true, 'reason', 'no_referrer');
  END IF;

  SELECT count(*)::int INTO v_prior
  FROM public.orders o
  WHERE o.user_id = v_referee
    AND o.id <> p_order_id
    AND lower(coalesce(o.order_status, '')) IN (
      'paid', 'processing', 'shipped', 'delivered', 'completed', 'awaiting_fulfillment'
    );

  IF v_prior > 0 THEN
    RETURN jsonb_build_object('ok', false, 'skipped', true, 'reason', 'not_first_order');
  END IF;

  v_key_ref := 'referral:buyer_buyer:referrer:' || v_referrer::text || ':' || v_referee::text;
  v_key_ree := 'referral:buyer_buyer:referee:' || v_referee::text || ':' || p_order_id::text;

  INSERT INTO public.referral_rewards (
    program, referrer_user_id, referee_user_id, qualifying_order_id,
    amount, currency, beneficiary_owner_type, beneficiary_owner_id,
    status, credited_at, idempotency_key, metadata
  ) VALUES (
    'buyer_buyer', v_referrer, v_referee, p_order_id,
    v_amount, 'INR', 'user', v_referrer,
    'credited', now(), v_key_ref,
    jsonb_build_object('role', 'referrer')
  )
  ON CONFLICT (idempotency_key) DO NOTHING
  RETURNING id INTO v_reward_id;

  IF v_reward_id IS NOT NULL THEN
    v_credit := public.platform_wallet_credit(
      'user', v_referrer, v_amount, 'referral_credit', v_key_ref || ':credit',
      'INR', 'Referral reward', jsonb_build_object('order_id', p_order_id),
      NULL, p_order_id, NULL, NULL, v_reward_id
    );
  END IF;

  INSERT INTO public.referral_rewards (
    program, referrer_user_id, referee_user_id, qualifying_order_id,
    amount, currency, beneficiary_owner_type, beneficiary_owner_id,
    status, credited_at, idempotency_key, metadata
  ) VALUES (
    'buyer_buyer', v_referrer, v_referee, p_order_id,
    v_amount, 'INR', 'user', v_referee,
    'credited', now(), v_key_ree,
    jsonb_build_object('role', 'referee')
  )
  ON CONFLICT (idempotency_key) DO NOTHING
  RETURNING id INTO v_reward_id;

  IF v_reward_id IS NOT NULL THEN
    PERFORM public.platform_wallet_credit(
      'user', v_referee, v_amount, 'referral_credit', v_key_ree || ':credit',
      'INR', 'Welcome referral credit', jsonb_build_object('order_id', p_order_id),
      NULL, p_order_id, NULL, NULL, v_reward_id
    );
  END IF;

  RETURN jsonb_build_object('ok', true, 'referrer', v_referrer, 'referee', v_referee);
END;
$$;

REVOKE ALL ON FUNCTION public.referral_try_credit_buyer_first_order(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.referral_try_credit_buyer_first_order(uuid) TO service_role;

-- Seller→seller: ₹200 to referrer user when referred shop is PayU verified and has first paid order
CREATE OR REPLACE FUNCTION public.referral_try_credit_seller_first_sale(p_shop_id uuid, p_order_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_shop public.shops%ROWTYPE;
  v_owner uuid;
  v_referrer uuid;
  v_prior int;
  v_amount numeric(14, 2) := 200;
  v_key text;
  v_reward_id uuid;
BEGIN
  SELECT * INTO v_shop FROM public.shops WHERE id = p_shop_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'shop_not_found');
  END IF;
  v_owner := v_shop.user_id;

  SELECT referred_by INTO v_referrer FROM public.profiles WHERE id = v_owner;
  IF v_referrer IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'skipped', true, 'reason', 'no_referrer');
  END IF;

  IF NOT public.shop_payu_kyc_allows_orders(p_shop_id) THEN
    RETURN jsonb_build_object('ok', false, 'skipped', true, 'reason', 'kyc_incomplete');
  END IF;

  SELECT count(*)::int INTO v_prior
  FROM public.order_items oi
  WHERE oi.vendor_id = p_shop_id
    AND oi.order_id <> p_order_id
    AND lower(coalesce(oi.item_status, '')) NOT IN ('cancelled', 'refunded');

  IF v_prior > 0 THEN
    RETURN jsonb_build_object('ok', false, 'skipped', true, 'reason', 'not_first_sale');
  END IF;

  v_key := 'referral:seller_seller:referrer:' || v_referrer::text || ':shop:' || p_shop_id::text;

  INSERT INTO public.referral_rewards (
    program, referrer_user_id, referee_user_id, referrer_shop_id, referee_shop_id,
    qualifying_order_id, amount, currency, beneficiary_owner_type, beneficiary_owner_id,
    status, credited_at, idempotency_key, metadata
  ) VALUES (
    'seller_seller', v_referrer, v_owner, NULL, p_shop_id,
    p_order_id, v_amount, 'INR', 'user', v_referrer,
    'credited', now(), v_key,
    jsonb_build_object('role', 'referrer')
  )
  ON CONFLICT (idempotency_key) DO NOTHING
  RETURNING id INTO v_reward_id;

  IF v_reward_id IS NULL THEN
    RETURN jsonb_build_object('ok', true, 'duplicate', true);
  END IF;

  PERFORM public.platform_wallet_credit(
    'user', v_referrer, v_amount, 'referral_credit', v_key || ':credit',
    'INR', 'Seller referral reward',
    jsonb_build_object('shop_id', p_shop_id, 'order_id', p_order_id),
    NULL, p_order_id, p_shop_id, NULL, v_reward_id
  );

  RETURN jsonb_build_object('ok', true, 'referrer', v_referrer, 'shop_id', p_shop_id);
END;
$$;

REVOKE ALL ON FUNCTION public.referral_try_credit_seller_first_sale(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.referral_try_credit_seller_first_sale(uuid, uuid) TO service_role;

-- Clawback within 14 days on full order cancel/refund (clamps to available balance).
CREATE OR REPLACE FUNCTION public.referral_try_clawback_for_order(p_order_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r public.referral_rewards%ROWTYPE;
  v_wallet public.platform_wallets%ROWTYPE;
  v_take numeric(14, 2);
  v_count int := 0;
BEGIN
  FOR r IN
    SELECT * FROM public.referral_rewards
    WHERE qualifying_order_id = p_order_id
      AND status = 'credited'
      AND credited_at > now() - interval '14 days'
  LOOP
    v_wallet := public.platform_wallet_get_or_create(
      r.beneficiary_owner_type, r.beneficiary_owner_id, r.currency
    );
    SELECT * INTO v_wallet FROM public.platform_wallets WHERE id = v_wallet.id FOR UPDATE;
    v_take := least(r.amount, coalesce(v_wallet.available_balance, 0));
    IF v_take > 0 THEN
      PERFORM public.platform_wallet_debit(
        r.beneficiary_owner_type,
        r.beneficiary_owner_id,
        v_take,
        'referral_clawback',
        'clawback:' || r.idempotency_key,
        r.currency,
        'Referral clawback',
        jsonb_build_object('reward_id', r.id, 'order_id', p_order_id, 'requested', r.amount),
        p_order_id,
        r.referee_shop_id,
        NULL
      );
    END IF;
    UPDATE public.referral_rewards
    SET status = 'clawed_back', clawed_back_at = now(), updated_at = now()
    WHERE id = r.id;
    v_count := v_count + 1;
  END LOOP;
  RETURN jsonb_build_object('ok', true, 'clawed', v_count);
END;
$$;

REVOKE ALL ON FUNCTION public.referral_try_clawback_for_order(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.referral_try_clawback_for_order(uuid) TO service_role;

-- When a shop wallet is topped up via platform PayU, mirror EasyShip pot.
CREATE OR REPLACE FUNCTION public.platform_wallet_mirror_shop_topup()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Skip mirrors that originated from EasyShip top-ups or the one-time balance migration.
  IF NEW.idempotency_key LIKE 'platform:%' OR NEW.idempotency_key LIKE 'migrate:%' THEN
    RETURN NEW;
  END IF;

  IF NEW.owner_type = 'shop'
     AND NEW.entry_type = 'topup'
     AND NEW.direction = 'credit' THEN
    INSERT INTO public.easyship_shipping_credits (shop_id, balance_amount, currency, updated_at)
    VALUES (NEW.owner_id, NEW.amount, NEW.currency, now())
    ON CONFLICT (shop_id) DO UPDATE
    SET
      balance_amount = public.easyship_shipping_credits.balance_amount + EXCLUDED.balance_amount,
      currency = EXCLUDED.currency,
      updated_at = now();

    INSERT INTO public.easyship_shipping_credit_ledger (
      shop_id, entry_type, amount, currency, idempotency_key, payload
    ) VALUES (
      NEW.owner_id,
      'topup',
      NEW.amount,
      NEW.currency,
      'mirror:' || NEW.idempotency_key,
      jsonb_build_object('source', 'platform_wallet_ledger', 'ledger_id', NEW.id)
    )
    ON CONFLICT (idempotency_key) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_platform_wallet_mirror_shop_topup ON public.platform_wallet_ledger;
CREATE TRIGGER trg_platform_wallet_mirror_shop_topup
  AFTER INSERT ON public.platform_wallet_ledger
  FOR EACH ROW
  EXECUTE FUNCTION public.platform_wallet_mirror_shop_topup();

-- Referral hooks on paid / refunded order transitions
CREATE OR REPLACE FUNCTION public.referral_on_order_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_paid boolean;
  v_was_paid boolean;
  v_refunded boolean;
  v_shop uuid;
BEGIN
  v_paid := lower(coalesce(NEW.order_status, '')) IN (
    'paid', 'processing', 'shipped', 'delivered', 'completed', 'awaiting_fulfillment'
  );
  v_was_paid := lower(coalesce(OLD.order_status, '')) IN (
    'paid', 'processing', 'shipped', 'delivered', 'completed', 'awaiting_fulfillment'
  );
  v_refunded := lower(coalesce(NEW.order_status, '')) IN (
    'refunded', 'cancelled', 'canceled'
  );

  IF v_paid AND NOT v_was_paid THEN
    PERFORM public.referral_try_credit_buyer_first_order(NEW.id);
    FOR v_shop IN
      SELECT DISTINCT oi.vendor_id
      FROM public.order_items oi
      WHERE oi.order_id = NEW.id AND oi.vendor_id IS NOT NULL
    LOOP
      PERFORM public.referral_try_credit_seller_first_sale(v_shop, NEW.id);
    END LOOP;
  END IF;

  IF v_refunded AND v_was_paid THEN
    PERFORM public.referral_try_clawback_for_order(NEW.id);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_referral_on_order_status_change ON public.orders;
CREATE TRIGGER trg_referral_on_order_status_change
  AFTER UPDATE OF order_status ON public.orders
  FOR EACH ROW
  WHEN (OLD.order_status IS DISTINCT FROM NEW.order_status)
  EXECUTE FUNCTION public.referral_on_order_status_change();

COMMENT ON TABLE public.platform_wallets IS
  'Unified prepaid INR wallets for users (shopping) and shops (shipping + ads).';
COMMENT ON TABLE public.referral_rewards IS
  'Referral wallet credits for buyer↔buyer and seller↔seller programs.';
