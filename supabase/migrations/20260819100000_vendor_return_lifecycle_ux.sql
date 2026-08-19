-- Vendor-arranged return tracking + richer return/exchange lifecycle UX.
-- Stores return AWB on order_issues (not a reverse order_delivery row — the
-- outbound sync_order_item_status_from_delivery trigger would otherwise flip
-- item_status). Guards RTO/sync against delivery_mode = 'return' for later use.

-- ---------------------------------------------------------------------------
-- Schema
-- ---------------------------------------------------------------------------
ALTER TABLE public.order_issues
  ADD COLUMN IF NOT EXISTS return_shipping_mode text,
  ADD COLUMN IF NOT EXISTS return_assigned_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reject_reason_code text,
  ADD COLUMN IF NOT EXISTS return_tracking_url text;

COMMENT ON COLUMN public.order_issues.return_shipping_mode IS
  'buyer_self | vendor_arranged — who submitted the return AWB';

-- Skip outbound item/order sync for reverse legs if they are ever inserted.
CREATE OR REPLACE FUNCTION public.sync_order_item_status_from_delivery()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_mapped_status public.order_status_enum;
  v_mode text;
BEGIN
  v_mode := lower(COALESCE(NEW.delivery_mode::text, ''));
  IF v_mode = 'return' OR COALESCE(NEW.delivery_metadata->>'leg', '') = 'return' THEN
    RETURN NEW;
  END IF;

  IF NEW.delivery_status = 'pending'::public.delivery_status_enum THEN
    RETURN NEW;
  END IF;

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
    AND (NEW.order_item_id IS NULL OR id = NEW.order_item_id)
    AND item_status IS DISTINCT FROM v_mapped_status
    AND item_status NOT IN ('cancelled', 'refunded', 'returned');

  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- Notification templates
-- ---------------------------------------------------------------------------
INSERT INTO public.notification_templates (
  template_key, platform, category,
  title_template, message_template,
  email_subject_template, email_body_template,
  sms_template, push_title_template, push_body_template,
  whatsapp_template, action_url_template, default_channels, default_priority, is_active
) VALUES
(
  'order_return_pickup_assigned_buyer', 'marketplace', 'transactional',
  'Return pickup arranged',
  '{{shop_name}} arranged return pickup for {{product_name}}. AWB {{tracking_number}}.',
  'Return pickup arranged — order {{order_number}}',
  '<p>Hi {{buyer_name}},</p><p><strong>{{shop_name}}</strong> arranged return pickup for <strong>{{product_name}}</strong>.</p><p>Tracking: <strong>{{tracking_number}}</strong></p><p><a href="{{action_url}}">View order</a></p>',
  'Return pickup AWB {{tracking_number}} for order {{order_number}}.',
  'Return pickup arranged',
  '{{shop_name}} arranged pickup — AWB {{tracking_number}}',
  NULL, '{{action_url}}', ARRAY['in_app','push','email'], 4, true
),
(
  'order_return_request_cancelled_seller', 'marketplace', 'transactional',
  'Return / exchange cancelled',
  '{{buyer_name}} cancelled their {{issue_label}} for {{product_name}}.',
  'Request cancelled — order {{order_number}}',
  '<p>Hi {{seller_name}},</p><p><strong>{{buyer_name}}</strong> cancelled their {{issue_label}} for <strong>{{product_name}}</strong>.</p><p><a href="{{action_url}}">Open vendor orders</a></p>',
  NULL,
  'Request cancelled',
  '{{buyer_name}} cancelled a {{issue_label}}',
  NULL, '{{action_url}}', ARRAY['in_app','push'], 4, true
),
(
  'order_return_rejected_buyer', 'marketplace', 'transactional',
  'Request declined',
  'Your {{issue_label}} for {{product_name}} was declined ({{reject_reason}}).',
  'Request declined — order {{order_number}}',
  '<p>Hi {{buyer_name}},</p><p>Your {{issue_label}} for <strong>{{product_name}}</strong> was declined.</p><p>Reason: <strong>{{reject_reason}}</strong></p><p>{{resolution_note}}</p><p><a href="{{action_url}}">View order</a></p>',
  NULL,
  'Request declined',
  '{{issue_label}} declined: {{reject_reason}}',
  NULL, '{{action_url}}', ARRAY['in_app','push','email'], 4, true
)
ON CONFLICT (template_key) DO UPDATE SET
  title_template = EXCLUDED.title_template,
  message_template = EXCLUDED.message_template,
  email_subject_template = EXCLUDED.email_subject_template,
  email_body_template = EXCLUDED.email_body_template,
  sms_template = EXCLUDED.sms_template,
  push_title_template = EXCLUDED.push_title_template,
  push_body_template = EXCLUDED.push_body_template,
  action_url_template = EXCLUDED.action_url_template,
  is_active = true,
  updated_at = now();

-- ---------------------------------------------------------------------------
-- Harden RTO: never treat reverse legs as outbound RTO
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_delivery_rto(p_delivery_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_delivery public.order_delivery%ROWTYPE;
  v_item public.order_items%ROWTYPE;
  v_order public.orders%ROWTYPE;
  v_payment public.order_payments%ROWTYPE;
  v_refund public.refunds%ROWTYPE;
  v_payment_captured boolean := false;
  v_app_base text := COALESCE(
    NULLIF(current_setting('app.settings.public_app_url', true), ''),
    'https://sheconomy.in'
  );
  v_buyer_name text;
  v_amount text;
  v_items_processed integer := 0;
BEGIN
  SELECT * INTO v_delivery FROM public.order_delivery WHERE id = p_delivery_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Delivery not found';
  END IF;

  IF lower(COALESCE(v_delivery.delivery_mode::text, '')) = 'return'
     OR COALESCE(v_delivery.delivery_metadata->>'leg', '') = 'return' THEN
    RETURN jsonb_build_object('skipped', true, 'reason', 'return_leg');
  END IF;

  IF v_delivery.delivery_status IS DISTINCT FROM 'returned_to_sender'::delivery_status_enum THEN
    RETURN jsonb_build_object('skipped', true, 'reason', 'not_rto');
  END IF;

  SELECT * INTO v_order FROM public.orders WHERE id = v_delivery.order_id;
  SELECT * INTO v_payment
  FROM public.order_payments
  WHERE order_id = v_order.id
  ORDER BY created_at DESC
  LIMIT 1;

  v_payment_captured := v_payment.id IS NOT NULL
    AND v_payment.payment_status IN ('completed', 'refunded')
    AND COALESCE(v_payment.payment_mode::text, '') NOT IN ('cod', 'cash_on_delivery');

  FOR v_item IN
    SELECT oi.*
    FROM public.order_items oi
    WHERE oi.order_id = v_delivery.order_id
      AND (v_delivery.order_item_id IS NULL OR oi.id = v_delivery.order_item_id)
      AND oi.item_status NOT IN ('cancelled', 'refunded')
      AND oi.exchanged_from_item_id IS NULL
      AND NOT EXISTS (
        SELECT 1 FROM public.refunds rf
        WHERE rf.order_item_id = oi.id
          AND rf.refund_status IN ('requested', 'processing', 'approved', 'completed')
      )
  LOOP
    UPDATE public.order_items
    SET item_status = 'returned', updated_at = now()
    WHERE id = v_item.id;

    PERFORM public._restock_cancelled_order_items(v_order.id, v_item.id);

    IF v_payment_captured OR (
      v_payment.id IS NOT NULL
      AND COALESCE(v_payment.payment_mode::text, '') IN ('cod', 'cash_on_delivery')
    ) THEN
      INSERT INTO public.refunds (
        order_item_id, initiated_by, refund_reason, detailed_reason,
        refund_amount, item_refund_amount, refund_status, refund_method,
        refund_kind, approved_at, processed_at, approved_by
      ) VALUES (
        v_item.id,
        COALESCE(v_order.user_id, v_item.vendor_id),
        'rto',
        'Package returned to sender (RTO)',
        COALESCE(v_item.total_price, 0),
        COALESCE(v_item.total_price, 0),
        'approved'::refund_status_enum,
        'original_payment',
        'rto',
        now(), now(),
        COALESCE(v_order.user_id, v_item.vendor_id)
      )
      RETURNING * INTO v_refund;

      IF v_payment_captured THEN
        PERFORM public._enqueue_gateway_refund(v_refund.id);
      END IF;

      v_items_processed := v_items_processed + 1;
    END IF;
  END LOOP;

  UPDATE public.orders
  SET order_status = 'returned', updated_at = now()
  WHERE id = v_order.id
    AND NOT EXISTS (
      SELECT 1 FROM public.order_items oi
      WHERE oi.order_id = v_order.id
        AND oi.item_status NOT IN ('cancelled', 'refunded', 'returned')
        AND oi.exchanged_from_item_id IS NULL
    );

  SELECT COALESCE(NULLIF(full_name, ''), username, 'there') INTO v_buyer_name
  FROM public.profiles WHERE id = v_order.user_id;
  v_amount := to_char(COALESCE(v_refund.refund_amount, 0), 'FM999999990.00');

  IF v_items_processed > 0 AND v_order.user_id IS NOT NULL THEN
    BEGIN
      PERFORM public.create_notification_from_template(
        p_template_key := 'order_rto_completed_buyer',
        p_recipient_id := v_order.user_id,
        p_variables := jsonb_build_object(
          'buyer_name', v_buyer_name,
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
  END IF;

  RETURN jsonb_build_object(
    'delivery_id', p_delivery_id,
    'items_processed', v_items_processed
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- Buyer submit_return_tracking — buyer_self mode; block if vendor_arranged
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
DECLARE
  v_user_id uuid := auth.uid();
  v_item public.order_items%ROWTYPE;
  v_order public.orders%ROWTYPE;
  v_shop public.shops%ROWTYPE;
  v_issue public.order_issues%ROWTYPE;
  v_refund public.refunds%ROWTYPE;
  v_tracking text := upper(trim(COALESCE(p_tracking_number, '')));
  v_courier text := NULLIF(trim(COALESCE(p_courier_slug, '')), '');
  v_app_base text := COALESCE(
    NULLIF(current_setting('app.settings.public_app_url', true), ''),
    'https://sheconomy.in'
  );
  v_buyer_name text;
  v_seller_name text;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF char_length(v_tracking) < 5 THEN
    RAISE EXCEPTION 'Enter a valid tracking / AWB number';
  END IF;

  SELECT * INTO v_item FROM public.order_items WHERE id = p_order_item_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order item not found';
  END IF;

  SELECT * INTO v_order FROM public.orders WHERE id = v_item.order_id;
  IF NOT FOUND OR v_order.user_id <> v_user_id THEN
    RAISE EXCEPTION 'Order not found or access denied';
  END IF;

  SELECT * INTO v_issue
  FROM public.order_issues
  WHERE order_item_id = v_item.id
    AND issue_type IN ('return_request', 'exchange_request', 'refund_request')
    AND (
      (status = 'resolved' AND resolution_action = 'accepted')
      OR status IN ('waiting_customer', 'in_progress')
    )
  ORDER BY created_at DESC
  LIMIT 1
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No approved return or exchange is waiting for a tracking number';
  END IF;

  IF v_issue.return_shipping_mode = 'vendor_arranged' OR v_issue.return_tracking_number IS NOT NULL THEN
    RAISE EXCEPTION 'Return tracking was already submitted for this request';
  END IF;

  UPDATE public.order_issues
  SET
    return_tracking_number = v_tracking,
    return_shipped_at = now(),
    return_courier_slug = v_courier,
    return_shipping_mode = 'buyer_self',
    return_assigned_by = v_user_id,
    status = CASE WHEN status = 'resolved' THEN status ELSE 'waiting_customer' END,
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

  PERFORM public._marketplace_append_issue_event(
    v_issue.id, v_user_id, 'return_shipped',
    'Tracking ' || v_tracking,
    jsonb_build_object(
      'tracking_number', v_tracking,
      'courier_slug', v_courier,
      'return_shipping_mode', 'buyer_self'
    )
  );

  SELECT * INTO v_shop FROM public.shops WHERE id = v_item.vendor_id;
  SELECT COALESCE(NULLIF(full_name, ''), username, 'A buyer') INTO v_buyer_name
  FROM public.profiles WHERE id = v_user_id;
  SELECT COALESCE(NULLIF(full_name, ''), username, 'Seller') INTO v_seller_name
  FROM public.profiles WHERE id = v_shop.user_id;

  IF v_shop.user_id IS NOT NULL THEN
    BEGIN
      PERFORM public.create_notification_from_template(
        p_template_key := 'order_return_tracking_seller',
        p_recipient_id := v_shop.user_id,
        p_variables := jsonb_build_object(
          'buyer_name', v_buyer_name,
          'seller_name', v_seller_name,
          'product_name', COALESCE(v_item.product_title, 'an item'),
          'order_number', v_order.order_number,
          'tracking_number', v_tracking,
          'action_url', v_app_base || '/vendor/orders'
        ),
        p_context_type := 'order',
        p_context_id := v_order.id::text
      );
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END IF;

  RETURN jsonb_build_object(
    'issue_id', v_issue.id,
    'tracking_number', v_tracking,
    'refund_id', v_refund.id,
    'return_shipping_mode', 'buyer_self'
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- Vendor assign_return_tracking
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.assign_return_tracking(
  p_order_item_id uuid,
  p_tracking_number text,
  p_courier_slug text DEFAULT NULL,
  p_custom_tracking_url text DEFAULT NULL
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
  v_is_admin boolean;
  v_app_base text := COALESCE(
    NULLIF(current_setting('app.settings.public_app_url', true), ''),
    'https://sheconomy.in'
  );
  v_buyer_name text;
  v_shop_name text;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF char_length(v_tracking) < 5 THEN
    RAISE EXCEPTION 'Enter a valid tracking / AWB number';
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
    return_shipping_mode = 'vendor_arranged',
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

  PERFORM public._marketplace_append_issue_event(
    v_issue.id, v_user_id, 'return_pickup_assigned',
    'Vendor assigned tracking ' || v_tracking,
    jsonb_build_object(
      'tracking_number', v_tracking,
      'courier_slug', v_courier,
      'tracking_url', v_url,
      'return_shipping_mode', 'vendor_arranged'
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
    'return_shipping_mode', 'vendor_arranged'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.assign_return_tracking(uuid, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.assign_return_tracking(uuid, text, text, text) TO authenticated;

-- ---------------------------------------------------------------------------
-- Buyer cancel_order_return_request
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.cancel_order_return_request(
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
  v_order public.orders%ROWTYPE;
  v_shop public.shops%ROWTYPE;
  v_issue public.order_issues%ROWTYPE;
  v_note text := NULLIF(trim(COALESCE(p_note, '')), '');
  v_app_base text := COALESCE(
    NULLIF(current_setting('app.settings.public_app_url', true), ''),
    'https://sheconomy.in'
  );
  v_buyer_name text;
  v_seller_name text;
  v_label text;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_item FROM public.order_items WHERE id = p_order_item_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order item not found';
  END IF;

  SELECT * INTO v_order FROM public.orders WHERE id = v_item.order_id;
  IF NOT FOUND OR v_order.user_id <> v_user_id THEN
    RAISE EXCEPTION 'Order not found or access denied';
  END IF;

  SELECT * INTO v_issue
  FROM public.order_issues
  WHERE order_item_id = v_item.id
    AND issue_type IN ('return_request', 'exchange_request', 'refund_request')
    AND (
      status IN ('open', 'assigned', 'in_progress', 'waiting_customer', 'escalated')
      OR (status = 'resolved' AND resolution_action = 'accepted')
    )
    AND COALESCE(resolution_action, '') NOT IN ('return_received', 'exchange_ready_to_ship', 'rejected', 'cancelled_by_buyer')
  ORDER BY created_at DESC
  LIMIT 1
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No open return or exchange request to cancel';
  END IF;

  IF v_issue.return_tracking_number IS NOT NULL THEN
    RAISE EXCEPTION 'Cannot cancel after return tracking has been assigned';
  END IF;

  UPDATE public.order_issues
  SET
    status = 'closed',
    resolution_action = 'cancelled_by_buyer',
    resolution_note = COALESCE(v_note, resolution_note),
    closed_at = now(),
    updated_at = now()
  WHERE id = v_issue.id
  RETURNING * INTO v_issue;

  UPDATE public.refunds
  SET
    refund_status = 'cancelled',
    updated_at = now(),
    detailed_reason = COALESCE(v_note, detailed_reason)
  WHERE order_item_id = v_item.id
    AND refund_status IN ('requested', 'processing');

  PERFORM public._marketplace_append_issue_event(
    v_issue.id, v_user_id, 'request_cancelled_by_buyer', v_note,
    jsonb_build_object('issue_type', v_issue.issue_type)
  );

  SELECT * INTO v_shop FROM public.shops WHERE id = v_item.vendor_id;
  SELECT COALESCE(NULLIF(full_name, ''), username, 'A buyer') INTO v_buyer_name
  FROM public.profiles WHERE id = v_user_id;
  SELECT COALESCE(NULLIF(full_name, ''), username, 'Seller') INTO v_seller_name
  FROM public.profiles WHERE id = v_shop.user_id;
  v_label := replace(v_issue.issue_type, '_', ' ');

  IF v_shop.user_id IS NOT NULL THEN
    BEGIN
      PERFORM public.create_notification_from_template(
        p_template_key := 'order_return_request_cancelled_seller',
        p_recipient_id := v_shop.user_id,
        p_variables := jsonb_build_object(
          'buyer_name', v_buyer_name,
          'seller_name', v_seller_name,
          'product_name', COALESCE(v_item.product_title, 'an item'),
          'issue_label', v_label,
          'order_number', v_order.order_number,
          'action_url', v_app_base || '/vendor/orders'
        ),
        p_context_type := 'order',
        p_context_id := v_order.id::text
      );
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END IF;

  RETURN jsonb_build_object(
    'issue_id', v_issue.id,
    'status', v_issue.status,
    'resolution_action', v_issue.resolution_action
  );
END;
$$;

REVOKE ALL ON FUNCTION public.cancel_order_return_request(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cancel_order_return_request(uuid, text) TO authenticated;

-- ---------------------------------------------------------------------------
-- resolve_order_issue_request — require reject_reason_code on reject
-- Drop prior overloads so a single 4-arg function (with defaults) remains.
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.resolve_order_issue_request(uuid, text, text);
DROP FUNCTION IF EXISTS public.resolve_order_issue_request(uuid, text, text, text);

CREATE OR REPLACE FUNCTION public.resolve_order_issue_request(
  p_issue_id uuid,
  p_decision text,
  p_resolution_note text DEFAULT NULL,
  p_reject_reason_code text DEFAULT NULL
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
  v_reject_code text := lower(NULLIF(trim(COALESCE(p_reject_reason_code, '')), ''));
  v_reject_label text;
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
  v_refund_id uuid;
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

  IF v_issue.issue_type NOT IN (
    'cancellation_request', 'return_request', 'refund_request', 'exchange_request'
  ) THEN
    RAISE EXCEPTION 'Only cancellation, return, refund, and exchange requests can be resolved here';
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

  IF v_decision = 'reject'
     AND v_issue.issue_type IN ('return_request', 'exchange_request', 'refund_request') THEN
    IF v_reject_code IS NULL OR v_reject_code NOT IN (
      'out_of_window', 'not_eligible', 'used_damaged', 'wrong_item_claimed', 'policy', 'other'
    ) THEN
      RAISE EXCEPTION 'Select a reject reason';
    END IF;
  END IF;

  v_reject_label := CASE v_reject_code
    WHEN 'out_of_window' THEN 'Outside return window'
    WHEN 'not_eligible' THEN 'Item not eligible'
    WHEN 'used_damaged' THEN 'Item used or damaged'
    WHEN 'wrong_item_claimed' THEN 'Claim does not match item'
    WHEN 'policy' THEN 'Against shop policy'
    WHEN 'other' THEN 'Other'
    ELSE NULL
  END;

  SELECT * INTO v_payment
  FROM public.order_payments
  WHERE order_id = v_order.id
  ORDER BY created_at DESC
  LIMIT 1;

  v_payment_captured := v_payment.id IS NOT NULL
    AND v_payment.payment_status = 'completed'
    AND COALESCE(v_payment.payment_mode::text, '') NOT IN ('cod', 'cash_on_delivery');

  IF v_decision = 'accept' THEN
    v_new_status := 'resolved';
    v_action := 'accepted';
    IF v_issue.issue_type = 'cancellation_request' THEN
      v_summary := 'Your cancellation request was accepted.';

      UPDATE public.order_items
      SET item_status = 'cancelled', updated_at = now()
      WHERE order_id = v_order.id
        AND (v_issue.order_item_id IS NULL OR id = v_issue.order_item_id)
        AND item_status NOT IN ('cancelled', 'refunded', 'returned');

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
            order_item_id, refund_amount, item_refund_amount, refund_reason,
            detailed_reason, initiated_by, approved_by, refund_status,
            approved_at, processed_at, refund_kind
          ) VALUES (
            v_refund_item.id,
            COALESCE(v_refund_item.total_price, 0),
            COALESCE(v_refund_item.total_price, 0),
            'order_cancellation',
            COALESCE(v_note, v_issue.description, 'Cancellation approved'),
            v_user_id, v_user_id,
            'approved'::refund_status_enum,
            now(), now(), 'cancellation'
          )
          RETURNING id INTO v_refund_id;

          PERFORM public._enqueue_gateway_refund(v_refund_id);

          BEGIN
            PERFORM public.update_sales_analytics_refund_status(
              p_order_item_id := v_refund_item.id,
              p_refund_amount := COALESCE(v_refund_item.total_price, 0),
              p_refund_status := 'approved'
            );
          EXCEPTION WHEN OTHERS THEN
            NULL;
          END;
        END LOOP;
      END IF;

      SELECT NOT EXISTS (
        SELECT 1 FROM public.order_items oi
        WHERE oi.order_id = v_order.id
          AND oi.item_status NOT IN ('cancelled', 'refunded', 'returned')
      ) INTO v_all_cancelled;

      IF v_all_cancelled THEN
        UPDATE public.orders
        SET order_status = 'cancelled', updated_at = now()
        WHERE id = v_order.id;

        IF v_payment_captured THEN
          UPDATE public.order_payments
          SET payment_status = 'refunded', updated_at = now()
          WHERE order_id = v_order.id AND payment_status = 'completed';
        ELSIF v_payment.id IS NOT NULL AND v_payment.payment_status IN ('pending', 'processing') THEN
          UPDATE public.order_payments
          SET payment_status = 'cancelled', updated_at = now()
          WHERE id = v_payment.id;
        END IF;
      END IF;
    ELSIF v_issue.issue_type = 'exchange_request' THEN
      v_summary := 'Your exchange was accepted. The shop will arrange return pickup, or you can add tracking yourself.';
      UPDATE public.order_issues
      SET status = 'waiting_customer', updated_at = now()
      WHERE id = v_issue.id;
      v_new_status := 'waiting_customer';
    ELSE
      v_summary := 'Your return request was accepted. The shop will arrange return pickup, or you can add tracking yourself.';
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
      WHEN v_issue.issue_type = 'exchange_request' THEN 'Your exchange request was declined.'
      ELSE 'Your return request was declined.'
    END;
    IF v_reject_label IS NOT NULL THEN
      v_summary := v_summary || ' Reason: ' || v_reject_label || '.';
    END IF;
    IF v_issue.issue_type IN ('return_request', 'refund_request') THEN
      UPDATE public.refunds
      SET refund_status = 'rejected', updated_at = now(),
          detailed_reason = COALESCE(v_note, detailed_reason)
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
    reject_reason_code = CASE WHEN v_decision = 'reject' THEN v_reject_code ELSE reject_reason_code END,
    resolved_at = CASE WHEN v_new_status IN ('resolved', 'waiting_customer') AND v_action = 'accepted'
      THEN COALESCE(resolved_at, now()) ELSE resolved_at END,
    closed_at = CASE WHEN v_new_status = 'closed' THEN now() ELSE closed_at END,
    assigned_to = COALESCE(assigned_to, v_user_id),
    updated_at = now()
  WHERE id = v_issue.id
  RETURNING * INTO v_issue;

  PERFORM public._marketplace_append_issue_event(
    v_issue.id, v_user_id, 'request_' || v_action, v_note,
    jsonb_build_object(
      'decision', v_decision,
      'reject_reason_code', v_reject_code
    )
  );

  v_label := replace(v_issue.issue_type, '_', ' ');
  SELECT COALESCE(NULLIF(full_name, ''), username, 'there') INTO v_buyer_name
  FROM public.profiles WHERE id = v_order.user_id;

  BEGIN
    IF v_decision = 'reject' AND v_issue.issue_type IN ('return_request', 'exchange_request', 'refund_request') THEN
      PERFORM public.create_notification_from_template(
        p_template_key := 'order_return_rejected_buyer',
        p_recipient_id := v_order.user_id,
        p_variables := jsonb_build_object(
          'buyer_name', v_buyer_name,
          'issue_label', v_label,
          'product_name', COALESCE(v_item.product_title, 'your item'),
          'reject_reason', COALESCE(v_reject_label, 'Declined'),
          'resolution_note', COALESCE(v_note, ''),
          'order_number', v_order.order_number,
          'action_url', v_app_base || '/orders/' || v_order.id::text
        ),
        p_context_type := 'order',
        p_context_id := v_order.id::text
      );
    ELSE
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
    END IF;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  RETURN jsonb_build_object(
    'issue_id', v_issue.id,
    'status', v_issue.status,
    'resolution_action', v_issue.resolution_action,
    'reject_reason_code', v_issue.reject_reason_code
  );
END;
$$;

REVOKE ALL ON FUNCTION public.resolve_order_issue_request(uuid, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resolve_order_issue_request(uuid, text, text, text) TO authenticated;
