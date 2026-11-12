-- Phase 7: Admin ops, reconciliation, dispute SLA, rate limits, audit helper

-- ---------------------------------------------------------------------------
-- Admin audit helper (table already exists with RLS)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.log_admin_action(
  p_action text,
  p_details jsonb DEFAULT '{}'::jsonb,
  p_target_user_id uuid DEFAULT NULL,
  p_ip_address text DEFAULT NULL,
  p_user_agent text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin uuid := auth.uid();
  v_id uuid;
BEGIN
  IF v_admin IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.profiles p WHERE p.id = v_admin AND p.role = 'A'
  ) THEN
    -- Allow finance / seller ops / logistics staff for ops actions
    IF NOT EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = v_admin AND p.role IN ('A', 'F', 'S', 'L')
    ) THEN
      RAISE EXCEPTION 'Not authorized';
    END IF;
  END IF;

  INSERT INTO public.admin_audit_logs (
    admin_id, action, details, target_user_id, ip_address, user_agent
  ) VALUES (
    v_admin,
    left(trim(p_action), 200),
    COALESCE(p_details, '{}'::jsonb),
    p_target_user_id,
    p_ip_address,
    p_user_agent
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.log_admin_action FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.log_admin_action TO authenticated, service_role;

-- Service-role audit (edge functions acting as admin with verified JWT)
CREATE OR REPLACE FUNCTION public.log_admin_action_as(
  p_admin_id uuid,
  p_action text,
  p_details jsonb DEFAULT '{}'::jsonb,
  p_target_user_id uuid DEFAULT NULL,
  p_ip_address text DEFAULT NULL,
  p_user_agent text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  IF p_admin_id IS NULL THEN
    RAISE EXCEPTION 'admin_id required';
  END IF;

  INSERT INTO public.admin_audit_logs (
    admin_id, action, details, target_user_id, ip_address, user_agent
  ) VALUES (
    p_admin_id,
    left(trim(p_action), 200),
    COALESCE(p_details, '{}'::jsonb),
    p_target_user_id,
    p_ip_address,
    p_user_agent
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.log_admin_action_as FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.log_admin_action_as TO service_role;

-- ---------------------------------------------------------------------------
-- Dispute SLA
-- ---------------------------------------------------------------------------

ALTER TABLE public.order_issues
  ADD COLUMN IF NOT EXISTS sla_due_at timestamptz,
  ADD COLUMN IF NOT EXISTS first_response_at timestamptz,
  ADD COLUMN IF NOT EXISTS sla_hours integer;

CREATE OR REPLACE FUNCTION public.order_issue_default_sla_hours(p_priority text)
RETURNS integer
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE lower(COALESCE(p_priority, 'normal'))
    WHEN 'urgent' THEN 4
    WHEN 'high' THEN 12
    WHEN 'low' THEN 72
    ELSE 24
  END;
$$;

CREATE OR REPLACE FUNCTION public.trg_order_issues_set_sla()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_hours integer;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_hours := COALESCE(NEW.sla_hours, public.order_issue_default_sla_hours(NEW.issue_priority));
    NEW.sla_hours := v_hours;
    IF NEW.sla_due_at IS NULL THEN
      NEW.sla_due_at := COALESCE(NEW.created_at, now()) + make_interval(hours => v_hours);
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.status IS DISTINCT FROM OLD.status
       AND OLD.status IN ('open', 'pending', 'in_progress', 'awaiting_vendor', 'awaiting_customer')
       AND NEW.first_response_at IS NULL
       AND NEW.status NOT IN ('open', 'pending') THEN
      NEW.first_response_at := now();
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_order_issues_set_sla ON public.order_issues;
CREATE TRIGGER trg_order_issues_set_sla
  BEFORE INSERT OR UPDATE OF status, issue_priority ON public.order_issues
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_order_issues_set_sla();

UPDATE public.order_issues
SET
  sla_hours = COALESCE(sla_hours, public.order_issue_default_sla_hours(issue_priority)),
  sla_due_at = COALESCE(
    sla_due_at,
    created_at + make_interval(hours => COALESCE(sla_hours, public.order_issue_default_sla_hours(issue_priority)))
  )
WHERE sla_due_at IS NULL
  AND status IS DISTINCT FROM 'closed'
  AND status IS DISTINCT FROM 'resolved'
  AND closed_at IS NULL;

CREATE INDEX IF NOT EXISTS order_issues_sla_due_idx
  ON public.order_issues (sla_due_at)
  WHERE closed_at IS NULL AND resolved_at IS NULL;

-- ---------------------------------------------------------------------------
-- Reconciliation tables
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.shepay_reconciliation_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  status text NOT NULL DEFAULT 'running'
    CHECK (status IN ('running', 'completed', 'failed')),
  matched_count integer NOT NULL DEFAULT 0,
  mismatch_count integer NOT NULL DEFAULT 0,
  missing_count integer NOT NULL DEFAULT 0,
  checked_count integer NOT NULL DEFAULT 0,
  mismatch_rate numeric(8, 4),
  alert_sent boolean NOT NULL DEFAULT false,
  error_message text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.shepay_reconciliation_rows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES public.shepay_reconciliation_runs (id) ON DELETE CASCADE,
  settlement_id uuid REFERENCES public.shepay_pending_settlements (id) ON DELETE SET NULL,
  order_id uuid REFERENCES public.orders (id) ON DELETE SET NULL,
  shop_id uuid REFERENCES public.shops (id) ON DELETE SET NULL,
  payu_id text,
  txnid text,
  result text NOT NULL CHECK (result IN ('matched', 'mismatch', 'missing')),
  local_amount numeric,
  remote_amount numeric,
  local_status text,
  remote_status text,
  detail jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS shepay_recon_rows_run_idx
  ON public.shepay_reconciliation_rows (run_id, result);

CREATE INDEX IF NOT EXISTS shepay_recon_runs_started_idx
  ON public.shepay_reconciliation_runs (started_at DESC);

ALTER TABLE public.shepay_reconciliation_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shepay_reconciliation_rows ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS shepay_recon_runs_admin_all ON public.shepay_reconciliation_runs;
CREATE POLICY shepay_recon_runs_admin_all
  ON public.shepay_reconciliation_runs
  FOR ALL
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN ('A', 'F'))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN ('A', 'F'))
  );

DROP POLICY IF EXISTS shepay_recon_rows_admin_select ON public.shepay_reconciliation_rows;
CREATE POLICY shepay_recon_rows_admin_select
  ON public.shepay_reconciliation_rows
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN ('A', 'F'))
  );

GRANT SELECT, INSERT, UPDATE ON public.shepay_reconciliation_runs TO authenticated, service_role;
GRANT SELECT, INSERT ON public.shepay_reconciliation_rows TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Rate limit buckets
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.api_rate_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bucket_key text NOT NULL,
  window_started_at timestamptz NOT NULL DEFAULT now(),
  hit_count integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (bucket_key)
);

ALTER TABLE public.api_rate_limits ENABLE ROW LEVEL SECURITY;
-- No client policies — service_role / SECURITY DEFINER only

CREATE OR REPLACE FUNCTION public.check_api_rate_limit(
  p_bucket text,
  p_limit integer DEFAULT 30,
  p_window_seconds integer DEFAULT 60
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.api_rate_limits%ROWTYPE;
  v_now timestamptz := now();
BEGIN
  IF nullif(trim(p_bucket), '') IS NULL THEN
    RETURN true;
  END IF;

  INSERT INTO public.api_rate_limits (bucket_key, window_started_at, hit_count)
  VALUES (p_bucket, v_now, 1)
  ON CONFLICT (bucket_key) DO UPDATE
    SET
      hit_count = CASE
        WHEN public.api_rate_limits.window_started_at < v_now - make_interval(secs => GREATEST(p_window_seconds, 1))
          THEN 1
        ELSE public.api_rate_limits.hit_count + 1
      END,
      window_started_at = CASE
        WHEN public.api_rate_limits.window_started_at < v_now - make_interval(secs => GREATEST(p_window_seconds, 1))
          THEN v_now
        ELSE public.api_rate_limits.window_started_at
      END,
      updated_at = v_now
  RETURNING * INTO v_row;

  RETURN v_row.hit_count <= GREATEST(p_limit, 1);
END;
$$;

REVOKE ALL ON FUNCTION public.check_api_rate_limit FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_api_rate_limit TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Notify admins on high recon mismatch rate
-- ---------------------------------------------------------------------------

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
  'shepay_recon_mismatch_admin',
  'transactional',
  'marketplace',
  'Settlement reconciliation mismatches',
  'Reconciliation run found {{mismatch_count}} mismatches and {{missing_count}} missing (rate {{mismatch_rate}}%). Review /admin/reconciliation.',
  '/admin/reconciliation',
  ARRAY['in_app', 'email']::text[],
  2,
  true
)
ON CONFLICT (template_key) DO UPDATE SET
  title_template = EXCLUDED.title_template,
  message_template = EXCLUDED.message_template,
  action_url_template = EXCLUDED.action_url_template,
  is_active = true,
  updated_at = now();

-- ---------------------------------------------------------------------------
-- Daily reconciliation cron → shepay-reconcile-daily
-- ---------------------------------------------------------------------------

DO $$
DECLARE
  v_project_url text := 'https://zsaqrrzwygzwrlzgymxk.supabase.co';
  v_secret text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    RETURN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_net') THEN
    RETURN;
  END IF;

  BEGIN
    SELECT decrypted_secret INTO v_secret
    FROM vault.decrypted_secrets WHERE name = 'notification_cron_secret' LIMIT 1;
  EXCEPTION WHEN OTHERS THEN
    v_secret := NULL;
  END;

  IF v_secret IS NULL OR length(trim(v_secret)) = 0 THEN
    RAISE NOTICE 'shepay-reconcile-daily cron skipped: missing notification_cron_secret';
    RETURN;
  END IF;

  PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname = 'shepay-reconcile-daily';
  PERFORM cron.schedule(
    'shepay-reconcile-daily',
    '15 2 * * *',
    format(
      $cron$
      SELECT net.http_post(
        url := %L || '/functions/v1/shepay-reconcile-daily',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'x-cron-secret', %L
        ),
        body := jsonb_build_object('limit', 200, 'alert_threshold', 0.05)
      );
      $cron$,
      rtrim(v_project_url, '/'),
      v_secret
    )
  );
END $$;
