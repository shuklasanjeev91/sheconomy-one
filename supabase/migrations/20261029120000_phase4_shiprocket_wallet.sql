-- Phase 4: Shiprocket wallet (no fund custody).
-- Tokens encrypted at rest via Supabase Vault (pgsodium AEAD under the hood).
-- Edge Functions never read plaintext columns; they call SECURITY DEFINER RPCs.

CREATE EXTENSION IF NOT EXISTS pgsodium WITH SCHEMA pgsodium;

-- Named key registry (Vault uses its own root key; this documents intent).
CREATE TABLE IF NOT EXISTS public.app_encryption_keys (
  name text PRIMARY KEY,
  key_id uuid,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.app_encryption_keys (name, notes)
VALUES (
  'shiprocket_token_key',
  'Shiprocket API tokens stored as vault.secrets rows; decrypt via shiprocket_get_api_token'
)
ON CONFLICT (name) DO NOTHING;

ALTER TABLE public.shiprocket_config
  ADD COLUMN IF NOT EXISTS api_token_secret_id uuid,
  ADD COLUMN IF NOT EXISTS pickup_pincode text,
  ADD COLUMN IF NOT EXISTS pickup_location_name text,
  ADD COLUMN IF NOT EXISTS pickup_address jsonb;

-- Backfill plaintext → Vault secret, then drop plaintext.
-- Idempotent: skip when api_token was already dropped by a prior apply.
DO $$
DECLARE
  r RECORD;
  v_secret_id uuid;
  v_name text;
  v_has_api_token boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'shiprocket_config'
      AND column_name = 'api_token'
  )
  INTO v_has_api_token;

  IF NOT v_has_api_token THEN
    RAISE NOTICE 'shiprocket_config.api_token already removed — skipping token backfill';
    RETURN;
  END IF;

  FOR r IN
    EXECUTE $q$
      SELECT shop_id, api_token, api_token_secret_id
      FROM public.shiprocket_config
      WHERE api_token IS NOT NULL
        AND length(trim(api_token)) > 0
    $q$
  LOOP
    v_name := 'shiprocket_token_' || r.shop_id::text;

    IF r.api_token_secret_id IS NOT NULL THEN
      PERFORM vault.update_secret(
        r.api_token_secret_id,
        r.api_token,
        v_name,
        'Shiprocket API token'
      );
      v_secret_id := r.api_token_secret_id;
    ELSE
      -- Reuse existing named secret if any.
      SELECT id INTO v_secret_id
      FROM vault.secrets
      WHERE name = v_name
      LIMIT 1;

      IF v_secret_id IS NOT NULL THEN
        PERFORM vault.update_secret(
          v_secret_id,
          r.api_token,
          v_name,
          'Shiprocket API token'
        );
      ELSE
        v_secret_id := vault.create_secret(
          r.api_token,
          v_name,
          'Shiprocket API token'
        );
      END IF;
    END IF;

    EXECUTE $q$
      UPDATE public.shiprocket_config
      SET api_token_secret_id = $1,
          api_token = NULL,
          updated_at = now()
      WHERE shop_id = $2
    $q$
    USING v_secret_id, r.shop_id;
  END LOOP;

  EXECUTE $q$
    UPDATE public.shiprocket_config
    SET api_token = NULL
    WHERE api_token IS NOT NULL
  $q$;
END $$;

ALTER TABLE public.shiprocket_config DROP COLUMN IF EXISTS api_token;

CREATE OR REPLACE FUNCTION public.shiprocket_store_api_token(p_shop_id uuid, p_token text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault
AS $$
DECLARE
  v_secret_id uuid;
  v_name text;
BEGIN
  IF p_shop_id IS NULL OR nullif(trim(p_token), '') IS NULL THEN
    RAISE EXCEPTION 'shop_id and token are required';
  END IF;

  v_name := 'shiprocket_token_' || p_shop_id::text;

  SELECT api_token_secret_id INTO v_secret_id
  FROM public.shiprocket_config
  WHERE shop_id = p_shop_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'shiprocket_config row not found for shop';
  END IF;

  IF v_secret_id IS NULL THEN
    SELECT id INTO v_secret_id
    FROM vault.secrets
    WHERE name = v_name
    LIMIT 1;
  END IF;

  IF v_secret_id IS NOT NULL THEN
    PERFORM vault.update_secret(v_secret_id, p_token, v_name, 'Shiprocket API token');
  ELSE
    v_secret_id := vault.create_secret(p_token, v_name, 'Shiprocket API token');
  END IF;

  UPDATE public.shiprocket_config
  SET api_token_secret_id = v_secret_id,
      updated_at = now()
  WHERE shop_id = p_shop_id;
END;
$$;

REVOKE ALL ON FUNCTION public.shiprocket_store_api_token(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.shiprocket_store_api_token(uuid, text) TO service_role;

CREATE OR REPLACE FUNCTION public.shiprocket_get_api_token(p_shop_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault
AS $$
DECLARE
  v_secret_id uuid;
  v_token text;
BEGIN
  SELECT api_token_secret_id
  INTO v_secret_id
  FROM public.shiprocket_config
  WHERE shop_id = p_shop_id
    AND is_connected IS DISTINCT FROM false;

  IF v_secret_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT decrypted_secret
  INTO v_token
  FROM vault.decrypted_secrets
  WHERE id = v_secret_id;

  RETURN nullif(v_token, '');
END;
$$;

REVOKE ALL ON FUNCTION public.shiprocket_get_api_token(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.shiprocket_get_api_token(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.shiprocket_clear_api_token(p_shop_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault
AS $$
DECLARE
  v_secret_id uuid;
BEGIN
  SELECT api_token_secret_id INTO v_secret_id
  FROM public.shiprocket_config
  WHERE shop_id = p_shop_id;

  UPDATE public.shiprocket_config
  SET api_token_secret_id = NULL,
      is_connected = false,
      token_expiry = NULL,
      updated_at = now()
  WHERE shop_id = p_shop_id;

  IF v_secret_id IS NOT NULL THEN
    DELETE FROM vault.secrets WHERE id = v_secret_id;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.shiprocket_clear_api_token(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.shiprocket_clear_api_token(uuid) TO service_role;

-- ---------------------------------------------------------------------------
-- Rate cache + wallet mirror + debit log
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.shiprocket_rate_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL REFERENCES public.shops (id) ON DELETE CASCADE,
  cache_key text NOT NULL,
  quote jsonb NOT NULL DEFAULT '{}'::jsonb,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (shop_id, cache_key)
);

CREATE INDEX IF NOT EXISTS shiprocket_rate_cache_expires_idx
  ON public.shiprocket_rate_cache (expires_at);

CREATE TABLE IF NOT EXISTS public.shiprocket_wallet_mirrors (
  shop_id uuid PRIMARY KEY REFERENCES public.shops (id) ON DELETE CASCADE,
  balance_amount numeric(14, 2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'INR',
  raw jsonb,
  recharge_url text NOT NULL DEFAULT 'https://app.shiprocket.in/seller/wallet',
  checked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.shiprocket_wallet_debits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL REFERENCES public.shops (id) ON DELETE CASCADE,
  order_id uuid REFERENCES public.orders (id) ON DELETE SET NULL,
  shiprocket_order_id text,
  awb text,
  amount numeric(14, 2),
  currency text NOT NULL DEFAULT 'INR',
  payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS shiprocket_wallet_debits_shop_idx
  ON public.shiprocket_wallet_debits (shop_id, created_at DESC);

ALTER TABLE public.shiprocket_rate_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shiprocket_wallet_mirrors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shiprocket_wallet_debits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS shiprocket_rate_cache_select_owner ON public.shiprocket_rate_cache;
CREATE POLICY shiprocket_rate_cache_select_owner
  ON public.shiprocket_rate_cache FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.shops s WHERE s.id = shop_id AND s.user_id = auth.uid()
  ));

DROP POLICY IF EXISTS shiprocket_wallet_mirrors_select_owner ON public.shiprocket_wallet_mirrors;
CREATE POLICY shiprocket_wallet_mirrors_select_owner
  ON public.shiprocket_wallet_mirrors FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.shops s WHERE s.id = shop_id AND s.user_id = auth.uid()
  ));

DROP POLICY IF EXISTS shiprocket_wallet_debits_select_owner ON public.shiprocket_wallet_debits;
CREATE POLICY shiprocket_wallet_debits_select_owner
  ON public.shiprocket_wallet_debits FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.shops s WHERE s.id = shop_id AND s.user_id = auth.uid()
  ));

GRANT SELECT ON public.shiprocket_rate_cache TO authenticated;
GRANT SELECT ON public.shiprocket_wallet_mirrors TO authenticated;
GRANT SELECT ON public.shiprocket_wallet_debits TO authenticated;
GRANT ALL ON public.shiprocket_rate_cache TO service_role;
GRANT ALL ON public.shiprocket_wallet_mirrors TO service_role;
GRANT ALL ON public.shiprocket_wallet_debits TO service_role;

-- ---------------------------------------------------------------------------
-- On delivery: schedule settlement eligibility (does not release yet)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.schedule_shepay_release_on_delivery(p_order_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_delivered_at timestamptz;
  v_window integer := 30;
  v_eligible_at timestamptz;
  v_updated integer := 0;
BEGIN
  IF p_order_id IS NULL THEN
    RETURN 0;
  END IF;

  SELECT MAX(od.delivered_at)
  INTO v_delivered_at
  FROM public.order_delivery od
  WHERE od.order_id = p_order_id
    AND od.delivered_at IS NOT NULL;

  IF v_delivered_at IS NULL THEN
    RETURN 0;
  END IF;

  SELECT COALESCE(MAX(COALESCE(p.return_window_days, 30)), 30)
  INTO v_window
  FROM public.order_items oi
  CROSS JOIN LATERAL public._resolve_item_return_policy(oi.id) p
  WHERE oi.order_id = p_order_id
    AND oi.item_status IS DISTINCT FROM 'cancelled'
    AND oi.item_status IS DISTINCT FROM 'refunded';

  v_eligible_at := v_delivered_at + make_interval(days => GREATEST(COALESCE(v_window, 30), 0));

  UPDATE public.shepay_pending_settlements
  SET eligible_at = v_eligible_at,
      hold_reason = CASE
        WHEN hold_reason IN ('dispute', 'refunded') THEN hold_reason
        WHEN split_status = 'not_split'
             AND (child_merchant_key IS NULL OR child_mid IS NULL)
          THEN 'awaiting_child'
        ELSE 'awaiting_release_window'
      END,
      updated_at = now()
  WHERE order_id = p_order_id
    AND status IN ('pending', 'failed')
    AND COALESCE(hold_reason, '') IS DISTINCT FROM 'refunded';

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated;
END;
$$;

REVOKE ALL ON FUNCTION public.schedule_shepay_release_on_delivery(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.schedule_shepay_release_on_delivery(uuid) TO service_role;

DROP FUNCTION IF EXISTS public._phase4_probe_encrypt(text, text);
