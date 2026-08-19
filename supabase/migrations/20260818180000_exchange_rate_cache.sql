-- Durable cache for exchange-rates edge function.
-- Free-tier exchangerate-api.com is rate-limited (429); every cold isolate was
-- hitting upstream and 502'ing the app. Service-role only — no client access.

CREATE TABLE IF NOT EXISTS public.exchange_rate_cache (
  base text PRIMARY KEY,
  rates jsonb NOT NULL,
  fetched_at timestamptz NOT NULL DEFAULT now(),
  next_update_at timestamptz,
  last_update_at timestamptz
);

ALTER TABLE public.exchange_rate_cache ENABLE ROW LEVEL SECURITY;

-- Deny all client roles; edge function uses service role (bypasses RLS).
DROP POLICY IF EXISTS exchange_rate_cache_deny_all ON public.exchange_rate_cache;
CREATE POLICY exchange_rate_cache_deny_all
  ON public.exchange_rate_cache
  FOR ALL
  TO authenticated, anon
  USING (false)
  WITH CHECK (false);

COMMENT ON TABLE public.exchange_rate_cache IS
  'Server-side FX rate cache for exchange-rates edge function. Not client-readable.';
