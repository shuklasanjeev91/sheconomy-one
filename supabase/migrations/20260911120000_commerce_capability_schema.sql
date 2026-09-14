-- Commerce capability roadmap: personalized offers, bundles/preorder helpers,
-- recently viewed, reorder schedules, demand forecasts, notification templates.

-- ---------------------------------------------------------------------------
-- Discount assignments (personalized offers)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.discount_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  discount_profile_id uuid NOT NULL REFERENCES public.discount_profiles(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  assignment_code text,
  expires_at timestamptz,
  notified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  UNIQUE (discount_profile_id, user_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS discount_assignments_code_uidx
  ON public.discount_assignments (upper(assignment_code))
  WHERE assignment_code IS NOT NULL;

CREATE INDEX IF NOT EXISTS discount_assignments_user_idx
  ON public.discount_assignments (user_id, created_at DESC);

ALTER TABLE public.discount_assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS discount_assignments_select_own ON public.discount_assignments;
CREATE POLICY discount_assignments_select_own
  ON public.discount_assignments FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM public.discount_profiles dp
      JOIN public.shops s ON s.id = dp.shop_id
      WHERE dp.id = discount_profile_id
        AND s.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS discount_assignments_insert_vendor ON public.discount_assignments;
CREATE POLICY discount_assignments_insert_vendor
  ON public.discount_assignments FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.discount_profiles dp
      JOIN public.shops s ON s.id = dp.shop_id
      WHERE dp.id = discount_profile_id
        AND s.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS discount_assignments_delete_vendor ON public.discount_assignments;
CREATE POLICY discount_assignments_delete_vendor
  ON public.discount_assignments FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.discount_profiles dp
      JOIN public.shops s ON s.id = dp.shop_id
      WHERE dp.id = discount_profile_id
        AND s.user_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- Recently viewed (server-side, synced from device)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.listing_recently_viewed (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  listing_id uuid NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  viewed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, listing_id)
);

CREATE INDEX IF NOT EXISTS listing_recently_viewed_user_idx
  ON public.listing_recently_viewed (user_id, viewed_at DESC);

ALTER TABLE public.listing_recently_viewed ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS listing_recently_viewed_own ON public.listing_recently_viewed;
CREATE POLICY listing_recently_viewed_own
  ON public.listing_recently_viewed FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Reorder schedules (lightweight subscriptions)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.listing_reorder_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  listing_id uuid NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  variant_id uuid REFERENCES public.listing_variations(id) ON DELETE SET NULL,
  quantity integer NOT NULL DEFAULT 1 CHECK (quantity > 0),
  cadence text NOT NULL CHECK (cadence IN ('weekly', 'biweekly', 'monthly')),
  next_run_at timestamptz NOT NULL,
  address_id uuid REFERENCES public.addresses(id) ON DELETE SET NULL,
  paused boolean NOT NULL DEFAULT false,
  last_notified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, listing_id, variant_id)
);

CREATE INDEX IF NOT EXISTS listing_reorder_schedules_due_idx
  ON public.listing_reorder_schedules (next_run_at)
  WHERE paused = false;

ALTER TABLE public.listing_reorder_schedules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS listing_reorder_schedules_own ON public.listing_reorder_schedules;
CREATE POLICY listing_reorder_schedules_own
  ON public.listing_reorder_schedules FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Listing-level demand / inventory forecast
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.listing_demand_forecasts (
  listing_id uuid PRIMARY KEY REFERENCES public.listings(id) ON DELETE CASCADE,
  shop_id uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  units_7d integer NOT NULL DEFAULT 0,
  units_28d integer NOT NULL DEFAULT 0,
  units_90d integer NOT NULL DEFAULT 0,
  average_daily_sales numeric NOT NULL DEFAULT 0,
  forecast_units_14d numeric NOT NULL DEFAULT 0,
  forecast_units_30d numeric NOT NULL DEFAULT 0,
  forecast_units_90d numeric NOT NULL DEFAULT 0,
  on_hand integer NOT NULL DEFAULT 0,
  stock_cover_days numeric,
  reorder_point numeric,
  suggested_restock_qty integer NOT NULL DEFAULT 0,
  computed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS listing_demand_forecasts_shop_idx
  ON public.listing_demand_forecasts (shop_id, stock_cover_days);

ALTER TABLE public.listing_demand_forecasts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS listing_demand_forecasts_vendor ON public.listing_demand_forecasts;
CREATE POLICY listing_demand_forecasts_vendor
  ON public.listing_demand_forecasts FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.shops s
      WHERE s.id = shop_id AND s.user_id = auth.uid()
    )
  );

CREATE TABLE IF NOT EXISTS public.listing_bundles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  title text NOT NULL,
  slug text,
  description text,
  bundle_price numeric NOT NULL,
  currency text NOT NULL DEFAULT 'INR',
  image_url text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.listing_bundle_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bundle_id uuid NOT NULL REFERENCES public.listing_bundles(id) ON DELETE CASCADE,
  listing_id uuid NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  quantity integer NOT NULL DEFAULT 1,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF to_regclass('public.listing_bundles') IS NULL THEN
    RETURN;
  END IF;
  ALTER TABLE public.listing_bundles ENABLE ROW LEVEL SECURITY;
  ALTER TABLE public.listing_bundle_items ENABLE ROW LEVEL SECURITY;
  EXECUTE 'DROP POLICY IF EXISTS listing_bundles_public_read ON public.listing_bundles';
  EXECUTE $p$CREATE POLICY listing_bundles_public_read ON public.listing_bundles FOR SELECT USING (is_active = true)$p$;
  EXECUTE 'DROP POLICY IF EXISTS listing_bundles_vendor_all ON public.listing_bundles';
  EXECUTE $p$
    CREATE POLICY listing_bundles_vendor_all ON public.listing_bundles FOR ALL TO authenticated
    USING (EXISTS (SELECT 1 FROM public.shops s WHERE s.id = shop_id AND s.user_id = auth.uid()))
    WITH CHECK (EXISTS (SELECT 1 FROM public.shops s WHERE s.id = shop_id AND s.user_id = auth.uid()))
  $p$;
  EXECUTE 'DROP POLICY IF EXISTS listing_bundle_items_public_read ON public.listing_bundle_items';
  EXECUTE $p$
    CREATE POLICY listing_bundle_items_public_read ON public.listing_bundle_items FOR SELECT
    USING (EXISTS (SELECT 1 FROM public.listing_bundles b WHERE b.id = bundle_id AND b.is_active = true))
  $p$;
  EXECUTE 'DROP POLICY IF EXISTS listing_bundle_items_vendor_all ON public.listing_bundle_items';
  EXECUTE $p$
    CREATE POLICY listing_bundle_items_vendor_all ON public.listing_bundle_items FOR ALL TO authenticated
    USING (
      EXISTS (
        SELECT 1 FROM public.listing_bundles b
        JOIN public.shops s ON s.id = b.shop_id
        WHERE b.id = bundle_id AND s.user_id = auth.uid()
      )
    )
    WITH CHECK (
      EXISTS (
        SELECT 1 FROM public.listing_bundles b
        JOIN public.shops s ON s.id = b.shop_id
        WHERE b.id = bundle_id AND s.user_id = auth.uid()
      )
    )
  $p$;
END $$;

-- ---------------------------------------------------------------------------
-- Notification templates
-- ---------------------------------------------------------------------------
INSERT INTO public.notification_templates (
  template_key, platform, category, title_template, message_template,
  email_subject_template, email_body_template, sms_template,
  push_title_template, push_body_template, whatsapp_template,
  action_url_template, default_channels, default_priority, is_active
)
VALUES
(
  'personalized_offer_assigned', 'commerce', 'promotional',
  'A personal offer is waiting',
  '{{discount_name}} is ready to use on your next order.',
  'Your SHEconomy offer: {{discount_name}}',
  '<p>Hi {{customer_name}},</p><p>You have a personal offer: <strong>{{discount_name}}</strong>.</p><p>Code: <strong>{{offer_code}}</strong></p><p><a href="{{action_url}}">Shop now</a></p>',
  NULL,
  'Personal offer',
  '{{discount_name}} is ready in your cart',
  NULL,
  '/cart',
  ARRAY['in_app', 'push', 'email']::text[], 2, true
),
(
  'reorder_schedule_due', 'commerce', 'transactional',
  'Time to reorder {{listing_title}}',
  'Your scheduled reorder for {{listing_title}} is ready. Pay to confirm with your usual checkout.',
  'Reorder {{listing_title}}',
  '<p>Your scheduled reorder for <strong>{{listing_title}}</strong> is due.</p><p><a href="{{action_url}}">Open cart</a></p>',
  NULL,
  'Reorder reminder',
  '{{listing_title}} is due for reorder',
  NULL,
  '/cart',
  ARRAY['in_app', 'push', 'email']::text[], 2, true
),
(
  'inventory_cover_low_vendor', 'commerce', 'transactional',
  '{{listing_title}} may run out soon',
  'About {{stock_cover_days}} days of stock left. Suggested restock: {{suggested_restock_qty}}.',
  'Low cover: {{listing_title}}',
  '<p><strong>{{listing_title}}</strong> has about {{stock_cover_days}} days of cover.</p><p>Suggested restock: {{suggested_restock_qty}}.</p>',
  NULL,
  'Stock cover low',
  '{{listing_title}} · ~{{stock_cover_days}} days left',
  NULL,
  '/vendor/analytics',
  ARRAY['in_app', 'email', 'push']::text[], 2, true
)
ON CONFLICT (template_key) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.commerce_discount_buyer_user_type(p_user_id uuid)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer := 0;
BEGIN
  IF p_user_id IS NULL THEN
    RETURN 'new';
  END IF;
  SELECT count(*)::integer INTO v_count
  FROM public.orders
  WHERE user_id = p_user_id
    AND order_status NOT IN ('cancelled', 'refunded');
  IF v_count = 0 THEN
    RETURN 'new';
  ELSIF v_count >= 5 THEN
    RETURN 'vip';
  END IF;
  RETURN 'returning';
END;
$$;

CREATE OR REPLACE FUNCTION public.commerce_discount_user_type_ok(
  p_eligible text[],
  p_buyer_type text
) RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT p_eligible IS NULL
    OR cardinality(p_eligible) = 0
    OR 'all' = ANY (p_eligible)
    OR p_buyer_type = ANY (p_eligible);
$$;

CREATE OR REPLACE FUNCTION public.commerce_discount_is_assigned(
  p_discount_id uuid,
  p_user_id uuid
) RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.discount_assignments da
    WHERE da.discount_profile_id = p_discount_id
      AND da.user_id = p_user_id
      AND (da.expires_at IS NULL OR da.expires_at >= now())
  );
$$;

CREATE OR REPLACE FUNCTION public.commerce_cart_line_unit_price(
  p_metadata jsonb,
  p_cart_unit numeric,
  p_listing_price numeric,
  p_variant_adj numeric
) RETURNS numeric
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN coalesce(p_metadata->>'bundle_id', '') <> '' THEN p_cart_unit
    ELSE p_listing_price + coalesce(p_variant_adj, 0)
  END;
$$;

CREATE OR REPLACE FUNCTION public.commerce_listing_allows_preorder(p_metadata jsonb)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT lower(coalesce(p_metadata->>'allow_preorder', 'false')) IN ('true', '1', 'yes');
$$;

CREATE OR REPLACE FUNCTION public.commerce_cart_bogo_discount(
  p_cart_id uuid,
  p_cart_item_ids uuid[],
  p_discount_id uuid
) RETURNS numeric
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rule public.bogo_rules%ROWTYPE;
  v_buy_qty integer := 0;
  v_triggers integer := 0;
  v_remaining integer := 0;
  v_total numeric := 0;
  r record;
BEGIN
  SELECT * INTO v_rule
  FROM public.bogo_rules
  WHERE discount_profile_id = p_discount_id;
  IF NOT FOUND THEN
    RETURN 0;
  END IF;

  SELECT coalesce(sum(ci.quantity), 0) INTO v_buy_qty
  FROM public.cart_items ci
  JOIN public.listings l ON l.id = ci.listing_id
  WHERE ci.cart_id = p_cart_id
    AND ci.id = ANY (p_cart_item_ids)
    AND ci.saved_for_later = false
    AND (
      (coalesce(array_length(v_rule.buy_listing_ids, 1), 0) > 0 AND l.id = ANY (v_rule.buy_listing_ids))
      OR (coalesce(array_length(v_rule.buy_categories, 1), 0) > 0 AND l.category = ANY (v_rule.buy_categories))
    );

  IF v_buy_qty < v_rule.buy_quantity THEN
    RETURN 0;
  END IF;

  v_triggers := floor(v_buy_qty::numeric / v_rule.buy_quantity)::integer;
  v_remaining := v_rule.get_quantity * v_triggers;

  FOR r IN
    SELECT
      ci.quantity,
      public.commerce_cart_line_unit_price(ci.item_metadata, ci.unit_price, l.price, lv.price_adjustment) AS unit_price
    FROM public.cart_items ci
    JOIN public.listings l ON l.id = ci.listing_id
    LEFT JOIN public.listing_variations lv ON lv.id = ci.variant_id
    WHERE ci.cart_id = p_cart_id
      AND ci.id = ANY (p_cart_item_ids)
      AND ci.saved_for_later = false
      AND (
        (
          coalesce(array_length(v_rule.get_listing_ids, 1), 0) > 0
          AND l.id = ANY (v_rule.get_listing_ids)
        )
        OR (
          coalesce(array_length(v_rule.get_listing_ids, 1), 0) = 0
          AND coalesce(array_length(v_rule.buy_listing_ids, 1), 0) > 0
          AND l.id = ANY (v_rule.buy_listing_ids)
        )
        OR (
          coalesce(array_length(v_rule.get_categories, 1), 0) > 0
          AND l.category = ANY (v_rule.get_categories)
        )
        OR (
          coalesce(array_length(v_rule.get_categories, 1), 0) = 0
          AND coalesce(array_length(v_rule.buy_categories, 1), 0) > 0
          AND l.category = ANY (v_rule.buy_categories)
        )
      )
    ORDER BY 2 ASC
  LOOP
    EXIT WHEN v_remaining <= 0;
    v_total := v_total + (least(r.quantity, v_remaining) * r.unit_price * v_rule.get_discount_value / 100.0);
    v_remaining := v_remaining - least(r.quantity, v_remaining);
  END LOOP;

  RETURN round(greatest(v_total, 0), 2);
END;
$$;

CREATE OR REPLACE FUNCTION public.commerce_cart_items_unavailable(
  p_cart_id uuid,
  p_cart_item_ids uuid[]
) RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_child record;
  v_needed integer;
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.cart_items ci
    JOIN public.listings l ON l.id = ci.listing_id
    LEFT JOIN public.listing_variations lv ON lv.id = ci.variant_id
    WHERE ci.cart_id = p_cart_id
      AND ci.id = ANY (p_cart_item_ids)
      AND ci.saved_for_later = false
      AND (
        NOT l.is_active OR l.listing_status <> 'active'
        OR (
          coalesce(ci.item_metadata->>'bundle_id', '') = ''
          AND NOT public.commerce_listing_allows_preorder(l.listing_metadata)
          AND (
            (l.quantity IS NOT NULL AND l.quantity < ci.quantity)
            OR (
              ci.variant_id IS NOT NULL
              AND (
                NOT coalesce(lv.is_available, false)
                OR (lv.stock IS NOT NULL AND lv.stock < ci.quantity)
              )
            )
          )
        )
      )
  ) THEN
    RETURN true;
  END IF;

  FOR v_child IN
    SELECT
      (child->>'listing_id')::uuid AS listing_id,
      sum(ci.quantity * coalesce((child->>'quantity')::integer, 1)) AS needed
    FROM public.cart_items ci
    CROSS JOIN LATERAL jsonb_array_elements(coalesce(ci.item_metadata->'bundle_items', '[]'::jsonb)) AS child
    WHERE ci.cart_id = p_cart_id
      AND ci.id = ANY (p_cart_item_ids)
      AND ci.saved_for_later = false
      AND coalesce(ci.item_metadata->>'bundle_id', '') <> ''
    GROUP BY 1
  LOOP
    SELECT l.quantity INTO v_needed
    FROM public.listings l
    WHERE l.id = v_child.listing_id
      AND l.is_active
      AND l.listing_status = 'active';
    IF NOT FOUND THEN
      RETURN true;
    END IF;
    IF v_needed IS NOT NULL AND v_needed < v_child.needed
       AND NOT public.commerce_listing_allows_preorder(
         (SELECT listing_metadata FROM public.listings WHERE id = v_child.listing_id)
       ) THEN
      RETURN true;
    END IF;
  END LOOP;

  RETURN false;
END;
$$;

-- Record a PDP view (keep 40 most recent)
CREATE OR REPLACE FUNCTION public.record_listing_view(p_listing_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
BEGIN
  IF v_user IS NULL OR p_listing_id IS NULL THEN
    RETURN;
  END IF;
  INSERT INTO public.listing_recently_viewed (user_id, listing_id, viewed_at)
  VALUES (v_user, p_listing_id, now())
  ON CONFLICT (user_id, listing_id)
  DO UPDATE SET viewed_at = excluded.viewed_at;

  DELETE FROM public.listing_recently_viewed rv
  WHERE rv.user_id = v_user
    AND rv.listing_id NOT IN (
      SELECT listing_id
      FROM public.listing_recently_viewed
      WHERE user_id = v_user
      ORDER BY viewed_at DESC
      LIMIT 40
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_listing_view(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_for_you_listing_ids(max_results integer DEFAULT 24)
RETURNS TABLE (id uuid)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
BEGIN
  RETURN QUERY
  WITH viewed AS (
    SELECT rv.listing_id, rv.viewed_at
    FROM public.listing_recently_viewed rv
    WHERE v_user IS NOT NULL AND rv.user_id = v_user
    ORDER BY rv.viewed_at DESC
    LIMIT 20
  ),
  cats AS (
    SELECT DISTINCT l.category
    FROM viewed v
    JOIN public.listings l ON l.id = v.listing_id
    WHERE l.category IS NOT NULL
  ),
  scored AS (
    SELECT l.id,
      (CASE WHEN l.category IN (SELECT category FROM cats) THEN 40 ELSE 0 END)
      + coalesce(l.average_rating, 0) * 8
      + CASE WHEN l.is_featured THEN 12 ELSE 0 END AS score
    FROM public.listings l
    JOIN public.shops s ON s.id = l.shop_id
    WHERE l.is_active AND l.listing_status = 'active'
      AND s.is_active AND s.verified
      AND l.id NOT IN (SELECT listing_id FROM viewed)
    ORDER BY score DESC, l.created_at DESC
    LIMIT greatest(max_results, 1)
  )
  SELECT scored.id FROM scored;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_for_you_listing_ids(integer) TO authenticated, anon;

-- Add a vendor kit as one cart line (bundle_price on the line).
CREATE OR REPLACE FUNCTION public.add_bundle_to_cart(p_cart_id uuid, p_bundle_id uuid, p_quantity integer DEFAULT 1)
RETURNS public.cart_items
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_bundle public.listing_bundles%ROWTYPE;
  v_first uuid;
  v_title text;
  v_image text;
  v_shop uuid;
  v_shop_name text;
  v_items jsonb;
  v_item public.cart_items;
  v_qty integer := greatest(coalesce(p_quantity, 1), 1);
BEGIN
  SELECT * INTO v_bundle
  FROM public.listing_bundles
  WHERE id = p_bundle_id AND is_active = true;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Bundle not found';
  END IF;

  SELECT l.id, l.title, l.shop_id, s.shop_name
  INTO v_first, v_title, v_shop, v_shop_name
  FROM public.listing_bundle_items bi
  JOIN public.listings l ON l.id = bi.listing_id
  JOIN public.shops s ON s.id = l.shop_id
  WHERE bi.bundle_id = p_bundle_id
  ORDER BY bi.display_order, bi.created_at
  LIMIT 1;
  IF v_first IS NULL THEN
    RAISE EXCEPTION 'Bundle has no products';
  END IF;

  SELECT coalesce(
    jsonb_agg(jsonb_build_object('listing_id', listing_id, 'quantity', quantity) ORDER BY display_order),
    '[]'::jsonb
  )
  INTO v_items
  FROM public.listing_bundle_items
  WHERE bundle_id = p_bundle_id;

  SELECT image_url INTO v_image
  FROM public.listing_images
  WHERE listing_id = v_first AND is_primary = true
  LIMIT 1;

  INSERT INTO public.cart_items (
    cart_id, listing_id, quantity, unit_price, title, image_url, shop_name, shop_id, item_metadata
  ) VALUES (
    p_cart_id,
    v_first,
    v_qty,
    v_bundle.bundle_price,
    v_bundle.title,
    coalesce(v_bundle.image_url, v_image),
    v_shop_name,
    v_shop,
    jsonb_build_object('bundle_id', v_bundle.id, 'bundle_items', v_items)
  )
  RETURNING * INTO v_item;

  PERFORM public.update_cart_totals(p_cart_id);
  RETURN v_item;
END;
$$;

GRANT EXECUTE ON FUNCTION public.add_bundle_to_cart(uuid, uuid, integer) TO authenticated, anon;

CREATE OR REPLACE FUNCTION public.refresh_listing_demand_forecasts()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer := 0;
BEGIN
  INSERT INTO public.listing_demand_forecasts (
    listing_id, shop_id, units_7d, units_28d, units_90d,
    average_daily_sales, forecast_units_14d, forecast_units_30d, forecast_units_90d,
    on_hand, stock_cover_days, reorder_point, suggested_restock_qty, computed_at
  )
  SELECT
    l.id,
    l.shop_id,
    coalesce(s.u7, 0),
    coalesce(s.u28, 0),
    coalesce(s.u90, 0),
    round(coalesce(s.u28, 0)::numeric / 28.0, 4),
    round(coalesce(s.u28, 0)::numeric / 28.0 * 14, 2),
    round(coalesce(s.u28, 0)::numeric / 28.0 * 30, 2),
    round(coalesce(s.u90, 0)::numeric / 90.0 * 90, 2),
    coalesce(l.quantity, l.stock, 0),
    CASE
      WHEN coalesce(s.u28, 0) <= 0 THEN NULL
      ELSE round(coalesce(l.quantity, l.stock, 0)::numeric / (s.u28::numeric / 28.0), 1)
    END,
    round(
      (coalesce(s.u28, 0)::numeric / 28.0)
      * 14
      + coalesce(nullif(l.listing_metadata->>'low_stock_threshold', '')::numeric, 5),
      2
    ),
    greatest(
      0,
      ceil(
        (coalesce(s.u28, 0)::numeric / 28.0) * 30
        + coalesce(nullif(l.listing_metadata->>'low_stock_threshold', '')::numeric, 5)
        - coalesce(l.quantity, l.stock, 0)
      )::integer
    ),
    now()
  FROM public.listings l
  LEFT JOIN LATERAL (
    SELECT
      sum(oi.quantity) FILTER (WHERE o.created_at >= now() - interval '7 days') AS u7,
      sum(oi.quantity) FILTER (WHERE o.created_at >= now() - interval '28 days') AS u28,
      sum(oi.quantity) FILTER (WHERE o.created_at >= now() - interval '90 days') AS u90
    FROM public.order_items oi
    JOIN public.orders o ON o.id = oi.order_id
    WHERE oi.listing_id = l.id
      AND o.order_status NOT IN ('cancelled', 'refunded')
  ) s ON true
  WHERE l.is_active
  ON CONFLICT (listing_id) DO UPDATE SET
    shop_id = excluded.shop_id,
    units_7d = excluded.units_7d,
    units_28d = excluded.units_28d,
    units_90d = excluded.units_90d,
    average_daily_sales = excluded.average_daily_sales,
    forecast_units_14d = excluded.forecast_units_14d,
    forecast_units_30d = excluded.forecast_units_30d,
    forecast_units_90d = excluded.forecast_units_90d,
    on_hand = excluded.on_hand,
    stock_cover_days = excluded.stock_cover_days,
    reorder_point = excluded.reorder_point,
    suggested_restock_qty = excluded.suggested_restock_qty,
    computed_at = excluded.computed_at;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.process_due_reorder_schedules(p_limit integer DEFAULT 50)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r record;
  v_processed integer := 0;
  v_title text;
BEGIN
  FOR r IN
    SELECT *
    FROM public.listing_reorder_schedules
    WHERE paused = false
      AND next_run_at <= now()
      AND (last_notified_at IS NULL OR last_notified_at < next_run_at)
    ORDER BY next_run_at
    LIMIT greatest(p_limit, 1)
  LOOP
    SELECT title INTO v_title FROM public.listings WHERE id = r.listing_id;
    INSERT INTO public.notifications (
      recipient_id, user_id, context_type, context_id, type, category,
      title, message, data, action_url, priority, channels, platform
    ) VALUES (
      r.user_id, r.user_id, 'listing', r.listing_id, 'reorder_schedule_due', 'transactional',
      'Time to reorder ' || coalesce(v_title, 'your item'),
      'Your scheduled reorder is ready. Open cart to pay with checkout.',
      jsonb_build_object(
        'listing_id', r.listing_id,
        'listing_title', v_title,
        'schedule_id', r.id,
        'notification_kind', 'reorder_schedule_due'
      ),
      '/cart',
      2,
      ARRAY['in_app', 'push', 'email']::text[],
      'commerce'
    );

    UPDATE public.listing_reorder_schedules
    SET
      last_notified_at = now(),
      next_run_at = CASE cadence
        WHEN 'weekly' THEN next_run_at + interval '7 days'
        WHEN 'biweekly' THEN next_run_at + interval '14 days'
        ELSE next_run_at + interval '1 month'
      END,
      updated_at = now()
    WHERE id = r.id;

    v_processed := v_processed + 1;
  END LOOP;
  RETURN v_processed;
END;
$$;

CREATE OR REPLACE FUNCTION public.notify_discount_assignment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_name text;
  v_code text;
BEGIN
  SELECT dp.discount_name, coalesce(NEW.assignment_code, dp.discount_code, '')
  INTO v_name, v_code
  FROM public.discount_profiles dp
  WHERE dp.id = NEW.discount_profile_id;

  INSERT INTO public.notifications (
    recipient_id, user_id, context_type, context_id, type, category,
    title, message, data, action_url, priority, channels, platform, created_by
  ) VALUES (
    NEW.user_id, NEW.user_id, 'discount', NEW.discount_profile_id, 'personalized_offer_assigned', 'promotional',
    'A personal offer is waiting',
    coalesce(v_name, 'A coupon') || ' is ready to use on your next order.',
    jsonb_build_object(
      'discount_name', v_name,
      'offer_code', v_code,
      'discount_profile_id', NEW.discount_profile_id,
      'notification_kind', 'personalized_offer_assigned'
    ),
    '/cart',
    2,
    ARRAY['in_app', 'push', 'email']::text[],
    'commerce',
    NEW.created_by
  );
  UPDATE public.discount_assignments SET notified_at = now() WHERE id = NEW.id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_discount_assignment ON public.discount_assignments;
CREATE TRIGGER trg_notify_discount_assignment
  AFTER INSERT ON public.discount_assignments
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_discount_assignment();

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname = 'process-due-reorder-schedules';
    PERFORM cron.schedule(
      'process-due-reorder-schedules',
      '15 * * * *',
      $cron$SELECT public.process_due_reorder_schedules(80)$cron$
    );
    PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname = 'refresh-listing-demand-forecasts';
    PERFORM cron.schedule(
      'refresh-listing-demand-forecasts',
      '20 3 * * *',
      $cron$SELECT public.refresh_listing_demand_forecasts()$cron$
    );
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'pg_cron schedule skipped: %', SQLERRM;
END $$;
