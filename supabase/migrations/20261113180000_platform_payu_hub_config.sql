-- One SHEconomy PayU Hub OAuth app for the whole marketplace.
-- Sellers never get Hub credentials; Approve creates child merchants under this parent.

CREATE TABLE IF NOT EXISTS public.platform_payu_hub_config (
  id smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  client_id text NOT NULL,
  client_secret_ciphertext text NOT NULL,
  client_secret_iv text NOT NULL,
  client_secret_tag text NOT NULL,
  parent_mid text,
  updated_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  last_verified_at timestamptz
);

COMMENT ON TABLE public.platform_payu_hub_config IS
  'Singleton PayU Hub OAuth client for SHEconomy aggregator. One row onboard unlimited seller child merchants.';

CREATE TABLE IF NOT EXISTS public.platform_payu_hub_tokens (
  scope text PRIMARY KEY CHECK (scope IN ('refer_child_merchant', 'fetch_child_merchants')),
  access_token text NOT NULL,
  expires_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.platform_payu_hub_tokens IS
  'Cached Hub bearer tokens so Approve/sync at seller scale does not mint a token per call.';

ALTER TABLE public.platform_payu_hub_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_payu_hub_tokens ENABLE ROW LEVEL SECURITY;

-- No policies for authenticated/anon — Edge Functions use the service role only.
REVOKE ALL ON public.platform_payu_hub_config FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.platform_payu_hub_tokens FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.platform_payu_hub_config TO service_role;
GRANT ALL ON public.platform_payu_hub_tokens TO service_role;
