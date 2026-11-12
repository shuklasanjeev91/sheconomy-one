-- Entity-aware seller KYC: CIN / LLPIN / registration + admin-only document kinds.
-- PayU child create still only forwards pan / bank / schedule_c / gst.

ALTER TABLE public.shop_payu_kyc
  ADD COLUMN IF NOT EXISTS cin text,
  ADD COLUMN IF NOT EXISTS llpin text,
  ADD COLUMN IF NOT EXISTS registration_number text;

ALTER TABLE public.shop_kyc_documents
  DROP CONSTRAINT IF EXISTS shop_kyc_documents_kind_check;

ALTER TABLE public.shop_kyc_documents
  ADD CONSTRAINT shop_kyc_documents_kind_check
  CHECK (
    kind IN (
      'pan',
      'bank',
      'schedule_c',
      'gst',
      'incorporation',
      'ownership',
      'id_front',
      'id_back'
    )
  );
