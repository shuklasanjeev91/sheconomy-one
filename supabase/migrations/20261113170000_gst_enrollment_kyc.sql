--  GST enrollment for seller PayU KYC:
-- sellers declare GST registered OR not registered (with reason).
-- Private Limited / companies keep CIN + COI; GST stays optional when not registered.

ALTER TABLE public.shop_payu_kyc
  ADD COLUMN IF NOT EXISTS gst_enrollment text,
  ADD COLUMN IF NOT EXISTS gst_exemption_reason text;

ALTER TABLE public.shop_payu_kyc
  DROP CONSTRAINT IF EXISTS shop_payu_kyc_gst_enrollment_check;
ALTER TABLE public.shop_payu_kyc
  ADD CONSTRAINT shop_payu_kyc_gst_enrollment_check
  CHECK (
    gst_enrollment IS NULL
    OR gst_enrollment IN ('registered', 'not_registered')
  );

ALTER TABLE public.shop_payu_kyc
  DROP CONSTRAINT IF EXISTS shop_payu_kyc_gst_exemption_reason_check;
ALTER TABLE public.shop_payu_kyc
  ADD CONSTRAINT shop_payu_kyc_gst_exemption_reason_check
  CHECK (
    gst_exemption_reason IS NULL
    OR gst_exemption_reason IN (
      'below_threshold',
      'exempt_category',
      'applied_awaiting'
    )
  );

COMMENT ON COLUMN public.shop_payu_kyc.gst_enrollment IS
  'GST declaration: registered (has GSTIN) or not_registered (below threshold / exempt / awaiting).';

COMMENT ON COLUMN public.shop_payu_kyc.gst_exemption_reason IS
  'Required when gst_enrollment = not_registered.';

-- Backfill from existing GSTIN presence.
UPDATE public.shop_payu_kyc
SET gst_enrollment = 'registered'
WHERE gst_number IS NOT NULL
  AND length(trim(gst_number)) > 0
  AND gst_enrollment IS NULL;

UPDATE public.shop_payu_kyc
SET
  gst_enrollment = 'not_registered',
  gst_exemption_reason = COALESCE(gst_exemption_reason, 'below_threshold')
WHERE (gst_number IS NULL OR length(trim(gst_number)) = 0)
  AND status IN ('submitted', 'changes_requested', 'payu_pending', 'payu_verified', 'rejected')
  AND gst_enrollment IS NULL;
