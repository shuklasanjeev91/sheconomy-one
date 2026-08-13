-- Seed delivery notification templates (customer + vendor) and notify both
-- sides when courier auto-sync advances order_delivery.delivery_status.

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
  'order_shipped_customer',
  'marketplace',
  'transactional',
  'Order {{order_number}} has shipped',
  'Tracking {{tracking_number}}. Estimated delivery {{estimated_delivery}}.',
  'Your order {{order_number}} has shipped',
  '<p>Hi {{customer_name}},</p><p>Order <strong>{{order_number}}</strong> has shipped.</p><p>Tracking: <strong>{{tracking_number}}</strong></p><p><a href="{{action_url}}">Track your order</a></p>',
  'SHEconomy: order {{order_number}} shipped. Track: {{action_url}}',
  'Order shipped',
  'Tracking {{tracking_number}} for order {{order_number}}',
  'Order {{order_number}} shipped. Track: {{action_url}}',
  '{{action_url}}',
  ARRAY['in_app', 'email', 'push'],
  3,
  true
),
(
  'order_item_shipped_customer',
  'marketplace',
  'transactional',
  '{{product_title}} has shipped',
  'From {{shop_name}}. Tracking {{tracking_number}}.',
  '{{product_title}} shipped · order {{order_number}}',
  '<p>Hi {{customer_name}},</p><p><strong>{{product_title}}</strong> from {{shop_name}} has shipped.</p><p>Tracking: <strong>{{tracking_number}}</strong></p><p><a href="{{action_url}}">Track your order</a></p>',
  'SHEconomy: {{product_title}} shipped. Track: {{action_url}}',
  'Item shipped',
  '{{product_title}} · tracking {{tracking_number}}',
  '{{product_title}} shipped. Track: {{action_url}}',
  '{{action_url}}',
  ARRAY['in_app', 'email', 'push'],
  3,
  true
),
(
  'order_in_transit_customer',
  'marketplace',
  'transactional',
  'Order {{order_number}} is in transit',
  'Your package is moving through the carrier network.',
  'Order {{order_number}} in transit',
  '<p>Hi {{customer_name}},</p><p>Order <strong>{{order_number}}</strong> is in transit.</p><p><a href="{{action_url}}">Track your order</a></p>',
  'SHEconomy: order {{order_number}} in transit. {{action_url}}',
  'In transit',
  'Order {{order_number}} is on the way',
  'Order {{order_number}} in transit. Track: {{action_url}}',
  '{{action_url}}',
  ARRAY['in_app', 'push'],
  4,
  true
),
(
  'order_out_for_delivery_customer',
  'marketplace',
  'transactional',
  'Out for delivery · order {{order_number}}',
  'Your package should arrive today.',
  'Out for delivery · order {{order_number}}',
  '<p>Hi {{customer_name}},</p><p>Order <strong>{{order_number}}</strong> is out for delivery.</p><p><a href="{{action_url}}">Track your order</a></p>',
  'SHEconomy: order {{order_number}} out for delivery.',
  'Out for delivery',
  'Order {{order_number}} is out for delivery',
  'Order {{order_number}} out for delivery. Track: {{action_url}}',
  '{{action_url}}',
  ARRAY['in_app', 'email', 'push'],
  2,
  true
),
(
  'order_delivered_customer',
  'marketplace',
  'transactional',
  'Order {{order_number}} delivered',
  'Your package was delivered. Enjoy!',
  'Delivered · order {{order_number}}',
  '<p>Hi {{customer_name}},</p><p>Order <strong>{{order_number}}</strong> was delivered.</p><p><a href="{{action_url}}">View order</a></p>',
  'SHEconomy: order {{order_number}} delivered.',
  'Delivered',
  'Order {{order_number}} was delivered',
  'Order {{order_number}} delivered. View: {{action_url}}',
  '{{action_url}}',
  ARRAY['in_app', 'email', 'push'],
  2,
  true
),
(
  'delivery_failed_customer',
  'marketplace',
  'transactional',
  'Delivery attempt failed · order {{order_number}}',
  '{{failure_reason}}. Next attempt: {{next_attempt_date}}.',
  'Delivery failed · order {{order_number}}',
  '<p>Hi {{customer_name}},</p><p>A delivery attempt for order <strong>{{order_number}}</strong> failed.</p><p>{{failure_reason}}</p><p><a href="{{action_url}}">View order</a></p>',
  'SHEconomy: delivery failed for order {{order_number}}.',
  'Delivery failed',
  'Delivery attempt failed for order {{order_number}}',
  'Delivery failed for order {{order_number}}. Details: {{action_url}}',
  '{{action_url}}',
  ARRAY['in_app', 'email', 'push'],
  1,
  true
),
(
  'order_shipped_seller',
  'marketplace',
  'transactional',
  'Shipment started · order {{order_number}}',
  'Tracking {{tracking_number}} is now live for the customer.',
  'Shipment live · order {{order_number}}',
  '<p>Hi {{seller_name}},</p><p>Tracking <strong>{{tracking_number}}</strong> for order <strong>{{order_number}}</strong> is live. Status will update automatically.</p><p><a href="{{action_url}}">View vendor orders</a></p>',
  'SHEconomy: tracking live for order {{order_number}}.',
  'Shipment tracking live',
  'Order {{order_number}} · {{tracking_number}}',
  'Tracking live for order {{order_number}}. {{action_url}}',
  '{{action_url}}',
  ARRAY['in_app', 'push'],
  4,
  true
),
(
  'order_item_shipped_seller',
  'marketplace',
  'transactional',
  '{{product_title}} tracking is live',
  'Order {{order_number}} · {{tracking_number}}',
  'Item shipped · order {{order_number}}',
  '<p>Hi {{seller_name}},</p><p><strong>{{product_title}}</strong> on order <strong>{{order_number}}</strong> is tracking as {{tracking_number}}.</p><p><a href="{{action_url}}">View vendor orders</a></p>',
  'SHEconomy: {{product_title}} tracking live.',
  'Item tracking live',
  '{{product_title}} · {{tracking_number}}',
  '{{product_title}} tracking live. {{action_url}}',
  '{{action_url}}',
  ARRAY['in_app', 'push'],
  4,
  true
),
(
  'order_in_transit_seller',
  'marketplace',
  'transactional',
  'In transit · order {{order_number}}',
  'Courier reports your shipment is in transit.',
  'In transit · order {{order_number}}',
  '<p>Hi {{seller_name}},</p><p>Order <strong>{{order_number}}</strong> is in transit.</p><p><a href="{{action_url}}">View vendor orders</a></p>',
  'SHEconomy: order {{order_number}} in transit.',
  'In transit',
  'Order {{order_number}} in transit',
  'Order {{order_number}} in transit. {{action_url}}',
  '{{action_url}}',
  ARRAY['in_app', 'push'],
  4,
  true
),
(
  'order_out_for_delivery_seller',
  'marketplace',
  'transactional',
  'Out for delivery · order {{order_number}}',
  'Courier reports out for delivery.',
  'Out for delivery · order {{order_number}}',
  '<p>Hi {{seller_name}},</p><p>Order <strong>{{order_number}}</strong> is out for delivery.</p><p><a href="{{action_url}}">View vendor orders</a></p>',
  'SHEconomy: order {{order_number}} out for delivery.',
  'Out for delivery',
  'Order {{order_number}} out for delivery',
  'Order {{order_number}} out for delivery. {{action_url}}',
  '{{action_url}}',
  ARRAY['in_app', 'push'],
  3,
  true
),
(
  'order_delivered_seller',
  'marketplace',
  'transactional',
  'Delivered · order {{order_number}}',
  'Courier confirms delivery to the customer.',
  'Delivered · order {{order_number}}',
  '<p>Hi {{seller_name}},</p><p>Order <strong>{{order_number}}</strong> was marked delivered.</p><p><a href="{{action_url}}">View vendor orders</a></p>',
  'SHEconomy: order {{order_number}} delivered.',
  'Delivered',
  'Order {{order_number}} delivered',
  'Order {{order_number}} delivered. {{action_url}}',
  '{{action_url}}',
  ARRAY['in_app', 'email', 'push'],
  3,
  true
),
(
  'delivery_failed_seller',
  'marketplace',
  'transactional',
  'Delivery failed · order {{order_number}}',
  '{{failure_reason}}',
  'Delivery failed · order {{order_number}}',
  '<p>Hi {{seller_name}},</p><p>Delivery failed for order <strong>{{order_number}}</strong>.</p><p>{{failure_reason}}</p><p><a href="{{action_url}}">View vendor orders</a></p>',
  'SHEconomy: delivery failed for order {{order_number}}.',
  'Delivery failed',
  'Delivery failed for order {{order_number}}',
  'Delivery failed for order {{order_number}}. {{action_url}}',
  '{{action_url}}',
  ARRAY['in_app', 'email', 'push'],
  1,
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
  default_priority = EXCLUDED.default_priority,
  is_active = EXCLUDED.is_active,
  updated_at = now();

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

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.notify_delivery_status_change() IS
  'Notifies customer and vendor when courier-synced delivery status changes.';
