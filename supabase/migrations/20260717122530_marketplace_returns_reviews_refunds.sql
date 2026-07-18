-- Marketplace Phase 1: buyer returns / verified reviews / digital downloads /
-- vendor cancellation+return resolution with pending refunds + notifications.
-- Identity, ownership, eligibility, and refund amounts are derived server-side.

-- ---------------------------------------------------------------------------
-- Optional issue event trail (timeline for buyers + sellers)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.order_issue_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_id uuid NOT NULL REFERENCES public.order_issues(id) ON DELETE CASCADE,
  actor_id uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  event_type text NOT NULL,
  note text NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS order_issue_events_issue_idx
  ON public.order_issue_events (issue_id, created_at ASC);

ALTER TABLE public.order_issue_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS order_issue_events_select_participants ON public.order_issue_events;
CREATE POLICY order_issue_events_select_participants
  ON public.order_issue_events FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.order_issues oi
      JOIN public.orders o ON o.id = oi.order_id
      LEFT JOIN public.order_items oi_item ON oi_item.id = oi.order_item_id
      LEFT JOIN public.shops s ON s.id = oi_item.vendor_id
      WHERE oi.id = order_issue_events.issue_id
        AND (
          o.user_id = auth.uid()
          OR s.user_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.id = auth.uid() AND p.role = 'admin'
          )
        )
    )
  );

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._marketplace_is_admin(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = p_user_id AND p.role = 'admin'
  );
$$;

REVOKE ALL ON FUNCTION public._marketplace_is_admin(uuid) FROM PUBLIC;

CREATE OR REPLACE FUNCTION public._marketplace_append_issue_event(
  p_issue_id uuid,
  p_actor_id uuid,
  p_event_type text,
  p_note text DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.order_issue_events (issue_id, actor_id, event_type, note, metadata)
  VALUES (p_issue_id, p_actor_id, p_event_type, p_note, COALESCE(p_metadata, '{}'::jsonb));
END;
$$;

REVOKE ALL ON FUNCTION public._marketplace_append_issue_event(uuid, uuid, text, text, jsonb) FROM PUBLIC;

-- ---------------------------------------------------------------------------
-- Notification templates
-- ---------------------------------------------------------------------------
INSERT INTO public.notification_templates (
  template_key,
  platform,
  category,
  title_template,
  message_template,
  email_subject_template,
  email_body_template,
  sms_template,
  push_title_template,
  push_body_template,
  whatsapp_template,
  action_url_template,
  default_channels,
  default_priority,
  is_active
)
VALUES
(
  'order_return_requested_seller',
  'marketplace',
  'transactional',
  'Return requested for order {{order_number}}',
  '{{buyer_name}} requested a return for {{product_name}}.',
  'Return request on order {{order_number}}',
  '<p>Hi {{seller_name}},</p><p><strong>{{buyer_name}}</strong> requested a return for <strong>{{product_name}}</strong> on order <strong>{{order_number}}</strong>.</p><p>{{reason}}</p><p><a href="{{action_url}}">Review in vendor orders</a></p>',
  'SHEconomy: return requested on order {{order_number}}. Open: {{action_url}}',
  'Return requested',
  '{{buyer_name}} wants to return {{product_name}}',
  'Return request for order {{order_number}}: {{product_name}}. Review: {{action_url}}',
  '{{action_url}}',
  ARRAY['in_app', 'email', 'push'],
  4,
  true
),
(
  'order_issue_resolved_buyer',
  'marketplace',
  'transactional',
  'Update on your {{issue_label}}',
  '{{resolution_summary}} for order {{order_number}}.',
  'Update on your {{issue_label}} · order {{order_number}}',
  '<p>Hi {{buyer_name}},</p><p>{{resolution_summary}}</p><p>Order: <strong>{{order_number}}</strong></p><p><a href="{{action_url}}">View order</a></p>',
  'SHEconomy: {{resolution_summary}} Order {{order_number}}.',
  'Order request update',
  '{{resolution_summary}}',
  'Update on order {{order_number}}: {{resolution_summary}}. View: {{action_url}}',
  '{{action_url}}',
  ARRAY['in_app', 'email', 'push'],
  4,
  true
),
(
  'order_refund_pending_buyer',
  'marketplace',
  'transactional',
  'Refund pending for order {{order_number}}',
  'A refund of {{refund_amount}} is pending for {{product_name}}.',
  'Refund pending · order {{order_number}}',
  '<p>Hi {{buyer_name}},</p><p>A refund of <strong>{{refund_amount}}</strong> for <strong>{{product_name}}</strong> is now pending processing.</p><p><a href="{{action_url}}">View order</a></p>',
  'SHEconomy: refund pending for order {{order_number}}.',
  'Refund pending',
  '{{refund_amount}} refund pending for {{product_name}}',
  'Refund pending for order {{order_number}}: {{refund_amount}}. Details: {{action_url}}',
  '{{action_url}}',
  ARRAY['in_app', 'email', 'push'],
  4,
  true
),
(
  'listing_review_received_seller',
  'marketplace',
  'transactional',
  'New {{rating}}-star review on {{product_name}}',
  '{{buyer_name}} left a verified review.',
  'New review on {{product_name}}',
  '<p>Hi {{seller_name}},</p><p><strong>{{buyer_name}}</strong> left a {{rating}}-star verified review on <strong>{{product_name}}</strong>.</p><p><a href="{{action_url}}">View listing</a></p>',
  'SHEconomy: new review on {{product_name}}.',
  'New product review',
  '{{rating}}★ from {{buyer_name}} on {{product_name}}',
  'New {{rating}}-star review on {{product_name}}. View: {{action_url}}',
  '{{action_url}}',
  ARRAY['in_app', 'email', 'push'],
  3,
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
  whatsapp_template = EXCLUDED.whatsapp_template,
  action_url_template = EXCLUDED.action_url_template,
  default_channels = EXCLUDED.default_channels,
  updated_at = now();

-- ---------------------------------------------------------------------------
-- Buyer: request return (+ pending refund row)
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
  v_app_base text := COALESCE(
    NULLIF(current_setting('app.settings.public_app_url', true), ''),
    'https://sheconomy.com'
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

  SELECT count(*) INTO v_open_count
  FROM public.order_issues oi
  WHERE oi.order_item_id = v_item.id
    AND oi.issue_type IN ('return_request', 'refund_request')
    AND oi.status IN ('open', 'assigned', 'in_progress', 'waiting_customer', 'escalated');

  IF v_open_count > 0 THEN
    RAISE EXCEPTION 'A return or refund request is already open for this item';
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
    order_id,
    order_item_id,
    issue_type,
    issue_title,
    description,
    reported_by,
    issue_priority,
    status,
    evidence_urls
  ) VALUES (
    v_order.id,
    v_item.id,
    'return_request',
    'Return request for ' || COALESCE(v_item.product_title, 'item'),
    trim(p_reason),
    v_user_id,
    'high',
    'open',
    COALESCE(p_evidence_urls, ARRAY[]::text[])
  )
  RETURNING * INTO v_issue;

  PERFORM public._marketplace_append_issue_event(
    v_issue.id,
    v_user_id,
    'return_requested',
    trim(p_reason),
    jsonb_build_object('evidence_count', coalesce(array_length(p_evidence_urls, 1), 0))
  );

  INSERT INTO public.refunds (
    order_item_id,
    initiated_by,
    refund_reason,
    detailed_reason,
    refund_amount,
    item_refund_amount,
    refund_status,
    refund_method
  ) VALUES (
    v_item.id,
    v_user_id,
    'return_request',
    COALESCE(NULLIF(trim(p_detailed_reason), ''), trim(p_reason)),
    COALESCE(v_item.total_price, 0),
    COALESCE(v_item.total_price, 0),
    'requested',
    'original_payment'
  )
  RETURNING * INTO v_refund;

  BEGIN
    PERFORM public.update_sales_analytics_return_status(
      p_order_item_id := v_item.id,
      p_is_returned := false,
      p_return_reason := trim(p_reason)
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
      NULL; -- notification failure must not block the return
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
-- Vendor/admin: resolve cancellation or return request
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
  v_decision text := lower(trim(COALESCE(p_decision, '')));
  v_is_admin boolean;
  v_note text := NULLIF(trim(COALESCE(p_resolution_note, '')), '');
  v_new_status text;
  v_action text;
  v_summary text;
  v_app_base text := COALESCE(
    NULLIF(current_setting('app.settings.public_app_url', true), ''),
    'https://sheconomy.com'
  );
  v_buyer_name text;
  v_label text;
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

  IF v_decision = 'accept' THEN
    v_new_status := 'resolved';
    v_action := 'accepted';
    IF v_issue.issue_type = 'cancellation_request' THEN
      v_summary := 'Your cancellation request was accepted.';
      UPDATE public.order_items
      SET item_status = 'cancelled', updated_at = now()
      WHERE order_id = v_order.id
        AND (v_issue.order_item_id IS NULL OR id = v_issue.order_item_id);
      UPDATE public.orders
      SET order_status = 'cancelled', updated_at = now()
      WHERE id = v_order.id
        AND NOT EXISTS (
          SELECT 1 FROM public.order_items oi
          WHERE oi.order_id = v_order.id
            AND oi.item_status NOT IN ('cancelled', 'refunded')
        );
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

-- ---------------------------------------------------------------------------
-- Vendor: confirm returned goods + mark refund approved (pending payout)
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
  v_app_base text := COALESCE(
    NULLIF(current_setting('app.settings.public_app_url', true), ''),
    'https://sheconomy.com'
  );
  v_buyer_name text;
  v_amount text;
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

  SELECT * INTO v_issue
  FROM public.order_issues
  WHERE order_item_id = v_item.id
    AND issue_type IN ('return_request', 'refund_request')
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_issue.id IS NOT NULL THEN
    UPDATE public.order_issues
    SET
      status = 'resolved',
      resolution_action = 'return_received',
      resolution_note = COALESCE(NULLIF(trim(COALESCE(p_note, '')), ''), resolution_note),
      resolved_at = COALESCE(resolved_at, now()),
      updated_at = now()
    WHERE id = v_issue.id;

    PERFORM public._marketplace_append_issue_event(
      v_issue.id,
      v_user_id,
      'return_received',
      NULLIF(trim(COALESCE(p_note, '')), ''),
      jsonb_build_object('refund_id', v_refund.id, 'refund_amount', v_refund.refund_amount)
    );
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
-- Buyer: verified-purchase review
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.submit_verified_listing_review(
  p_order_item_id uuid,
  p_rating integer,
  p_title text DEFAULT NULL,
  p_review_text text DEFAULT '',
  p_review_images jsonb DEFAULT '[]'::jsonb
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
  v_listing public.listings%ROWTYPE;
  v_shop public.shops%ROWTYPE;
  v_review public.listing_reviews%ROWTYPE;
  v_existing_id uuid;
  v_text text := trim(COALESCE(p_review_text, ''));
  v_title text := NULLIF(trim(COALESCE(p_title, '')), '');
  v_app_base text := COALESCE(
    NULLIF(current_setting('app.settings.public_app_url', true), ''),
    'https://sheconomy.com'
  );
  v_buyer_name text;
  v_seller_name text;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_rating IS NULL OR p_rating < 1 OR p_rating > 5 THEN
    RAISE EXCEPTION 'Rating must be between 1 and 5';
  END IF;

  IF char_length(v_text) < 10 THEN
    RAISE EXCEPTION 'Please write a short review (at least 10 characters).';
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
    RAISE EXCEPTION 'You can review this item after it is delivered';
  END IF;

  IF COALESCE(v_item.has_review, false) THEN
    RAISE EXCEPTION 'You already reviewed this item';
  END IF;

  SELECT id INTO v_existing_id
  FROM public.listing_reviews
  WHERE listing_id = v_item.listing_id
    AND reviewer_id = v_user_id
    AND order_id = v_order.id
  LIMIT 1;

  IF v_existing_id IS NOT NULL THEN
    RAISE EXCEPTION 'You already reviewed this purchase';
  END IF;

  SELECT * INTO v_listing FROM public.listings WHERE id = v_item.listing_id;
  SELECT * INTO v_shop FROM public.shops WHERE id = v_item.vendor_id;

  INSERT INTO public.listing_reviews (
    listing_id,
    reviewer_id,
    order_id,
    rating,
    title,
    review_text,
    review_images,
    review_status,
    is_verified_purchase,
    purchase_verified_at,
    published_at,
    review_type
  ) VALUES (
    v_item.listing_id,
    v_user_id,
    v_order.id,
    p_rating,
    v_title,
    v_text,
    COALESCE(p_review_images, '[]'::jsonb),
    'approved',
    true,
    now(),
    now(),
    'listing'
  )
  RETURNING * INTO v_review;

  UPDATE public.order_items
  SET has_review = true, updated_at = now()
  WHERE id = v_item.id;

  UPDATE public.listings l
  SET
    average_rating = sub.avg_rating,
    total_reviews = sub.total_reviews,
    updated_at = now()
  FROM (
    SELECT
      avg(rating)::numeric(4,2) AS avg_rating,
      count(*)::integer AS total_reviews
    FROM public.listing_reviews
    WHERE listing_id = v_item.listing_id
      AND review_status = 'approved'
  ) sub
  WHERE l.id = v_item.listing_id;

  SELECT COALESCE(NULLIF(full_name, ''), username, 'A buyer') INTO v_buyer_name
  FROM public.profiles WHERE id = v_user_id;
  SELECT COALESCE(NULLIF(full_name, ''), username, 'Seller') INTO v_seller_name
  FROM public.profiles WHERE id = v_shop.user_id;

  IF v_shop.user_id IS NOT NULL THEN
    BEGIN
      PERFORM public.create_notification_from_template(
        p_template_key := 'listing_review_received_seller',
        p_recipient_id := v_shop.user_id,
        p_variables := jsonb_build_object(
          'buyer_name', v_buyer_name,
          'seller_name', v_seller_name,
          'product_name', COALESCE(v_listing.title, v_item.product_title, 'your listing'),
          'rating', p_rating::text,
          'action_url', v_app_base || '/listing/' || COALESCE(v_listing.slug, v_item.listing_id::text)
        ),
        p_context_type := 'listing',
        p_context_id := v_item.listing_id::text
      );
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END IF;

  RETURN jsonb_build_object(
    'review_id', v_review.id,
    'rating', v_review.rating,
    'is_verified_purchase', true
  );
END;
$$;

REVOKE ALL ON FUNCTION public.submit_verified_listing_review(uuid, integer, text, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_verified_listing_review(uuid, integer, text, text, jsonb) TO authenticated;

-- ---------------------------------------------------------------------------
-- Buyer: safe digital download (ownership + expiry + attempt tracking)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_order_digital_download(
  p_order_item_id uuid
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
  v_url text;
  v_attempts integer;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_item FROM public.order_items WHERE id = p_order_item_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order item not found';
  END IF;

  SELECT * INTO v_order FROM public.orders WHERE id = v_item.order_id;
  IF NOT FOUND OR v_order.user_id <> v_user_id THEN
    RAISE EXCEPTION 'Order not found or access denied';
  END IF;

  v_url := NULLIF(trim(COALESCE(v_item.digital_download_url, '')), '');
  IF v_url IS NULL THEN
    RAISE EXCEPTION 'No digital download is available for this item';
  END IF;

  IF v_url !~* '^https?://' THEN
    RAISE EXCEPTION 'Download link is invalid';
  END IF;

  IF v_order.order_status IN ('cancelled', 'refunded')
     OR v_item.item_status IN ('cancelled', 'refunded') THEN
    RAISE EXCEPTION 'Download is unavailable for cancelled or refunded orders';
  END IF;

  IF v_item.download_expires_at IS NOT NULL AND v_item.download_expires_at < now() THEN
    RAISE EXCEPTION 'This download link has expired';
  END IF;

  v_attempts := COALESCE(v_item.download_attempts, 0) + 1;

  UPDATE public.order_items
  SET download_attempts = v_attempts, updated_at = now()
  WHERE id = v_item.id;

  RETURN jsonb_build_object(
    'url', v_url,
    'download_attempts', v_attempts,
    'download_expires_at', v_item.download_expires_at,
    'product_title', v_item.product_title
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_order_digital_download(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_order_digital_download(uuid) TO authenticated;
