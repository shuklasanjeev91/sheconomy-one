-- Snapshot of the realtime GST registry check shown to the vendor.

ALTER TABLE public.shop_payu_kyc
  ADD COLUMN IF NOT EXISTS gst_legal_name text,
  ADD COLUMN IF NOT EXISTS gst_trade_name text,
  ADD COLUMN IF NOT EXISTS gst_status text;
