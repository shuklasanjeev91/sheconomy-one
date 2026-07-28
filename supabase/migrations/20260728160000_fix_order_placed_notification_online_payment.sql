-- Fix: "Order Placed Successfully!" fires for Razorpay/online-payment orders BEFORE
-- the buyer has paid anything.
--
-- Root cause: dispatch_marketplace_order_notifications() was called unconditionally
-- inside atomic_marketplace_checkout(), firing for every payment mode.
--
-- Two-line fix (no changes to the notification function itself):
--   1. atomic_marketplace_checkout   — only call dispatch for COD orders.
--      Online orders are deferred to step 2.
--   2. process_checkout_payment_webhook — call dispatch after payment is confirmed
--      (v_group_status = 'paid'), so the customer and vendor are notified only
--      when money has actually moved.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. atomic_marketplace_checkout  (identical to 20260727143000 except line ~392)
-- ─────────────────────────────────────────────────────────────────────────────
DROP FUNCTION IF EXISTS public.atomic_marketplace_checkout(uuid, uuid[], uuid, uuid, text, text, jsonb, uuid[], text, jsonb);

CREATE OR REPLACE FUNCTION public.atomic_marketplace_checkout(
  p_cart_id uuid,
  p_cart_item_ids uuid[],
  p_shipping_address_id uuid,
  p_billing_address_id uuid DEFAULT NULL,
  p_payment_mode text DEFAULT 'online',
  p_idempotency_key text DEFAULT NULL,
  p_notes_by_shop jsonb DEFAULT '{}'::jsonb,
  p_gift_shop_ids uuid[] DEFAULT ARRAY[]::uuid[]
,
  p_customer_currency text DEFAULT NULL,
  p_customer_amounts_by_shop jsonb DEFAULT '{}'::jsonb
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
  v_shop_currency text;
  v_customer_subtotal numeric;
  v_customer_shipping numeric;
  v_customer_discount numeric;
  v_customer_total numeric;
  v_customer_amounts jsonb;
  v_conversion_applied boolean;
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

  v_customer_currency := coalesce(nullif(trim(p_customer_currency), ''), v_cart.currency, 'INR');
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
    v_user_id, p_cart_id, v_key, 'created', p_payment_mode, v_customer_currency,
    v_subtotal, v_discount_total, greatest(0, v_subtotal - v_discount_total), p_cart_item_ids
  )
  RETURNING * INTO v_group;

  FOR v_shop IN
    SELECT l.shop_id, s.shop_name, s.shop_currency,
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
    GROUP BY l.shop_id, s.shop_name, s.shop_currency, scs.payment_mode, scs.payment_gateway
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

    v_shop_currency := coalesce(nullif(trim(v_shop.shop_currency), ''), 'INR');
    v_customer_amounts := p_customer_amounts_by_shop->v_shop.shop_id::text;
    v_conversion_applied := v_customer_currency IS DISTINCT FROM v_shop_currency;

    IF v_conversion_applied
       AND v_customer_amounts IS NOT NULL
       AND v_customer_amounts <> 'null'::jsonb
       AND v_customer_amounts <> '{}'::jsonb THEN
      v_customer_subtotal := coalesce((v_customer_amounts->>'subtotal_amount')::numeric, v_shop_subtotal);
      v_customer_shipping := coalesce((v_customer_amounts->>'shipping_amount')::numeric, v_shop_shipping);
      v_customer_discount := coalesce((v_customer_amounts->>'discount_amount')::numeric, v_shop_discount);
      v_customer_total := coalesce((v_customer_amounts->>'total_amount')::numeric, v_shop_total);
    ELSE
      v_customer_subtotal := v_shop_subtotal;
      v_customer_shipping := v_shop_shipping;
      v_customer_discount := v_shop_discount;
      v_customer_total := v_shop_total;
    END IF;

    v_order_result := public.create_customer_order(jsonb_build_object(
      'user_id', v_user_id,
      'cart_items', v_items,
      'shipping_address_id', p_shipping_address_id,
      'billing_address_id', coalesce(p_billing_address_id, p_shipping_address_id),
      'customer_notes', nullif(p_notes_by_shop->>v_shop.shop_id::text, ''),
      'payment_mode', p_payment_mode,
      'payment_provider', v_payment_provider,
      'currency', v_shop_currency,
      'customer_currency', v_customer_currency,
      'customer_country', v_customer_country,
      'subtotal_amount', v_shop_subtotal,
      'shipping_amount', v_shop_shipping,
      'tax_amount', 0,
      'discount_amount', v_shop_discount,
      'total_amount', v_shop_total,
      'customer_subtotal_amount', v_customer_subtotal,
      'customer_shipping_amount', v_customer_shipping,
      'customer_tax_amount', 0,
      'customer_discount_amount', v_customer_discount,
      'customer_total_amount', v_customer_total,
      'estimated_delivery_date', v_estimated_delivery,
      'discount_codes', CASE WHEN v_discount.id IS NULL THEN '[]'::jsonb ELSE jsonb_build_array(v_discount.discount_code) END,
      'order_source', 'sheconomy-one',
      'order_metadata', jsonb_build_object(
        'created_via', 'atomic_marketplace_checkout',
        'checkout_group_id', v_group.id,
        'currency_info', jsonb_build_object(
          'shop_currency', v_shop_currency,
          'customer_currency', v_customer_currency,
          'customer_country', v_customer_country,
          'currency_conversion_applied', v_conversion_applied,
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

    -- COD only: notify immediately (payment happens on delivery, order is confirmed now).
    -- Online payment (Razorpay / PayU): defer — notified after webhook confirms payment.
    IF p_payment_mode = 'cod' THEN
      PERFORM public.dispatch_marketplace_order_notifications((v_order_result->>'order_id')::uuid);
    END IF;

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
      v_shop_total, v_shop_currency,
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

REVOKE ALL ON FUNCTION public.atomic_marketplace_checkout(uuid, uuid[], uuid, uuid, text, text, jsonb, uuid[], text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.atomic_marketplace_checkout(uuid, uuid[], uuid, uuid, text, text, jsonb, uuid[], text, jsonb) TO authenticated;


-- ─────────────────────────────────────────────────────────────────────────────
-- 2. process_checkout_payment_webhook  (identical to previous version + one block)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.process_checkout_payment_webhook(
  p_payment_step_id uuid,
  p_shop_id uuid,
  p_provider payment_provider_enum,
  p_webhook_id text,
  p_event_type text,
  p_status text,
  p_provider_reference text DEFAULT NULL,
  p_payload jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_step public.commerce_checkout_payment_steps%ROWTYPE;
  v_inserted uuid;
  v_group_status text;
BEGIN
  IF p_status NOT IN ('requires_action', 'processing', 'paid', 'failed', 'cancelled') THEN
    RAISE EXCEPTION 'Invalid payment status';
  END IF;

  INSERT INTO public.payment_webhooks (
    shop_id, provider, webhook_id, event_type, payload, processed
  ) VALUES (
    p_shop_id, p_provider, p_webhook_id, p_event_type, coalesce(p_payload, '{}'::jsonb), false
  )
  ON CONFLICT (provider, webhook_id) DO NOTHING
  RETURNING id INTO v_inserted;

  IF v_inserted IS NULL THEN
    RETURN jsonb_build_object('duplicate', true, 'webhook_id', p_webhook_id);
  END IF;

  SELECT * INTO v_step
  FROM public.commerce_checkout_payment_steps
  WHERE id = p_payment_step_id AND shop_id = p_shop_id
  FOR UPDATE;
  IF NOT FOUND THEN
    UPDATE public.payment_webhooks
    SET error_message = 'Payment step not found', retry_count = retry_count + 1, updated_at = now()
    WHERE id = v_inserted;
    RAISE EXCEPTION 'Payment step not found';
  END IF;

  -- Paid is terminal and cannot be reversed by a delayed failure webhook.
  IF v_step.status <> 'paid' OR p_status = 'paid' THEN
    UPDATE public.commerce_checkout_payment_steps
    SET status = p_status,
        provider_reference = coalesce(p_provider_reference, provider_reference),
        last_error = CASE WHEN p_status = 'failed' THEN p_payload->>'error' ELSE NULL END,
        processed_at = CASE WHEN p_status IN ('paid', 'failed', 'cancelled') THEN now() ELSE processed_at END,
        updated_at = now()
    WHERE id = v_step.id;
  END IF;

  UPDATE public.order_payments
  SET payment_status = CASE p_status
        WHEN 'paid' THEN 'completed'::payment_status_enum
        WHEN 'failed' THEN 'failed'::payment_status_enum
        WHEN 'cancelled' THEN 'cancelled'::payment_status_enum
        ELSE 'processing'::payment_status_enum
      END,
      gateway_transaction_id = coalesce(p_provider_reference, gateway_transaction_id),
      processed_at = CASE WHEN p_status = 'paid' THEN now() ELSE processed_at END,
      updated_at = now()
  WHERE order_id = v_step.order_id;

  SELECT CASE
    WHEN bool_and(status = 'paid') THEN 'paid'
    WHEN bool_or(status = 'paid') THEN 'partially_paid'
    WHEN bool_or(status IN ('pending', 'requires_action', 'processing')) THEN 'awaiting_payment'
    WHEN bool_and(status = 'cancelled') THEN 'cancelled'
    ELSE 'failed'
  END INTO v_group_status
  FROM public.commerce_checkout_payment_steps
  WHERE checkout_group_id = v_step.checkout_group_id;

  UPDATE public.commerce_checkout_groups
  SET status = v_group_status,
      paid_at = CASE WHEN v_group_status = 'paid' THEN now() ELSE paid_at END,
      last_error = CASE WHEN v_group_status = 'failed' THEN p_payload->>'error' ELSE NULL END,
      updated_at = now()
  WHERE id = v_step.checkout_group_id;

  IF v_group_status = 'paid' THEN
    UPDATE public.inventory_reservations
    SET status = 'converted', converted_at = now()
    WHERE checkout_group_id = v_step.checkout_group_id AND status = 'reserved';

    -- Promote the order from awaiting_payment → pending so the vendor can see
    -- and act on it. 'pending' = payment received, vendor has work to do.
    -- Uses a CTE so the status log only fires when the UPDATE actually matched
    -- a row (idempotent on repeated webhook delivery).
    WITH status_update AS (
      UPDATE public.orders
      SET order_status = 'pending', updated_at = now()
      WHERE id = v_step.order_id AND order_status = 'awaiting_payment'
      RETURNING id
    )
    INSERT INTO public.order_status_logs (
      order_id, from_status, to_status, note, system_generated, change_metadata
    )
    SELECT id, 'awaiting_payment', 'pending',
           'Payment confirmed — order released to vendor', true,
           jsonb_build_object(
             'payment_step_id', v_step.id,
             'provider', p_provider,
             'provider_reference', p_provider_reference
           )
    FROM status_update;
    -- item_status stays 'pending' — no update needed. Vendor item filters work
    -- correctly because vendor visibility is gated by orders.order_status.

    -- Payment confirmed: send the deferred notifications (customer + vendor).
    -- dispatch_marketplace_order_notifications is non-fatal; a failure here must
    -- never roll back the payment record.
    BEGIN
      PERFORM public.dispatch_marketplace_order_notifications(v_step.order_id);
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'notification dispatch failed for order %: %', v_step.order_id, SQLERRM;
    END;
  END IF;

  UPDATE public.payment_webhooks
  SET processed = true, processed_at = now(), updated_at = now()
  WHERE id = v_inserted;

  RETURN jsonb_build_object(
    'duplicate', false,
    'payment_step_id', v_step.id,
    'checkout_group_id', v_step.checkout_group_id,
    'status', p_status,
    'group_status', v_group_status
  );
END;
$$;

REVOKE ALL ON FUNCTION public.process_checkout_payment_webhook(uuid, uuid, payment_provider_enum, text, text, text, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.process_checkout_payment_webhook(uuid, uuid, payment_provider_enum, text, text, text, text, jsonb) TO service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. create_customer_order
--    Online-payment orders now start as 'awaiting_payment', not 'pending'.
--    Vendors can only see/action an order once the payment webhook promotes it
--    to 'confirmed' (see section 2 above).  COD orders remain 'pending' since
--    payment is collected on delivery and is effectively guaranteed at checkout.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.create_customer_order(order_data JSONB)
RETURNS JSONB AS $$
DECLARE
  v_order_id UUID;
  v_order_number TEXT;
  v_cart_items JSONB;
  v_item JSONB;
  v_order_item_id UUID;
  v_listing RECORD;
  v_shipping_address RECORD;
  v_billing_address RECORD;
  v_tax_amount NUMERIC := 0;
  v_subtotal_amount NUMERIC := 0;
  v_discount_amount NUMERIC := 0;
  v_shipping_amount NUMERIC := 0;
  v_total_amount NUMERIC := 0;
  v_result JSONB;
  v_vendor_count INTEGER := 0;
  v_delivery_date DATE;
  v_shop_currency TEXT;
  v_customer_currency TEXT;
  v_customer_country TEXT;
  v_customer_subtotal_amount NUMERIC := 0;
  v_customer_shipping_amount NUMERIC := 0;
  v_customer_tax_amount NUMERIC := 0;
  v_customer_discount_amount NUMERIC := 0;
  v_customer_total_amount NUMERIC := 0;
  v_unit_price NUMERIC;
  v_quantity INTEGER;
  v_item_discount_amount NUMERIC;
  v_item_subtotal NUMERIC;
  v_item_total NUMERIC;
  v_payment_mode TEXT;
  v_initial_order_status public.order_status_enum;
BEGIN
  v_cart_items := order_data->'cart_items';
  v_payment_mode := COALESCE(order_data->>'payment_mode', 'cod');

  -- COD orders are confirmed at checkout (payment on delivery).
  -- Online payment orders wait for the webhook before becoming visible to vendors.
  v_initial_order_status := CASE
    WHEN v_payment_mode = 'cod' THEN 'pending'::public.order_status_enum
    ELSE 'awaiting_payment'::public.order_status_enum
  END;

  v_shop_currency := COALESCE(order_data->>'currency', 'INR');
  v_customer_currency := COALESCE(order_data->>'customer_currency', v_shop_currency);
  v_customer_country := public.normalize_iso_country_code(
    COALESCE(order_data->>'customer_country', 'IN')
  );

  IF (order_data->>'user_id') IS NULL THEN
    RAISE EXCEPTION 'User ID is required';
  END IF;

  IF v_cart_items IS NULL OR jsonb_array_length(v_cart_items) = 0 THEN
    RAISE EXCEPTION 'Cart items are required';
  END IF;

  IF (order_data->>'shipping_address_id') IS NULL THEN
    RAISE EXCEPTION 'Shipping address is required';
  END IF;

  SELECT country, state, city, postal_code, address_line_1, address_line_2, address_label
  INTO v_shipping_address
  FROM public.addresses
  WHERE id = (order_data->>'shipping_address_id')::UUID;

  IF v_shipping_address IS NULL THEN
    RAISE EXCEPTION 'Shipping address not found';
  END IF;

  IF (order_data->>'billing_address_id') IS NOT NULL THEN
    SELECT country, state, city, postal_code, address_line_1, address_line_2, address_label
    INTO v_billing_address
    FROM public.addresses
    WHERE id = (order_data->>'billing_address_id')::UUID;
  ELSE
    v_billing_address := v_shipping_address;
  END IF;

  v_order_number := generate_order_number();

  IF (order_data->>'subtotal_amount') IS NOT NULL THEN
    v_subtotal_amount := (order_data->>'subtotal_amount')::NUMERIC;
    v_shipping_amount := COALESCE((order_data->>'shipping_amount')::NUMERIC, 0);
    v_tax_amount := COALESCE((order_data->>'tax_amount')::NUMERIC, 0);
    v_discount_amount := COALESCE((order_data->>'discount_amount')::NUMERIC, 0);
    v_total_amount := COALESCE((order_data->>'total_amount')::NUMERIC,
                               v_subtotal_amount + v_shipping_amount + v_tax_amount - v_discount_amount);
    v_customer_subtotal_amount := COALESCE((order_data->>'customer_subtotal_amount')::NUMERIC, v_subtotal_amount);
    v_customer_shipping_amount := COALESCE((order_data->>'customer_shipping_amount')::NUMERIC, v_shipping_amount);
    v_customer_tax_amount := COALESCE((order_data->>'customer_tax_amount')::NUMERIC, v_tax_amount);
    v_customer_discount_amount := COALESCE((order_data->>'customer_discount_amount')::NUMERIC, v_discount_amount);
    v_customer_total_amount := COALESCE((order_data->>'customer_total_amount')::NUMERIC, v_total_amount);
  ELSE
    FOR v_item IN SELECT * FROM jsonb_array_elements(v_cart_items)
    LOOP
      v_unit_price := (v_item->>'unit_price')::NUMERIC;
      v_quantity := (v_item->>'quantity')::INTEGER;
      v_item_subtotal := v_unit_price * v_quantity;
      v_item_discount_amount := COALESCE((v_item->>'item_discount_amount')::NUMERIC, 0);
      v_subtotal_amount := v_subtotal_amount + v_item_subtotal;
      v_discount_amount := v_discount_amount + v_item_discount_amount;
    END LOOP;

    IF order_data->'discount_codes' IS NOT NULL
       AND jsonb_array_length(order_data->'discount_codes') > 0 THEN
      v_discount_amount := v_discount_amount
        + COALESCE((order_data->'order_metadata'->'discount_info'->>'total_discount')::NUMERIC, 0);
    END IF;

    v_shipping_amount := COALESCE((order_data->>'shipping_amount')::NUMERIC, 0);
    v_total_amount := v_subtotal_amount + v_shipping_amount - v_discount_amount;
    v_customer_subtotal_amount := v_subtotal_amount;
    v_customer_shipping_amount := v_shipping_amount;
    v_customer_tax_amount := v_tax_amount;
    v_customer_discount_amount := v_discount_amount;
    v_customer_total_amount := v_total_amount;
  END IF;

  v_delivery_date := COALESCE(
    (order_data->>'estimated_delivery_date')::DATE,
    CURRENT_DATE + INTERVAL '7 days'
  );

  INSERT INTO public.orders (
    id, order_number, user_id, shipping_address_id, billing_address_id,
    subtotal_amount, shipping_amount, tax_amount, discount_amount, total_amount,
    currency, customer_currency, customer_country,
    customer_subtotal_amount, customer_shipping_amount, customer_tax_amount,
    customer_discount_amount, customer_total_amount,
    order_status, payment_required, customer_notes, special_instructions,
    estimated_delivery_date, requested_delivery_date, order_source, order_metadata
  ) VALUES (
    gen_random_uuid(), v_order_number,
    (order_data->>'user_id')::UUID,
    (order_data->>'shipping_address_id')::UUID,
    COALESCE((order_data->>'billing_address_id')::UUID, (order_data->>'shipping_address_id')::UUID),
    v_subtotal_amount, v_shipping_amount, v_tax_amount, v_discount_amount, v_total_amount,
    v_shop_currency, v_customer_currency, v_customer_country,
    v_customer_subtotal_amount, v_customer_shipping_amount, v_customer_tax_amount,
    v_customer_discount_amount, v_customer_total_amount,
    v_initial_order_status,
    CASE WHEN v_payment_mode = 'cod' THEN false ELSE true END,
    order_data->>'customer_notes',
    order_data->>'special_instructions',
    v_delivery_date,
    (order_data->>'requested_delivery_date')::DATE,
    COALESCE(order_data->>'order_source', 'web'),
    COALESCE(
      order_data->'order_metadata',
      jsonb_build_object(
        'created_via', 'create_customer_order_function',
        'cart_items_count', jsonb_array_length(v_cart_items)
      )
    )
  ) RETURNING id INTO v_order_id;

  SELECT COUNT(DISTINCT l.shop_id)
  INTO v_vendor_count
  FROM jsonb_array_elements(v_cart_items) AS ci
  JOIN public.listings l ON (ci->>'listing_id')::UUID = l.id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(v_cart_items)
  LOOP
    SELECT l.id, l.title, l.description, l.shop_id, l.listing_type,
      l.quantity as stock_quantity, l.sku, lrp.return_policy_id, s.shop_name
    INTO v_listing
    FROM public.listings l
    JOIN public.shops s ON l.shop_id = s.id
    LEFT JOIN public.listing_return_policies lrp ON l.id = lrp.listing_id
    WHERE l.id = (v_item->>'listing_id')::UUID;

    IF v_listing.id IS NULL THEN
      RAISE EXCEPTION 'Listing not found: %', v_item->>'listing_id';
    END IF;

    v_unit_price := (v_item->>'unit_price')::NUMERIC;
    v_quantity := (v_item->>'quantity')::INTEGER;
    v_item_subtotal := v_unit_price * v_quantity;
    v_item_discount_amount := COALESCE((v_item->>'item_discount_amount')::NUMERIC, 0);
    v_item_total := v_item_subtotal - v_item_discount_amount;

    IF v_listing.stock_quantity IS NOT NULL AND v_listing.stock_quantity < v_quantity THEN
      RAISE EXCEPTION 'Insufficient stock for listing: %. Available: %, Requested: %',
        v_listing.title, v_listing.stock_quantity, v_quantity;
    END IF;

    INSERT INTO public.order_items (
      id, order_id, listing_id, vendor_id, listing_return_policy_id,
      product_title, product_description, product_sku, variation_details,
      quantity, unit_price, total_price, item_discount_amount, item_status
    ) VALUES (
      gen_random_uuid(), v_order_id, v_listing.id, v_listing.shop_id, v_listing.return_policy_id,
      v_listing.title, v_listing.description, v_listing.sku,
      COALESCE(v_item->'variation_details', '{}'::jsonb),
      v_quantity, v_unit_price, v_item_total, v_item_discount_amount,
      'pending'::public.order_status_enum
    ) RETURNING id INTO v_order_item_id;

    IF v_item->'listing_discounts' IS NOT NULL
       AND jsonb_array_length(v_item->'listing_discounts') > 0 THEN
      DECLARE v_discount JSONB;
      BEGIN
        FOR v_discount IN SELECT * FROM jsonb_array_elements(v_item->'listing_discounts')
        LOOP
          INSERT INTO public.order_discounts (
            order_item_id, discount_profile_id, discount_name, discount_type,
            discount_amount, applied_at, applied_by_code, discount_scope, discount_metadata
          ) VALUES (
            v_order_item_id,
            (v_discount->>'discount_profile_id')::UUID,
            v_discount->>'discount_name',
            v_discount->>'discount_type',
            (v_discount->>'discount_amount')::NUMERIC,
            now(),
            (v_discount->>'discount_code') IS NOT NULL,
            COALESCE(v_discount->>'discount_scope', 'item'),
            v_discount
          );
        END LOOP;
      END;
    END IF;

    INSERT INTO public.order_delivery (
      order_id, order_item_id, delivery_status, delivery_mode,
      estimated_delivery_date, delivery_address, delivery_instructions
    ) VALUES (
      v_order_id, v_order_item_id, 'pending', 'standard', v_delivery_date,
      jsonb_build_object(
        'country', v_shipping_address.country,
        'state', v_shipping_address.state,
        'city', v_shipping_address.city,
        'postal_code', v_shipping_address.postal_code,
        'address_line_1', v_shipping_address.address_line_1,
        'address_line_2', v_shipping_address.address_line_2,
        'address_label', v_shipping_address.address_label
      ),
      order_data->>'special_instructions'
    );

    UPDATE public.listings
    SET quantity = CASE
          WHEN quantity IS NULL THEN NULL
          ELSE GREATEST(0, quantity - v_quantity)
        END,
        updated_at = now()
    WHERE id = v_listing.id;
  END LOOP;

  INSERT INTO public.order_payments (
    order_id, amount, payment_status, payment_mode, cod_amount, payment_metadata
  ) VALUES (
    v_order_id, v_total_amount, 'pending'::payment_status_enum,
    v_payment_mode::payment_mode_enum,
    CASE WHEN v_payment_mode = 'cod' THEN v_total_amount ELSE NULL END,
    jsonb_build_object(
      'currency', v_customer_currency,
      'shop_currency', v_shop_currency,
      'customer_country', v_customer_country,
      'vendor_count', v_vendor_count,
      'customer_total_amount', v_customer_total_amount
    )
  );

  INSERT INTO public.order_status_logs (
    order_id, from_status, to_status, changed_by, note, system_generated, change_metadata
  ) VALUES (
    v_order_id, NULL, v_initial_order_status, (order_data->>'user_id')::UUID,
    CASE WHEN v_payment_mode = 'cod' THEN 'Order created (COD)'
         ELSE 'Order reserved — awaiting payment' END,
    true,
    jsonb_build_object(
      'vendor_count', v_vendor_count,
      'item_count', jsonb_array_length(v_cart_items),
      'total_amount', v_total_amount,
      'currency', v_shop_currency,
      'customer_currency', v_customer_currency,
      'customer_total_amount', v_customer_total_amount
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'order_id', v_order_id,
    'order_number', v_order_number,
    'total_amount', v_total_amount,
    'currency', v_shop_currency,
    'customer_currency', v_customer_currency,
    'customer_total_amount', v_customer_total_amount,
    'vendor_count', v_vendor_count,
    'item_count', jsonb_array_length(v_cart_items),
    'payment_mode', v_payment_mode,
    'message', 'Order created successfully'
  );

EXCEPTION WHEN OTHERS THEN
  RAISE EXCEPTION 'Order creation failed: %', SQLERRM;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. cancel_checkout_payment
--    Must also cancel orders/items in 'awaiting_payment' state, not just
--    'pending'. Without this a buyer who abandons Razorpay can never cancel.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.cancel_checkout_payment(p_checkout_group_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_group public.commerce_checkout_groups%ROWTYPE;
BEGIN
  SELECT * INTO v_group FROM public.commerce_checkout_groups
  WHERE id = p_checkout_group_id AND buyer_id = auth.uid()
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Checkout not found'; END IF;
  IF v_group.status IN ('paid', 'cancelled') THEN
    RAISE EXCEPTION 'Checkout cannot be cancelled';
  END IF;

  -- Release reserved inventory back to listings.
  UPDATE public.listings l
  SET quantity = CASE WHEN l.quantity IS NULL THEN NULL ELSE l.quantity + r.quantity END,
      updated_at = now()
  FROM public.inventory_reservations r
  WHERE r.checkout_group_id = v_group.id
    AND r.listing_id = l.id
    AND r.status = 'reserved';

  UPDATE public.listing_variations lv
  SET stock = CASE WHEN lv.stock IS NULL THEN NULL ELSE lv.stock + r.quantity END,
      updated_at = now()
  FROM public.inventory_reservations r
  WHERE r.checkout_group_id = v_group.id
    AND r.variation_id = lv.id
    AND r.status = 'reserved';

  UPDATE public.inventory_reservations
  SET status = 'released', released_at = now()
  WHERE checkout_group_id = v_group.id AND status = 'reserved';

  -- Cancel items (item_status is always 'pending' before payment confirmation).
  UPDATE public.order_items
  SET item_status = 'cancelled', updated_at = now()
  WHERE order_id = ANY(v_group.order_ids)
    AND item_status = 'pending';

  -- Cancel orders in both pre-payment states.
  UPDATE public.orders
  SET order_status = 'cancelled', updated_at = now()
  WHERE id = ANY(v_group.order_ids)
    AND order_status IN ('pending', 'awaiting_payment');

  UPDATE public.order_payments
  SET payment_status = 'cancelled', updated_at = now()
  WHERE order_id = ANY(v_group.order_ids)
    AND payment_status IN ('pending', 'processing');

  PERFORM public._restore_checkout_cart(v_group.id, v_group.cart_id, v_group.order_ids);

  UPDATE public.commerce_checkout_payment_steps
  SET status = 'cancelled', updated_at = now()
  WHERE checkout_group_id = v_group.id AND status <> 'paid';

  UPDATE public.commerce_checkout_groups
  SET status = 'cancelled', cancelled_at = now(), updated_at = now()
  WHERE id = v_group.id;

  RETURN jsonb_build_object('checkout_group_id', v_group.id, 'status', 'cancelled');
END;
$$;

REVOKE ALL ON FUNCTION public.cancel_checkout_payment(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cancel_checkout_payment(uuid) TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. Fix validate_item_status_transition trigger
--    The live trigger was created outside migrations and has an incomplete
--    transition map that doesn't include 'awaiting_payment' at all.  We
--    replace the function body with the complete state machine that matches
--    order.constants.ts so the backfill (section 6) and the webhook handler
--    (section 2) can perform their transitions without being blocked.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.validate_item_status_transition()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_old_status TEXT;
  v_new_status TEXT;
  valid_transitions JSONB;
BEGIN
  v_old_status := OLD.item_status::TEXT;
  v_new_status := NEW.item_status::TEXT;

  -- Full state machine — mirrors ORDER_STATUS_VALID_TRANSITIONS in order.constants.ts.
  valid_transitions := '{
    "pending":           ["awaiting_payment", "confirmed", "processing", "cancelled"],
    "awaiting_payment":  ["pending", "confirmed", "payment_failed", "cancelled"],
    "payment_failed":    ["awaiting_payment", "cancelled"],
    "confirmed":         ["processing", "on_hold", "cancelled"],
    "processing":        ["shipped", "partially_shipped", "on_hold", "cancelled"],
    "partially_shipped": ["shipped", "in_transit", "delivered", "returned"],
    "shipped":           ["in_transit", "delivered", "returned"],
    "in_transit":        ["out_for_delivery", "delivered", "returned"],
    "out_for_delivery":  ["delivered", "failed_delivery", "returned"],
    "delivered":         ["completed", "returned", "disputed"],
    "completed":         ["returned", "disputed"],
    "returned":          ["refunded"],
    "refunded":          [],
    "cancelled":         [],
    "disputed":          ["completed", "refunded", "returned"],
    "on_hold":           ["processing", "cancelled"],
    "failed_delivery":   ["out_for_delivery", "returned", "on_hold"]
  }'::JSONB;

  -- No-op when status is unchanged.
  IF v_new_status = v_old_status THEN
    RETURN NEW;
  END IF;

  IF NOT (valid_transitions->v_old_status ? v_new_status) THEN
    RAISE EXCEPTION 'Invalid status transition from % to % for order item %',
      v_old_status, v_new_status, NEW.id
    USING HINT = 'Valid transitions from ' || v_old_status || ': ' ||
                 COALESCE((valid_transitions->v_old_status)::TEXT, 'none');
  END IF;

  RETURN NEW;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. Backfill
--    Existing 'pending' orders that require payment and are not yet paid should
--    be moved to 'awaiting_payment' so the new state machine applies to them.
--    Safe to run multiple times (idempotent WHERE clause).
-- ─────────────────────────────────────────────────────────────────────────────

-- Only the orders table needs backfilling. item_status stays 'pending' — the
-- vendor is blocked by orders.order_status = 'awaiting_payment', not item_status.
UPDATE public.orders
SET order_status = 'awaiting_payment', updated_at = now()
WHERE order_status = 'pending'
  AND payment_required = true
  AND id IN (
    SELECT order_id FROM public.order_payments
    WHERE payment_status = 'pending'
  );
