-- ============================================================
-- MIGRATION: Sale Events + Auto Discount Sync + Banners bucket
-- Ports legacy 103_sale_events.sql + 104_sale_event_banners_bucket.sql
-- into the new project. Idempotent: safe to re-run (no DROP TABLE).
--
-- Roles: A=Admin, V=Vendor, U=User — resolved via public.cms_get_role()
-- (defined in 20260717120000_cms_setup.sql → reads profiles.role).
-- Dependencies: public.profiles(role), public.shops, public.discount_profiles.
-- ============================================================

-- ============================================================
-- STEP 0: shared helpers (created if the CMS migration didn't run first)
-- ============================================================
CREATE OR REPLACE FUNCTION public.cms_get_role()
RETURNS CHAR AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.sale_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- STEP 1: extend discount_profiles with event-source tracking
-- ============================================================
ALTER TABLE public.discount_profiles
  ADD COLUMN IF NOT EXISTS source         VARCHAR(20) DEFAULT 'manual'
                                          CHECK (source IN ('manual', 'event')),
  ADD COLUMN IF NOT EXISTS event_offer_id UUID;

COMMENT ON COLUMN public.discount_profiles.source         IS 'manual = vendor created, event = auto-copied from a sale event';
COMMENT ON COLUMN public.discount_profiles.event_offer_id IS 'FK to event_offers — which offer generated this discount';

-- ============================================================
-- STEP 2: sale_events
-- ============================================================
CREATE TABLE IF NOT EXISTS public.sale_events (
  id                      UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  event_name              VARCHAR(255) NOT NULL,
  event_slug              VARCHAR(255) NOT NULL UNIQUE,
  description             TEXT,
  start_date              TIMESTAMPTZ  NOT NULL,
  end_date                TIMESTAMPTZ  NOT NULL,
  banner_image            TEXT,
  status                  VARCHAR(20)  NOT NULL DEFAULT 'draft'
                          CHECK (status IN ('draft', 'active', 'expired')),
  currency                VARCHAR(3)   NOT NULL DEFAULT 'INR',
  registration_start_date TIMESTAMPTZ,
  registration_end_date   TIMESTAMPTZ,
  created_by              UUID         REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at              TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ  NOT NULL DEFAULT now(),
  CONSTRAINT valid_event_dates CHECK (end_date > start_date)
);

-- Columns added later in the product's life — kept idempotent for existing DBs.
ALTER TABLE public.sale_events
  ADD COLUMN IF NOT EXISTS currency                VARCHAR(3)  NOT NULL DEFAULT 'INR',
  ADD COLUMN IF NOT EXISTS registration_start_date TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS registration_end_date   TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_sale_events_status     ON public.sale_events(status);
CREATE INDEX IF NOT EXISTS idx_sale_events_start_date ON public.sale_events(start_date);
CREATE INDEX IF NOT EXISTS idx_sale_events_slug       ON public.sale_events(event_slug);

-- ============================================================
-- STEP 3: event_offers
-- ============================================================
CREATE TABLE IF NOT EXISTS public.event_offers (
  id                    UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id              UUID          NOT NULL REFERENCES public.sale_events(id) ON DELETE CASCADE,
  offer_name            VARCHAR(255)  NOT NULL,
  discount_type         VARCHAR(20)   NOT NULL CHECK (discount_type IN ('percentage', 'fixed')),
  discount_value        DECIMAL(10,2) NOT NULL CHECK (discount_value > 0),
  max_discount_amount   DECIMAL(10,2),
  min_order_amount      DECIMAL(10,2) DEFAULT 0,
  max_uses_total        INTEGER,
  max_uses_per_customer INTEGER       DEFAULT 1,
  applies_to            VARCHAR(20)   NOT NULL DEFAULT 'category'
                        CHECK (applies_to IN ('order', 'product', 'category')),
  currency              VARCHAR(3)    NOT NULL DEFAULT 'INR',
  created_at            TIMESTAMPTZ   NOT NULL DEFAULT now()
);

ALTER TABLE public.event_offers
  ADD COLUMN IF NOT EXISTS currency VARCHAR(3) NOT NULL DEFAULT 'INR';

CREATE INDEX IF NOT EXISTS idx_event_offers_event_id ON public.event_offers(event_id);

-- FK from discount_profiles → event_offers (added after event_offers exists).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_discount_profiles_event_offer'
  ) THEN
    ALTER TABLE public.discount_profiles
      ADD CONSTRAINT fk_discount_profiles_event_offer
      FOREIGN KEY (event_offer_id) REFERENCES public.event_offers(id) ON DELETE SET NULL;
  END IF;
END$$;

-- ============================================================
-- STEP 4: event_offer_categories (category_id is TEXT to match categories.category_id)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.event_offer_categories (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  offer_id    UUID NOT NULL REFERENCES public.event_offers(id) ON DELETE CASCADE,
  category_id TEXT NOT NULL,
  UNIQUE (offer_id, category_id)
);
CREATE INDEX IF NOT EXISTS idx_event_offer_categories_offer_id ON public.event_offer_categories(offer_id);

-- ============================================================
-- STEP 5: event_offer_listings
-- ============================================================
CREATE TABLE IF NOT EXISTS public.event_offer_listings (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  offer_id   UUID NOT NULL REFERENCES public.event_offers(id) ON DELETE CASCADE,
  listing_id UUID NOT NULL,
  UNIQUE (offer_id, listing_id)
);
CREATE INDEX IF NOT EXISTS idx_event_offer_listings_offer_id ON public.event_offer_listings(offer_id);

-- ============================================================
-- STEP 6: vendor_event_enrollments
-- ============================================================
CREATE TABLE IF NOT EXISTS public.vendor_event_enrollments (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id          UUID        NOT NULL REFERENCES public.sale_events(id) ON DELETE CASCADE,
  shop_id           UUID        NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  enrollment_status VARCHAR(20) NOT NULL DEFAULT 'pending'
                    CHECK (enrollment_status IN ('pending', 'accepted', 'rejected')),
  enrolled_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (event_id, shop_id)
);
CREATE INDEX IF NOT EXISTS idx_vendor_enrollments_shop_id  ON public.vendor_event_enrollments(shop_id);
CREATE INDEX IF NOT EXISTS idx_vendor_enrollments_event_id ON public.vendor_event_enrollments(event_id);
CREATE INDEX IF NOT EXISTS idx_vendor_enrollments_status   ON public.vendor_event_enrollments(enrollment_status);

-- ============================================================
-- STEP 7: auto-sync trigger — accepted enrollment → discount_profiles rows
-- ============================================================
CREATE OR REPLACE FUNCTION public.fn_sync_event_discounts_on_enrollment()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_event  public.sale_events%ROWTYPE;
  v_offer  public.event_offers%ROWTYPE;
BEGIN
  -- ENROLL: status becomes 'accepted'
  IF (TG_OP = 'UPDATE' AND NEW.enrollment_status = 'accepted' AND OLD.enrollment_status <> 'accepted')
  OR (TG_OP = 'INSERT' AND NEW.enrollment_status = 'accepted')
  THEN
    SELECT * INTO v_event FROM public.sale_events WHERE id = NEW.event_id;

    FOR v_offer IN SELECT * FROM public.event_offers WHERE event_id = NEW.event_id LOOP
      INSERT INTO public.discount_profiles (
        shop_id, discount_name, discount_type, discount_value, max_discount_amount,
        min_order_amount, max_uses_total, max_uses_per_customer, applies_to,
        valid_from, valid_until, source, event_offer_id, created_at, updated_at
      )
      VALUES (
        NEW.shop_id,
        v_event.event_name || ' – ' || v_offer.offer_name,
        v_offer.discount_type, v_offer.discount_value, v_offer.max_discount_amount,
        v_offer.min_order_amount, v_offer.max_uses_total, v_offer.max_uses_per_customer,
        v_offer.applies_to, v_event.start_date, v_event.end_date,
        'event', v_offer.id, now(), now()
      )
      ON CONFLICT DO NOTHING;
    END LOOP;
  END IF;

  -- UNENROLL / REJECTED: remove this event's discounts for the shop
  IF TG_OP = 'UPDATE' AND NEW.enrollment_status IN ('rejected', 'pending')
     AND OLD.enrollment_status = 'accepted'
  THEN
    DELETE FROM public.discount_profiles
    WHERE shop_id = NEW.shop_id AND source = 'event'
      AND event_offer_id IN (SELECT id FROM public.event_offers WHERE event_id = NEW.event_id);
  END IF;

  -- HARD DELETE of an accepted enrollment
  IF TG_OP = 'DELETE' AND OLD.enrollment_status = 'accepted' THEN
    DELETE FROM public.discount_profiles
    WHERE shop_id = OLD.shop_id AND source = 'event'
      AND event_offer_id IN (SELECT id FROM public.event_offers WHERE event_id = OLD.event_id);
    RETURN OLD;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_event_discounts ON public.vendor_event_enrollments;
CREATE TRIGGER trg_sync_event_discounts
  AFTER INSERT OR UPDATE OR DELETE ON public.vendor_event_enrollments
  FOR EACH ROW EXECUTE FUNCTION public.fn_sync_event_discounts_on_enrollment();

-- ============================================================
-- STEP 8: updated_at auto-touch triggers
-- ============================================================
DROP TRIGGER IF EXISTS trg_sale_events_updated_at        ON public.sale_events;
DROP TRIGGER IF EXISTS trg_vendor_enrollments_updated_at ON public.vendor_event_enrollments;

CREATE TRIGGER trg_sale_events_updated_at
  BEFORE UPDATE ON public.sale_events
  FOR EACH ROW EXECUTE FUNCTION public.sale_set_updated_at();

CREATE TRIGGER trg_vendor_enrollments_updated_at
  BEFORE UPDATE ON public.vendor_event_enrollments
  FOR EACH ROW EXECUTE FUNCTION public.sale_set_updated_at();

-- ============================================================
-- STEP 9: RLS
-- ============================================================
ALTER TABLE public.sale_events              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_offers             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_offer_categories   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_offer_listings     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendor_event_enrollments ENABLE ROW LEVEL SECURITY;

-- sale_events -------------------------------------------------
DROP POLICY IF EXISTS admin_all_sale_events            ON public.sale_events;
DROP POLICY IF EXISTS vendor_read_active_sale_events   ON public.sale_events;
DROP POLICY IF EXISTS public_read_active_sale_events   ON public.sale_events;

CREATE POLICY admin_all_sale_events ON public.sale_events FOR ALL
  USING (public.cms_get_role() = 'A') WITH CHECK (public.cms_get_role() = 'A');
CREATE POLICY public_read_active_sale_events ON public.sale_events FOR SELECT
  USING (status = 'active');

-- event_offers ------------------------------------------------
DROP POLICY IF EXISTS admin_all_event_offers               ON public.event_offers;
DROP POLICY IF EXISTS read_event_offers_of_active_events   ON public.event_offers;

CREATE POLICY admin_all_event_offers ON public.event_offers FOR ALL
  USING (public.cms_get_role() = 'A') WITH CHECK (public.cms_get_role() = 'A');
CREATE POLICY read_event_offers_of_active_events ON public.event_offers FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.sale_events se
    WHERE se.id = event_offers.event_id AND se.status = 'active'
  ));

-- event_offer_categories --------------------------------------
DROP POLICY IF EXISTS admin_all_event_offer_categories    ON public.event_offer_categories;
DROP POLICY IF EXISTS read_event_offer_categories_active  ON public.event_offer_categories;

CREATE POLICY admin_all_event_offer_categories ON public.event_offer_categories FOR ALL
  USING (public.cms_get_role() = 'A') WITH CHECK (public.cms_get_role() = 'A');
CREATE POLICY read_event_offer_categories_active ON public.event_offer_categories FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.event_offers eo
    JOIN public.sale_events se ON se.id = eo.event_id
    WHERE eo.id = event_offer_categories.offer_id AND se.status = 'active'
  ));

-- event_offer_listings ----------------------------------------
DROP POLICY IF EXISTS admin_all_event_offer_listings   ON public.event_offer_listings;
DROP POLICY IF EXISTS read_event_offer_listings_active ON public.event_offer_listings;

CREATE POLICY admin_all_event_offer_listings ON public.event_offer_listings FOR ALL
  USING (public.cms_get_role() = 'A') WITH CHECK (public.cms_get_role() = 'A');
CREATE POLICY read_event_offer_listings_active ON public.event_offer_listings FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.event_offers eo
    JOIN public.sale_events se ON se.id = eo.event_id
    WHERE eo.id = event_offer_listings.offer_id AND se.status = 'active'
  ));

-- vendor_event_enrollments ------------------------------------
DROP POLICY IF EXISTS admin_all_vendor_enrollments          ON public.vendor_event_enrollments;
DROP POLICY IF EXISTS vendor_insert_own_enrollment          ON public.vendor_event_enrollments;
DROP POLICY IF EXISTS vendor_read_own_enrollments           ON public.vendor_event_enrollments;
DROP POLICY IF EXISTS vendor_delete_own_pending_enrollment  ON public.vendor_event_enrollments;

CREATE POLICY admin_all_vendor_enrollments ON public.vendor_event_enrollments FOR ALL
  USING (public.cms_get_role() = 'A') WITH CHECK (public.cms_get_role() = 'A');

CREATE POLICY vendor_insert_own_enrollment ON public.vendor_event_enrollments FOR INSERT
  WITH CHECK (
    public.cms_get_role() = 'V'
    AND shop_id IN (SELECT id FROM public.shops WHERE user_id = auth.uid())
    AND EXISTS (SELECT 1 FROM public.sale_events WHERE id = event_id AND status = 'active')
  );

CREATE POLICY vendor_read_own_enrollments ON public.vendor_event_enrollments FOR SELECT
  USING (
    public.cms_get_role() = 'V'
    AND shop_id IN (SELECT id FROM public.shops WHERE user_id = auth.uid())
  );

CREATE POLICY vendor_delete_own_pending_enrollment ON public.vendor_event_enrollments FOR DELETE
  USING (
    public.cms_get_role() = 'V'
    AND shop_id IN (SELECT id FROM public.shops WHERE user_id = auth.uid())
    AND enrollment_status = 'pending'
  );

-- ============================================================
-- STEP 10: sale-event-banners storage bucket + policies
-- ============================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'sale-event-banners', 'sale-event-banners', true, 5242880,
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "sale-event-banners: public read"  ON storage.objects;
DROP POLICY IF EXISTS "sale-event-banners: admin upload" ON storage.objects;
DROP POLICY IF EXISTS "sale-event-banners: admin update" ON storage.objects;
DROP POLICY IF EXISTS "sale-event-banners: admin delete" ON storage.objects;

CREATE POLICY "sale-event-banners: public read" ON storage.objects FOR SELECT
  USING (bucket_id = 'sale-event-banners');

CREATE POLICY "sale-event-banners: admin upload" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'sale-event-banners' AND public.cms_get_role() = 'A');

CREATE POLICY "sale-event-banners: admin update" ON storage.objects FOR UPDATE
  USING (bucket_id = 'sale-event-banners' AND public.cms_get_role() = 'A');

CREATE POLICY "sale-event-banners: admin delete" ON storage.objects FOR DELETE
  USING (bucket_id = 'sale-event-banners' AND public.cms_get_role() = 'A');

-- ============================================================
-- DONE
-- ============================================================
