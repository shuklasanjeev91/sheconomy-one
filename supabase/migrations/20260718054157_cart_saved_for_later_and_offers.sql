-- Amazon-style Save for later: cart lines can leave checkout totals while staying on the cart.

ALTER TABLE public.cart_items
  ADD COLUMN IF NOT EXISTS saved_for_later boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS cart_items_cart_id_saved_for_later_idx
  ON public.cart_items (cart_id)
  WHERE saved_for_later = true;

-- Totals only count active (not saved-for-later) lines.
CREATE OR REPLACE FUNCTION public.update_cart_totals(p_cart_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.carts
  SET
    items_subtotal = (
      SELECT COALESCE(SUM(total_price), 0)
      FROM public.cart_items
      WHERE cart_id = p_cart_id
        AND saved_for_later = false
    ),
    total_amount = (
      SELECT COALESCE(SUM(total_price), 0)
      FROM public.cart_items
      WHERE cart_id = p_cart_id
        AND saved_for_later = false
    ) - COALESCE(discount_amount, 0),
    updated_at = now()
  WHERE id = p_cart_id;
END;
$$;

-- Re-adding a listing that was saved for later moves it back into the active cart.
CREATE OR REPLACE FUNCTION public.add_to_cart(
  p_cart_id uuid,
  p_listing_id uuid,
  p_variant_id uuid DEFAULT NULL,
  p_quantity integer DEFAULT 1
)
RETURNS cart_items
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_listing_record RECORD;
  v_variant public.listing_variations;
  v_cart_item public.cart_items;
  v_unit_price NUMERIC(12,2);
  v_variant_name TEXT;
  v_variant_value TEXT;
  v_variant_sku TEXT;
  v_image_url TEXT;
BEGIN
  SELECT l.*, s.shop_name, s.id as shop_id
  INTO v_listing_record
  FROM public.listings l
  JOIN public.shops s ON l.shop_id = s.id
  WHERE l.id = p_listing_id
    AND l.is_active = true
    AND l.listing_status = 'active'
    AND s.verified = true
    AND s.is_active = true;

  IF v_listing_record.id IS NULL THEN
    RAISE EXCEPTION 'Listing not found or not available';
  END IF;

  IF p_variant_id IS NOT NULL THEN
    SELECT * INTO v_variant
    FROM public.listing_variations
    WHERE id = p_variant_id
      AND listing_id = p_listing_id
      AND is_available = true;

    IF v_variant.id IS NULL THEN
      RAISE EXCEPTION 'Variant not found or not available';
    END IF;

    v_unit_price := v_listing_record.price + v_variant.price_adjustment;
    v_variant_name := v_variant.variation_name;
    v_variant_value := v_variant.variation_value;
    v_variant_sku := v_variant.sku;
  ELSE
    v_unit_price := v_listing_record.price;
    v_variant_name := NULL;
    v_variant_value := NULL;
    v_variant_sku := v_listing_record.sku;
  END IF;

  SELECT image_url INTO v_image_url
  FROM public.listing_images
  WHERE listing_id = p_listing_id AND is_primary = true
  LIMIT 1;

  INSERT INTO public.cart_items (
    cart_id, listing_id, variant_id, quantity,
    unit_price, title, image_url, shop_name, shop_id,
    variant_name, variant_value, variant_sku, saved_for_later
  )
  VALUES (
    p_cart_id, p_listing_id, p_variant_id, p_quantity,
    v_unit_price, v_listing_record.title,
    v_image_url,
    v_listing_record.shop_name, v_listing_record.shop_id,
    v_variant_name, v_variant_value, v_variant_sku, false
  )
  ON CONFLICT (cart_id, listing_id, variant_id)
  DO UPDATE SET
    quantity = CASE
      WHEN public.cart_items.saved_for_later THEN p_quantity
      ELSE public.cart_items.quantity + p_quantity
    END,
    unit_price = EXCLUDED.unit_price,
    title = EXCLUDED.title,
    image_url = EXCLUDED.image_url,
    shop_name = EXCLUDED.shop_name,
    shop_id = EXCLUDED.shop_id,
    variant_name = EXCLUDED.variant_name,
    variant_value = EXCLUDED.variant_value,
    variant_sku = EXCLUDED.variant_sku,
    saved_for_later = false,
    updated_at = now()
  RETURNING * INTO v_cart_item;

  PERFORM public.update_cart_totals(p_cart_id);

  RETURN v_cart_item;
END;
$$;

-- Patch atomic checkout: reject / ignore saved_for_later lines (keeps live body otherwise).
CREATE OR REPLACE FUNCTION public.atomic_marketplace_checkout(
  p_cart_id uuid,
  p_cart_item_ids uuid[],
  p_shipping_address_id uuid,
  p_billing_address_id uuid DEFAULT NULL,
  p_payment_mode text DEFAULT 'online',
  p_idempotency_key text DEFAULT NULL,
  p_notes_by_shop jsonb DEFAULT '{}'::jsonb,
  p_gift_shop_ids uuid[] DEFAULT ARRAY[]::uuid[]
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_cart public.carts%ROWTYPE;
  v_group public.commerce_checkout_groups%ROWTYPE;
  v_existing public.commerce_checkout_groups%ROWTYPE;
  v_discount public.discount_profiles%ROWTYPE;
  v_shop record;
  v_order_result jsonb;
  v_order_ids uuid[] := ARRAY[]::uuid[];
  v_order_numbers text[] := ARRAY[]::text[];
  v_items jsonb;
  v_subtotal numeric := 0;
  v_eligible_subtotal numeric := 0;
  v_discount_total numeric := 0;
  v_shop_subtotal numeric;
  v_shop_discount numeric;
  v_shop_total numeric;
  v_collection text;
  v_provider text;
  v_line_count integer;
  v_customer_discount_uses integer := 0;
  v_key text := nullif(trim(coalesce(p_idempotency_key, '')), '');
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF v_key IS NULL OR char_length(v_key) < 8 THEN
    RAISE EXCEPTION 'A valid idempotency key is required';
  END IF;
  IF p_payment_mode NOT IN ('online', 'cod') THEN
    RAISE EXCEPTION 'Unsupported payment mode';
  END IF;
  IF coalesce(array_length(p_cart_item_ids, 1), 0) = 0 THEN
    RAISE EXCEPTION 'Select at least one cart item';
  END IF;

  SELECT * INTO v_existing
  FROM public.commerce_checkout_groups
  WHERE buyer_id = v_user_id AND idempotency_key = v_key;
  IF FOUND THEN
    RETURN jsonb_build_object(
      'success', true,
      'checkout_group_id', v_existing.id,
      'status', v_existing.status,
      'order_ids', v_existing.order_ids,
      'order_numbers', (
        SELECT coalesce(array_agg(o.order_number ORDER BY o.created_at), ARRAY[]::text[])
        FROM public.orders o WHERE o.id = ANY(v_existing.order_ids)
      ),
      'subtotal_amount', v_existing.subtotal_amount,
      'discount_amount', v_existing.discount_amount,
      'total_amount', v_existing.total_amount,
      'payment_steps', (
        SELECT coalesce(jsonb_agg(jsonb_build_object(
          'id', ps.id, 'order_id', ps.order_id, 'shop_id', ps.shop_id,
          'collection', ps.collection, 'provider', ps.provider,
          'status', ps.status, 'amount', ps.amount, 'checkout_url', ps.checkout_url
        ) ORDER BY ps.created_at), '[]'::jsonb)
        FROM public.commerce_checkout_payment_steps ps
        WHERE ps.checkout_group_id = v_existing.id
      ),
      'idempotent_replay', true
    );
  END IF;

  SELECT * INTO v_cart FROM public.carts WHERE id = p_cart_id FOR UPDATE;
  IF NOT FOUND OR v_cart.user_id IS DISTINCT FROM v_user_id OR v_cart.status <> 'active' THEN
    RAISE EXCEPTION 'Cart not found or unavailable';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.addresses
    WHERE id = p_shipping_address_id AND user_id = v_user_id
  ) THEN
    RAISE EXCEPTION 'Shipping address not found';
  END IF;
  IF p_billing_address_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.addresses
    WHERE id = p_billing_address_id AND user_id = v_user_id
  ) THEN
    RAISE EXCEPTION 'Billing address not found';
  END IF;

  SELECT count(*) INTO v_line_count
  FROM public.cart_items ci
  WHERE ci.cart_id = p_cart_id
    AND ci.id = ANY(p_cart_item_ids)
    AND ci.saved_for_later = false;
  IF v_line_count <> cardinality(p_cart_item_ids) THEN
    RAISE EXCEPTION 'One or more selected cart items are invalid';
  END IF;

  PERFORM l.id
  FROM public.listings l
  JOIN public.cart_items ci ON ci.listing_id = l.id
  WHERE ci.cart_id = p_cart_id AND ci.id = ANY(p_cart_item_ids) AND ci.saved_for_later = false
  ORDER BY l.id
  FOR UPDATE OF l;

  PERFORM lv.id
  FROM public.listing_variations lv
  JOIN public.cart_items ci ON ci.variant_id = lv.id
  WHERE ci.cart_id = p_cart_id AND ci.id = ANY(p_cart_item_ids) AND ci.saved_for_later = false
  ORDER BY lv.id
  FOR UPDATE OF lv;

  IF EXISTS (
    SELECT 1
    FROM public.cart_items ci
    JOIN public.listings l ON l.id = ci.listing_id
    LEFT JOIN public.listing_variations lv ON lv.id = ci.variant_id
    WHERE ci.cart_id = p_cart_id
      AND ci.id = ANY(p_cart_item_ids)
      AND ci.saved_for_later = false
      AND (
        NOT l.is_active OR l.listing_status <> 'active'
        OR (l.quantity IS NOT NULL AND l.quantity < ci.quantity)
        OR (ci.variant_id IS NOT NULL AND (NOT coalesce(lv.is_available, false) OR (lv.stock IS NOT NULL AND lv.stock < ci.quantity)))
      )
  ) THEN
    RAISE EXCEPTION 'One or more items are unavailable or out of stock';
  END IF;

  SELECT coalesce(sum((l.price + coalesce(lv.price_adjustment, 0)) * ci.quantity), 0)
  INTO v_subtotal
  FROM public.cart_items ci
  JOIN public.listings l ON l.id = ci.listing_id
  LEFT JOIN public.listing_variations lv ON lv.id = ci.variant_id
  WHERE ci.cart_id = p_cart_id
    AND ci.id = ANY(p_cart_item_ids)
    AND ci.saved_for_later = false;

  IF v_cart.applied_discount_id IS NOT NULL THEN
    SELECT * INTO v_discount
    FROM public.discount_profiles
    WHERE id = v_cart.applied_discount_id
    FOR UPDATE;

    IF NOT FOUND OR NOT v_discount.is_active
       OR v_discount.valid_from > now()
       OR (v_discount.valid_until IS NOT NULL AND v_discount.valid_until < now())
       OR (v_discount.max_uses_total IS NOT NULL AND v_discount.max_uses_total > 0
           AND coalesce(v_discount.total_uses, 0) >= v_discount.max_uses_total) THEN
      RAISE EXCEPTION 'The applied coupon is no longer valid';
    END IF;

    SELECT count(*) INTO v_customer_discount_uses
    FROM public.orders o
    WHERE o.user_id = v_user_id
      AND o.order_metadata->'discount_info'->>'discount_profile_id' = v_discount.id::text
      AND o.order_status NOT IN ('cancelled', 'refunded');
    IF v_discount.max_uses_per_customer IS NOT NULL
       AND v_discount.max_uses_per_customer > 0
       AND v_customer_discount_uses >= v_discount.max_uses_per_customer THEN
      RAISE EXCEPTION 'You have already used this coupon';
    END IF;

    SELECT coalesce(sum((l.price + coalesce(lv.price_adjustment, 0)) * ci.quantity), 0)
    INTO v_eligible_subtotal
    FROM public.cart_items ci
    JOIN public.listings l ON l.id = ci.listing_id
    LEFT JOIN public.listing_variations lv ON lv.id = ci.variant_id
    WHERE ci.cart_id = p_cart_id
      AND ci.id = ANY(p_cart_item_ids)
      AND ci.saved_for_later = false
      AND (v_discount.shop_id IS NULL OR l.shop_id = v_discount.shop_id)
      AND (v_discount.eligible_listings IS NULL OR l.id = ANY(v_discount.eligible_listings));

    IF v_eligible_subtotal < coalesce(v_discount.min_order_amount, 0) THEN
      RAISE EXCEPTION 'The selected items no longer meet the coupon minimum';
    END IF;
    IF v_discount.discount_type = 'percentage' THEN
      v_discount_total := round(v_eligible_subtotal * v_discount.discount_value / 100, 2);
    ELSE
      v_discount_total := v_discount.discount_value;
    END IF;
    IF v_discount.max_discount_amount IS NOT NULL THEN
      v_discount_total := least(v_discount_total, v_discount.max_discount_amount);
    END IF;
    v_discount_total := greatest(0, least(v_discount_total, v_eligible_subtotal));
  END IF;

  INSERT INTO public.commerce_checkout_groups (
    buyer_id, cart_id, idempotency_key, status, payment_mode, currency,
    subtotal_amount, discount_amount, total_amount, selected_cart_item_ids
  ) VALUES (
    v_user_id, p_cart_id, v_key, 'created', p_payment_mode, v_cart.currency,
    v_subtotal, v_discount_total, greatest(0, v_subtotal - v_discount_total), p_cart_item_ids
  )
  RETURNING * INTO v_group;

  FOR v_shop IN
    SELECT l.shop_id, s.shop_name,
      coalesce(scs.payment_mode, 'shepay') AS routing_mode,
      scs.payment_gateway,
      sum((l.price + coalesce(lv.price_adjustment, 0)) * ci.quantity) AS subtotal
    FROM public.cart_items ci
    JOIN public.listings l ON l.id = ci.listing_id
    JOIN public.shops s ON s.id = l.shop_id
    LEFT JOIN public.listing_variations lv ON lv.id = ci.variant_id
    LEFT JOIN public.shop_commerce_settings scs ON scs.shop_id = l.shop_id
    WHERE ci.cart_id = p_cart_id
      AND ci.id = ANY(p_cart_item_ids)
      AND ci.saved_for_later = false
    GROUP BY l.shop_id, s.shop_name, scs.payment_mode, scs.payment_gateway
    ORDER BY l.shop_id
  LOOP
    v_shop_subtotal := v_shop.subtotal;
    v_shop_discount := CASE
      WHEN v_eligible_subtotal > 0 THEN round(v_discount_total * (
        SELECT coalesce(sum((l.price + coalesce(lv.price_adjustment, 0)) * ci.quantity), 0)
        FROM public.cart_items ci
        JOIN public.listings l ON l.id = ci.listing_id
        LEFT JOIN public.listing_variations lv ON lv.id = ci.variant_id
        WHERE ci.cart_id = p_cart_id
          AND ci.id = ANY(p_cart_item_ids)
          AND ci.saved_for_later = false
          AND l.shop_id = v_shop.shop_id
          AND (v_discount.shop_id IS NULL OR l.shop_id = v_discount.shop_id)
          AND (v_discount.eligible_listings IS NULL OR l.id = ANY(v_discount.eligible_listings))
      ) / v_eligible_subtotal, 2)
      ELSE 0
    END;
    v_shop_total := greatest(0, v_shop_subtotal - v_shop_discount);

    SELECT jsonb_agg(jsonb_build_object(
      'listing_id', l.id,
      'quantity', ci.quantity,
      'unit_price', l.price + coalesce(lv.price_adjustment, 0),
      'variation_details', CASE WHEN ci.variant_id IS NULL THEN '{}'::jsonb ELSE jsonb_build_object(
        'variant_id', ci.variant_id,
        'variant_name', lv.variation_name,
        'variant_value', lv.variation_value
      ) END
    ) ORDER BY ci.id)
    INTO v_items
    FROM public.cart_items ci
    JOIN public.listings l ON l.id = ci.listing_id
    LEFT JOIN public.listing_variations lv ON lv.id = ci.variant_id
    WHERE ci.cart_id = p_cart_id
      AND ci.id = ANY(p_cart_item_ids)
      AND ci.saved_for_later = false
      AND l.shop_id = v_shop.shop_id;

    v_order_result := public.create_customer_order(jsonb_build_object(
      'user_id', v_user_id,
      'cart_items', v_items,
      'shipping_address_id', p_shipping_address_id,
      'billing_address_id', coalesce(p_billing_address_id, p_shipping_address_id),
      'customer_notes', nullif(p_notes_by_shop->>v_shop.shop_id::text, ''),
      'payment_mode', p_payment_mode,
      'currency', v_cart.currency,
      'subtotal_amount', v_shop_subtotal,
      'shipping_amount', 0,
      'tax_amount', 0,
      'discount_amount', v_shop_discount,
      'total_amount', v_shop_total,
      'discount_codes', CASE WHEN v_discount.id IS NULL THEN '[]'::jsonb ELSE jsonb_build_array(v_discount.discount_code) END,
      'order_source', 'sheconomy-one-atomic',
      'order_metadata', jsonb_build_object(
        'created_via', 'atomic_marketplace_checkout',
        'checkout_group_id', v_group.id,
        'discount_info', CASE WHEN v_discount.id IS NULL THEN NULL ELSE jsonb_build_object(
          'discount_profile_id', v_discount.id,
          'discount_name', v_discount.discount_name,
          'total_discount', v_shop_discount
        ) END,
        'gift', jsonb_build_object('is_gift', v_shop.shop_id = ANY(p_gift_shop_ids))
      )
    ));

    v_order_ids := array_append(v_order_ids, (v_order_result->>'order_id')::uuid);
    v_order_numbers := array_append(v_order_numbers, v_order_result->>'order_number');
    v_collection := CASE
      WHEN p_payment_mode = 'cod' THEN 'cod'
      WHEN v_shop.routing_mode IN ('direct', 'seller_direct') THEN 'direct'
      ELSE 'shepay'
    END;
    v_provider := CASE WHEN v_collection = 'direct' THEN v_shop.payment_gateway ELSE 'shepay' END;

    INSERT INTO public.commerce_checkout_payment_steps (
      checkout_group_id, order_id, shop_id, collection, provider, status,
      amount, currency, idempotency_key, metadata
    ) VALUES (
      v_group.id, (v_order_result->>'order_id')::uuid, v_shop.shop_id,
      v_collection, v_provider,
      CASE WHEN p_payment_mode = 'cod' THEN 'processing' ELSE 'pending' END,
      v_shop_total, v_cart.currency,
      v_key || ':' || v_shop.shop_id::text,
      jsonb_build_object('order_number', v_order_result->>'order_number')
    );
  END LOOP;

  INSERT INTO public.inventory_reservations (
    checkout_group_id, listing_id, variation_id, quantity, status,
    expires_at, converted_at
  )
  SELECT v_group.id, ci.listing_id, ci.variant_id, sum(ci.quantity),
    CASE WHEN p_payment_mode = 'cod' THEN 'converted' ELSE 'reserved' END,
    v_group.expires_at, CASE WHEN p_payment_mode = 'cod' THEN now() ELSE NULL END
  FROM public.cart_items ci
  WHERE ci.cart_id = p_cart_id
    AND ci.id = ANY(p_cart_item_ids)
    AND ci.saved_for_later = false
  GROUP BY ci.listing_id, ci.variant_id;

  IF v_discount.id IS NOT NULL AND v_discount_total > 0 THEN
    UPDATE public.discount_profiles
    SET total_uses = coalesce(total_uses, 0) + 1, updated_at = now()
    WHERE id = v_discount.id;
  END IF;

  DELETE FROM public.cart_items
  WHERE cart_id = p_cart_id
    AND id = ANY(p_cart_item_ids)
    AND saved_for_later = false;

  PERFORM public.update_cart_totals(p_cart_id);

  UPDATE public.commerce_checkout_groups
  SET order_ids = v_order_ids,
      status = CASE WHEN p_payment_mode = 'cod' THEN 'paid' ELSE 'awaiting_payment' END,
      paid_at = CASE WHEN p_payment_mode = 'cod' THEN now() ELSE NULL END,
      updated_at = now()
  WHERE id = v_group.id
  RETURNING * INTO v_group;

  RETURN jsonb_build_object(
    'success', true,
    'checkout_group_id', v_group.id,
    'status', v_group.status,
    'order_ids', v_order_ids,
    'order_numbers', v_order_numbers,
    'subtotal_amount', v_subtotal,
    'discount_amount', v_discount_total,
    'total_amount', greatest(0, v_subtotal - v_discount_total),
    'payment_steps', (
      SELECT coalesce(jsonb_agg(jsonb_build_object(
        'id', ps.id,
        'order_id', ps.order_id,
        'shop_id', ps.shop_id,
        'collection', ps.collection,
        'provider', ps.provider,
        'status', ps.status,
        'amount', ps.amount,
        'checkout_url', ps.checkout_url
      ) ORDER BY ps.created_at), '[]'::jsonb)
      FROM public.commerce_checkout_payment_steps ps
      WHERE ps.checkout_group_id = v_group.id
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.atomic_marketplace_checkout(uuid, uuid[], uuid, uuid, text, text, jsonb, uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.atomic_marketplace_checkout(uuid, uuid[], uuid, uuid, text, text, jsonb, uuid[]) TO authenticated;

-- Abandoned-cart reminders only count active cart lines.
CREATE OR REPLACE FUNCTION public.process_abandoned_carts(
  p_limit integer DEFAULT 50
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r RECORD;
  v_stage smallint;
  v_idle interval;
  v_item_count integer;
  v_notification_id uuid;
  v_processed integer := 0;
  v_customer_name text;
  v_cart_total text;
  v_action_url text;
  v_app_base text := COALESCE(
    NULLIF(current_setting('app.settings.public_app_url', true), ''),
    'https://sheconomy.com'
  );
BEGIN
  FOR r IN
    SELECT
      c.id AS cart_id,
      c.user_id,
      c.total_amount,
      c.currency,
      c.last_activity_at,
      c.status,
      GREATEST(
        COALESCE(c.last_activity_at, c.updated_at, c.created_at),
        COALESCE(c.updated_at, c.created_at)
      ) AS idle_since
    FROM public.carts c
    WHERE c.user_id IS NOT NULL
      AND c.status IN ('active', 'abandoned')
      AND COALESCE(c.total_amount, 0) > 0
      AND EXISTS (
        SELECT 1 FROM public.cart_items ci
        WHERE ci.cart_id = c.id AND ci.saved_for_later = false
      )
      AND c.converted_at IS NULL
    ORDER BY idle_since ASC
    LIMIT GREATEST(p_limit, 1)
  LOOP
    v_idle := now() - r.idle_since;

    IF v_idle >= interval '72 hours' THEN
      v_stage := 3;
    ELSIF v_idle >= interval '24 hours' THEN
      v_stage := 2;
    ELSIF v_idle >= interval '1 hour' THEN
      v_stage := 1;
    ELSE
      CONTINUE;
    END IF;

    IF EXISTS (
      SELECT 1 FROM public.cart_reminder_log l
      WHERE l.cart_id = r.cart_id AND l.stage >= v_stage
    ) THEN
      CONTINUE;
    END IF;

    IF v_stage > 1 AND NOT EXISTS (
      SELECT 1 FROM public.cart_reminder_log l
      WHERE l.cart_id = r.cart_id AND l.stage = v_stage - 1
    ) THEN
      v_stage := v_stage - 1;
      IF EXISTS (
        SELECT 1 FROM public.cart_reminder_log l
        WHERE l.cart_id = r.cart_id AND l.stage = v_stage
      ) THEN
        CONTINUE;
      END IF;
    END IF;

    SELECT COALESCE(SUM(ci.quantity), 0)::integer
    INTO v_item_count
    FROM public.cart_items ci
    WHERE ci.cart_id = r.cart_id
      AND ci.saved_for_later = false;

    IF v_item_count <= 0 THEN
      CONTINUE;
    END IF;

    SELECT COALESCE(NULLIF(p.full_name, ''), split_part(COALESCE(u.email, 'there'), '@', 1), 'there')
    INTO v_customer_name
    FROM auth.users u
    LEFT JOIN public.profiles p ON p.id = u.id
    WHERE u.id = r.user_id;

    v_cart_total := trim(both from to_char(COALESCE(r.total_amount, 0), 'FM999999990.00'))
      || ' ' || COALESCE(r.currency, 'INR');
    v_action_url := v_app_base || '/cart';

    UPDATE public.carts
    SET status = 'abandoned', updated_at = now()
    WHERE id = r.cart_id
      AND status = 'active';

    BEGIN
      v_notification_id := public.create_notification_from_template(
        'cart_abandoned_customer',
        r.user_id,
        jsonb_build_object(
          'customer_name', v_customer_name,
          'item_count', v_item_count,
          'cart_total', v_cart_total,
          'action_url', v_action_url,
          'cart_id', r.cart_id,
          'stage', v_stage
        ),
        'cart',
        r.cart_id,
        NULL,
        NULL,
        NULL,
        CASE WHEN v_stage = 1 THEN 5 WHEN v_stage = 2 THEN 4 ELSE 3 END,
        NULL
      );
    EXCEPTION WHEN OTHERS THEN
      v_notification_id := NULL;
    END;

    INSERT INTO public.cart_reminder_log (cart_id, user_id, stage, notification_id)
    VALUES (r.cart_id, r.user_id, v_stage, v_notification_id)
    ON CONFLICT (cart_id, stage) DO NOTHING;

    IF v_notification_id IS NOT NULL THEN
      INSERT INTO public.notification_event_queue (
        event_key, recipient_id, payload, scheduled_for, status
      ) VALUES (
        'dispatch_notification',
        r.user_id,
        jsonb_build_object('notification_id', v_notification_id, 'cart_id', r.cart_id, 'stage', v_stage),
        now(),
        'pending'
      );
    END IF;

    v_processed := v_processed + 1;
  END LOOP;

  RETURN v_processed;
END;
$$;

REVOKE ALL ON FUNCTION public.process_abandoned_carts(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.process_abandoned_carts(integer) TO service_role;
