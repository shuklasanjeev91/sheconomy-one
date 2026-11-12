-- Point KYC reminder / status notification CTAs at Verification (not Payment Methods).

UPDATE public.notification_templates
SET
  action_url_template = '/vendor/settings?section=verification',
  message_template = replace(
    coalesce(message_template, ''),
    '/vendor/settings?section=payments',
    '/vendor/settings?section=verification'
  ),
  email_body_template = replace(
    coalesce(email_body_template, ''),
    '/vendor/settings?section=payments',
    '/vendor/settings?section=verification'
  ),
  updated_at = now()
WHERE action_url_template = '/vendor/settings?section=payments'
   OR coalesce(message_template, '') LIKE '%/vendor/settings?section=payments%'
   OR coalesce(email_body_template, '') LIKE '%/vendor/settings?section=payments%';

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
      AND s.created_at < now() - interval '1 day'
      AND (lr.last_sent IS NULL OR lr.last_sent <= now() - interval '23 hours')
    ORDER BY lr.last_sent ASC NULLS FIRST, s.created_at ASC
    LIMIT GREATEST(COALESCE(p_limit, 200), 1)
  LOOP
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
        v_hint := 'Add your business, bank, and KYC documents under Verification (PAN, bank proof, Schedule C).';
      WHEN 'changes_requested' THEN
        v_label := 'Changes requested';
        v_hint := 'Update the documents or details we asked for in Verification, then resubmit.';
      WHEN 'rejected' THEN
        v_label := 'Not approved';
        v_hint := 'Re-upload the required documents in Verification and submit again.';
      WHEN 'submitted' THEN
        v_label := 'Under review';
        v_hint := 'We are reviewing your application. You can check status anytime in Verification.';
      WHEN 'payu_pending' THEN
        v_label := 'PayU verification in progress';
        v_hint := 'PayU is verifying your account. Selling unlocks when verification finishes.';
      ELSE
        v_label := initcap(replace(v_status, '_', ' '));
        v_hint := 'Finish Verification so buyers can order from your shop.';
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
        3,
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
