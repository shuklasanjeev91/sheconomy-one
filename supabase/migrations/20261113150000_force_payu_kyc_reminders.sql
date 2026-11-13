-- Stronger mandatory-KYC reminder copy + force-send for incomplete sellers.
-- Channels remain in_app + push + email via create_notification_from_template.

UPDATE public.notification_templates
SET
  title_template = 'Action required: verify {{shop_name}} to sell',
  message_template = '{{cta_hint}} Selling is paused until payout KYC is verified. Open Verification to continue.',
  email_subject_template = 'Action required: complete KYC for {{shop_name}} to sell on SHEconomy',
  email_body_template = '<p>Hi {{seller_name}},</p><p>Your shop <strong>{{shop_name}}</strong> cannot accept orders or show listings until payout verification is complete.</p><p>Status: <strong>{{kyc_status_label}}</strong></p><p>{{cta_hint}}</p><p><a href="{{action_url}}">Complete verification now</a></p><p>SHEconomy</p>',
  push_title_template = 'Complete KYC to sell',
  push_body_template = '{{shop_name}}: selling is paused — {{cta_hint}}',
  action_url_template = '/vendor/settings?section=verification',
  default_channels = ARRAY['in_app', 'push', 'email']::text[],
  is_active = true,
  updated_at = now()
WHERE template_key = 'payu_kyc_reminder';

CREATE OR REPLACE FUNCTION public.process_payu_kyc_reminders(
  p_limit integer DEFAULT 200,
  p_force boolean DEFAULT false
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r RECORD;
  v_sent integer := 0;
  v_status text;
  v_label text;
  v_hint text;
  v_seller_name text;
BEGIN
  FOR r IN
    SELECT
      s.id AS shop_id,
      s.user_id,
      s.shop_name,
      k.status AS kyc_status
    FROM public.shops s
    LEFT JOIN public.shop_payu_kyc k ON k.shop_id = s.id
    LEFT JOIN LATERAL (
      SELECT MAX(n.created_at) AS last_sent
      FROM public.notifications n
      WHERE n.recipient_id = s.user_id
        AND n.context_type = 'shop'
        AND n.context_id = s.id
        AND n.type = 'payu_kyc_reminder'
    ) lr ON true
    WHERE s.user_id IS NOT NULL
      AND COALESCE(s.is_active, true) = true
      AND (k.shop_id IS NULL OR k.status IS DISTINCT FROM 'payu_verified')
      AND (
        p_force
        OR s.created_at < now() - interval '1 day'
      )
      AND (
        p_force
        OR lr.last_sent IS NULL
        OR lr.last_sent <= now() - interval '23 hours'
      )
    ORDER BY lr.last_sent ASC NULLS FIRST, s.created_at ASC
    LIMIT GREATEST(COALESCE(p_limit, 200), 1)
  LOOP
    IF NOT p_force AND EXISTS (
      SELECT 1
      FROM public.notifications n
      WHERE n.recipient_id = r.user_id
        AND n.context_type = 'shop'
        AND n.context_id = r.shop_id
        AND n.type = 'payu_kyc_reminder'
        AND n.created_at > now() - interval '23 hours'
    ) THEN
      CONTINUE;
    END IF;

    -- Even when forcing, avoid double-sending within a few minutes.
    IF p_force AND EXISTS (
      SELECT 1
      FROM public.notifications n
      WHERE n.recipient_id = r.user_id
        AND n.context_type = 'shop'
        AND n.context_id = r.shop_id
        AND n.type = 'payu_kyc_reminder'
        AND n.created_at > now() - interval '5 minutes'
    ) THEN
      CONTINUE;
    END IF;

    v_status := COALESCE(r.kyc_status, 'not_started');
    CASE v_status
      WHEN 'not_started', 'draft' THEN
        v_label := 'Not submitted';
        v_hint := 'Add your business, bank, and KYC documents under Verification (PAN, bank proof, Schedule C). Selling is blocked until this is verified.';
      WHEN 'changes_requested' THEN
        v_label := 'Changes requested';
        v_hint := 'Update the requested details in Verification and resubmit. Selling stays blocked until approved.';
      WHEN 'rejected' THEN
        v_label := 'Not approved';
        v_hint := 'Re-upload the required documents in Verification and submit again. Selling stays blocked until approved.';
      WHEN 'submitted' THEN
        v_label := 'Under review';
        v_hint := 'We are reviewing your application. Selling unlocks after PayU verification finishes.';
      WHEN 'payu_pending' THEN
        v_label := 'PayU verification in progress';
        v_hint := 'PayU is verifying your account. Selling unlocks when verification finishes.';
      ELSE
        v_label := initcap(replace(v_status, '_', ' '));
        v_hint := 'Finish Verification so buyers can order from your shop. Selling is blocked until KYC is verified.';
    END CASE;

    SELECT COALESCE(
      NULLIF(p.full_name, ''),
      NULLIF(p.business_name, ''),
      'there'
    )
    INTO v_seller_name
    FROM public.profiles p
    WHERE p.id = r.user_id;

    BEGIN
      PERFORM public.create_notification_from_template(
        'payu_kyc_reminder',
        r.user_id,
        jsonb_build_object(
          'seller_name', COALESCE(v_seller_name, 'there'),
          'shop_name', COALESCE(NULLIF(r.shop_name, ''), 'your shop'),
          'kyc_status', v_status,
          'kyc_status_label', v_label,
          'cta_hint', v_hint,
          'action_url', '/vendor/settings?section=verification'
        ),
        'shop',
        r.shop_id,
        NULL,
        NULL,
        ARRAY['in_app', 'push', 'email']::text[],
        4,
        NULL
      );
      v_sent := v_sent + 1;
    EXCEPTION WHEN OTHERS THEN
      CONTINUE;
    END;
  END LOOP;

  RETURN v_sent;
END;
$$;

COMMENT ON FUNCTION public.process_payu_kyc_reminders(integer, boolean) IS
  'Sends in_app + push + email KYC reminders. p_force=true bypasses the 1-day / 23h gates (still 5-minute dedupe).';

REVOKE ALL ON FUNCTION public.process_payu_kyc_reminders(integer, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.process_payu_kyc_reminders(integer, boolean) TO service_role;

-- Keep single-arg overload for existing cron: SELECT process_payu_kyc_reminders(2000)
CREATE OR REPLACE FUNCTION public.process_payu_kyc_reminders(p_limit integer DEFAULT 200)
RETURNS integer
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.process_payu_kyc_reminders(p_limit, false);
$$;

REVOKE ALL ON FUNCTION public.process_payu_kyc_reminders(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.process_payu_kyc_reminders(integer) TO service_role;

-- Ensure daily cron still points at the safe (non-force) overload.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    RETURN;
  END IF;

  PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname = 'process-payu-kyc-reminders';
  PERFORM cron.schedule(
    'process-payu-kyc-reminders',
    '30 4 * * *',
    $cron$SELECT public.process_payu_kyc_reminders(2000)$cron$
  );
END $$;
