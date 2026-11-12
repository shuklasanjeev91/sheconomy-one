-- Phase 6: Buyer unified tracking support + idempotent notification enqueue
-- + low-wallet seller alert. Shipped/delivered buyer alerts already fire from
-- notify_delivery_status_change; seller new-order from dispatch_marketplace_order_notifications.

-- ---------------------------------------------------------------------------
-- Buyer-readable settlement status (safe fields only via column grants + RLS)
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS shepay_pending_settlements_select_buyer ON public.shepay_pending_settlements;
CREATE POLICY shepay_pending_settlements_select_buyer
  ON public.shepay_pending_settlements
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.orders o
      WHERE o.id = shepay_pending_settlements.order_id
        AND o.user_id = auth.uid()
    )
  );

-- Realtime for live buyer / seller settlement cards
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.shepay_pending_settlements;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.commerce_checkout_groups;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ---------------------------------------------------------------------------
-- Idempotent notification queue
-- ---------------------------------------------------------------------------

ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS idempotency_key text;

CREATE UNIQUE INDEX IF NOT EXISTS notifications_idempotency_key_uidx
  ON public.notifications (idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE OR REPLACE FUNCTION public.create_notification_idempotent(
  p_template_key text,
  p_recipient_id uuid,
  p_idempotency_key text,
  p_variables jsonb DEFAULT '{}'::jsonb,
  p_context_type text DEFAULT NULL,
  p_context_id uuid DEFAULT NULL,
  p_parent_context_type text DEFAULT NULL,
  p_parent_context_id uuid DEFAULT NULL,
  p_override_priority integer DEFAULT NULL,
  p_scheduled_for timestamptz DEFAULT NULL,
  p_source_system text DEFAULT 'trigger'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing uuid;
  v_created uuid;
BEGIN
  IF nullif(trim(COALESCE(p_idempotency_key, '')), '') IS NULL THEN
    RETURN public.create_validated_notification(
      p_template_key,
      p_recipient_id,
      COALESCE(p_variables, '{}'::jsonb),
      p_context_type,
      p_context_id,
      p_parent_context_type,
      p_parent_context_id,
      p_override_priority,
      p_scheduled_for,
      COALESCE(p_source_system, 'trigger')
    );
  END IF;

  SELECT id INTO v_existing
  FROM public.notifications
  WHERE idempotency_key = p_idempotency_key
  LIMIT 1;

  IF v_existing IS NOT NULL THEN
    RETURN v_existing;
  END IF;

  v_created := public.create_validated_notification(
    p_template_key,
    p_recipient_id,
    COALESCE(p_variables, '{}'::jsonb),
    p_context_type,
    p_context_id,
    p_parent_context_type,
    p_parent_context_id,
    p_override_priority,
    p_scheduled_for,
    COALESCE(p_source_system, 'trigger')
  );

  IF v_created IS NOT NULL THEN
    UPDATE public.notifications
    SET idempotency_key = p_idempotency_key
    WHERE id = v_created
      AND idempotency_key IS NULL;
  END IF;

  RETURN v_created;
EXCEPTION
  WHEN unique_violation THEN
    SELECT id INTO v_existing
    FROM public.notifications
    WHERE idempotency_key = p_idempotency_key
    LIMIT 1;
    RETURN v_existing;
END;
$$;

REVOKE ALL ON FUNCTION public.create_notification_idempotent FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_notification_idempotent TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Templates: low wallet (seller) + order confirmed (seller)
-- ---------------------------------------------------------------------------

INSERT INTO public.notification_templates (
  template_key,
  category,
  platform,
  title_template,
  message_template,
  action_url_template,
  default_channels,
  default_priority,
  is_active
)
VALUES (
  'shiprocket_wallet_low_seller',
  'transactional',
  'marketplace',
  'Shiprocket wallet running low',
  'Your Shiprocket wallet balance is {{balance}} {{currency}}. Recharge on Shiprocket before processing more shipments. SHEconomy never holds your shipping funds.',
  '/vendor/wallet',
  ARRAY['in_app', 'push', 'email']::text[],
  4,
  true
)
ON CONFLICT (template_key) DO UPDATE SET
  title_template = EXCLUDED.title_template,
  message_template = EXCLUDED.message_template,
  action_url_template = EXCLUDED.action_url_template,
  is_active = true,
  updated_at = now();

INSERT INTO public.notification_templates (
  template_key,
  category,
  platform,
  title_template,
  message_template,
  action_url_template,
  default_channels,
  default_priority,
  is_active
)
VALUES (
  'order_confirmed_seller',
  'transactional',
  'marketplace',
  'New order confirmed — #{{order_number}}',
  'Order #{{order_number}} is confirmed. Prepare the shipment from your Shiprocket wallet when ready.',
  '/vendor/orders',
  ARRAY['in_app', 'push', 'email']::text[],
  4,
  true
)
ON CONFLICT (template_key) DO UPDATE SET
  title_template = EXCLUDED.title_template,
  message_template = EXCLUDED.message_template,
  action_url_template = EXCLUDED.action_url_template,
  is_active = true,
  updated_at = now();

-- Notify seller when wallet mirror crosses at/below threshold (default 100 INR).
CREATE OR REPLACE FUNCTION public.notify_shiprocket_wallet_low()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner uuid;
  v_shop_name text;
  v_threshold numeric := 100;
  v_prev numeric;
BEGIN
  IF NEW.balance_amount IS NULL THEN
    RETURN NEW;
  END IF;

  v_prev := COALESCE(OLD.balance_amount, NEW.balance_amount + 1);
  IF NOT (
    NEW.balance_amount <= v_threshold
    AND (TG_OP = 'INSERT' OR v_prev > v_threshold)
  ) THEN
    RETURN NEW;
  END IF;

  SELECT s.user_id, s.shop_name
  INTO v_owner, v_shop_name
  FROM public.shops s
  WHERE s.id = NEW.shop_id;

  IF v_owner IS NULL THEN
    RETURN NEW;
  END IF;

  PERFORM public.create_notification_idempotent(
    'shiprocket_wallet_low_seller',
    v_owner,
    'shiprocket_wallet_low:' || NEW.shop_id::text || ':' || to_char(timezone('utc', now()), 'YYYY-MM-DD'),
    jsonb_build_object(
      'balance', to_char(NEW.balance_amount, 'FM999999990.00'),
      'currency', COALESCE(NEW.currency, 'INR'),
      'shop_name', COALESCE(v_shop_name, 'Your shop'),
      'recharge_url', COALESCE(NEW.recharge_url, 'https://app.shiprocket.in/seller/wallet')
    ),
    'shop',
    NEW.shop_id,
    NULL,
    NULL,
    4,
    NULL,
    'shiprocket_wallet_trigger'
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_shiprocket_wallet_low ON public.shiprocket_wallet_mirrors;
CREATE TRIGGER trg_notify_shiprocket_wallet_low
  AFTER INSERT OR UPDATE OF balance_amount ON public.shiprocket_wallet_mirrors
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_shiprocket_wallet_low();

-- ---------------------------------------------------------------------------
-- Patch delivery notifier → idempotent buyer shipped/delivered (+ seller)
-- ---------------------------------------------------------------------------

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
  v_idem_suffix TEXT;
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.delivery_status IS NOT DISTINCT FROM NEW.delivery_status THEN
    RETURN NEW;
  END IF;

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
  v_idem_suffix := NEW.id::text || ':' || NEW.delivery_status::text;

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
    PERFORM public.create_notification_idempotent(
      v_customer_template,
      v_order_info.user_id,
      v_customer_template || ':' || v_idem_suffix || ':buyer',
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
    PERFORM public.create_notification_idempotent(
      v_seller_template,
      v_vendor_id,
      v_seller_template || ':' || v_idem_suffix || ':seller',
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

  IF v_notify IS TRUE
     AND NEW.delivery_status = 'delivered'::public.delivery_status_enum
     AND v_order_info.user_id IS NOT NULL THEN
    PERFORM public.create_notification_idempotent(
      'order_review_prompt_customer',
      v_order_info.user_id,
      'order_review_prompt_customer:' || NEW.id::text,
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
-- Patch marketplace dispatch → idempotent keys + order_confirmed_seller
-- ---------------------------------------------------------------------------

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
  v_seller_template text;
BEGIN
  IF p_order_id IS NULL THEN
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.notifications n
    WHERE n.idempotency_key = 'order_placed_customer:' || p_order_id::text
  ) THEN
    RETURN;
  END IF;

  -- Legacy short-window dedupe for rows written before idempotency_key existed
  IF EXISTS (
    SELECT 1
    FROM public.notifications n
    WHERE n.context_id = p_order_id
      AND n.type = 'order_placed_customer'
      AND n.created_at > now() - interval '5 minutes'
      AND n.idempotency_key IS NULL
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
    PERFORM public.create_notification_idempotent(
      'order_placed_customer',
      v_order_record.user_id,
      'order_placed_customer:' || v_order_record.id::text,
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

    v_seller_template := CASE
      WHEN v_payment_mode = 'cod' THEN 'cod_order_vendor'
      ELSE 'order_confirmed_seller'
    END;

    BEGIN
      PERFORM public.create_notification_idempotent(
        v_seller_template,
        v_vendor_records.vendor_user_id,
        v_seller_template || ':' || v_order_record.id::text || ':' || v_vendor_records.shop_id::text,
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
      -- Fall back to legacy new_order_vendor if order_confirmed_seller missing in older envs
      BEGIN
        PERFORM public.create_notification_idempotent(
          CASE WHEN v_payment_mode = 'cod' THEN 'cod_order_vendor' ELSE 'new_order_vendor' END,
          v_vendor_records.vendor_user_id,
          'new_order_vendor:' || v_order_record.id::text || ':' || v_vendor_records.shop_id::text,
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
        PERFORM public.create_notification_idempotent(
          'new_order_admin',
          v_admin_id,
          'new_order_admin:' || v_order_record.id::text || ':' || v_admin_id::text,
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
