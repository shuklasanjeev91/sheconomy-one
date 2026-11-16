-- Warehouse-wise inventory for sellers.
-- listings.quantity remains checkout source of truth (= sum of warehouse_inventory when rows exist).
-- EasyShip ship-from stays resolveSellerOrigin (warehouse → shop address); unchanged here.

ALTER TABLE public.warehouse_inventory ENABLE ROW LEVEL SECURITY;

-- Null-safe uniqueness: Postgres UNIQUE treats NULLs as distinct.
ALTER TABLE public.warehouse_inventory
  DROP CONSTRAINT IF EXISTS unique_warehouse_product_variant;
DROP INDEX IF EXISTS unique_warehouse_product_variant;

CREATE UNIQUE INDEX IF NOT EXISTS unique_warehouse_listing_base
  ON public.warehouse_inventory (warehouse_id, listing_id)
  WHERE variant_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS unique_warehouse_listing_variant
  ON public.warehouse_inventory (warehouse_id, listing_id, variant_id)
  WHERE variant_id IS NOT NULL;

DROP POLICY IF EXISTS warehouse_inventory_owner_select ON public.warehouse_inventory;
CREATE POLICY warehouse_inventory_owner_select
  ON public.warehouse_inventory
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.warehouses w
      JOIN public.shops s ON s.id = w.shop_id
      WHERE w.id = warehouse_id
        AND (s.user_id = auth.uid() OR EXISTS (
          SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'A'
        ))
    )
  );

DROP POLICY IF EXISTS warehouse_inventory_owner_insert ON public.warehouse_inventory;
CREATE POLICY warehouse_inventory_owner_insert
  ON public.warehouse_inventory
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.warehouses w
      JOIN public.shops s ON s.id = w.shop_id
      WHERE w.id = warehouse_id AND s.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS warehouse_inventory_owner_update ON public.warehouse_inventory;
CREATE POLICY warehouse_inventory_owner_update
  ON public.warehouse_inventory
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.warehouses w
      JOIN public.shops s ON s.id = w.shop_id
      WHERE w.id = warehouse_id
        AND (s.user_id = auth.uid() OR EXISTS (
          SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'A'
        ))
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.warehouses w
      JOIN public.shops s ON s.id = w.shop_id
      WHERE w.id = warehouse_id
        AND (s.user_id = auth.uid() OR EXISTS (
          SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'A'
        ))
    )
  );

DROP POLICY IF EXISTS warehouse_inventory_owner_delete ON public.warehouse_inventory;
CREATE POLICY warehouse_inventory_owner_delete
  ON public.warehouse_inventory
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.warehouses w
      JOIN public.shops s ON s.id = w.shop_id
      WHERE w.id = warehouse_id AND s.user_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- Sync listing.quantity / variation.stock from warehouse rows
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sync_listing_quantity_from_warehouses(
  p_listing_id uuid,
  p_variant_id uuid DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sum integer;
BEGIN
  IF p_listing_id IS NULL THEN
    RAISE EXCEPTION 'listing_id is required';
  END IF;

  SELECT coalesce(sum(wi.available_quantity), 0)::integer
  INTO v_sum
  FROM public.warehouse_inventory wi
  WHERE wi.listing_id = p_listing_id
    AND wi.variant_id IS NOT DISTINCT FROM p_variant_id
    AND coalesce(wi.is_active, true);

  -- Avoid recursive mirror when we push the sum onto listings.
  PERFORM set_config('app.skip_wh_mirror', '1', true);

  IF p_variant_id IS NULL THEN
    UPDATE public.listings
    SET quantity = v_sum,
        stock = v_sum,
        updated_at = now()
    WHERE id = p_listing_id;
  ELSE
    UPDATE public.listing_variations
    SET stock = v_sum,
        updated_at = now()
    WHERE id = p_variant_id AND listing_id = p_listing_id;
  END IF;

  PERFORM set_config('app.skip_wh_mirror', '0', true);
  RETURN v_sum;
END;
$$;

REVOKE ALL ON FUNCTION public.sync_listing_quantity_from_warehouses(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sync_listing_quantity_from_warehouses(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sync_listing_quantity_from_warehouses(uuid, uuid) TO service_role;

-- ---------------------------------------------------------------------------
-- Mirror listing quantity changes onto warehouse_inventory when rows exist
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._mirror_listing_qty_to_warehouse_inventory()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old integer;
  v_new integer;
  v_delta integer;
  v_left integer;
  v_take integer;
  r record;
  v_default_wh uuid;
  v_shop_id uuid;
BEGIN
  IF current_setting('app.skip_wh_mirror', true) = '1' THEN
    RETURN NEW;
  END IF;

  v_old := CASE WHEN TG_TABLE_NAME = 'listings' THEN OLD.quantity ELSE OLD.stock END;
  v_new := CASE WHEN TG_TABLE_NAME = 'listings' THEN NEW.quantity ELSE NEW.stock END;

  IF v_old IS NULL OR v_new IS NULL OR v_old IS NOT DISTINCT FROM v_new THEN
    RETURN NEW;
  END IF;

  -- Only act when warehouse inventory rows already exist for this SKU.
  IF TG_TABLE_NAME = 'listings' THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.warehouse_inventory
      WHERE listing_id = NEW.id AND variant_id IS NULL AND coalesce(is_active, true)
    ) THEN
      RETURN NEW;
    END IF;
    v_shop_id := NEW.shop_id;
  ELSE
    IF NOT EXISTS (
      SELECT 1 FROM public.warehouse_inventory
      WHERE listing_id = NEW.listing_id AND variant_id = NEW.id AND coalesce(is_active, true)
    ) THEN
      RETURN NEW;
    END IF;
    SELECT shop_id INTO v_shop_id FROM public.listings WHERE id = NEW.listing_id;
  END IF;

  v_delta := v_new - v_old;

  SELECT w.id INTO v_default_wh
  FROM public.warehouses w
  WHERE w.shop_id = v_shop_id AND w.status = 'active'
  ORDER BY w.is_default DESC, w.is_primary DESC, w.updated_at DESC NULLS LAST
  LIMIT 1;

  IF v_delta < 0 THEN
    v_left := -v_delta;
    FOR r IN
      SELECT wi.id, wi.available_quantity
      FROM public.warehouse_inventory wi
      JOIN public.warehouses w ON w.id = wi.warehouse_id
      WHERE wi.listing_id = CASE WHEN TG_TABLE_NAME = 'listings' THEN NEW.id ELSE NEW.listing_id END
        AND wi.variant_id IS NOT DISTINCT FROM CASE WHEN TG_TABLE_NAME = 'listings' THEN NULL ELSE NEW.id END
        AND coalesce(wi.is_active, true)
      ORDER BY (w.id = v_default_wh) DESC, w.is_default DESC, wi.available_quantity DESC
      FOR UPDATE OF wi
    LOOP
      EXIT WHEN v_left <= 0;
      v_take := LEAST(r.available_quantity, v_left);
      UPDATE public.warehouse_inventory
      SET available_quantity = available_quantity - v_take,
          updated_at = now(),
          status = CASE
            WHEN available_quantity - v_take <= 0 THEN 'out_of_stock'::inventory_status_enum
            ELSE status
          END
      WHERE id = r.id;
      v_left := v_left - v_take;
    END LOOP;
  ELSIF v_delta > 0 THEN
    -- Restock onto default warehouse row when present; else first active row.
    UPDATE public.warehouse_inventory wi
    SET available_quantity = wi.available_quantity + v_delta,
        updated_at = now(),
        status = 'in_stock'::inventory_status_enum,
        last_restocked_at = now()
    WHERE wi.id = (
      SELECT wi2.id
      FROM public.warehouse_inventory wi2
      JOIN public.warehouses w ON w.id = wi2.warehouse_id
      WHERE wi2.listing_id = CASE WHEN TG_TABLE_NAME = 'listings' THEN NEW.id ELSE NEW.listing_id END
        AND wi2.variant_id IS NOT DISTINCT FROM CASE WHEN TG_TABLE_NAME = 'listings' THEN NULL ELSE NEW.id END
        AND coalesce(wi2.is_active, true)
      ORDER BY (w.id = v_default_wh) DESC, w.is_default DESC
      LIMIT 1
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS mirror_listing_qty_to_warehouse_inventory ON public.listings;
CREATE TRIGGER mirror_listing_qty_to_warehouse_inventory
  AFTER UPDATE OF quantity ON public.listings
  FOR EACH ROW
  EXECUTE FUNCTION public._mirror_listing_qty_to_warehouse_inventory();

DROP TRIGGER IF EXISTS mirror_variation_stock_to_warehouse_inventory ON public.listing_variations;
CREATE TRIGGER mirror_variation_stock_to_warehouse_inventory
  AFTER UPDATE OF stock ON public.listing_variations
  FOR EACH ROW
  EXECUTE FUNCTION public._mirror_listing_qty_to_warehouse_inventory();

-- ---------------------------------------------------------------------------
-- Seller: set absolute stock for one warehouse + listing (+ optional variant)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.vendor_set_warehouse_inventory(
  p_shop_id uuid,
  p_warehouse_id uuid,
  p_listing_id uuid,
  p_available_quantity integer,
  p_variant_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.warehouse_inventory%ROWTYPE;
  v_sum integer;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.shops WHERE id = p_shop_id AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  IF p_available_quantity IS NULL OR p_available_quantity < 0 THEN
    RAISE EXCEPTION 'available_quantity must be >= 0';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.warehouses
    WHERE id = p_warehouse_id AND shop_id = p_shop_id AND status = 'active'
  ) THEN
    RAISE EXCEPTION 'Warehouse not found for this shop';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.listings WHERE id = p_listing_id AND shop_id = p_shop_id
  ) THEN
    RAISE EXCEPTION 'Listing not found for this shop';
  END IF;

  IF p_variant_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.listing_variations
    WHERE id = p_variant_id AND listing_id = p_listing_id
  ) THEN
    RAISE EXCEPTION 'Variation not found for this listing';
  END IF;

  IF p_variant_id IS NULL THEN
    INSERT INTO public.warehouse_inventory AS wi (
      warehouse_id, listing_id, variant_id, available_quantity, status, is_active, updated_at, last_restocked_at
    ) VALUES (
      p_warehouse_id, p_listing_id, NULL, p_available_quantity,
      CASE WHEN p_available_quantity > 0 THEN 'in_stock'::inventory_status_enum ELSE 'out_of_stock'::inventory_status_enum END,
      true, now(), now()
    )
    ON CONFLICT (warehouse_id, listing_id) WHERE variant_id IS NULL
    DO UPDATE SET
      available_quantity = EXCLUDED.available_quantity,
      status = EXCLUDED.status,
      is_active = true,
      updated_at = now(),
      last_restocked_at = now()
    RETURNING * INTO v_row;
  ELSE
    INSERT INTO public.warehouse_inventory AS wi (
      warehouse_id, listing_id, variant_id, available_quantity, status, is_active, updated_at, last_restocked_at
    ) VALUES (
      p_warehouse_id, p_listing_id, p_variant_id, p_available_quantity,
      CASE WHEN p_available_quantity > 0 THEN 'in_stock'::inventory_status_enum ELSE 'out_of_stock'::inventory_status_enum END,
      true, now(), now()
    )
    ON CONFLICT (warehouse_id, listing_id, variant_id) WHERE variant_id IS NOT NULL
    DO UPDATE SET
      available_quantity = EXCLUDED.available_quantity,
      status = EXCLUDED.status,
      is_active = true,
      updated_at = now(),
      last_restocked_at = now()
    RETURNING * INTO v_row;
  END IF;

  v_sum := public.sync_listing_quantity_from_warehouses(p_listing_id, p_variant_id);

  RETURN jsonb_build_object(
    'id', v_row.id,
    'warehouse_id', v_row.warehouse_id,
    'listing_id', v_row.listing_id,
    'variant_id', v_row.variant_id,
    'available_quantity', v_row.available_quantity,
    'listing_quantity', v_sum
  );
END;
$$;

REVOKE ALL ON FUNCTION public.vendor_set_warehouse_inventory(uuid, uuid, uuid, integer, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.vendor_set_warehouse_inventory(uuid, uuid, uuid, integer, uuid) TO authenticated;

-- Apply a stock delta onto the shop default warehouse (bulk +/-).
CREATE OR REPLACE FUNCTION public.vendor_apply_default_warehouse_stock_delta(
  p_shop_id uuid,
  p_listing_ids uuid[],
  p_stock_delta integer
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_wh uuid;
  v_id uuid;
  v_current integer;
  v_next integer;
  v_count integer := 0;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.shops WHERE id = p_shop_id AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  IF p_stock_delta IS NULL OR p_stock_delta = 0 THEN
    RETURN 0;
  END IF;

  SELECT w.id INTO v_wh
  FROM public.warehouses w
  WHERE w.shop_id = p_shop_id AND w.status = 'active'
  ORDER BY w.is_default DESC, w.is_primary DESC, w.updated_at DESC NULLS LAST
  LIMIT 1;

  IF v_wh IS NULL THEN
    -- No warehouse: fall back to listing-level stock.
    UPDATE public.listings
    SET quantity = CASE
          WHEN quantity IS NULL THEN quantity
          ELSE greatest(0, quantity + p_stock_delta)
        END,
        stock = CASE
          WHEN stock IS NULL THEN stock
          ELSE greatest(0, stock + p_stock_delta)
        END,
        updated_at = now()
    WHERE shop_id = p_shop_id AND id = ANY(p_listing_ids);
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
  END IF;

  FOREACH v_id IN ARRAY p_listing_ids LOOP
    IF NOT EXISTS (
      SELECT 1 FROM public.listings WHERE id = v_id AND shop_id = p_shop_id
    ) THEN
      CONTINUE;
    END IF;

    SELECT available_quantity INTO v_current
    FROM public.warehouse_inventory
    WHERE warehouse_id = v_wh AND listing_id = v_id AND variant_id IS NULL
    FOR UPDATE;

    IF NOT FOUND THEN
      -- Seed from current listing quantity when first touching warehouse stock.
      SELECT coalesce(quantity, stock, 0) INTO v_current
      FROM public.listings WHERE id = v_id;
      v_current := coalesce(v_current, 0);
    END IF;

    v_next := greatest(0, coalesce(v_current, 0) + p_stock_delta);
    PERFORM public.vendor_set_warehouse_inventory(p_shop_id, v_wh, v_id, v_next, NULL);
    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.vendor_apply_default_warehouse_stock_delta(uuid, uuid[], integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.vendor_apply_default_warehouse_stock_delta(uuid, uuid[], integer) TO authenticated;

-- Prefer warehouse-aware bulk stock when a delta is provided.
CREATE OR REPLACE FUNCTION public.vendor_bulk_update_listings(
  p_shop_id uuid,
  p_listing_ids uuid[],
  p_status text DEFAULT NULL,
  p_price_percent numeric DEFAULT NULL,
  p_stock_delta integer DEFAULT NULL,
  p_category text DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
  v_stock_count integer := 0;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.shops WHERE id = p_shop_id AND user_id = auth.uid()) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;
  IF p_status IS NOT NULL AND p_status NOT IN ('draft', 'active', 'paused', 'sold_out', 'archived') THEN
    RAISE EXCEPTION 'Invalid listing status';
  END IF;

  IF p_stock_delta IS NOT NULL AND p_stock_delta <> 0 THEN
    v_stock_count := public.vendor_apply_default_warehouse_stock_delta(
      p_shop_id, p_listing_ids, p_stock_delta
    );
  END IF;

  UPDATE public.listings
  SET listing_status = coalesce(p_status::listing_status_enum, listing_status),
      is_active = CASE WHEN p_status IS NULL THEN is_active WHEN p_status = 'active' THEN true ELSE false END,
      price = CASE WHEN p_price_percent IS NULL THEN price ELSE greatest(0, round(price * (1 + p_price_percent / 100), 2)) END,
      category = coalesce(nullif(trim(p_category), ''), category),
      updated_at = now()
  WHERE shop_id = p_shop_id AND id = ANY(p_listing_ids);

  GET DIAGNOSTICS v_count = ROW_COUNT;
  IF p_stock_delta IS NOT NULL AND p_stock_delta <> 0 THEN
    RETURN greatest(v_count, v_stock_count);
  END IF;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.vendor_bulk_update_listings(uuid, uuid[], text, numeric, integer, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.vendor_bulk_update_listings(uuid, uuid[], text, numeric, integer, text) TO authenticated;

COMMENT ON TABLE public.warehouse_inventory IS
  'Per-warehouse stock for listings/variants. Sum syncs to listings.quantity for checkout.';
