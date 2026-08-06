-- Shop-owned legal documents for the storefront mini-app
-- (/shop/[slug]/privacy|terms|refunds). Returns/shipping reuse existing modules.

CREATE TABLE IF NOT EXISTS public.shop_legal_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  doc_type text NOT NULL CHECK (doc_type IN ('privacy', 'terms', 'refunds')),
  title text NOT NULL DEFAULT '',
  body_markdown text NOT NULL DEFAULT '',
  is_published boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (shop_id, doc_type)
);

CREATE INDEX IF NOT EXISTS shop_legal_documents_shop_id_idx
  ON public.shop_legal_documents (shop_id);

ALTER TABLE public.shop_legal_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY shop_legal_documents_public_read
  ON public.shop_legal_documents
  FOR SELECT
  USING (
    is_published = true
    AND EXISTS (
      SELECT 1 FROM public.shops s
      WHERE s.id = shop_id AND s.is_active = true
    )
  );

CREATE POLICY shop_legal_documents_owner_all
  ON public.shop_legal_documents
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.shops s
      WHERE s.id = shop_id AND s.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.shops s
      WHERE s.id = shop_id AND s.user_id = auth.uid()
    )
  );

GRANT SELECT ON public.shop_legal_documents TO anon, authenticated;
GRANT ALL ON public.shop_legal_documents TO authenticated;
