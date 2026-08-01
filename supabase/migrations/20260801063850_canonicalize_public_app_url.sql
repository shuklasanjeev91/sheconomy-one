-- Canonical public app URL for notification action links.
-- Legacy triggers fall back to https://sheconomy.com when the GUC is unset;
-- pin the setting and rewrite stored / function URLs onto https://sheconomy.in.

CREATE OR REPLACE FUNCTION public.app_public_base_url()
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT 'https://sheconomy.in'::text;
$$;

COMMENT ON FUNCTION public.app_public_base_url() IS
  'Canonical web origin for notification / email / share action URLs.';

-- Prefer database-level setting so existing COALESCE(current_setting(...), ...)
-- trigger bodies pick sheconomy.in without rewriting every function.
DO $$
BEGIN
  EXECUTE 'ALTER DATABASE ' || quote_ident(current_database())
    || ' SET app.settings.public_app_url TO ''https://sheconomy.in''';
EXCEPTION
  WHEN insufficient_privilege THEN
    -- Hosted roles may not ALTER DATABASE; session GUCs still help local.
    PERFORM set_config('app.settings.public_app_url', 'https://sheconomy.in', false);
END $$;

-- Rewrite function source that still hardcodes sheconomy.com / www.
DO $$
DECLARE
  r record;
  src text;
BEGIN
  FOR r IN
    SELECT p.oid
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prokind = 'f'
      AND pg_get_functiondef(p.oid) ~* 'sheconomy\.(com|in)'
  LOOP
    src := pg_get_functiondef(r.oid);
    src := replace(src, 'https://www.sheconomy.in', 'https://sheconomy.in');
    src := replace(src, 'https://sheconomy.com', 'https://sheconomy.in');
    src := replace(src, 'http://sheconomy.com', 'https://sheconomy.in');
    IF src IS DISTINCT FROM pg_get_functiondef(r.oid) THEN
      EXECUTE src;
    END IF;
  END LOOP;
END $$;

-- Normalize stored notification deep links.
UPDATE public.notifications
SET action_url = regexp_replace(
  action_url,
  '^https?://(www\.)?sheconomy\.(com|in)',
  'https://sheconomy.in',
  'i'
)
WHERE action_url ~* '^https?://(www\.)?sheconomy\.(com|in)';

UPDATE public.notifications
SET action_url = regexp_replace(
  action_url,
  '^https?://[^/]+\.vercel\.app',
  'https://sheconomy.in',
  'i'
)
WHERE action_url ~* '^https?://[^/]+\.vercel\.app';

-- Same rewrite for JSON payload copies of action_url.
UPDATE public.notifications
SET data = jsonb_set(
  data,
  '{action_url}',
  to_jsonb(
    regexp_replace(
      data->>'action_url',
      '^https?://(www\.)?sheconomy\.(com|in)',
      'https://sheconomy.in',
      'i'
    )
  )
)
WHERE data ? 'action_url'
  AND data->>'action_url' ~* '^https?://(www\.)?sheconomy\.(com|in)';

UPDATE public.notifications
SET data = jsonb_set(
  data,
  '{action_url}',
  to_jsonb(
    regexp_replace(
      data->>'action_url',
      '^https?://[^/]+\.vercel\.app',
      'https://sheconomy.in',
      'i'
    )
  )
)
WHERE data ? 'action_url'
  AND data->>'action_url' ~* '^https?://[^/]+\.vercel\.app';
