-- Phase 1: KYC document metadata table, Schedule C path, unlock rejected
-- applications for re-upload, notification templates, and 6h KYC sync cron.

ALTER TABLE public.shop_payu_kyc
  ADD COLUMN IF NOT EXISTS schedule_c_document_path text;

CREATE TABLE IF NOT EXISTS public.shop_kyc_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('pan', 'bank', 'schedule_c', 'gst')),
  storage_path text NOT NULL,
  mime_type text,
  file_size bigint,
  payu_document_uuid text,
  payu_document_status text,
  rejection_reason text,
  uploaded_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (shop_id, kind)
);

CREATE INDEX IF NOT EXISTS shop_kyc_documents_shop_id_idx
  ON public.shop_kyc_documents (shop_id);

ALTER TABLE public.shop_kyc_documents ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.shop_kyc_documents_touch()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS shop_kyc_documents_touch_trg ON public.shop_kyc_documents;
CREATE TRIGGER shop_kyc_documents_touch_trg
  BEFORE UPDATE ON public.shop_kyc_documents
  FOR EACH ROW
  EXECUTE FUNCTION public.shop_kyc_documents_touch();

DROP POLICY IF EXISTS shop_kyc_documents_table_owner_select ON public.shop_kyc_documents;
CREATE POLICY shop_kyc_documents_table_owner_select
  ON public.shop_kyc_documents
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.shops s
      WHERE s.id = shop_id AND s.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'A'
    )
  );

DROP POLICY IF EXISTS shop_kyc_documents_table_owner_insert ON public.shop_kyc_documents;
CREATE POLICY shop_kyc_documents_table_owner_insert
  ON public.shop_kyc_documents
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.shops s
      WHERE s.id = shop_id AND s.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS shop_kyc_documents_table_owner_update ON public.shop_kyc_documents;
CREATE POLICY shop_kyc_documents_table_owner_update
  ON public.shop_kyc_documents
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.shops s
      WHERE s.id = shop_id AND s.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'A'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.shops s
      WHERE s.id = shop_id AND s.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'A'
    )
  );

GRANT SELECT, INSERT, UPDATE ON public.shop_kyc_documents TO authenticated;

-- Backfill document rows from legacy path columns where present.
INSERT INTO public.shop_kyc_documents (shop_id, kind, storage_path)
SELECT shop_id, 'pan', pan_document_path
FROM public.shop_payu_kyc
WHERE pan_document_path IS NOT NULL AND btrim(pan_document_path) <> ''
ON CONFLICT (shop_id, kind) DO NOTHING;

INSERT INTO public.shop_kyc_documents (shop_id, kind, storage_path)
SELECT shop_id, 'bank', bank_document_path
FROM public.shop_payu_kyc
WHERE bank_document_path IS NOT NULL AND btrim(bank_document_path) <> ''
ON CONFLICT (shop_id, kind) DO NOTHING;

INSERT INTO public.shop_kyc_documents (shop_id, kind, storage_path)
SELECT shop_id, 'gst', gst_document_path
FROM public.shop_payu_kyc
WHERE gst_document_path IS NOT NULL AND btrim(gst_document_path) <> ''
ON CONFLICT (shop_id, kind) DO NOTHING;

INSERT INTO public.shop_kyc_documents (shop_id, kind, storage_path)
SELECT shop_id, 'schedule_c', schedule_c_document_path
FROM public.shop_payu_kyc
WHERE schedule_c_document_path IS NOT NULL AND btrim(schedule_c_document_path) <> ''
ON CONFLICT (shop_id, kind) DO NOTHING;

-- Unlock rejected applications so sellers can re-upload and resubmit.
CREATE OR REPLACE FUNCTION public.shop_payu_kyc_enforce()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  jwt_role text := coalesce(auth.jwt() ->> 'role', '');
  is_admin boolean := false;
BEGIN
  IF jwt_role = 'service_role' THEN
    NEW.updated_at := now();
    RETURN NEW;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.role = 'A'
  ) INTO is_admin;

  IF is_admin THEN
    IF TG_OP = 'UPDATE' THEN
      IF NEW.status = 'payu_verified' AND OLD.status IS DISTINCT FROM 'payu_verified' THEN
        RAISE EXCEPTION 'payu_verified is set by the platform';
      END IF;
      IF NEW.status = 'payu_pending' AND OLD.status IS DISTINCT FROM 'payu_pending' THEN
        RAISE EXCEPTION 'payu_pending is set by the platform';
      END IF;
      NEW.payu_product_account_uuid := OLD.payu_product_account_uuid;
      NEW.payu_mid := OLD.payu_mid;
      NEW.payu_merchant_key := OLD.payu_merchant_key;
      NEW.payu_onboarding_status := OLD.payu_onboarding_status;
      NEW.payu_document_status := OLD.payu_document_status;
      NEW.payu_kyc_status := OLD.payu_kyc_status;
      NEW.payu_error := OLD.payu_error;
    END IF;
    NEW.updated_at := now();
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.status NOT IN ('draft', 'submitted') THEN
      RAISE EXCEPTION 'invalid payout application status';
    END IF;
    NEW.payu_product_account_uuid := NULL;
    NEW.payu_mid := NULL;
    NEW.payu_merchant_key := NULL;
    NEW.payu_onboarding_status := NULL;
    NEW.payu_document_status := NULL;
    NEW.payu_kyc_status := NULL;
    NEW.payu_error := NULL;
    NEW.admin_note := NULL;
    NEW.reviewed_by := NULL;
    NEW.reviewed_at := NULL;
    NEW.updated_at := now();
    RETURN NEW;
  END IF;

  IF OLD.status NOT IN ('draft', 'changes_requested', 'rejected') THEN
    RAISE EXCEPTION 'payout application is locked';
  END IF;
  IF NEW.status NOT IN ('draft', 'submitted') THEN
    RAISE EXCEPTION 'invalid payout application status';
  END IF;

  NEW.payu_product_account_uuid := OLD.payu_product_account_uuid;
  NEW.payu_mid := OLD.payu_mid;
  NEW.payu_merchant_key := OLD.payu_merchant_key;
  NEW.payu_onboarding_status := OLD.payu_onboarding_status;
  NEW.payu_document_status := OLD.payu_document_status;
  NEW.payu_kyc_status := OLD.payu_kyc_status;
  NEW.payu_error := OLD.payu_error;
  IF NEW.status = 'submitted' THEN
    NEW.admin_note := NULL;
  ELSE
    NEW.admin_note := OLD.admin_note;
  END IF;
  NEW.reviewed_by := OLD.reviewed_by;
  NEW.reviewed_at := OLD.reviewed_at;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

INSERT INTO public.notification_templates (
  template_key, platform, category,
  title_template, message_template,
  email_subject_template, email_body_template,
  sms_template, push_title_template, push_body_template,
  whatsapp_template, action_url_template, default_channels, default_priority, is_active
) VALUES
(
  'payu_kyc_active', 'commerce', 'transactional',
  'Payouts verified — you can sell',
  'Your payout account for {{shop_name}} is active. Buyers can order from your shop.',
  'Payouts verified for {{shop_name}}',
  '<p>Hi {{seller_name}},</p><p>Your payout account for <strong>{{shop_name}}</strong> is verified. You can sell on SHEconomy.</p><p><a href="{{action_url}}">Open payout settings</a></p>',
  NULL,
  'Payouts verified',
  '{{shop_name}} can accept orders',
  NULL,
  '/vendor/settings?section=payments',
  ARRAY['in_app', 'push', 'email']::text[], 3, true
),
(
  'payu_kyc_rejected', 'commerce', 'transactional',
  'Update your payout documents',
  'PayU needs updated documents for {{shop_name}}. {{reason}}',
  'Update payout documents for {{shop_name}}',
  '<p>Hi {{seller_name}},</p><p>PayU needs updated documents for <strong>{{shop_name}}</strong>.</p><p>{{reason}}</p><p><a href="{{action_url}}">Re-upload in SHEconomy</a></p>',
  NULL,
  'Update payout documents',
  'Re-upload documents for {{shop_name}}',
  NULL,
  '/vendor/settings?section=payments',
  ARRAY['in_app', 'push', 'email']::text[], 3, true
)
ON CONFLICT (template_key) DO UPDATE SET
  title_template = EXCLUDED.title_template,
  message_template = EXCLUDED.message_template,
  email_subject_template = EXCLUDED.email_subject_template,
  email_body_template = EXCLUDED.email_body_template,
  push_title_template = EXCLUDED.push_title_template,
  push_body_template = EXCLUDED.push_body_template,
  action_url_template = EXCLUDED.action_url_template,
  default_channels = EXCLUDED.default_channels,
  is_active = EXCLUDED.is_active,
  updated_at = now();

-- Checkout gate: shops with a KYC row must be payu_verified before order creation.
CREATE OR REPLACE FUNCTION public.shop_payu_kyc_allows_orders(p_shop_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT NOT EXISTS (
    SELECT 1 FROM public.shop_payu_kyc k
    WHERE k.shop_id = p_shop_id
      AND k.status IS DISTINCT FROM 'payu_verified'
  );
$$;

REVOKE ALL ON FUNCTION public.shop_payu_kyc_allows_orders(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.shop_payu_kyc_allows_orders(uuid) TO authenticated, service_role;

-- Server-side gate for both Platform PayU and SHEPay checkout rails.
CREATE OR REPLACE FUNCTION public.orders_require_payu_kyc()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.shop_payu_kyc_allows_orders(NEW.shop_id) THEN
    RAISE EXCEPTION 'This shop is not ready to accept orders yet. Payout verification is still pending.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS orders_require_payu_kyc_trg ON public.orders;
CREATE TRIGGER orders_require_payu_kyc_trg
  BEFORE INSERT ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.orders_require_payu_kyc();

-- Cron: poll PayU KYC every 6 hours (Edge Function shepay-sync-kyc).
DO $$
DECLARE
  v_project_url text;
  v_secret text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    RETURN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_net') THEN
    RETURN;
  END IF;

  BEGIN
    SELECT decrypted_secret INTO v_project_url
    FROM vault.decrypted_secrets WHERE name = 'project_url' LIMIT 1;
  EXCEPTION WHEN OTHERS THEN
    v_project_url := NULL;
  END;

  BEGIN
    SELECT decrypted_secret INTO v_secret
    FROM vault.decrypted_secrets WHERE name = 'notification_cron_secret' LIMIT 1;
  EXCEPTION WHEN OTHERS THEN
    v_secret := NULL;
  END;

  IF v_project_url IS NULL OR v_secret IS NULL THEN
    RAISE NOTICE 'shepay-sync-kyc cron skipped: missing vault secrets';
    RETURN;
  END IF;

  PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname = 'shepay-sync-kyc';
  PERFORM cron.schedule(
    'shepay-sync-kyc',
    '0 */6 * * *',
    format(
      $cron$
      SELECT net.http_post(
        url := %L || '/functions/v1/shepay-sync-kyc',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'x-cron-secret', %L
        ),
        body := '{}'::jsonb
      );
      $cron$,
      rtrim(v_project_url, '/'),
      v_secret
    )
  );
END $$;
