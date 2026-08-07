-- Auto courier tracking: buyer notifications on ship + status changes,
-- and pg_cron poll of courier-track-sync (AfterShip / TrackingMore / Shiprocket).

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. notify_delivery_status_change — INSERT + UPDATE, respect notify_customer
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.notify_delivery_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order_info RECORD;
  v_item_info RECORD;
  v_variables JSONB;
  v_template_key TEXT;
  v_notify BOOLEAN;
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.delivery_status IS NOT DISTINCT FROM NEW.delivery_status THEN
    RETURN NEW;
  END IF;

  -- Skip placeholder pending rows created at checkout.
  IF NEW.delivery_status = 'pending'::public.delivery_status_enum THEN
    RETURN NEW;
  END IF;

  v_notify := COALESCE((NEW.delivery_metadata->>'notify_customer')::boolean, true);
  IF v_notify IS NOT TRUE THEN
    RETURN NEW;
  END IF;

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

  IF v_order_info.user_id IS NULL THEN
    RETURN NEW;
  END IF;

  v_template_key := CASE NEW.delivery_status
    WHEN 'shipped'::public.delivery_status_enum THEN
      CASE WHEN NEW.order_item_id IS NOT NULL THEN 'order_item_shipped_customer' ELSE 'order_shipped_customer' END
    WHEN 'out_for_delivery'::public.delivery_status_enum THEN 'order_out_for_delivery_customer'
    WHEN 'delivered'::public.delivery_status_enum THEN 'order_delivered_customer'
    WHEN 'failed_delivery'::public.delivery_status_enum THEN 'delivery_failed_customer'
    ELSE NULL
  END;

  IF v_template_key IS NULL THEN
    RETURN NEW;
  END IF;

  v_variables := jsonb_build_object(
    'order_number', v_order_info.order_number,
    'order_id', NEW.order_id,
    'customer_name', COALESCE(v_order_info.customer_name, 'Customer'),
    'customer_total_amount', ROUND(COALESCE(v_order_info.customer_total_amount, 0)::numeric, 2),
    'customer_currency', COALESCE(v_order_info.customer_currency, 'INR'),
    'tracking_number', COALESCE(NEW.tracking_number, NEW.awb_code, ''),
    'estimated_delivery', COALESCE(NEW.estimated_delivery_date::text, 'soon'),
    'failure_reason', COALESCE(NEW.delivery_metadata->>'failure_reason', 'Delivery attempt unsuccessful'),
    'next_attempt_date', COALESCE(NEW.delivery_metadata->>'next_attempt_date', 'Tomorrow'),
    'delivery_person_phone', COALESCE(NEW.delivery_person_phone, '')
  );

  IF NEW.order_item_id IS NOT NULL THEN
    SELECT
      oi.product_title,
      COALESCE(oi.unit_price, oi.total_price, 0) AS item_price,
      oi.id AS order_item_id,
      s.shop_name AS shop_name
    INTO v_item_info
    FROM public.order_items oi
    LEFT JOIN public.shops s ON s.id = oi.vendor_id
    WHERE oi.id = NEW.order_item_id;

    v_variables := v_variables || jsonb_build_object(
      'order_item_id', NEW.order_item_id,
      'product_title', COALESCE(v_item_info.product_title, 'Item'),
      'item_customer_price', ROUND(COALESCE(v_item_info.item_price, 0)::numeric, 2),
      'shop_name', COALESCE(v_item_info.shop_name, 'Shop')
    );
  END IF;

  PERFORM public.create_validated_notification(
    v_template_key,
    v_order_info.user_id,
    v_variables,
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

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_delivery_status_notification ON public.order_delivery;
CREATE TRIGGER trigger_delivery_status_notification
  AFTER INSERT OR UPDATE OF delivery_status ON public.order_delivery
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_delivery_status_change();

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Cron: poll in-flight AWBs every 20 minutes via courier-track-sync
--    Reuses vault secret notification_cron_secret (same as dispatch-notifications).
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule(jobid)
    FROM cron.job
    WHERE jobname = 'courier-track-sync';

    PERFORM cron.schedule(
      'courier-track-sync',
      '*/20 * * * *',
      $cron$
      SELECT net.http_post(
        url := 'https://zsaqrrzwygzwrlzgymxk.supabase.co/functions/v1/courier-track-sync',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'x-cron-secret', (
            SELECT decrypted_secret
            FROM vault.decrypted_secrets
            WHERE name = 'notification_cron_secret'
            LIMIT 1
          )
        ),
        body := jsonb_build_object('limit', 40)
      );
      $cron$
    );
  END IF;
END;
$$;
