-- Daily reminders for sellers whose payout KYC is not yet payu_verified.
-- Channels: in_app + push + email via notification templates + dispatch cron.

INSERT INTO public.notification_templates (
  template_key, platform, category,
  title_template, message_template,
  email_subject_template, email_body_template,
  sms_template, push_title_template, push_body_template,
  whatsapp_template, action_url_template, default_channels, default_priority, is_active
) VALUES
(
  'payu_kyc_reminder', 'commerce', 'transactional',
  'Complete payout setup for {{shop_name}}',
  '{{cta_hint}} Open payout settings to finish KYC so you can sell on SHEconomy.',
  'Reminder: complete payout KYC for {{shop_name}}',
  '<p>Hi {{seller_name}},</p><p>Your shop <strong>{{shop_name}}</strong> still needs payout verification.</p><p>Status: <strong>{{kyc_status_label}}</strong></p><p>{{cta_hint}}</p><p><a href="{{action_url}}">Complete payout setup</a></p>',
  NULL,
  'Complete payout setup',
  '{{shop_name}}: {{cta_hint}}',
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

CREATE OR REPLACE FUNCTION public.process_payu_kyc_reminders(p_limit integer DEFAULT 200)
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
      -- Give new shops a day before the first nudge.
      AND s.created_at < now() - interval '1 day'
      AND (lr.last_sent IS NULL OR lr.last_sent <= now() - interval '23 hours')
    ORDER BY lr.last_sent ASC NULLS FIRST, s.created_at ASC
    LIMIT GREATEST(COALESCE(p_limit, 200), 1)
  LOOP
    -- At most one reminder per shop per ~24 hours.
    IF EXISTS (
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

    v_status := COALESCE(r.kyc_status, 'not_started');
    CASE v_status
      WHEN 'not_started', 'draft' THEN
        v_label := 'Not submitted';
        v_hint := 'Add your business, bank, and KYC documents (PAN, bank proof, Schedule C).';
      WHEN 'changes_requested' THEN
        v_label := 'Changes requested';
        v_hint := 'Update the documents or details we asked for, then resubmit.';
      WHEN 'rejected' THEN
        v_label := 'Not approved';
        v_hint := 'Re-upload the required documents and submit again.';
      WHEN 'submitted' THEN
        v_label := 'Under review';
        v_hint := 'We are reviewing your application. You can check status anytime in payout settings.';
      WHEN 'payu_pending' THEN
        v_label := 'PayU verification in progress';
        v_hint := 'PayU is verifying your account. Selling unlocks when verification finishes.';
      ELSE
        v_label := initcap(replace(v_status, '_', ' '));
        v_hint := 'Finish payout KYC so buyers can order from your shop.';
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
          'action_url', '/vendor/settings?section=payments'
        ),
        'shop',
        r.shop_id,
        NULL,
        NULL,
        ARRAY['in_app', 'push', 'email']::text[],
        3,
        NULL
      );
      v_sent := v_sent + 1;
    EXCEPTION WHEN OTHERS THEN
      -- Keep going for other shops.
      CONTINUE;
    END;
  END LOOP;

  RETURN v_sent;
END;
$$;

REVOKE ALL ON FUNCTION public.process_payu_kyc_reminders(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.process_payu_kyc_reminders(integer) TO service_role;

-- 10:00 IST = 04:30 UTC
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
