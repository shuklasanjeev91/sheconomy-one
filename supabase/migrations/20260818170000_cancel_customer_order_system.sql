-- ─────────────────────────────────────────────────────────────────────────────
-- Cancel order system
--
-- 1. Shared helper that cancels an unpaid checkout group (stock, cart, orders).
-- 2. cancel_customer_order(order_id) — buyer instant-cancel for unpaid orders.
-- 3. Hardened resolve_order_issue_request — restock + processing refunds on
--    accepted cancellation_request.
-- ─────────────────────────────────────────────────────────────────────────────

-- Shared unpaid-checkout cancel body used by cancel_checkout_payment and
-- cancel_customer_order. Caller must already have locked the group row and
-- verified ownership / unpaid status.
CREATE OR REPLACE FUNCTION public._cancel_unpaid_checkout_group(p_group_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_group public.commerce_checkout_groups%ROWTYPE;
BEGIN
  SELECT * INTO v_group
  FROM public.commerce_checkout_groups
  WHERE id = p_group_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Checkout not found';
  END IF;

  IF v_group.status IN ('paid', 'cancelled') THEN
    RAISE EXCEPTION 'Checkout cannot be cancelled';
  END IF;

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

  UPDATE public.order_items
  SET item_status = 'cancelled', updated_at = now()
  WHERE order_id = ANY(v_group.order_ids)
    AND item_status NOT IN ('cancelled', 'refunded', 'shipped', 'delivered', 'completed');

  UPDATE public.orders
  SET order_status = 'cancelled', updated_at = now()
  WHERE id = ANY(v_group.order_ids)
    AND order_status IN ('pending', 'awaiting_payment', 'payment_failed');

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

REVOKE ALL ON FUNCTION public._cancel_unpaid_checkout_group(uuid) FROM PUBLIC;

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
  RETURN public._cancel_unpaid_checkout_group(v_group.id);
END;
$$;

REVOKE ALL ON FUNCTION public.cancel_checkout_payment(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cancel_checkout_payment(uuid) TO authenticated;

-- Restock listings/variations for cancelled order items (paid cancel path).
-- Does not touch inventory_reservations — paid checkouts convert reservations;
-- unpaid cancels go through _cancel_unpaid_checkout_group instead.
CREATE OR REPLACE FUNCTION public._restock_cancelled_order_items(p_order_id uuid, p_order_item_id uuid DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r record;
  v_variant uuid;
BEGIN
  FOR r IN
    SELECT oi.id, oi.listing_id, oi.quantity, oi.variation_details
    FROM public.order_items oi
    WHERE oi.order_id = p_order_id
      AND (p_order_item_id IS NULL OR oi.id = p_order_item_id)
      AND oi.item_status IN ('cancelled', 'refunded')
  LOOP
    IF r.listing_id IS NOT NULL THEN
      UPDATE public.listings
      SET quantity = CASE WHEN quantity IS NULL THEN NULL ELSE quantity + r.quantity END,
          updated_at = now()
      WHERE id = r.listing_id;
    END IF;

    v_variant := NULL;
    IF r.variation_details IS NOT NULL AND jsonb_typeof(r.variation_details) = 'object' THEN
      BEGIN
        v_variant := NULLIF(r.variation_details ->> 'variant_id', '')::uuid;
      EXCEPTION WHEN others THEN
        v_variant := NULL;
      END;
    END IF;

    IF v_variant IS NOT NULL THEN
      UPDATE public.listing_variations
      SET stock = CASE WHEN stock IS NULL THEN NULL ELSE stock + r.quantity END,
          updated_at = now()
      WHERE id = v_variant;
    END IF;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public._restock_cancelled_order_items(uuid, uuid) FROM PUBLIC;

-- Buyer-facing instant cancel for unpaid / awaiting_payment orders.
CREATE OR REPLACE FUNCTION public.cancel_customer_order(p_order_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_order public.orders%ROWTYPE;
  v_payment public.order_payments%ROWTYPE;
  v_group_id uuid;
  v_is_admin boolean;
  v_result jsonb;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found';
  END IF;

  v_is_admin := public._marketplace_is_admin(v_user_id);
  IF NOT v_is_admin AND v_order.user_id <> v_user_id THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  IF v_order.order_status IN ('cancelled', 'refunded', 'completed') THEN
    RAISE EXCEPTION 'This order can no longer be cancelled';
  END IF;

  IF v_order.order_status NOT IN ('pending', 'awaiting_payment', 'payment_failed') THEN
    RAISE EXCEPTION 'Instant cancel is only available before payment is confirmed. Request cancellation instead.';
  END IF;

  SELECT * INTO v_payment
  FROM public.order_payments
  WHERE order_id = p_order_id
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_payment.id IS NOT NULL
     AND v_payment.payment_status IN ('completed', 'refunded') THEN
    RAISE EXCEPTION 'This order is already paid. Request cancellation instead.';
  END IF;

  -- Prefer cancelling via the unpaid checkout group (releases stock + restores cart).
  SELECT g.id INTO v_group_id
  FROM public.commerce_checkout_payment_steps ps
  JOIN public.commerce_checkout_groups g ON g.id = ps.checkout_group_id
  WHERE ps.order_id = p_order_id
    AND g.status NOT IN ('paid', 'cancelled')
  ORDER BY ps.created_at DESC
  LIMIT 1;

  IF v_group_id IS NOT NULL THEN
    -- Ownership already checked on the order; lock group by id.
    PERFORM 1 FROM public.commerce_checkout_groups WHERE id = v_group_id FOR UPDATE;
    v_result := public._cancel_unpaid_checkout_group(v_group_id);
    RETURN jsonb_build_object(
      'order_id', p_order_id,
      'status', 'cancelled',
      'checkout_group_id', v_group_id
    );
  END IF;

  -- Standalone unpaid order (no checkout group).
  UPDATE public.order_items
  SET item_status = 'cancelled', updated_at = now()
  WHERE order_id = p_order_id
    AND item_status NOT IN ('cancelled', 'refunded');

  PERFORM public._restock_cancelled_order_items(p_order_id, NULL);

  UPDATE public.orders
  SET order_status = 'cancelled', updated_at = now()
  WHERE id = p_order_id;

  UPDATE public.order_payments
  SET payment_status = 'cancelled', updated_at = now()
  WHERE order_id = p_order_id
    AND payment_status IN ('pending', 'processing', 'failed');

  RETURN jsonb_build_object(
    'order_id', p_order_id,
    'status', 'cancelled',
    'checkout_group_id', null
  );
END;
$$;

REVOKE ALL ON FUNCTION public.cancel_customer_order(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cancel_customer_order(uuid) TO authenticated;

-- Hardened vendor/admin resolution: restock + processing refunds on accept.
CREATE OR REPLACE FUNCTION public.resolve_order_issue_request(
  p_issue_id uuid,
  p_decision text,
  p_resolution_note text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_issue public.order_issues%ROWTYPE;
  v_order public.orders%ROWTYPE;
  v_item public.order_items%ROWTYPE;
  v_shop public.shops%ROWTYPE;
  v_payment public.order_payments%ROWTYPE;
  v_decision text := lower(trim(COALESCE(p_decision, '')));
  v_is_admin boolean;
  v_note text := NULLIF(trim(COALESCE(p_resolution_note, '')), '');
  v_new_status text;
  v_action text;
  v_summary text;
  v_app_base text := COALESCE(
    NULLIF(current_setting('app.settings.public_app_url', true), ''),
    'https://sheconomy.in'
  );
  v_buyer_name text;
  v_label text;
  v_refund_item record;
  v_payment_captured boolean := false;
  v_all_cancelled boolean := false;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF v_decision NOT IN ('accept', 'reject') THEN
    RAISE EXCEPTION 'Decision must be accept or reject';
  END IF;

  SELECT * INTO v_issue FROM public.order_issues WHERE id = p_issue_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Issue not found';
  END IF;

  IF v_issue.issue_type NOT IN ('cancellation_request', 'return_request', 'refund_request') THEN
    RAISE EXCEPTION 'Only cancellation and return requests can be resolved here';
  END IF;

  IF v_issue.status NOT IN ('open', 'assigned', 'in_progress', 'waiting_customer', 'escalated') THEN
    RAISE EXCEPTION 'This request is no longer open';
  END IF;

  SELECT * INTO v_order FROM public.orders WHERE id = v_issue.order_id;
  SELECT * INTO v_item FROM public.order_items WHERE id = v_issue.order_item_id;
  IF v_item.id IS NOT NULL THEN
    SELECT * INTO v_shop FROM public.shops WHERE id = v_item.vendor_id;
  ELSE
    SELECT s.* INTO v_shop
    FROM public.order_items oi
    JOIN public.shops s ON s.id = oi.vendor_id
    WHERE oi.order_id = v_order.id
    LIMIT 1;
  END IF;

  v_is_admin := public._marketplace_is_admin(v_user_id);
  IF NOT v_is_admin AND (v_shop.user_id IS NULL OR v_shop.user_id <> v_user_id) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  SELECT * INTO v_payment
  FROM public.order_payments
  WHERE order_id = v_order.id
  ORDER BY created_at DESC
  LIMIT 1;

  v_payment_captured := v_payment.id IS NOT NULL
    AND v_payment.payment_status = 'completed'
    AND COALESCE(v_payment.payment_mode, '') NOT IN ('cod', 'cash_on_delivery');

  IF v_decision = 'accept' THEN
    v_new_status := 'resolved';
    v_action := 'accepted';
    IF v_issue.issue_type = 'cancellation_request' THEN
      v_summary := 'Your cancellation request was accepted.';

      UPDATE public.order_items
      SET item_status = 'cancelled', updated_at = now()
      WHERE order_id = v_order.id
        AND (v_issue.order_item_id IS NULL OR id = v_issue.order_item_id)
        AND item_status NOT IN ('cancelled', 'refunded');

      PERFORM public._restock_cancelled_order_items(v_order.id, v_issue.order_item_id);

      IF v_payment_captured THEN
        FOR v_refund_item IN
          SELECT oi.id, oi.total_price
          FROM public.order_items oi
          WHERE oi.order_id = v_order.id
            AND (v_issue.order_item_id IS NULL OR oi.id = v_issue.order_item_id)
            AND oi.item_status = 'cancelled'
            AND NOT EXISTS (
              SELECT 1 FROM public.refunds rf
              WHERE rf.order_item_id = oi.id
                AND rf.refund_status NOT IN ('rejected', 'cancelled')
            )
        LOOP
          INSERT INTO public.refunds (
            order_item_id,
            refund_amount,
            item_refund_amount,
            refund_reason,
            detailed_reason,
            initiated_by,
            approved_by,
            refund_status,
            approved_at,
            processed_at
          ) VALUES (
            v_refund_item.id,
            COALESCE(v_refund_item.total_price, 0),
            COALESCE(v_refund_item.total_price, 0),
            'order_cancellation',
            COALESCE(v_note, v_issue.description, 'Cancellation approved'),
            v_user_id,
            v_user_id,
            'processing'::refund_status_enum,
            now(),
            now()
          );

          BEGIN
            PERFORM public.update_sales_analytics_refund_status(
              p_order_item_id := v_refund_item.id,
              p_refund_amount := COALESCE(v_refund_item.total_price, 0),
              p_refund_status := 'processing'
            );
          EXCEPTION WHEN OTHERS THEN
            NULL;
          END;
        END LOOP;
      END IF;

      SELECT NOT EXISTS (
        SELECT 1 FROM public.order_items oi
        WHERE oi.order_id = v_order.id
          AND oi.item_status NOT IN ('cancelled', 'refunded')
      ) INTO v_all_cancelled;

      IF v_all_cancelled THEN
        UPDATE public.orders
        SET order_status = 'cancelled', updated_at = now()
        WHERE id = v_order.id;

        IF v_payment_captured THEN
          UPDATE public.order_payments
          SET payment_status = 'refunded', updated_at = now()
          WHERE order_id = v_order.id
            AND payment_status = 'completed';
        ELSIF v_payment.id IS NOT NULL AND v_payment.payment_status IN ('pending', 'processing') THEN
          UPDATE public.order_payments
          SET payment_status = 'cancelled', updated_at = now()
          WHERE id = v_payment.id;
        END IF;
      END IF;
    ELSE
      v_summary := 'Your return request was accepted. Ship the item back using the instructions from the shop.';
      UPDATE public.refunds
      SET refund_status = 'processing', updated_at = now()
      WHERE order_item_id = v_issue.order_item_id
        AND refund_status = 'requested';
      BEGIN
        PERFORM public.update_sales_analytics_refund_status(
          p_order_item_id := v_issue.order_item_id,
          p_refund_amount := COALESCE(v_item.total_price, 0),
          p_refund_status := 'processing'
        );
      EXCEPTION WHEN OTHERS THEN
        NULL;
      END;
    END IF;
  ELSE
    v_new_status := 'closed';
    v_action := 'rejected';
    v_summary := CASE
      WHEN v_issue.issue_type = 'cancellation_request' THEN 'Your cancellation request was declined.'
      ELSE 'Your return request was declined.'
    END;
    IF v_issue.issue_type IN ('return_request', 'refund_request') THEN
      UPDATE public.refunds
      SET refund_status = 'rejected', updated_at = now(), detailed_reason = COALESCE(v_note, detailed_reason)
      WHERE order_item_id = v_issue.order_item_id
        AND refund_status IN ('requested', 'processing');
      BEGIN
        PERFORM public.update_sales_analytics_refund_status(
          p_order_item_id := v_issue.order_item_id,
          p_refund_amount := COALESCE(v_item.total_price, 0),
          p_refund_status := 'rejected'
        );
      EXCEPTION WHEN OTHERS THEN
        NULL;
      END;
    END IF;
  END IF;

  UPDATE public.order_issues
  SET
    status = v_new_status,
    resolution_action = v_action,
    resolution_note = v_note,
    resolved_at = CASE WHEN v_new_status = 'resolved' THEN now() ELSE resolved_at END,
    closed_at = CASE WHEN v_new_status = 'closed' THEN now() ELSE closed_at END,
    assigned_to = COALESCE(assigned_to, v_user_id),
    updated_at = now()
  WHERE id = v_issue.id
  RETURNING * INTO v_issue;

  PERFORM public._marketplace_append_issue_event(
    v_issue.id,
    v_user_id,
    'request_' || v_action,
    v_note,
    jsonb_build_object('decision', v_decision)
  );

  v_label := replace(v_issue.issue_type, '_', ' ');
  SELECT COALESCE(NULLIF(full_name, ''), username, 'there') INTO v_buyer_name
  FROM public.profiles WHERE id = v_order.user_id;

  BEGIN
    PERFORM public.create_notification_from_template(
      p_template_key := 'order_issue_resolved_buyer',
      p_recipient_id := v_order.user_id,
      p_variables := jsonb_build_object(
        'buyer_name', v_buyer_name,
        'issue_label', v_label,
        'resolution_summary', v_summary || CASE WHEN v_note IS NULL THEN '' ELSE ' Note: ' || v_note END,
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
    'status', v_issue.status,
    'resolution_action', v_issue.resolution_action
  );
END;
$$;

REVOKE ALL ON FUNCTION public.resolve_order_issue_request(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resolve_order_issue_request(uuid, text, text) TO authenticated;
