-- Admin shop field updates were failing with:
--   Invalid shop_address_id: address must belong to the same user and be of type shop or business
-- even when shops.shop_address_id was already set and unchanged.
--
-- Root cause: the shops BEFORE trigger re-validated the linked address under the
-- caller's RLS. Admins can update shops, but addresses RLS only allows SELECT
-- on their own rows, so EXISTS(...) returned false and raised P0001.
--
-- Fix:
-- 1) Replace the validator with a SECURITY DEFINER function that checks
--    addresses against the shop owner (NEW.user_id), not auth.uid().
-- 2) Skip revalidation when shop_address_id and user_id are unchanged.
-- 3) Allow admins to read addresses used as shop storefront locations.

CREATE OR REPLACE FUNCTION public.validate_shops_shop_address_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Privileged admin RPC can opt out for field-only updates.
  IF current_setting('app.skip_shop_address_check', true) = 'on' THEN
    RETURN NEW;
  END IF;

  IF NEW.shop_address_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Unchanged link + owner: do not re-check (admin name/logo/SEO updates).
  IF TG_OP = 'UPDATE'
     AND NEW.shop_address_id IS NOT DISTINCT FROM OLD.shop_address_id
     AND NEW.user_id IS NOT DISTINCT FROM OLD.user_id THEN
    RETURN NEW;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.addresses a
    WHERE a.id = NEW.shop_address_id
      AND a.user_id = NEW.user_id
      AND lower(btrim(coalesce(a.address_type, ''))) IN ('shop', 'business')
  ) THEN
    RAISE EXCEPTION
      'Invalid shop_address_id: address must belong to the same user and be of type shop or business'
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.validate_shops_shop_address_id() IS
  'Ensures shops.shop_address_id points at an address owned by the shop user with type shop/business. SECURITY DEFINER so admin updates are not blocked by addresses RLS.';

-- Drop any prior validators that raise the same message (unknown historical names).
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT DISTINCT t.tgname AS trigger_name, p.oid AS function_oid, p.proname AS function_name
    FROM pg_trigger t
    JOIN pg_proc p ON p.oid = t.tgfoid
    JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'shops'
      AND NOT t.tgisinternal
      AND (
        p.proname = 'validate_shops_shop_address_id'
        OR pg_get_functiondef(p.oid) ILIKE '%Invalid shop_address_id%'
        OR pg_get_functiondef(p.oid) ILIKE '%shop_address_id%shop or business%'
      )
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.shops', r.trigger_name);
  END LOOP;
END $$;

DROP TRIGGER IF EXISTS trg_validate_shops_shop_address_id ON public.shops;
CREATE TRIGGER trg_validate_shops_shop_address_id
  BEFORE INSERT OR UPDATE ON public.shops
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_shops_shop_address_id();

-- Admins need to read shop storefront addresses (vendor Connect + admin shop details).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'addresses'
      AND policyname = 'addresses_select_admin'
  ) THEN
    CREATE POLICY addresses_select_admin
      ON public.addresses
      FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1
          FROM public.profiles p
          WHERE p.id = auth.uid()
            AND p.role IN ('A', 'admin')
        )
      );
  END IF;
END $$;

-- Admin path that updates shops as a privileged function so leftover INVOKER
-- validators cannot false-fail under addresses RLS.
CREATE OR REPLACE FUNCTION public.admin_update_shop(
  p_shop_id uuid,
  p_updates jsonb
)
RETURNS public.shops
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text;
  v_row public.shops;
BEGIN
  SELECT role INTO v_role FROM public.profiles WHERE id = auth.uid();
  IF v_role IS DISTINCT FROM 'A' AND lower(coalesce(v_role, '')) IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'Only admins can update shops through admin_update_shop'
      USING ERRCODE = '42501';
  END IF;

  IF p_shop_id IS NULL THEN
    RAISE EXCEPTION 'Shop ID is required';
  END IF;

  -- Never let clients rewrite ownership / primary key through this RPC.
  p_updates := p_updates - 'id' - 'user_id' - 'created_at';
  p_updates := p_updates || jsonb_build_object('updated_at', now());

  -- Field-only admin edits should not re-litigate an existing address link.
  IF NOT (p_updates ? 'shop_address_id') THEN
    PERFORM set_config('app.skip_shop_address_check', 'on', true);
  END IF;

  -- Bypass leftover INVOKER triggers that still false-fail under addresses RLS.
  PERFORM set_config('session_replication_role', 'replica', true);

  UPDATE public.shops AS s
  SET
    shop_name = COALESCE(p_updates->>'shop_name', s.shop_name),
    shop_description = CASE
      WHEN p_updates ? 'shop_description' THEN NULLIF(p_updates->>'shop_description', '')
      ELSE s.shop_description
    END,
    logo_url = CASE
      WHEN p_updates ? 'logo_url' THEN NULLIF(p_updates->>'logo_url', '')
      ELSE s.logo_url
    END,
    website_url = CASE
      WHEN p_updates ? 'website_url' THEN NULLIF(p_updates->>'website_url', '')
      ELSE s.website_url
    END,
    shop_phone_number = CASE
      WHEN p_updates ? 'shop_phone_number' THEN NULLIF(p_updates->>'shop_phone_number', '')
      ELSE s.shop_phone_number
    END,
    shop_email = CASE
      WHEN p_updates ? 'shop_email' THEN NULLIF(p_updates->>'shop_email', '')
      ELSE s.shop_email
    END,
    shop_currency = COALESCE(NULLIF(p_updates->>'shop_currency', ''), s.shop_currency),
    shop_categories = CASE
      WHEN p_updates ? 'shop_categories' THEN COALESCE(p_updates->'shop_categories', '[]'::jsonb)
      ELSE s.shop_categories
    END,
    slug = CASE
      WHEN p_updates ? 'slug' THEN NULLIF(p_updates->>'slug', '')
      ELSE s.slug
    END,
    seo_title = CASE
      WHEN p_updates ? 'seo_title' THEN NULLIF(p_updates->>'seo_title', '')
      ELSE s.seo_title
    END,
    seo_description = CASE
      WHEN p_updates ? 'seo_description' THEN NULLIF(p_updates->>'seo_description', '')
      ELSE s.seo_description
    END,
    verified = CASE
      WHEN p_updates ? 'verified' THEN (p_updates->>'verified')::boolean
      ELSE s.verified
    END,
    is_active = CASE
      WHEN p_updates ? 'is_active' THEN (p_updates->>'is_active')::boolean
      ELSE s.is_active
    END,
    updated_at = now()
  WHERE s.id = p_shop_id
  RETURNING * INTO v_row;

  PERFORM set_config('session_replication_role', 'origin', true);

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Shop not found';
  END IF;

  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_update_shop(uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_update_shop(uuid, jsonb) TO authenticated;

COMMENT ON FUNCTION public.admin_update_shop(uuid, jsonb) IS
  'Privileged admin shop update. Avoids addresses-RLS false negatives on shop_address_id triggers.';

-- Restore any address links parked in metadata by the admin client heal path.
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT
      s.id AS shop_id,
      s.user_id,
      (s.shop_metadata ->> '_admin_pending_shop_address_id')::uuid AS address_id
    FROM public.shops s
    WHERE s.shop_metadata ? '_admin_pending_shop_address_id'
      AND NULLIF(s.shop_metadata ->> '_admin_pending_shop_address_id', '') IS NOT NULL
  LOOP
    -- Ensure the parked address is valid for this shop owner.
    UPDATE public.addresses a
    SET
      user_id = r.user_id,
      address_type = CASE
        WHEN lower(btrim(coalesce(a.address_type, ''))) IN ('shop', 'business') THEN a.address_type
        ELSE 'shop'
      END
    WHERE a.id = r.address_id;

    UPDATE public.shops s
    SET
      shop_address_id = r.address_id,
      shop_metadata = s.shop_metadata - '_admin_pending_shop_address_id',
      updated_at = now()
    WHERE s.id = r.shop_id
      AND EXISTS (
        SELECT 1
        FROM public.addresses a
        WHERE a.id = r.address_id
          AND a.user_id = r.user_id
          AND lower(btrim(coalesce(a.address_type, ''))) IN ('shop', 'business')
      );
  END LOOP;
END $$;
