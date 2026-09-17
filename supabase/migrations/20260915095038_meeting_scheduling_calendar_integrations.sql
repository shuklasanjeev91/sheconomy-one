-- Scheduled meeting end times and secure external calendar integrations.
ALTER TABLE public.meetings
  ADD COLUMN IF NOT EXISTS scheduled_end_at timestamptz;

UPDATE public.meetings
SET scheduled_end_at = scheduled_at + interval '1 hour'
WHERE scheduled_at IS NOT NULL
  AND scheduled_end_at IS NULL;

ALTER TABLE public.meetings
  DROP CONSTRAINT IF EXISTS meetings_scheduled_time_range;
ALTER TABLE public.meetings
  ADD CONSTRAINT meetings_scheduled_time_range
  CHECK (
    scheduled_at IS NULL
    OR scheduled_end_at IS NULL
    OR scheduled_end_at > scheduled_at
  );

CREATE OR REPLACE FUNCTION public.validate_meeting_timezone()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.time_zone IS NULL OR NEW.time_zone = '' OR NEW.time_zone NOT LIKE '%/%'
    OR NOT EXISTS (SELECT 1 FROM pg_timezone_names WHERE name = NEW.time_zone)
  THEN
    RAISE EXCEPTION 'meetings.time_zone must be a valid IANA timezone';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_meeting_timezone ON public.meetings;
CREATE TRIGGER trg_validate_meeting_timezone
  BEFORE INSERT OR UPDATE OF time_zone ON public.meetings
  FOR EACH ROW EXECUTE FUNCTION public.validate_meeting_timezone();

CREATE TABLE IF NOT EXISTS public.calendar_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider text NOT NULL CHECK (provider IN ('google', 'microsoft')),
  provider_account_id text,
  provider_email text,
  scopes text[] NOT NULL DEFAULT '{}'::text[],
  access_token_ciphertext text,
  access_token_iv text,
  access_token_tag text,
  refresh_token_ciphertext text,
  refresh_token_iv text,
  refresh_token_tag text,
  token_expires_at timestamptz,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'revoked', 'error')),
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, provider)
);

CREATE TABLE IF NOT EXISTS public.calendar_oauth_states (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider text NOT NULL CHECK (provider IN ('google', 'microsoft')),
  state_hash text NOT NULL UNIQUE,
  code_verifier_ciphertext text NOT NULL,
  code_verifier_iv text NOT NULL,
  code_verifier_tag text NOT NULL,
  redirect_to text,
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS calendar_oauth_states_expiry_idx
  ON public.calendar_oauth_states (expires_at);

CREATE TABLE IF NOT EXISTS public.calendar_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id uuid NOT NULL REFERENCES public.calendar_connections(id) ON DELETE CASCADE,
  meeting_id uuid NOT NULL REFERENCES public.meetings(id) ON DELETE CASCADE,
  provider text NOT NULL CHECK (provider IN ('google', 'microsoft')),
  external_event_id text NOT NULL,
  external_calendar_id text,
  external_url text,
  etag text,
  last_synced_at timestamptz NOT NULL DEFAULT now(),
  sync_status text NOT NULL DEFAULT 'synced' CHECK (sync_status IN ('pending', 'synced', 'error', 'deleted')),
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (connection_id, meeting_id)
);

CREATE TABLE IF NOT EXISTS public.meeting_invite_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id uuid NOT NULL REFERENCES public.meetings(id) ON DELETE CASCADE,
  invitee_key text NOT NULL,
  channel text NOT NULL CHECK (channel IN ('notification', 'email')),
  status text NOT NULL DEFAULT 'sent' CHECK (status IN ('sent', 'failed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (meeting_id, invitee_key, channel)
);

ALTER TABLE public.calendar_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calendar_oauth_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calendar_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meeting_invite_deliveries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS calendar_connections_select_own ON public.calendar_connections;
CREATE POLICY calendar_connections_select_own ON public.calendar_connections
  FOR SELECT TO authenticated USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS calendar_events_select_own ON public.calendar_events;
CREATE POLICY calendar_events_select_own ON public.calendar_events
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.calendar_connections connection
      WHERE connection.id = calendar_events.connection_id
        AND connection.user_id = (SELECT auth.uid())
    )
  );

-- OAuth state, token writes, provider event IDs and delivery idempotency are
-- service-role only. The Edge Functions expose narrowly scoped operations.
REVOKE ALL ON public.calendar_oauth_states FROM anon, authenticated;
REVOKE ALL ON public.meeting_invite_deliveries FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.calendar_connections FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.calendar_events FROM anon, authenticated;
REVOKE SELECT ON public.calendar_connections FROM anon, authenticated;
GRANT SELECT (
  id, user_id, provider, provider_account_id, provider_email, scopes,
  token_expires_at, status, created_at, updated_at
) ON public.calendar_connections TO authenticated;
GRANT SELECT ON public.calendar_events TO authenticated;

COMMENT ON TABLE public.calendar_connections IS
  'Calendar OAuth tokens encrypted by Edge Functions with CALENDAR_TOKEN_ENCRYPTION_KEY; plaintext is never stored.';
