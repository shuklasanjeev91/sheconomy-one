-- Prompt buyers to leave a review when courier sync marks delivery as delivered.

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
  'order_review_prompt_customer',
  'marketplace',
  'transactional',
  'How was order {{order_number}}?',
  'Your package was delivered. Share a quick review for {{product_title}}.',
  'Review your order {{order_number}}',
  '<p>Hi {{customer_name}},</p><p>Order <strong>{{order_number}}</strong> was delivered. Please leave a short review for <strong>{{product_title}}</strong>.</p><p><a href="{{action_url}}">Write a review</a></p>',
  'SHEconomy: how was order {{order_number}}? Review: {{action_url}}',
  'Leave a review',
  'How was {{product_title}}?',
  'Order {{order_number}} delivered — leave a review: {{action_url}}',
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
