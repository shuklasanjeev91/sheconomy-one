-- Auto reverse pickup + no buyer AWB.
--
-- Returns/exchanges are now Amazon-style: on vendor approval the client auto-books
-- a reverse pickup through the platform Shiprocket account and records the AWB via
-- assign_return_tracking with return_shipping_mode = 'auto'. Manual vendor paste
-- ('vendor_arranged') stays as the fallback. The buyer never enters an AWB, so
-- submit_return_tracking is hard-disabled.
--
-- assign_return_tracking now also writes a reverse `order_delivery` leg
-- (delivery_mode = 'return') so the courier webhook + track-sync keep it live, and
-- a new trigger auto-confirms the return (refund / replacement) once that reverse
-- leg is delivered back to the seller.

-- ---------------------------------------------------------------------------
-- 0. Doc + guard reverse legs out of buyer delivery notifications
-- ---------------------------------------------------------------------------
COMMENT ON COLUMN public.order_issues.return_shipping_mode IS
  'auto (system-booked) | vendor_arranged (manual paste) | buyer_self (legacy)';

-- Reverse pickup legs are seller-facing logistics — never send buyer/seller
-- "your order shipped/delivered" notifications or a review nudge for them. This
-- mirrors the 20260812123000 definition, adding the return-leg guard at the top.
CREATE OR REPLACE FUNCTION public.notify_delivery_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order_info RECORD;
  v_item_info RECORD;
  v_vendor_id uuid;
  v_seller_name text;
  v_variables JSONB;
  v_customer_template TEXT;
  v_seller_template TEXT;
  v_notify BOOLEAN;
  v_customer_action TEXT;
  v_seller_action TEXT;
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.delivery_status IS NOT DISTINCT FROM NEW.delivery_status THEN
    RETURN NEW;
  END IF;

  -- Reverse pickup legs are handled by the return lifecycle, not delivery notices.
  IF lower(COALESCE(NEW.delivery_mode::text, '')) = 'return'
     OR COALESCE(NEW.delivery_metadata->>'leg', '') = 'return' THEN
    RETURN NEW;
  END IF;

  IF NEW.delivery_status = 'pending'::public.delivery_status_enum THEN
    RETURN NEW;
  END IF;

  v_notify := COALESCE((NEW.delivery_metadata->>'notify_customer')::boolean, true);

  SELECT
    o.id,
    o.order_number,
    o.user_id,
    o.customer_total_amount,
    o.customer_currency,
    p.full_name AS customer_name
  INTO v_order_info
  FROM public.orders o
  LEFT JOIN public.profiles p ON o.user_id = p.id
  WHERE o.id = NEW.order_id;

  IF v_order_info.id IS NULL THEN
    RETURN NEW;
  END IF;

  v_customer_template := CASE NEW.delivery_status
    WHEN 'shipped'::public.delivery_status_enum THEN
      CASE WHEN NEW.order_item_id IS NOT NULL THEN 'order_item_shipped_customer' ELSE 'order_shipped_customer' END
    WHEN 'in_transit'::public.delivery_status_enum THEN 'order_in_transit_customer'
    WHEN 'out_for_delivery'::public.delivery_status_enum THEN 'order_out_for_delivery_customer'
    WHEN 'delivered'::public.delivery_status_enum THEN 'order_delivered_customer'
    WHEN 'failed_delivery'::public.delivery_status_enum THEN 'delivery_failed_customer'
    ELSE NULL
  END;

  v_seller_template := CASE NEW.delivery_status
    WHEN 'shipped'::public.delivery_status_enum THEN
      CASE WHEN NEW.order_item_id IS NOT NULL THEN 'order_item_shipped_seller' ELSE 'order_shipped_seller' END
    WHEN 'in_transit'::public.delivery_status_enum THEN 'order_in_transit_seller'
    WHEN 'out_for_delivery'::public.delivery_status_enum THEN 'order_out_for_delivery_seller'
    WHEN 'delivered'::public.delivery_status_enum THEN 'order_delivered_seller'
    WHEN 'failed_delivery'::public.delivery_status_enum THEN 'delivery_failed_seller'
    ELSE NULL
  END;

  v_customer_action := '/orders/' || NEW.order_id::text;
  v_seller_action := '/vendor/orders';

  v_variables := jsonb_build_object(
    'order_number', v_order_info.order_number,
    'order_id', NEW.order_id,
    'customer_name', COALESCE(v_order_info.customer_name, 'Customer'),
    'seller_name', 'Seller',
    'customer_total_amount', ROUND(COALESCE(v_order_info.customer_total_amount, 0)::numeric, 2),
    'customer_currency', COALESCE(v_order_info.customer_currency, 'INR'),
    'tracking_number', COALESCE(NEW.tracking_number, NEW.awb_code, ''),
    'estimated_delivery', COALESCE(NEW.estimated_delivery_date::text, 'soon'),
    'failure_reason', COALESCE(NEW.delivery_metadata->>'failure_reason', 'Delivery attempt unsuccessful'),
    'next_attempt_date', COALESCE(NEW.delivery_metadata->>'next_attempt_date', 'Tomorrow'),
    'delivery_person_phone', COALESCE(NEW.delivery_person_phone, ''),
    'action_url', v_customer_action,
    'product_title', 'Item',
    'shop_name', 'Shop'
  );

  IF NEW.order_item_id IS NOT NULL THEN
    SELECT
      oi.product_title,
      COALESCE(oi.unit_price, oi.total_price, 0) AS item_price,
      oi.id AS order_item_id,
      s.shop_name AS shop_name,
      s.user_id AS vendor_user_id
    INTO v_item_info
    FROM public.order_items oi
    LEFT JOIN public.shops s ON s.id = oi.vendor_id
    WHERE oi.id = NEW.order_item_id;

    v_vendor_id := v_item_info.vendor_user_id;
    v_variables := v_variables || jsonb_build_object(
      'order_item_id', NEW.order_item_id,
      'product_title', COALESCE(v_item_info.product_title, 'Item'),
      'item_customer_price', ROUND(COALESCE(v_item_info.item_price, 0)::numeric, 2),
      'shop_name', COALESCE(v_item_info.shop_name, 'Shop')
    );
  ELSE
    SELECT s.user_id
    INTO v_vendor_id
    FROM public.order_items oi
    JOIN public.shops s ON s.id = oi.vendor_id
    WHERE oi.order_id = NEW.order_id
    LIMIT 1;
  END IF;

  IF v_vendor_id IS NOT NULL THEN
    SELECT full_name INTO v_seller_name FROM public.profiles WHERE id = v_vendor_id;
    v_variables := v_variables || jsonb_build_object(
      'seller_name', COALESCE(v_seller_name, 'Seller')
    );
  END IF;

  IF v_notify IS TRUE
     AND v_customer_template IS NOT NULL
     AND v_order_info.user_id IS NOT NULL THEN
    PERFORM public.create_validated_notification(
      v_customer_template,
      v_order_info.user_id,
      v_variables || jsonb_build_object('action_url', v_customer_action),
      public.get_order_delivery_context(),
      NEW.id,
      public.get_order_context(),
      NEW.order_id,
      CASE
        WHEN NEW.delivery_status = 'failed_delivery'::public.delivery_status_enum THEN 1
        WHEN NEW.delivery_status = 'delivered'::public.delivery_status_enum THEN 2
        ELSE 3
      END,
      NULL,
      'delivery_trigger'
    );
  END IF;

  IF v_seller_template IS NOT NULL AND v_vendor_id IS NOT NULL THEN
    PERFORM public.create_validated_notification(
      v_seller_template,
      v_vendor_id,
      v_variables || jsonb_build_object('action_url', v_seller_action),
      public.get_order_delivery_context(),
      NEW.id,
      public.get_order_context(),
      NEW.order_id,
      CASE
        WHEN NEW.delivery_status = 'failed_delivery'::public.delivery_status_enum THEN 1
        WHEN NEW.delivery_status = 'delivered'::public.delivery_status_enum THEN 2
        ELSE 3
      END,
      NULL,
      'delivery_trigger_seller'
    );
  END IF;

  -- Soft review nudge after successful delivery (customer only).
  IF v_notify IS TRUE
     AND NEW.delivery_status = 'delivered'::public.delivery_status_enum
     AND v_order_info.user_id IS NOT NULL THEN
    PERFORM public.create_validated_notification(
      'order_review_prompt_customer',
      v_order_info.user_id,
      v_variables || jsonb_build_object('action_url', v_customer_action),
      public.get_order_context(),
      NEW.order_id,
      public.get_order_delivery_context(),
      NEW.id,
      4,
      NULL,
      'delivery_review_prompt'
    );
  END IF;

  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- 1. Buyer submit_return_tracking — hard-disabled (returns are seller-arranged)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.submit_return_tracking(
  p_order_item_id uuid,
  p_tracking_number text,
  p_courier_slug text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RAISE EXCEPTION 'Returns are arranged by the seller — no buyer tracking is required';
END;
$$;

-- ---------------------------------------------------------------------------
-- 2. assign_return_tracking — supports auto | vendor_arranged, writes reverse leg
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.assign_return_tracking(uuid, text, text, text);

CREATE OR REPLACE FUNCTION public.assign_return_tracking(
  p_order_item_id uuid,
  p_tracking_number text,
  p_courier_slug text DEFAULT NULL,
  p_custom_tracking_url text DEFAULT NULL,
  p_return_shipping_mode text DEFAULT 'vendor_arranged'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_item public.order_items%ROWTYPE;
  v_order public.orders%ROWTYPE;
  v_shop public.shops%ROWTYPE;
  v_issue public.order_issues%ROWTYPE;
  v_refund public.refunds%ROWTYPE;
  v_tracking text := upper(trim(COALESCE(p_tracking_number, '')));
  v_courier text := NULLIF(trim(COALESCE(p_courier_slug, '')), '');
  v_url text := NULLIF(trim(COALESCE(p_custom_tracking_url, '')), '');
  v_mode text := lower(NULLIF(trim(COALESCE(p_return_shipping_mode, '')), ''));
  v_is_admin boolean;
  v_app_base text := COALESCE(
    NULLIF(current_setting('app.settings.public_app_url', true), ''),
    'https://sheconomy.in'
  );
  v_buyer_name text;
  v_shop_name text;
  v_addr jsonb;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF char_length(v_tracking) < 5 THEN
    RAISE EXCEPTION 'Enter a valid tracking / AWB number';
  END IF;

  IF v_mode IS NULL OR v_mode NOT IN ('auto', 'vendor_arranged') THEN
    v_mode := 'vendor_arranged';
  END IF;

  SELECT * INTO v_item FROM public.order_items WHERE id = p_order_item_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order item not found';
  END IF;

  SELECT * INTO v_order FROM public.orders WHERE id = v_item.order_id;
  SELECT * INTO v_shop FROM public.shops WHERE id = v_item.vendor_id;

  v_is_admin := public._marketplace_is_admin(v_user_id);
  IF NOT v_is_admin AND (v_shop.user_id IS NULL OR v_shop.user_id <> v_user_id) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  SELECT * INTO v_issue
  FROM public.order_issues
  WHERE order_item_id = v_item.id
    AND issue_type IN ('return_request', 'exchange_request', 'refund_request')
    AND resolution_action = 'accepted'
    AND resolution_action IS DISTINCT FROM 'return_received'
    AND resolution_action IS DISTINCT FROM 'exchange_ready_to_ship'
    AND (
      status IN ('waiting_customer', 'in_progress', 'resolved')
    )
  ORDER BY created_at DESC
  LIMIT 1
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No accepted return or exchange is waiting for pickup tracking';
  END IF;

  IF v_issue.return_tracking_number IS NOT NULL THEN
    RAISE EXCEPTION 'Return tracking was already assigned for this request';
  END IF;

  UPDATE public.order_issues
  SET
    return_tracking_number = v_tracking,
    return_shipped_at = now(),
    return_courier_slug = v_courier,
    return_tracking_url = v_url,
    return_shipping_mode = v_mode,
    return_assigned_by = v_user_id,
    status = 'waiting_customer',
    updated_at = now()
  WHERE id = v_issue.id
  RETURNING * INTO v_issue;

  UPDATE public.refunds
  SET
    return_tracking_number = v_tracking,
    return_shipped_at = COALESCE(return_shipped_at, now()),
    updated_at = now()
  WHERE order_item_id = v_item.id
    AND refund_status IN ('requested', 'processing', 'approved')
  RETURNING * INTO v_refund;

  -- Reverse order_delivery leg so the courier webhook + track-sync keep it live
  -- and the delivered→auto-confirm trigger can fire. Guard against duplicates.
  IF NOT EXISTS (
    SELECT 1 FROM public.order_delivery od
    WHERE od.order_item_id = v_item.id
      AND (lower(COALESCE(od.delivery_mode::text, '')) = 'return'
           OR COALESCE(od.delivery_metadata->>'leg', '') = 'return')
  ) THEN
    SELECT od.delivery_address INTO v_addr
    FROM public.order_delivery od
    WHERE od.order_item_id = v_item.id
      AND lower(COALESCE(od.delivery_mode::text, '')) <> 'return'
    ORDER BY od.created_at ASC
    LIMIT 1;

    INSERT INTO public.order_delivery (
      order_id, order_item_id, delivery_status, delivery_mode,
      tracking_number, awb_code, carrier_name, courier_service_name,
      carrier_tracking_url, delivery_address, shipped_at, delivery_metadata
    ) VALUES (
      v_item.order_id, v_item.id, 'shipped'::public.delivery_status_enum, 'return',
      v_tracking, v_tracking, COALESCE(v_courier, 'courier'), v_courier,
      v_url, COALESCE(v_addr, '{}'::jsonb), now(),
      jsonb_build_object(
        'leg', 'return',
        'courier_slug', v_courier,
        'return_shipping_mode', v_mode,
        'notify_customer', false
      )
    );
  END IF;

  PERFORM public._marketplace_append_issue_event(
    v_issue.id, v_user_id,
    CASE WHEN v_mode = 'auto' THEN 'return_pickup_auto_booked' ELSE 'return_pickup_assigned' END,
    CASE WHEN v_mode = 'auto' THEN 'Auto-booked pickup ' || v_tracking
         ELSE 'Vendor assigned tracking ' || v_tracking END,
    jsonb_build_object(
      'tracking_number', v_tracking,
      'courier_slug', v_courier,
      'tracking_url', v_url,
      'return_shipping_mode', v_mode
    )
  );

  SELECT COALESCE(NULLIF(full_name, ''), username, 'there') INTO v_buyer_name
  FROM public.profiles WHERE id = v_order.user_id;
  v_shop_name := COALESCE(NULLIF(v_shop.shop_name, ''), 'The shop');

  BEGIN
    PERFORM public.create_notification_from_template(
      p_template_key := 'order_return_pickup_assigned_buyer',
      p_recipient_id := v_order.user_id,
      p_variables := jsonb_build_object(
        'buyer_name', v_buyer_name,
        'shop_name', v_shop_name,
        'product_name', COALESCE(v_item.product_title, 'your item'),
        'order_number', v_order.order_number,
        'tracking_number', v_tracking,
        'action_url', v_app_base || '/orders/' || v_order.id::text
      ),
      p_context_type := 'order',
      p_context_id := v_order.id::text
    );
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  RETURN jsonb_build_object(
    'issue_id', v_issue.id,
    'tracking_number', v_tracking,
    'courier_slug', v_courier,
    'tracking_url', v_url,
    'refund_id', v_refund.id,
    'return_shipping_mode', v_mode
  );
END;
$$;

REVOKE ALL ON FUNCTION public.assign_return_tracking(uuid, text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.assign_return_tracking(uuid, text, text, text, text) TO authenticated;

-- ---------------------------------------------------------------------------
-- 3. Refactor confirm_order_return_received into a reusable internal core so a
--    trigger can auto-confirm without a vendor tap.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._confirm_order_return_received(
  p_order_item_id uuid,
  p_actor uuid DEFAULT NULL,
  p_note text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item public.order_items%ROWTYPE;
  v_order public.orders%ROWTYPE;
  v_shop public.shops%ROWTYPE;
  v_refund public.refunds%ROWTYPE;
  v_issue public.order_issues%ROWTYPE;
  v_replacement public.order_items%ROWTYPE;
  v_actor uuid;
  v_app_base text := COALESCE(
    NULLIF(current_setting('app.settings.public_app_url', true), ''),
    'https://sheconomy.in'
  );
  v_buyer_name text;
  v_seller_name text;
  v_amount text;
  v_is_exchange boolean := false;
BEGIN
  SELECT * INTO v_item FROM public.order_items WHERE id = p_order_item_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order item not found';
  END IF;

  SELECT * INTO v_order FROM public.orders WHERE id = v_item.order_id;
  SELECT * INTO v_shop FROM public.shops WHERE id = v_item.vendor_id;
  v_actor := COALESCE(p_actor, v_shop.user_id, v_order.user_id);

  SELECT * INTO v_issue
  FROM public.order_issues
  WHERE order_item_id = v_item.id
    AND issue_type IN ('return_request', 'refund_request', 'exchange_request')
  ORDER BY created_at DESC
  LIMIT 1
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No open return or exchange found for this item';
  END IF;

  v_is_exchange := v_issue.issue_type = 'exchange_request';

  IF v_is_exchange THEN
    IF v_issue.resolution_action NOT IN ('accepted', 'exchange_ready_to_ship')
       AND v_issue.status NOT IN ('resolved', 'waiting_customer') THEN
      RAISE EXCEPTION 'Approve the exchange before confirming goods received';
    END IF;

    -- Idempotency: replacement already created.
    IF v_issue.resolution_action = 'exchange_ready_to_ship' THEN
      RETURN jsonb_build_object('issue_id', v_issue.id, 'skipped', true, 'reason', 'already_ready');
    END IF;

    UPDATE public.order_items
    SET item_status = 'returned', updated_at = now()
    WHERE id = v_item.id
      AND item_status NOT IN ('returned', 'refunded', 'cancelled');

    PERFORM public._restock_cancelled_order_items(v_order.id, v_item.id);

    INSERT INTO public.order_items (
      order_id, listing_id, vendor_id, listing_return_policy_id,
      product_title, product_description, product_sku, variation_details,
      quantity, unit_price, total_price, item_discount_amount,
      item_status, exchanged_from_item_id
    ) VALUES (
      v_item.order_id, v_item.listing_id, v_item.vendor_id, v_item.listing_return_policy_id,
      v_item.product_title, v_item.product_description, v_item.product_sku, v_item.variation_details,
      v_item.quantity, v_item.unit_price, v_item.total_price, COALESCE(v_item.item_discount_amount, 0),
      'processing'::order_status_enum, v_item.id
    )
    RETURNING * INTO v_replacement;

    IF v_replacement.listing_id IS NOT NULL THEN
      UPDATE public.listings
      SET quantity = CASE
            WHEN quantity IS NULL THEN NULL
            WHEN quantity >= v_replacement.quantity THEN quantity - v_replacement.quantity
            ELSE 0
          END,
          updated_at = now()
      WHERE id = v_replacement.listing_id;
    END IF;

    UPDATE public.order_issues
    SET
      status = 'resolved',
      resolution_action = 'exchange_ready_to_ship',
      resolution_note = COALESCE(NULLIF(trim(COALESCE(p_note, '')), ''), resolution_note),
      resolved_at = COALESCE(resolved_at, now()),
      updated_at = now()
    WHERE id = v_issue.id;

    PERFORM public._marketplace_append_issue_event(
      v_issue.id, v_actor, 'exchange_ready_to_ship',
      NULLIF(trim(COALESCE(p_note, '')), ''),
      jsonb_build_object('replacement_item_id', v_replacement.id)
    );

    SELECT COALESCE(NULLIF(full_name, ''), username, 'Seller') INTO v_seller_name
    FROM public.profiles WHERE id = v_shop.user_id;

    BEGIN
      PERFORM public.create_notification_from_template(
        p_template_key := 'order_exchange_ready_seller',
        p_recipient_id := v_shop.user_id,
        p_variables := jsonb_build_object(
          'seller_name', v_seller_name,
          'product_name', COALESCE(v_item.product_title, 'your item'),
          'order_number', v_order.order_number,
          'action_url', v_app_base || '/vendor/orders'
        ),
        p_context_type := 'order',
        p_context_id := v_order.id::text
      );
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;

    SELECT COALESCE(NULLIF(full_name, ''), username, 'there') INTO v_buyer_name
    FROM public.profiles WHERE id = v_order.user_id;

    BEGIN
      PERFORM public.create_notification_from_template(
        p_template_key := 'order_issue_resolved_buyer',
        p_recipient_id := v_order.user_id,
        p_variables := jsonb_build_object(
          'buyer_name', v_buyer_name,
          'issue_label', 'exchange request',
          'resolution_summary', 'Your return was received. The shop will ship your replacement soon.',
          'order_number', v_order.order_number,
          'action_url', v_app_base || '/orders/' || v_order.id::text
        ),
        p_context_type := 'order',
        p_context_id := v_order.id::text
      );
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;

    RETURN jsonb_build_object(
      'issue_id', v_issue.id,
      'replacement_item_id', v_replacement.id,
      'resolution_action', 'exchange_ready_to_ship'
    );
  END IF;

  -- Return / refund path
  SELECT * INTO v_refund
  FROM public.refunds
  WHERE order_item_id = v_item.id
    AND refund_status IN ('requested', 'processing', 'approved')
  ORDER BY created_at DESC
  LIMIT 1
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No open refund/return found for this item';
  END IF;

  -- Idempotency: refund already checked in.
  IF v_refund.return_received_at IS NOT NULL THEN
    RETURN jsonb_build_object('refund_id', v_refund.id, 'skipped', true, 'reason', 'already_received');
  END IF;

  UPDATE public.order_items
  SET item_status = 'refunded', updated_at = now()
  WHERE id = v_item.id
    AND item_status NOT IN ('refunded', 'cancelled');

  PERFORM public._restock_cancelled_order_items(v_order.id, v_item.id);

  UPDATE public.refunds
  SET
    refund_status = 'approved',
    return_received_at = COALESCE(return_received_at, now()),
    approved_at = COALESCE(approved_at, now()),
    approved_by = v_actor,
    detailed_reason = COALESCE(NULLIF(trim(COALESCE(p_note, '')), ''), detailed_reason),
    updated_at = now()
  WHERE id = v_refund.id
  RETURNING * INTO v_refund;

  PERFORM public._enqueue_gateway_refund(v_refund.id);

  BEGIN
    PERFORM public.update_sales_analytics_return_status(
      p_order_item_id := v_item.id,
      p_is_returned := true,
      p_return_reason := COALESCE(v_refund.detailed_reason, v_refund.refund_reason)
    );
    PERFORM public.update_sales_analytics_refund_status(
      p_order_item_id := v_item.id,
      p_refund_amount := v_refund.refund_amount,
      p_refund_status := 'approved'
    );
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  UPDATE public.order_issues
  SET
    status = 'resolved',
    resolution_action = 'return_received',
    resolution_note = COALESCE(NULLIF(trim(COALESCE(p_note, '')), ''), resolution_note),
    resolved_at = COALESCE(resolved_at, now()),
    updated_at = now()
  WHERE id = v_issue.id;

  PERFORM public._marketplace_append_issue_event(
    v_issue.id, v_actor, 'return_received',
    NULLIF(trim(COALESCE(p_note, '')), ''),
    jsonb_build_object('refund_id', v_refund.id, 'refund_amount', v_refund.refund_amount)
  );

  IF NOT EXISTS (
    SELECT 1 FROM public.order_items oi
    WHERE oi.order_id = v_order.id
      AND oi.item_status NOT IN ('cancelled', 'refunded', 'returned')
      AND oi.exchanged_from_item_id IS NULL
  ) THEN
    UPDATE public.orders
    SET order_status = 'refunded', updated_at = now()
    WHERE id = v_order.id
      AND order_status NOT IN ('cancelled', 'refunded');
  END IF;

  v_amount := trim(to_char(v_refund.refund_amount, 'FM999999990.00')) || ' ' || COALESCE(v_order.currency, 'INR');
  SELECT COALESCE(NULLIF(full_name, ''), username, 'there') INTO v_buyer_name
  FROM public.profiles WHERE id = v_order.user_id;

  BEGIN
    PERFORM public.create_notification_from_template(
      p_template_key := 'order_refund_pending_buyer',
      p_recipient_id := v_order.user_id,
      p_variables := jsonb_build_object(
        'buyer_name', v_buyer_name,
        'product_name', COALESCE(v_item.product_title, 'your item'),
        'order_number', v_order.order_number,
        'refund_amount', v_amount,
        'action_url', v_app_base || '/orders/' || v_order.id::text
      ),
      p_context_type := 'order',
      p_context_id := v_order.id::text
    );
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  RETURN jsonb_build_object(
    'refund_id', v_refund.id,
    'refund_status', v_refund.refund_status,
    'refund_amount', v_refund.refund_amount
  );
END;
$$;

REVOKE ALL ON FUNCTION public._confirm_order_return_received(uuid, uuid, text) FROM PUBLIC;

-- Public RPC: authenticate + access-check, then delegate to the core.
CREATE OR REPLACE FUNCTION public.confirm_order_return_received(
  p_order_item_id uuid,
  p_note text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_item public.order_items%ROWTYPE;
  v_shop public.shops%ROWTYPE;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_item FROM public.order_items WHERE id = p_order_item_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order item not found';
  END IF;

  SELECT * INTO v_shop FROM public.shops WHERE id = v_item.vendor_id;
  IF v_shop.user_id <> v_user_id AND NOT public._marketplace_is_admin(v_user_id) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  RETURN public._confirm_order_return_received(p_order_item_id, v_user_id, p_note);
END;
$$;

REVOKE ALL ON FUNCTION public.confirm_order_return_received(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.confirm_order_return_received(uuid, text) TO authenticated;

-- ---------------------------------------------------------------------------
-- 4. Reverse leg delivered → auto-confirm (refund / replacement)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_return_leg_delivered(p_delivery_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_delivery public.order_delivery%ROWTYPE;
  v_item public.order_items%ROWTYPE;
  v_shop public.shops%ROWTYPE;
BEGIN
  SELECT * INTO v_delivery FROM public.order_delivery WHERE id = p_delivery_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('skipped', true, 'reason', 'not_found');
  END IF;

  IF lower(COALESCE(v_delivery.delivery_mode::text, '')) <> 'return'
     AND COALESCE(v_delivery.delivery_metadata->>'leg', '') <> 'return' THEN
    RETURN jsonb_build_object('skipped', true, 'reason', 'not_return_leg');
  END IF;

  IF v_delivery.delivery_status IS DISTINCT FROM 'delivered'::public.delivery_status_enum THEN
    RETURN jsonb_build_object('skipped', true, 'reason', 'not_delivered');
  END IF;

  IF v_delivery.order_item_id IS NULL THEN
    RETURN jsonb_build_object('skipped', true, 'reason', 'no_item');
  END IF;

  SELECT * INTO v_item FROM public.order_items WHERE id = v_delivery.order_item_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('skipped', true, 'reason', 'item_gone');
  END IF;

  SELECT * INTO v_shop FROM public.shops WHERE id = v_item.vendor_id;

  BEGIN
    RETURN public._confirm_order_return_received(
      v_delivery.order_item_id,
      v_shop.user_id,
      'Auto-confirmed: return delivered back to seller'
    );
  EXCEPTION WHEN OTHERS THEN
    -- Never let auto-confirm abort the delivery status update.
    RETURN jsonb_build_object('skipped', true, 'reason', 'confirm_failed');
  END;
END;
$$;

REVOKE ALL ON FUNCTION public.handle_return_leg_delivered(uuid) FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.trigger_handle_return_leg_delivered()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.delivery_status = 'delivered'::public.delivery_status_enum
     AND (lower(COALESCE(NEW.delivery_mode::text, '')) = 'return'
          OR COALESCE(NEW.delivery_metadata->>'leg', '') = 'return')
     AND (TG_OP = 'INSERT' OR OLD.delivery_status IS DISTINCT FROM NEW.delivery_status) THEN
    PERFORM public.handle_return_leg_delivered(NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_handle_return_leg_delivered ON public.order_delivery;
CREATE TRIGGER trigger_handle_return_leg_delivered
  AFTER INSERT OR UPDATE OF delivery_status ON public.order_delivery
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_handle_return_leg_delivered();
