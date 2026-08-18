-- RTO / Return / Exchange / Refund completion.
-- Extends marketplace returns: buyer AWB, exchanges, RTO auto-refund, PayU enqueue.

-- ---------------------------------------------------------------------------
-- Schema
-- ---------------------------------------------------------------------------
ALTER TABLE public.refunds
  ADD COLUMN IF NOT EXISTS gateway_refund_request_id text,
  ADD COLUMN IF NOT EXISTS gateway_refund_status text,
  ADD COLUMN IF NOT EXISTS refund_kind text NOT NULL DEFAULT 'return';

ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS exchanged_from_item_id uuid
    REFERENCES public.order_items(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS order_items_exchanged_from_idx
  ON public.order_items (exchanged_from_item_id)
  WHERE exchanged_from_item_id IS NOT NULL;

ALTER TABLE public.order_issues
  ADD COLUMN IF NOT EXISTS return_tracking_number text,
  ADD COLUMN IF NOT EXISTS return_shipped_at timestamptz,
  ADD COLUMN IF NOT EXISTS return_courier_slug text;

-- Restock returned lines too (return / RTO / exchange).
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
      AND oi.item_status IN ('cancelled', 'refunded', 'returned')
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

-- Resolve listing/shop return policy for an order item.
CREATE OR REPLACE FUNCTION public._resolve_item_return_policy(p_order_item_id uuid)
RETURNS TABLE (
  accepts_returns boolean,
  accepts_exchanges boolean,
  accepts_refunds boolean,
  return_window_days integer
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item public.order_items%ROWTYPE;
  v_policy public.return_policies%ROWTYPE;
BEGIN
  SELECT * INTO v_item FROM public.order_items WHERE id = p_order_item_id;
  IF NOT FOUND THEN
    RETURN;
  END IF;

  IF v_item.listing_return_policy_id IS NOT NULL THEN
    SELECT * INTO v_policy FROM public.return_policies WHERE id = v_item.listing_return_policy_id AND is_active;
  END IF;

  IF v_policy.id IS NULL THEN
    SELECT rp.* INTO v_policy
    FROM public.listing_return_policies lrp
    JOIN public.return_policies rp ON rp.id = lrp.return_policy_id
    WHERE lrp.listing_id = v_item.listing_id
      AND rp.is_active
    LIMIT 1;
  END IF;

  IF v_policy.id IS NULL THEN
    SELECT * INTO v_policy
    FROM public.return_policies
    WHERE shop_id = v_item.vendor_id
      AND is_active
    ORDER BY is_default DESC, updated_at DESC
    LIMIT 1;
  END IF;

  IF v_policy.id IS NULL THEN
    accepts_returns := true;
    accepts_exchanges := true;
    accepts_refunds := true;
    return_window_days := 30;
    RETURN NEXT;
    RETURN;
  END IF;

  accepts_returns := v_policy.accepts_returns;
  accepts_exchanges := v_policy.accepts_exchanges;
  accepts_refunds := v_policy.accepts_refunds;
  return_window_days := COALESCE(v_policy.return_window_days, 30);
  RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION public._resolve_item_return_policy(uuid) FROM PUBLIC;

-- Delivered_at for return window (item delivery row, else order delivery).
CREATE OR REPLACE FUNCTION public._item_delivered_at(p_order_item_id uuid)
RETURNS timestamptz
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (
      SELECT od.delivered_at
      FROM public.order_delivery od
      WHERE od.order_item_id = p_order_item_id
        AND od.delivered_at IS NOT NULL
      ORDER BY od.delivered_at DESC
      LIMIT 1
    ),
    (
      SELECT od.delivered_at
      FROM public.order_items oi
      JOIN public.order_delivery od ON od.order_id = oi.order_id
      WHERE oi.id = p_order_item_id
        AND od.delivered_at IS NOT NULL
      ORDER BY od.delivered_at DESC
      LIMIT 1
    )
  );
$$;

REVOKE ALL ON FUNCTION public._item_delivered_at(uuid) FROM PUBLIC;

-- Enqueue PayU / gateway refund via edge function (best-effort).
CREATE OR REPLACE FUNCTION public._enqueue_gateway_refund(p_refund_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_secret text;
BEGIN
  IF p_refund_id IS NULL THEN
    RETURN;
  END IF;

  BEGIN
    SELECT decrypted_secret INTO v_secret
    FROM vault.decrypted_secrets
    WHERE name = 'notification_cron_secret'
    LIMIT 1;
  EXCEPTION WHEN OTHERS THEN
    v_secret := NULL;
  END;

  BEGIN
    PERFORM net.http_post(
      url := 'https://zsaqrrzwygzwrlzgymxk.supabase.co/functions/v1/process-refund',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-cron-secret', COALESCE(v_secret, '')
      ),
      body := jsonb_build_object('refund_id', p_refund_id)
    );
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
END;
$$;

REVOKE ALL ON FUNCTION public._enqueue_gateway_refund(uuid) FROM PUBLIC;

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
  'order_return_tracking_seller', 'marketplace', 'transactional',
  'Return shipped',
  '{{buyer_name}} shipped a return for {{product_name}} (AWB {{tracking_number}}).',
  'Return shipped — order {{order_number}}',
  '<p>Hi {{seller_name}},</p><p><strong>{{buyer_name}}</strong> shipped the return for <strong>{{product_name}}</strong>. Tracking: <strong>{{tracking_number}}</strong>.</p><p><a href="{{action_url}}">Open vendor orders</a></p>',
  'Return AWB {{tracking_number}} for order {{order_number}}',
  'Return shipped',
  '{{buyer_name}} shipped {{product_name}} back ({{tracking_number}})',
  NULL,
  '{{action_url}}',
  ARRAY['in_app', 'push', 'email'],
  4,
  true
),
(
  'order_exchange_requested_seller', 'marketplace', 'transactional',
  'Exchange requested',
  '{{buyer_name}} requested an exchange for {{product_name}}.',
  'Exchange request — order {{order_number}}',
  '<p>Hi {{seller_name}},</p><p><strong>{{buyer_name}}</strong> requested an exchange for <strong>{{product_name}}</strong>.</p><p>{{reason}}</p><p><a href="{{action_url}}">Review request</a></p>',
  'Exchange request on order {{order_number}}',
  'Exchange requested',
  '{{buyer_name}} wants to exchange {{product_name}}',
  NULL,
  '{{action_url}}',
  ARRAY['in_app', 'push', 'email'],
  4,
  true
),
(
  'order_exchange_ready_seller', 'marketplace', 'transactional',
  'Exchange ready to ship',
  'Return received for {{product_name}}. Ship the replacement.',
  'Ship exchange — order {{order_number}}',
  '<p>Hi {{seller_name}},</p><p>You confirmed the return for <strong>{{product_name}}</strong>. A replacement line is ready — add tracking when you ship it.</p><p><a href="{{action_url}}">Open vendor orders</a></p>',
  'Ship replacement for order {{order_number}}',
  'Ship exchange',
  'Replacement ready for {{product_name}}',
  NULL,
  '{{action_url}}',
  ARRAY['in_app', 'push', 'email'],
  4,
  true
),
(
  'order_rto_completed_buyer', 'marketplace', 'transactional',
  'Package returned to seller',
  'Your package for {{product_name}} was returned to the seller. A refund of {{refund_amount}} is being processed.',
  'RTO refund — order {{order_number}}',
  '<p>Hi {{buyer_name}},</p><p>Your package for <strong>{{product_name}}</strong> was returned to the seller. Refund: <strong>{{refund_amount}}</strong>.</p><p><a href="{{action_url}}">View order</a></p>',
  'RTO refund {{refund_amount}} for order {{order_number}}',
  'Package returned',
  'Refund {{refund_amount}} is processing for {{product_name}}',
  NULL,
  '{{action_url}}',
  ARRAY['in_app', 'push', 'email'],
  4,
  true
),
(
  'order_refund_completed_buyer', 'marketplace', 'transactional',
  'Refund completed',
  'Your refund of {{refund_amount}} for {{product_name}} is complete.',
  'Refund completed — order {{order_number}}',
  '<p>Hi {{buyer_name}},</p><p>Your refund of <strong>{{refund_amount}}</strong> for <strong>{{product_name}}</strong> is complete.</p><p><a href="{{action_url}}">View order</a></p>',
  'Refund {{refund_amount}} completed for order {{order_number}}',
  'Refund completed',
  '{{refund_amount}} refunded for {{product_name}}',
  NULL,
  '{{action_url}}',
  ARRAY['in_app', 'push', 'email'],
  4,
  true
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
  default_channels = EXCLUDED.default_channels,
  updated_at = now();

-- ---------------------------------------------------------------------------
-- Buyer: request return (policy + window hardened)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.request_order_return(
  p_order_item_id uuid,
  p_reason text,
  p_evidence_urls text[] DEFAULT ARRAY[]::text[],
  p_detailed_reason text DEFAULT NULL
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
  v_open_count integer;
  v_policy record;
  v_delivered_at timestamptz;
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

  IF char_length(trim(COALESCE(p_reason, ''))) < 10 THEN
    RAISE EXCEPTION 'Please describe why you want to return this item (at least 10 characters).';
  END IF;

  SELECT * INTO v_item FROM public.order_items WHERE id = p_order_item_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order item not found';
  END IF;

  SELECT * INTO v_order FROM public.orders WHERE id = v_item.order_id;
  IF NOT FOUND OR v_order.user_id <> v_user_id THEN
    RAISE EXCEPTION 'Order not found or access denied';
  END IF;

  IF v_item.item_status NOT IN ('delivered', 'completed')
     AND v_order.order_status NOT IN ('delivered', 'completed') THEN
    RAISE EXCEPTION 'Returns are only available after delivery';
  END IF;

  IF v_item.digital_download_url IS NOT NULL
     OR EXISTS (
       SELECT 1 FROM public.listings l
       WHERE l.id = v_item.listing_id
         AND l.listing_type::text IN ('digital', 'service')
     ) THEN
    RAISE EXCEPTION 'Digital purchases cannot be returned through this flow';
  END IF;

  SELECT * INTO v_policy FROM public._resolve_item_return_policy(v_item.id);
  IF NOT COALESCE(v_policy.accepts_returns, true) THEN
    RAISE EXCEPTION 'This shop does not accept returns for this item';
  END IF;

  v_delivered_at := public._item_delivered_at(v_item.id);
  IF v_delivered_at IS NULL THEN
    RAISE EXCEPTION 'Returns are only available after delivery';
  END IF;
  IF now() - v_delivered_at > make_interval(days => COALESCE(v_policy.return_window_days, 30)) THEN
    RAISE EXCEPTION 'The return window for this item has ended';
  END IF;

  SELECT count(*) INTO v_open_count
  FROM public.order_issues oi
  WHERE oi.order_item_id = v_item.id
    AND oi.issue_type IN ('return_request', 'refund_request', 'exchange_request')
    AND oi.status IN ('open', 'assigned', 'in_progress', 'waiting_customer', 'escalated', 'resolved');

  IF v_open_count > 0 THEN
    RAISE EXCEPTION 'A return, exchange, or refund request is already open for this item';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.refunds r
    WHERE r.order_item_id = v_item.id
      AND r.refund_status IN ('requested', 'processing', 'approved', 'completed')
  ) THEN
    RAISE EXCEPTION 'A refund is already in progress for this item';
  END IF;

  SELECT * INTO v_shop FROM public.shops WHERE id = v_item.vendor_id;

  INSERT INTO public.order_issues (
    order_id, order_item_id, issue_type, issue_title, description,
    reported_by, issue_priority, status, evidence_urls
  ) VALUES (
    v_order.id, v_item.id, 'return_request',
    'Return request for ' || COALESCE(v_item.product_title, 'item'),
    trim(p_reason), v_user_id, 'high', 'open',
    COALESCE(p_evidence_urls, ARRAY[]::text[])
  )
  RETURNING * INTO v_issue;

  PERFORM public._marketplace_append_issue_event(
    v_issue.id, v_user_id, 'return_requested', trim(p_reason),
    jsonb_build_object('evidence_count', coalesce(array_length(p_evidence_urls, 1), 0))
  );

  INSERT INTO public.refunds (
    order_item_id, initiated_by, refund_reason, detailed_reason,
    refund_amount, item_refund_amount, refund_status, refund_method, refund_kind
  ) VALUES (
    v_item.id, v_user_id, 'return_request',
    COALESCE(NULLIF(trim(p_detailed_reason), ''), trim(p_reason)),
    COALESCE(v_item.total_price, 0), COALESCE(v_item.total_price, 0),
    'requested', 'original_payment', 'return'
  )
  RETURNING * INTO v_refund;

  BEGIN
    PERFORM public.update_sales_analytics_return_status(
      p_order_item_id := v_item.id, p_is_returned := false, p_return_reason := trim(p_reason)
    );
    PERFORM public.update_sales_analytics_refund_status(
      p_order_item_id := v_item.id,
      p_refund_amount := COALESCE(v_item.total_price, 0),
      p_refund_status := 'requested'
    );
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  SELECT COALESCE(NULLIF(full_name, ''), username, 'A buyer') INTO v_buyer_name
  FROM public.profiles WHERE id = v_user_id;
  SELECT COALESCE(NULLIF(full_name, ''), username, 'Seller') INTO v_seller_name
  FROM public.profiles WHERE id = v_shop.user_id;

  IF v_shop.user_id IS NOT NULL THEN
    BEGIN
      PERFORM public.create_notification_from_template(
        p_template_key := 'order_return_requested_seller',
        p_recipient_id := v_shop.user_id,
        p_variables := jsonb_build_object(
          'buyer_name', v_buyer_name,
          'seller_name', v_seller_name,
          'product_name', COALESCE(v_item.product_title, 'an item'),
          'order_number', v_order.order_number,
          'reason', left(trim(p_reason), 240),
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
    'refund_id', v_refund.id,
    'status', 'open'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.request_order_return(uuid, text, text[], text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.request_order_return(uuid, text, text[], text) TO authenticated;

-- ---------------------------------------------------------------------------
-- Buyer: request exchange
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.request_order_exchange(
  p_order_item_id uuid,
  p_reason text,
  p_evidence_urls text[] DEFAULT ARRAY[]::text[],
  p_detailed_reason text DEFAULT NULL
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
  v_open_count integer;
  v_policy record;
  v_delivered_at timestamptz;
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

  IF char_length(trim(COALESCE(p_reason, ''))) < 10 THEN
    RAISE EXCEPTION 'Please describe why you want an exchange (at least 10 characters).';
  END IF;

  SELECT * INTO v_item FROM public.order_items WHERE id = p_order_item_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order item not found';
  END IF;

  SELECT * INTO v_order FROM public.orders WHERE id = v_item.order_id;
  IF NOT FOUND OR v_order.user_id <> v_user_id THEN
    RAISE EXCEPTION 'Order not found or access denied';
  END IF;

  IF v_item.item_status NOT IN ('delivered', 'completed')
     AND v_order.order_status NOT IN ('delivered', 'completed') THEN
    RAISE EXCEPTION 'Exchanges are only available after delivery';
  END IF;

  IF v_item.digital_download_url IS NOT NULL
     OR EXISTS (
       SELECT 1 FROM public.listings l
       WHERE l.id = v_item.listing_id
         AND l.listing_type::text IN ('digital', 'service')
     ) THEN
    RAISE EXCEPTION 'Digital purchases cannot be exchanged through this flow';
  END IF;

  SELECT * INTO v_policy FROM public._resolve_item_return_policy(v_item.id);
  IF NOT COALESCE(v_policy.accepts_exchanges, true) THEN
    RAISE EXCEPTION 'This shop does not accept exchanges for this item';
  END IF;

  v_delivered_at := public._item_delivered_at(v_item.id);
  IF v_delivered_at IS NULL THEN
    RAISE EXCEPTION 'Exchanges are only available after delivery';
  END IF;
  IF now() - v_delivered_at > make_interval(days => COALESCE(v_policy.return_window_days, 30)) THEN
    RAISE EXCEPTION 'The exchange window for this item has ended';
  END IF;

  SELECT count(*) INTO v_open_count
  FROM public.order_issues oi
  WHERE oi.order_item_id = v_item.id
    AND oi.issue_type IN ('return_request', 'refund_request', 'exchange_request')
    AND oi.status IN ('open', 'assigned', 'in_progress', 'waiting_customer', 'escalated', 'resolved');

  IF v_open_count > 0 THEN
    RAISE EXCEPTION 'A return, exchange, or refund request is already open for this item';
  END IF;

  SELECT * INTO v_shop FROM public.shops WHERE id = v_item.vendor_id;

  INSERT INTO public.order_issues (
    order_id, order_item_id, issue_type, issue_title, description,
    reported_by, issue_priority, status, evidence_urls
  ) VALUES (
    v_order.id, v_item.id, 'exchange_request',
    'Exchange request for ' || COALESCE(v_item.product_title, 'item'),
    trim(p_reason), v_user_id, 'high', 'open',
    COALESCE(p_evidence_urls, ARRAY[]::text[])
  )
  RETURNING * INTO v_issue;

  PERFORM public._marketplace_append_issue_event(
    v_issue.id, v_user_id, 'exchange_requested', trim(p_reason),
    jsonb_build_object(
      'evidence_count', coalesce(array_length(p_evidence_urls, 1), 0),
      'detailed_reason', NULLIF(trim(COALESCE(p_detailed_reason, '')), '')
    )
  );

  SELECT COALESCE(NULLIF(full_name, ''), username, 'A buyer') INTO v_buyer_name
  FROM public.profiles WHERE id = v_user_id;
  SELECT COALESCE(NULLIF(full_name, ''), username, 'Seller') INTO v_seller_name
  FROM public.profiles WHERE id = v_shop.user_id;

  IF v_shop.user_id IS NOT NULL THEN
    BEGIN
      PERFORM public.create_notification_from_template(
        p_template_key := 'order_exchange_requested_seller',
        p_recipient_id := v_shop.user_id,
        p_variables := jsonb_build_object(
          'buyer_name', v_buyer_name,
          'seller_name', v_seller_name,
          'product_name', COALESCE(v_item.product_title, 'an item'),
          'order_number', v_order.order_number,
          'reason', left(trim(p_reason), 240),
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
    'status', 'open'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.request_order_exchange(uuid, text, text[], text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.request_order_exchange(uuid, text, text[], text) TO authenticated;

-- ---------------------------------------------------------------------------
-- Buyer: submit return AWB
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

  IF v_issue.return_tracking_number IS NOT NULL THEN
    RAISE EXCEPTION 'Return tracking was already submitted for this request';
  END IF;

  UPDATE public.order_issues
  SET
    return_tracking_number = v_tracking,
    return_shipped_at = now(),
    return_courier_slug = v_courier,
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
    jsonb_build_object('tracking_number', v_tracking, 'courier_slug', v_courier)
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
    'refund_id', v_refund.id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.submit_return_tracking(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_return_tracking(uuid, text, text) TO authenticated;

-- ---------------------------------------------------------------------------
-- Vendor resolve: include exchange_request + enqueue PayU on cancel refunds
-- ---------------------------------------------------------------------------
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
      v_summary := 'Your exchange was accepted. Ship the item back, then the shop will send a replacement.';
      UPDATE public.order_issues
      SET status = 'waiting_customer', updated_at = now()
      WHERE id = v_issue.id;
      v_new_status := 'waiting_customer';
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
      WHEN v_issue.issue_type = 'exchange_request' THEN 'Your exchange request was declined.'
      ELSE 'Your return request was declined.'
    END;
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
    resolved_at = CASE WHEN v_new_status IN ('resolved', 'waiting_customer') AND v_action = 'accepted'
      THEN COALESCE(resolved_at, now()) ELSE resolved_at END,
    closed_at = CASE WHEN v_new_status = 'closed' THEN now() ELSE closed_at END,
    assigned_to = COALESCE(assigned_to, v_user_id),
    updated_at = now()
  WHERE id = v_issue.id
  RETURNING * INTO v_issue;

  PERFORM public._marketplace_append_issue_event(
    v_issue.id, v_user_id, 'request_' || v_action, v_note,
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

-- ---------------------------------------------------------------------------
-- Vendor: confirm return received (return → PayU; exchange → replacement item)
-- ---------------------------------------------------------------------------
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
  v_order public.orders%ROWTYPE;
  v_shop public.shops%ROWTYPE;
  v_refund public.refunds%ROWTYPE;
  v_issue public.order_issues%ROWTYPE;
  v_replacement public.order_items%ROWTYPE;
  v_app_base text := COALESCE(
    NULLIF(current_setting('app.settings.public_app_url', true), ''),
    'https://sheconomy.in'
  );
  v_buyer_name text;
  v_seller_name text;
  v_amount text;
  v_is_exchange boolean := false;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_item FROM public.order_items WHERE id = p_order_item_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order item not found';
  END IF;

  SELECT * INTO v_order FROM public.orders WHERE id = v_item.order_id;
  SELECT * INTO v_shop FROM public.shops WHERE id = v_item.vendor_id;

  IF v_shop.user_id <> v_user_id AND NOT public._marketplace_is_admin(v_user_id) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

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

    -- Deduct stock for the replacement shipment.
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
      v_issue.id, v_user_id, 'exchange_ready_to_ship',
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
    approved_by = v_user_id,
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
    v_issue.id, v_user_id, 'return_received',
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

REVOKE ALL ON FUNCTION public.confirm_order_return_received(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.confirm_order_return_received(uuid, text) TO authenticated;

-- ---------------------------------------------------------------------------
-- RTO: courier returned_to_sender → restock + refund + PayU
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
      ELSE
        -- COD: no gateway capture — mark completed immediately.
        UPDATE public.refunds
        SET refund_status = 'completed', completed_at = now(), updated_at = now()
        WHERE id = v_refund.id;
      END IF;

      BEGIN
        PERFORM public.update_sales_analytics_return_status(
          p_order_item_id := v_item.id,
          p_is_returned := true,
          p_return_reason := 'RTO'
        );
        PERFORM public.update_sales_analytics_refund_status(
          p_order_item_id := v_item.id,
          p_refund_amount := COALESCE(v_item.total_price, 0),
          p_refund_status := CASE WHEN v_payment_captured THEN 'approved' ELSE 'completed' END
        );
      EXCEPTION WHEN OTHERS THEN
        NULL;
      END;

      v_amount := trim(to_char(COALESCE(v_item.total_price, 0), 'FM999999990.00'))
        || ' ' || COALESCE(v_order.currency, 'INR');
      SELECT COALESCE(NULLIF(full_name, ''), username, 'there') INTO v_buyer_name
      FROM public.profiles WHERE id = v_order.user_id;

      BEGIN
        PERFORM public.create_notification_from_template(
          p_template_key := 'order_rto_completed_buyer',
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
    END IF;

    v_items_processed := v_items_processed + 1;
  END LOOP;

  IF NOT EXISTS (
    SELECT 1 FROM public.order_items oi
    WHERE oi.order_id = v_order.id
      AND oi.item_status NOT IN ('cancelled', 'refunded', 'returned')
  ) THEN
    UPDATE public.orders
    SET order_status = 'returned', updated_at = now()
    WHERE id = v_order.id;

    IF v_payment_captured THEN
      UPDATE public.order_payments
      SET payment_status = 'refunded', updated_at = now()
      WHERE order_id = v_order.id AND payment_status = 'completed';
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'delivery_id', p_delivery_id,
    'items_processed', v_items_processed
  );
END;
$$;

REVOKE ALL ON FUNCTION public.handle_delivery_rto(uuid) FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.trigger_handle_delivery_rto()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.delivery_status = 'returned_to_sender'::delivery_status_enum
     AND (TG_OP = 'INSERT' OR OLD.delivery_status IS DISTINCT FROM NEW.delivery_status) THEN
    PERFORM public.handle_delivery_rto(NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_handle_delivery_rto ON public.order_delivery;
CREATE TRIGGER trigger_handle_delivery_rto
  AFTER INSERT OR UPDATE OF delivery_status ON public.order_delivery
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_handle_delivery_rto();
