-- Vendor payout KYC collected inside SHEconomy. PayU child-merchant
-- fields are written only by the service role (edge function).

CREATE TABLE IF NOT EXISTS public.shop_payu_kyc (
  shop_id uuid PRIMARY KEY REFERENCES public.shops(id) ON DELETE CASCADE,
  legal_name text NOT NULL DEFAULT '',
  mobile text NOT NULL DEFAULT '',
  email text NOT NULL DEFAULT '',
  pan_number text NOT NULL DEFAULT '',
  pan_name text NOT NULL DEFAULT '',
  gst_number text,
  business_name text NOT NULL DEFAULT '',
  business_entity_id integer NOT NULL DEFAULT 2,
  monthly_expected_volume integer NOT NULL DEFAULT 50000,
  bank_account_number text NOT NULL DEFAULT '',
  bank_holder_name text NOT NULL DEFAULT '',
  ifsc text NOT NULL DEFAULT '',
  pan_document_path text,
  bank_document_path text,
  gst_document_path text,
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN (
      'draft',
      'submitted',
      'changes_requested',
      'payu_pending',
      'payu_verified',
      'rejected'
    )),
  admin_note text,
  reviewed_by uuid,
  reviewed_at timestamptz,
  payu_product_account_uuid text,
  payu_mid text,
  payu_merchant_key text,
  payu_onboarding_status text,
  payu_document_status text,
  payu_kyc_status text,
  payu_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS shop_payu_kyc_status_idx ON public.shop_payu_kyc (status);

ALTER TABLE public.shop_payu_kyc ENABLE ROW LEVEL SECURITY;

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

  IF OLD.status NOT IN ('draft', 'changes_requested') THEN
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
  NEW.admin_note := OLD.admin_note;
  NEW.reviewed_by := OLD.reviewed_by;
  NEW.reviewed_at := OLD.reviewed_at;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS shop_payu_kyc_enforce_trg ON public.shop_payu_kyc;
CREATE TRIGGER shop_payu_kyc_enforce_trg
  BEFORE INSERT OR UPDATE ON public.shop_payu_kyc
  FOR EACH ROW
  EXECUTE FUNCTION public.shop_payu_kyc_enforce();

DROP POLICY IF EXISTS shop_payu_kyc_owner_select ON public.shop_payu_kyc;
CREATE POLICY shop_payu_kyc_owner_select
  ON public.shop_payu_kyc
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

DROP POLICY IF EXISTS shop_payu_kyc_owner_insert ON public.shop_payu_kyc;
CREATE POLICY shop_payu_kyc_owner_insert
  ON public.shop_payu_kyc
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.shops s
      WHERE s.id = shop_id AND s.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS shop_payu_kyc_owner_update ON public.shop_payu_kyc;
CREATE POLICY shop_payu_kyc_owner_update
  ON public.shop_payu_kyc
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

GRANT SELECT, INSERT, UPDATE ON public.shop_payu_kyc TO authenticated;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'shop-kyc-documents',
  'shop-kyc-documents',
  false,
  10485760,
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'application/pdf']
)
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS shop_kyc_documents_owner_select ON storage.objects;
CREATE POLICY shop_kyc_documents_owner_select
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'shop-kyc-documents'
    AND (
      (storage.foldername(name))[1] = (SELECT auth.uid())::text
      OR EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid() AND p.role = 'A'
      )
    )
  );

DROP POLICY IF EXISTS shop_kyc_documents_owner_insert ON storage.objects;
CREATE POLICY shop_kyc_documents_owner_insert
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'shop-kyc-documents'
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
  );

DROP POLICY IF EXISTS shop_kyc_documents_owner_update ON storage.objects;
CREATE POLICY shop_kyc_documents_owner_update
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'shop-kyc-documents'
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
  )
  WITH CHECK (
    bucket_id = 'shop-kyc-documents'
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
  );
