-- ─────────────────────────────────────────────────────────────────────────────
-- Fix: online payment orders must start as 'awaiting_payment', not 'pending'.
--
-- Root cause discovered: two triggers clobber 'awaiting_payment' back to 'pending'
-- immediately after create_customer_order sets it:
--   a) sync_order_item_status_from_delivery fires on order_delivery INSERT and
--      UPDATEs order_items even when the mapped status hasn't changed.
--   b) sync_order_status_from_items fires on every order_items UPDATE, sees all
--      items are 'pending', and overwrites orders.order_status = 'pending' —
--      erasing the 'awaiting_payment' that was just set.
--
-- Five changes — no backfill, DDL only:
--   1. sync_order_item_status_from_delivery  — skip 'pending' delivery entirely
--   2. sync_order_status_from_items          — never touch awaiting_payment orders
--   3. validate_item_status_transition       — add 'awaiting_payment' to the map
--   4. create_customer_order                 — item_status = awaiting_payment for online
--   5. process_checkout_payment_webhook      — promote order+items on payment confirmed
--
-- Run this in the Supabase Dashboard → SQL Editor.
-- ─────────────────────────────────────────────────────────────────────────────

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. sync_order_item_status_from_delivery
--    'pending' delivery is the initial state set when order_delivery is inserted
--    during create_customer_order.  Mapping that back to item_status = 'pending'
--    was overwriting the 'awaiting_payment' status we just set for online orders.
--    Fix: skip 'pending' delivery entirely (it means "not shipped yet" — nothing
--    has actually happened that warrants a status change).  All other delivery
--    transitions (shipped, delivered, etc.) continue to sync as before.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.sync_order_item_status_from_delivery()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_mapped_status public.order_status_enum;
BEGIN
  -- 'pending' delivery = order just created, not shipped yet.
  -- Skip it — item_status is already set correctly by create_customer_order.
  IF NEW.delivery_status = 'pending'::public.delivery_status_enum THEN
    RETURN NEW;
  END IF;

  -- Unchanged delivery_status on UPDATE → nothing to do.
  IF TG_OP = 'UPDATE' AND NEW.delivery_status = OLD.delivery_status THEN
    RETURN NEW;
  END IF;

  v_mapped_status := CASE NEW.delivery_status
    WHEN 'ready_to_ship'::public.delivery_status_enum    THEN 'processing'::public.order_status_enum
    WHEN 'shipped'::public.delivery_status_enum          THEN 'shipped'::public.order_status_enum
    WHEN 'in_transit'::public.delivery_status_enum       THEN 'in_transit'::public.order_status_enum
    WHEN 'out_for_delivery'::public.delivery_status_enum THEN 'out_for_delivery'::public.order_status_enum
    WHEN 'delivered'::public.delivery_status_enum        THEN 'delivered'::public.order_status_enum
    WHEN 'failed_delivery'::public.delivery_status_enum  THEN 'on_hold'::public.order_status_enum
    WHEN 'returned_to_sender'::public.delivery_status_enum THEN 'returned'::public.order_status_enum
    WHEN 'lost'::public.delivery_status_enum             THEN 'on_hold'::public.order_status_enum
    WHEN 'damaged'::public.delivery_status_enum          THEN 'on_hold'::public.order_status_enum
    WHEN 'cancelled'::public.delivery_status_enum        THEN 'cancelled'::public.order_status_enum
    ELSE NULL
  END;

  IF v_mapped_status IS NULL THEN
    RETURN NEW;
  END IF;

  UPDATE public.order_items
  SET item_status = v_mapped_status, updated_at = now()
  WHERE order_id = NEW.order_id
    AND item_status IS DISTINCT FROM v_mapped_status;

  RETURN NEW;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. sync_order_status_from_items
--    Guard: never overwrite 'awaiting_payment' or 'payment_failed' via item sync.
--    Those states are owned exclusively by the payment webhook.
--    The transition awaiting_payment → pending happens only in
--    process_checkout_payment_webhook when the provider confirms payment.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.sync_order_status_from_items()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  item_statuses TEXT[];
  unique_statuses TEXT[];
  order_status_to_set public.order_status_enum;
  current_order_status public.order_status_enum;
BEGIN
  SELECT array_agg(DISTINCT item_status::TEXT)
  INTO item_statuses
  FROM public.order_items
  WHERE order_id = COALESCE(NEW.order_id, OLD.order_id);

  unique_statuses := array_remove(array_agg(DISTINCT unnest), NULL)
                    FROM unnest(item_statuses);

  IF array_length(unique_statuses, 1) = 1 THEN
    order_status_to_set := unique_statuses[1]::public.order_status_enum;

    SELECT order_status INTO current_order_status
    FROM public.orders
    WHERE id = COALESCE(NEW.order_id, OLD.order_id);

    -- Payment-controlled states must never be overwritten by item-sync.
    -- awaiting_payment → pending is the payment webhook's responsibility.
    IF current_order_status IN (
      'awaiting_payment'::public.order_status_enum,
      'payment_failed'::public.order_status_enum
    ) THEN
      RETURN COALESCE(NEW, OLD);
    END IF;

    IF current_order_status != order_status_to_set THEN
      UPDATE public.orders
      SET order_status = order_status_to_set, updated_at = now()
      WHERE id = COALESCE(NEW.order_id, OLD.order_id);

      INSERT INTO public.order_status_logs (
        order_id, from_status, to_status, changed_by,
        change_reason, system_generated, change_metadata
      ) VALUES (
        COALESCE(NEW.order_id, OLD.order_id),
        current_order_status,
        order_status_to_set,
        auth.uid(),
        'Automatic sync - all items have same status',
        true,
        jsonb_build_object(
          'trigger', 'sync_order_status_from_items',
          'item_count', array_length(item_statuses, 1),
          'unified_status', order_status_to_set
        )
      );
    END IF;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. validate_item_status_transition
--    The live trigger was missing 'awaiting_payment' entirely.
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
  -- On INSERT there is no OLD row; skip validation (new row can start anywhere).
  IF TG_OP = 'INSERT' THEN
    RETURN NEW;
  END IF;

  v_old_status := OLD.item_status::TEXT;
  v_new_status := NEW.item_status::TEXT;

  -- No-op when status is unchanged.
  IF v_new_status = v_old_status THEN
    RETURN NEW;
  END IF;

  -- Full state machine — mirrors VALID_STATUS_TRANSITIONS in order.constants.ts.
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
-- 4. create_customer_order
--    Online-payment orders start as 'awaiting_payment' so vendors cannot see
--    or action them before the buyer pays.  The payment webhook promotes the
--    order to 'pending' once payment is confirmed.
--    COD orders start as 'pending' (payment on delivery, guaranteed at checkout).
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
      v_initial_order_status  -- 'awaiting_payment' for online, 'pending' for COD
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
    v_order_id, v_total_amount, 'pending',
    v_payment_mode,
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
-- 5. process_checkout_payment_webhook
--    When Razorpay confirms payment (group_status = 'paid'):
--      orders.order_status  : awaiting_payment → pending
--      order_items.item_status : awaiting_payment → pending
--    Both use a guarded UPDATE (only fires if the row is still in the pre-payment
--    state) so re-delivered webhooks are idempotent.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.process_checkout_payment_webhook(
  p_checkout_group_id    uuid,
  p_provider             text,
  p_provider_reference   text,
  p_status               text,   -- 'paid' | 'failed' | 'cancelled'
  p_amount               numeric DEFAULT NULL,
  p_currency             text    DEFAULT NULL,
  p_metadata             jsonb   DEFAULT '{}'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_step   public.commerce_checkout_payment_steps%ROWTYPE;
  v_inserted uuid;
  v_group_status text;
BEGIN
  -- Fetch the payment step for this checkout group.
  SELECT * INTO v_step
  FROM public.commerce_checkout_payment_steps
  WHERE checkout_group_id = p_checkout_group_id
  LIMIT 1;

  IF v_step.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Checkout step not found');
  END IF;

  -- Idempotency: already processed.
  IF v_step.status IN ('paid', 'failed', 'cancelled') THEN
    RETURN jsonb_build_object('success', true, 'status', v_step.status, 'idempotent', true);
  END IF;

  -- Update the payment step.
  UPDATE public.commerce_checkout_payment_steps
  SET status             = p_status,
      provider_reference = p_provider_reference,
      processed_at       = CASE WHEN p_status = 'paid' THEN now() ELSE processed_at END,
      metadata           = metadata || p_metadata,
      updated_at         = now()
  WHERE id = v_step.id;

  -- Aggregate group status: 'paid' only when all steps are paid.
  SELECT CASE
    WHEN bool_and(status = 'paid')       THEN 'paid'
    WHEN bool_or(status  = 'failed')     THEN 'failed'
    WHEN bool_or(status  = 'cancelled')  THEN 'cancelled'
    ELSE 'awaiting_payment'
  END
  INTO v_group_status
  FROM public.commerce_checkout_payment_steps
  WHERE checkout_group_id = p_checkout_group_id;

  UPDATE public.commerce_checkout_groups
  SET status     = v_group_status,
      paid_at    = CASE WHEN v_group_status = 'paid' THEN now() ELSE paid_at END,
      updated_at = now()
  WHERE id = p_checkout_group_id;

  IF v_group_status = 'paid' THEN
    -- Convert inventory reservations.
    UPDATE public.inventory_reservations
    SET status = 'converted', converted_at = now()
    WHERE checkout_group_id = p_checkout_group_id AND status = 'reserved';

    -- Promote order: awaiting_payment → pending (vendor can now see & action it).
    WITH order_update AS (
      UPDATE public.orders
      SET order_status = 'pending',
          updated_at   = now()
      WHERE id           = v_step.order_id
        AND order_status = 'awaiting_payment'
      RETURNING id
    )
    INSERT INTO public.order_status_logs (
      order_id, from_status, to_status, note, system_generated, change_metadata
    )
    SELECT id,
           'awaiting_payment',
           'pending',
           'Payment confirmed — order released to vendor',
           true,
           jsonb_build_object(
             'payment_step_id',    v_step.id,
             'provider',           p_provider,
             'provider_reference', p_provider_reference
           )
    FROM order_update;

    -- Promote items: awaiting_payment → pending.
    UPDATE public.order_items
    SET item_status = 'pending',
        updated_at  = now()
    WHERE order_id   = v_step.order_id
      AND item_status = 'awaiting_payment';

    -- Mark order_payments as completed and record the provider reference.
    UPDATE public.order_payments
    SET payment_status         = 'completed',
        transaction_id         = p_provider_reference,
        gateway_transaction_id = p_provider_reference,
        payment_gateway        = p_provider,
        processed_at           = now(),
        updated_at             = now()
    WHERE order_id = v_step.order_id
      AND payment_status = 'pending';

    -- Dispatch deferred notifications (customer placed + vendor new order).
    BEGIN
      PERFORM public.dispatch_marketplace_order_notifications(v_step.order_id);
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'notification dispatch failed for order %: %', v_step.order_id, SQLERRM;
    END;
  END IF;

  RETURN jsonb_build_object(
    'success',      true,
    'status',       v_group_status,
    'order_id',     v_step.order_id,
    'step_id',      v_step.id
  );
END;
$$;
