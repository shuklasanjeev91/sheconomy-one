-- Align atomic_marketplace_checkout order payloads with legacy web checkout:
-- per-shop shipping from delivery_profiles, full order_metadata, customer amounts,
-- and post-create notification dispatch when order rows are complete.

CREATE OR REPLACE FUNCTION public.normalize_iso_country_code(p_value text)
RETURNS character varying(2)
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  v_raw text := upper(trim(coalesce(p_value, '')));
BEGIN
  IF v_raw = '' THEN
    RETURN 'IN';
  END IF;

  IF char_length(v_raw) = 2 THEN
    RETURN v_raw;
  END IF;

  RETURN CASE
    WHEN v_raw IN ('IND', 'INDIA') THEN 'IN'
    WHEN v_raw IN ('USA', 'UNITED STATES', 'UNITED STATES OF AMERICA') THEN 'US'
    WHEN v_raw IN ('GBR', 'UK', 'UNITED KINGDOM', 'GREAT BRITAIN') THEN 'GB'
    WHEN v_raw IN ('AUS', 'AUSTRALIA') THEN 'AU'
    WHEN v_raw IN ('CAN', 'CANADA') THEN 'CA'
    WHEN v_raw IN ('ARE', 'UAE', 'UNITED ARAB EMIRATES') THEN 'AE'
    WHEN v_raw IN ('SGP', 'SINGAPORE') THEN 'SG'
    WHEN v_raw IN ('DEU', 'GERMANY') THEN 'DE'
    WHEN v_raw IN ('FRA', 'FRANCE') THEN 'FR'
    WHEN char_length(v_raw) = 3 THEN left(v_raw, 2)
    ELSE 'IN'
  END;
END;
$$;

CREATE OR REPLACE FUNCTION public.calculate_shop_shipping_from_profiles(
  p_shop_id uuid,
  p_subtotal_after_discount numeric,
  p_requires_shipping boolean DEFAULT true
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  v_profile public.delivery_profiles%ROWTYPE;
  v_subtotal numeric := greatest(0, coalesce(p_subtotal_after_discount, 0));
  v_shipping numeric := 0;
  v_rate jsonb;
  v_min numeric;
  v_max numeric;
  v_estimated_days integer := 7;
BEGIN
  IF NOT coalesce(p_requires_shipping, true) THEN
    RETURN jsonb_build_object(
      'shipping_amount', 0,
      'delivery_profile_id', NULL,
      'delivery_profile_name', NULL,
      'processing_time_max', 7,
      'estimated_days', 7,
      'is_free_shipping', true
    );
  END IF;

  SELECT *
  INTO v_profile
  FROM public.delivery_profiles dp
  WHERE dp.shop_id = p_shop_id
    AND dp.is_active = true
  ORDER BY dp.is_default DESC, dp.created_at ASC
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'shipping_amount', 0,
      'delivery_profile_id', NULL,
      'delivery_profile_name', NULL,
      'processing_time_max', 7,
      'estimated_days', 7,
      'is_free_shipping', true
    );
  END IF;

  v_estimated_days := coalesce(v_profile.processing_time_max, 7);

  IF v_profile.shipping_rate_type = 'free' THEN
    RETURN jsonb_build_object(
      'shipping_amount', 0,
      'delivery_profile_id', v_profile.id,
      'delivery_profile_name', v_profile.profile_name,
      'processing_time_max', v_estimated_days,
      'estimated_days', v_estimated_days,
      'is_free_shipping', true,
      'free_shipping_threshold', v_profile.free_shipping_threshold
    );
  END IF;

  IF v_profile.shipping_rate_type IS DISTINCT FROM 'variable'
     AND v_profile.free_shipping_threshold IS NOT NULL
     AND v_subtotal >= v_profile.free_shipping_threshold THEN
    RETURN jsonb_build_object(
      'shipping_amount', 0,
      'delivery_profile_id', v_profile.id,
      'delivery_profile_name', v_profile.profile_name,
      'processing_time_max', v_estimated_days,
      'estimated_days', v_estimated_days,
      'is_free_shipping', true,
      'free_shipping_threshold', v_profile.free_shipping_threshold
    );
  END IF;

  IF v_profile.shipping_rate_type = 'fixed' THEN
    v_shipping := coalesce(v_profile.fixed_fee, 0);
  ELSIF v_profile.shipping_rate_type = 'variable' THEN
    v_shipping := coalesce(v_profile.fixed_fee, 0);
    IF jsonb_typeof(v_profile.shipping_zones) = 'array'
       AND jsonb_array_length(v_profile.shipping_zones) > 0
       AND jsonb_typeof(v_profile.shipping_zones->0->'rates') = 'array' THEN
      FOR v_rate IN
        SELECT value
        FROM jsonb_array_elements(v_profile.shipping_zones->0->'rates') AS value
      LOOP
        v_min := coalesce((v_rate->>'min_order')::numeric, 0);
        v_max := NULLIF(v_rate->>'max_order', '')::numeric;
        IF v_subtotal >= v_min AND (v_max IS NULL OR v_subtotal <= v_max) THEN
          v_shipping := coalesce((v_rate->>'fee')::numeric, 0);
          EXIT;
        END IF;
      END LOOP;
    END IF;
  ELSE
    v_shipping := coalesce(v_profile.fixed_fee, 0);
  END IF;

  RETURN jsonb_build_object(
    'shipping_amount', round(v_shipping, 2),
    'delivery_profile_id', v_profile.id,
    'delivery_profile_name', v_profile.profile_name,
    'processing_time_max', v_estimated_days,
    'estimated_days', v_estimated_days,
    'is_free_shipping', v_shipping = 0,
    'free_shipping_threshold', v_profile.free_shipping_threshold
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.dispatch_marketplace_order_notifications(p_order_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order_record RECORD;
  v_vendor_records RECORD;
  v_admin_id uuid;
  v_customer_variables jsonb;
  v_vendor_variables jsonb;
  v_payment_mode text;
  v_payment_status text;
  v_shipping_method text;
BEGIN
  IF p_order_id IS NULL THEN
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.notifications n
    WHERE n.context_id = p_order_id
      AND n.type = 'order_placed_customer'
      AND n.created_at > now() - interval '5 minutes'
  ) THEN
    RETURN;
  END IF;

  SELECT
    op.payment_mode::text,
    op.payment_status::text
  INTO v_payment_mode, v_payment_status
  FROM public.order_payments op
  WHERE op.order_id = p_order_id
  ORDER BY op.created_at DESC
  LIMIT 1;

  v_payment_mode := coalesce(v_payment_mode, 'pending');
  v_payment_status := coalesce(v_payment_status, 'pending');

  SELECT
    o.id,
    o.order_number,
    o.customer_total_amount,
    o.total_amount,
    o.customer_currency,
    o.currency,
    o.customer_subtotal_amount,
    o.customer_shipping_amount,
    o.customer_tax_amount,
    o.customer_discount_amount,
    o.order_status::text AS order_status,
    o.created_at,
    o.user_id,
    count(oi.id) AS item_count,
    coalesce(p.full_name, 'Valued Customer') AS customer_name,
    coalesce(p.phone, '') AS customer_phone,
    coalesce(string_agg(DISTINCT s.shop_name, ', '), 'Shop') AS shop_names,
    max(s.logo_url) AS brand_logo_url,
    coalesce(
      sa.address_line_1 || ', ' || sa.city || ', ' || sa.state || ' - ' || sa.postal_code,
      'Address not available'
    ) AS shipping_address,
    coalesce(
      ba.address_line_1 || ', ' || ba.city || ', ' || ba.state || ' - ' || ba.postal_code,
      sa.address_line_1 || ', ' || sa.city
    ) AS billing_address
  INTO v_order_record
  FROM public.orders o
  LEFT JOIN public.order_items oi ON o.id = oi.order_id
  LEFT JOIN public.profiles p ON o.user_id = p.id
  LEFT JOIN public.shops s ON oi.vendor_id = s.id
  LEFT JOIN public.addresses sa ON o.shipping_address_id = sa.id
  LEFT JOIN public.addresses ba ON o.billing_address_id = ba.id
  WHERE o.id = p_order_id
  GROUP BY
    o.id, o.order_number, o.customer_total_amount, o.total_amount, o.customer_currency, o.currency,
    o.customer_subtotal_amount, o.customer_shipping_amount, o.customer_tax_amount,
    o.customer_discount_amount, o.order_status, o.created_at, o.user_id,
    p.full_name, p.phone,
    sa.address_line_1, sa.city, sa.state, sa.postal_code,
    ba.address_line_1, ba.city, ba.state, ba.postal_code;

  IF v_order_record.id IS NULL OR coalesce(v_order_record.item_count, 0) = 0 THEN
    RETURN;
  END IF;

  SELECT coalesce(od.delivery_mode::text, 'Standard Shipping')
  INTO v_shipping_method
  FROM public.order_delivery od
  WHERE od.order_id = p_order_id
  LIMIT 1;

  v_shipping_method := coalesce(v_shipping_method, 'Standard Shipping');

  v_customer_variables := jsonb_build_object(
    'order_number', v_order_record.order_number,
    'order_id', v_order_record.id::text,
    'total_amount', round(coalesce(v_order_record.customer_total_amount, v_order_record.total_amount, 0), 2),
    'customer_total_amount', round(coalesce(v_order_record.customer_total_amount, v_order_record.total_amount, 0), 2),
    'customer_currency', coalesce(v_order_record.customer_currency, v_order_record.currency, 'INR'),
    'customer_subtotal_amount', round(coalesce(v_order_record.customer_subtotal_amount, 0), 2),
    'customer_shipping_amount', round(coalesce(v_order_record.customer_shipping_amount, 0), 2),
    'customer_tax_amount', round(coalesce(v_order_record.customer_tax_amount, 0), 2),
    'customer_discount_amount', round(coalesce(v_order_record.customer_discount_amount, 0), 2),
    'item_count', coalesce(v_order_record.item_count, 0),
    'total_items', coalesce(v_order_record.item_count, 0),
    'customer_name', v_order_record.customer_name,
    'customer_phone', v_order_record.customer_phone,
    'order_date', v_order_record.created_at::text,
    'payment_mode', CASE
      WHEN v_payment_mode = 'cod' THEN 'Cash on Delivery'
      WHEN v_payment_mode = 'online' THEN 'Online Payment'
      ELSE 'Payment Pending'
    END,
    'order_status', v_order_record.order_status,
    'shop_names', v_order_record.shop_names,
    'shipping_address', v_order_record.shipping_address,
    'billing_address', coalesce(v_order_record.billing_address, v_order_record.shipping_address),
    'brand_logo_url', coalesce(v_order_record.brand_logo_url, ''),
    'shipping_method', v_shipping_method,
    'support_email', 'info@sheconomy.in'
  );

  BEGIN
    PERFORM public.create_validated_notification(
      'order_placed_customer',
      v_order_record.user_id,
      v_customer_variables,
      public.get_order_context(),
      v_order_record.id,
      NULL,
      NULL,
      2,
      NULL,
      'atomic_checkout'
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'dispatch_marketplace_order_notifications customer %: %', p_order_id, SQLERRM;
  END;

  FOR v_vendor_records IN
    SELECT
      s.id AS shop_id,
      s.user_id AS vendor_user_id,
      coalesce(s.shop_name, 'Shop') AS shop_name,
      s.shop_currency AS shop_currency,
      count(oi.id) AS vendor_item_count,
      coalesce(sum(oi.unit_price * oi.quantity), 0) AS vendor_order_value,
      coalesce(p.full_name, 'Shop Owner') AS shop_owner_name,
      string_agg(oi.product_title || ' (Qty: ' || oi.quantity || ')', ', ') AS items_summary
    FROM public.order_items oi
    JOIN public.shops s ON oi.vendor_id = s.id
    LEFT JOIN public.profiles p ON s.user_id = p.id
    WHERE oi.order_id = p_order_id
    GROUP BY s.id, s.user_id, s.shop_name, s.shop_currency, p.full_name
  LOOP
    v_vendor_variables := jsonb_build_object(
      'order_number', v_order_record.order_number,
      'order_id', v_order_record.id::text,
      'order_value', round(coalesce(v_vendor_records.vendor_order_value, 0), 2),
      'vendor_order_value', round(coalesce(v_vendor_records.vendor_order_value, 0), 2),
      'shop_currency', coalesce(v_vendor_records.shop_currency, v_order_record.currency, 'INR'),
      'customer_name', v_order_record.customer_name,
      'shop_owner_name', v_vendor_records.shop_owner_name,
      'shop_id', v_vendor_records.shop_id::text,
      'shop_name', v_vendor_records.shop_name,
      'item_count', v_vendor_records.vendor_item_count,
      'items_summary', coalesce(v_vendor_records.items_summary, 'Items'),
      'payment_status', CASE
        WHEN v_payment_mode = 'cod' THEN 'Cash on Delivery'
        WHEN v_payment_status = 'completed' THEN 'Paid Online'
        WHEN v_payment_status = 'pending' THEN 'Payment Pending'
        ELSE 'Payment Processing'
      END,
      'currency_note', CASE
        WHEN v_order_record.customer_currency IS DISTINCT FROM v_vendor_records.shop_currency
        THEN 'Note: Customer paid in ' || coalesce(v_order_record.customer_currency, 'INR')
          || '. Amount shown in your shop currency: '
          || coalesce(v_vendor_records.shop_currency, v_order_record.currency, 'INR')
        ELSE ''
      END,
      'customer_phone', v_order_record.customer_phone,
      'vendor_cod_amount', CASE
        WHEN v_payment_mode = 'cod' THEN round(v_vendor_records.vendor_order_value, 2)
        ELSE NULL
      END
    );

    BEGIN
      PERFORM public.create_validated_notification(
        CASE WHEN v_payment_mode = 'cod' THEN 'cod_order_vendor' ELSE 'new_order_vendor' END,
        v_vendor_records.vendor_user_id,
        v_vendor_variables,
        public.get_vendor_order_context(),
        v_order_record.id,
        public.get_shop_context(),
        v_vendor_records.shop_id,
        1,
        NULL,
        'atomic_checkout'
      );
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'dispatch_marketplace_order_notifications vendor %: %', v_vendor_records.shop_id, SQLERRM;
    END;
  END LOOP;

  IF EXISTS (
    SELECT 1 FROM public.notification_templates
    WHERE template_key = 'new_order_admin' AND is_active = true
  ) THEN
    FOR v_admin_id IN
      SELECT id FROM public.profiles WHERE role = 'A'
    LOOP
      BEGIN
        PERFORM public.create_validated_notification(
          'new_order_admin',
          v_admin_id,
          v_customer_variables,
          public.get_order_context(),
          v_order_record.id,
          NULL,
          NULL,
          2,
          NULL,
          'atomic_checkout'
        );
      EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'dispatch_marketplace_order_notifications admin %: %', v_admin_id, SQLERRM;
      END;
    END LOOP;
  END IF;
END;
$$;

-- Patch atomic checkout (same signature as live function).
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
  v_shipping_total numeric := 0;
  v_shop_subtotal numeric;
  v_shop_discount numeric;
  v_shop_shipping numeric;
  v_shop_total numeric;
  v_shop_subtotal_after_discount numeric;
  v_shipping_quote jsonb;
  v_requires_shipping boolean;
  v_collection text;
  v_provider text;
  v_line_count integer;
  v_customer_discount_uses integer := 0;
  v_customer_country text := 'IN';
  v_customer_currency text;
  v_estimated_delivery date;
  v_payment_provider text;
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

  SELECT public.normalize_iso_country_code(a.country)
  INTO v_customer_country
  FROM public.addresses a
  WHERE a.id = p_shipping_address_id;

  v_customer_currency := coalesce(v_cart.currency, 'INR');
  v_payment_provider := CASE WHEN p_payment_mode = 'cod' THEN 'cod' ELSE 'online' END;

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

    v_shop_subtotal_after_discount := greatest(0, v_shop_subtotal - v_shop_discount);

    SELECT EXISTS (
      SELECT 1
      FROM public.cart_items ci
      JOIN public.listings l ON l.id = ci.listing_id
      WHERE ci.cart_id = p_cart_id
        AND ci.id = ANY(p_cart_item_ids)
        AND ci.saved_for_later = false
        AND l.shop_id = v_shop.shop_id
        AND l.listing_type IS DISTINCT FROM 'digital'
        AND coalesce(l.shipping_required, true)
    ) INTO v_requires_shipping;

    v_shipping_quote := public.calculate_shop_shipping_from_profiles(
      v_shop.shop_id,
      v_shop_subtotal_after_discount,
      v_requires_shipping
    );
    v_shop_shipping := coalesce((v_shipping_quote->>'shipping_amount')::numeric, 0);
    v_shop_total := v_shop_subtotal_after_discount + v_shop_shipping;
    v_shipping_total := v_shipping_total + v_shop_shipping;
    v_estimated_delivery := current_date + coalesce((v_shipping_quote->>'processing_time_max')::integer, 7);

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
      'payment_provider', v_payment_provider,
      'currency', v_cart.currency,
      'customer_currency', v_customer_currency,
      'customer_country', v_customer_country,
      'subtotal_amount', v_shop_subtotal,
      'shipping_amount', v_shop_shipping,
      'tax_amount', 0,
      'discount_amount', v_shop_discount,
      'total_amount', v_shop_total,
      'customer_subtotal_amount', v_shop_subtotal,
      'customer_shipping_amount', v_shop_shipping,
      'customer_tax_amount', 0,
      'customer_discount_amount', v_shop_discount,
      'customer_total_amount', v_shop_total,
      'estimated_delivery_date', v_estimated_delivery,
      'discount_codes', CASE WHEN v_discount.id IS NULL THEN '[]'::jsonb ELSE jsonb_build_array(v_discount.discount_code) END,
      'order_source', 'sheconomy-one',
      'order_metadata', jsonb_build_object(
        'created_via', 'atomic_marketplace_checkout',
        'checkout_group_id', v_group.id,
        'currency_info', jsonb_build_object(
          'shop_currency', v_cart.currency,
          'customer_currency', v_customer_currency,
          'customer_country', v_customer_country,
          'currency_conversion_applied', false,
          'detected_at', now()
        ),
        'shipping_info', jsonb_build_object(
          'delivery_profile_id', v_shipping_quote->>'delivery_profile_id',
          'delivery_profile_name', v_shipping_quote->>'delivery_profile_name',
          'shipping_amount', v_shop_shipping,
          'is_free_shipping', coalesce((v_shipping_quote->>'is_free_shipping')::boolean, v_shop_shipping = 0),
          'processing_time_max', coalesce((v_shipping_quote->>'processing_time_max')::integer, 7),
          'estimated_delivery_date', v_estimated_delivery
        ),
        'payment_info', jsonb_build_object(
          'provider', v_payment_provider,
          'initiated_at', now()
        ),
        'discount_info', CASE WHEN v_discount.id IS NULL THEN NULL ELSE jsonb_build_object(
          'discount_profile_id', v_discount.id,
          'discount_name', v_discount.discount_name,
          'total_discount', v_shop_discount
        ) END,
        'gift', jsonb_build_object('is_gift', v_shop.shop_id = ANY(p_gift_shop_ids))
      )
    ));

    IF coalesce(v_order_result->>'success', 'true') = 'false' THEN
      RAISE EXCEPTION '%', coalesce(v_order_result->>'message', 'Order creation failed');
    END IF;

    PERFORM public.dispatch_marketplace_order_notifications((v_order_result->>'order_id')::uuid);

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
      total_amount = greatest(0, v_subtotal - v_discount_total + v_shipping_total),
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
    'shipping_amount', v_shipping_total,
    'total_amount', greatest(0, v_subtotal - v_discount_total + v_shipping_total),
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

REVOKE ALL ON FUNCTION public.calculate_shop_shipping_from_profiles(uuid, numeric, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.calculate_shop_shipping_from_profiles(uuid, numeric, boolean) TO authenticated;

REVOKE ALL ON FUNCTION public.dispatch_marketplace_order_notifications(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.dispatch_marketplace_order_notifications(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.atomic_marketplace_checkout(uuid, uuid[], uuid, uuid, text, text, jsonb, uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.atomic_marketplace_checkout(uuid, uuid[], uuid, uuid, text, text, jsonb, uuid[]) TO authenticated;
