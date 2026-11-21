-- EasyShip order fulfillment: paid items open a shipment row, and label /
-- tracking updates on order_delivery keep that row in step.

CREATE OR REPLACE FUNCTION public.easyship_fulfillment_rank(p_status public.fulfillment_status_enum)
RETURNS integer
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE p_status
    WHEN 'pending' THEN 1
    WHEN 'processing' THEN 2
    WHEN 'ready_to_ship' THEN 3
    WHEN 'shipped' THEN 4
    WHEN 'out_for_delivery' THEN 5
    WHEN 'delivered' THEN 6
    WHEN 'delivery_failed' THEN 7
    WHEN 'exception' THEN 7
    WHEN 'returned' THEN 8
    WHEN 'returned_to_sender' THEN 8
    WHEN 'cancelled' THEN 9
    ELSE 0
  END;
$$;

CREATE OR REPLACE FUNCTION public.sync_easyship_order_fulfillment(p_order_item_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_vendor_id uuid;
  v_quantity integer;
  v_item_status text;
  v_shop_user uuid;
  v_fulfillment public.order_fulfillments%ROWTYPE;
  v_delivery_status text;
  v_tracking text;
  v_label text;
  v_cost numeric;
  v_carrier text;
  v_meta jsonb;
  v_shipped_at timestamptz;
  v_delivered_at timestamptz;
  v_tracking_url text;
  v_easyship_id text;
  v_target public.fulfillment_status_enum;
  v_qty integer;
  v_now timestamptz := now();
  v_found_delivery boolean := false;
  v_has_fulfillment boolean := false;
BEGIN
  SELECT oi.vendor_id, GREATEST(COALESCE(oi.quantity, 1), 1), oi.item_status::text
  INTO v_vendor_id, v_quantity, v_item_status
  FROM public.order_items oi
  WHERE oi.id = p_order_item_id;

  IF NOT FOUND OR v_vendor_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT s.user_id INTO v_shop_user
  FROM public.shops s
  WHERE s.id = v_vendor_id;

  SELECT * INTO v_fulfillment
  FROM public.order_fulfillments f
  WHERE f.order_item_id = p_order_item_id
    AND f.fulfillment_status IS DISTINCT FROM 'cancelled'::public.fulfillment_status_enum
  ORDER BY f.created_at DESC
  LIMIT 1;
  v_has_fulfillment := FOUND;

  IF v_item_status IN ('cancelled', 'refunded') THEN
    IF v_has_fulfillment
       AND public.easyship_fulfillment_rank(v_fulfillment.fulfillment_status) < 4 THEN
      UPDATE public.order_fulfillments
      SET fulfillment_status = 'cancelled', updated_at = v_now
      WHERE id = v_fulfillment.id;
      INSERT INTO public.fulfillment_events (
        fulfillment_id, event_type, event_description, event_timestamp,
        previous_status, new_status, source_system, triggered_by
      ) VALUES (
        v_fulfillment.id, 'status_change', 'Order cancelled before shipment',
        v_now, v_fulfillment.fulfillment_status, 'cancelled', 'easyship', v_shop_user
      );
    END IF;
    RETURN CASE WHEN v_has_fulfillment THEN v_fulfillment.id ELSE NULL END;
  END IF;

  IF v_item_status NOT IN (
    'confirmed', 'processing', 'shipped', 'partially_shipped', 'in_transit',
    'out_for_delivery', 'delivered', 'completed', 'failed_delivery', 'returned'
  ) THEN
    RETURN CASE WHEN v_has_fulfillment THEN v_fulfillment.id ELSE NULL END;
  END IF;

  IF v_shop_user IS NULL THEN
    RETURN NULL;
  END IF;

  v_target := CASE v_item_status
    WHEN 'shipped' THEN 'shipped'::public.fulfillment_status_enum
    WHEN 'partially_shipped' THEN 'shipped'::public.fulfillment_status_enum
    WHEN 'in_transit' THEN 'shipped'::public.fulfillment_status_enum
    WHEN 'out_for_delivery' THEN 'out_for_delivery'::public.fulfillment_status_enum
    WHEN 'delivered' THEN 'delivered'::public.fulfillment_status_enum
    WHEN 'completed' THEN 'delivered'::public.fulfillment_status_enum
    WHEN 'failed_delivery' THEN 'delivery_failed'::public.fulfillment_status_enum
    WHEN 'returned' THEN 'returned'::public.fulfillment_status_enum
    ELSE 'processing'::public.fulfillment_status_enum
  END;

  SELECT
    d.delivery_status::text,
    NULLIF(btrim(d.tracking_number), ''),
    NULLIF(btrim(d.label_url), ''),
    d.shipping_cost,
    COALESCE(NULLIF(btrim(d.carrier_name), ''), NULLIF(btrim(d.courier_service_name), '')),
      CASE
        WHEN d.delivery_metadata IS NULL THEN '{}'::jsonb
        ELSE d.delivery_metadata::jsonb
      END,
    d.shipped_at,
    d.delivered_at,
    NULLIF(btrim(d.carrier_tracking_url), '')
  INTO
    v_delivery_status, v_tracking, v_label, v_cost, v_carrier,
    v_meta, v_shipped_at, v_delivered_at, v_tracking_url
  FROM public.order_delivery d
  WHERE d.order_item_id = p_order_item_id
  ORDER BY d.updated_at DESC NULLS LAST
  LIMIT 1;

  v_found_delivery := FOUND;
  IF NOT v_found_delivery OR v_meta IS NULL OR jsonb_typeof(v_meta) <> 'object' THEN
    v_meta := '{}'::jsonb;
  END IF;
  v_easyship_id := NULLIF(v_meta ->> 'easyship_shipment_id', '');

  IF v_found_delivery THEN
    v_target := CASE v_delivery_status
      WHEN 'ready_to_ship' THEN 'ready_to_ship'::public.fulfillment_status_enum
      WHEN 'shipped' THEN 'shipped'::public.fulfillment_status_enum
      WHEN 'in_transit' THEN 'shipped'::public.fulfillment_status_enum
      WHEN 'out_for_delivery' THEN 'out_for_delivery'::public.fulfillment_status_enum
      WHEN 'delivered' THEN 'delivered'::public.fulfillment_status_enum
      WHEN 'failed_delivery' THEN 'delivery_failed'::public.fulfillment_status_enum
      WHEN 'returned_to_sender' THEN 'returned_to_sender'::public.fulfillment_status_enum
      WHEN 'lost' THEN 'exception'::public.fulfillment_status_enum
      WHEN 'damaged' THEN 'exception'::public.fulfillment_status_enum
      WHEN 'cancelled' THEN 'cancelled'::public.fulfillment_status_enum
      ELSE v_target
    END;
  END IF;

  v_qty := GREATEST(COALESCE(v_quantity, 1), 1);

  IF NOT v_has_fulfillment THEN
    INSERT INTO public.order_fulfillments (
      order_item_id,
      fulfilled_by,
      fulfillment_number,
      fulfillment_status,
      quantity_to_fulfill,
      quantity_fulfilled,
      quantity_shipped,
      quantity_delivered,
      fulfillment_method,
      carrier_code,
      carrier_name,
      tracking_number,
      shipping_label_url,
      shipping_cost,
      fulfillment_cost,
      external_fulfillment_id,
      shipped_at,
      delivered_at,
      fulfillment_metadata
    ) VALUES (
      p_order_item_id,
      v_shop_user,
      'FUL-' || to_char(clock_timestamp(), 'YYYYMMDDHH24MISSMS') || '-' || substr(replace(p_order_item_id::text, '-', ''), 1, 8),
      v_target,
      v_qty,
      CASE WHEN public.easyship_fulfillment_rank(v_target) >= 4 THEN v_qty ELSE 0 END,
      CASE WHEN public.easyship_fulfillment_rank(v_target) >= 4 THEN v_qty ELSE 0 END,
      CASE WHEN v_target = 'delivered' THEN v_qty ELSE 0 END,
      'easyship',
      'easyship',
      COALESCE(v_carrier, 'EasyShip'),
      v_tracking,
      v_label,
      v_cost,
      v_cost,
      v_easyship_id,
      CASE WHEN public.easyship_fulfillment_rank(v_target) >= 4 THEN GREATEST(COALESCE(v_shipped_at, v_now), v_now) ELSE NULL END,
      CASE WHEN v_target = 'delivered' THEN GREATEST(COALESCE(v_delivered_at, v_shipped_at, v_now), v_now) ELSE NULL END,
      jsonb_build_object(
        'source', 'easyship',
        'tracking_url', v_tracking_url,
        'easyship_shipment_id', v_easyship_id
      )
    )
    RETURNING * INTO v_fulfillment;

    INSERT INTO public.fulfillment_events (
      fulfillment_id, event_type, event_description, event_timestamp,
      previous_status, new_status, source_system, triggered_by, event_data
    ) VALUES (
      v_fulfillment.id,
      'status_change',
      'EasyShip fulfillment opened',
      v_now,
      NULL,
      v_target,
      'easyship',
      v_shop_user,
      jsonb_build_object('tracking_number', v_tracking, 'label_url', v_label)
    );

    RETURN v_fulfillment.id;
  END IF;

  IF v_fulfillment.fulfillment_status = 'cancelled'::public.fulfillment_status_enum THEN
    RETURN v_fulfillment.id;
  END IF;

  IF public.easyship_fulfillment_rank(v_target) > public.easyship_fulfillment_rank(v_fulfillment.fulfillment_status)
     OR (v_tracking IS NOT NULL AND v_fulfillment.tracking_number IS DISTINCT FROM v_tracking)
     OR (v_label IS NOT NULL AND v_fulfillment.shipping_label_url IS DISTINCT FROM v_label)
     OR (v_easyship_id IS NOT NULL AND v_fulfillment.external_fulfillment_id IS DISTINCT FROM v_easyship_id)
  THEN
    UPDATE public.order_fulfillments
    SET
      fulfillment_status = CASE
        WHEN public.easyship_fulfillment_rank(v_target) > public.easyship_fulfillment_rank(fulfillment_status)
          THEN v_target
        ELSE fulfillment_status
      END,
      carrier_code = COALESCE(carrier_code, 'easyship'),
      carrier_name = COALESCE(v_carrier, carrier_name, 'EasyShip'),
      tracking_number = COALESCE(v_tracking, tracking_number),
      shipping_label_url = COALESCE(v_label, shipping_label_url),
      shipping_cost = COALESCE(v_cost, shipping_cost),
      fulfillment_cost = COALESCE(v_cost, fulfillment_cost),
      external_fulfillment_id = COALESCE(v_easyship_id, external_fulfillment_id),
      fulfillment_method = COALESCE(fulfillment_method, 'easyship'),
      quantity_shipped = CASE
        WHEN public.easyship_fulfillment_rank(v_target) >= 4 THEN GREATEST(quantity_shipped, v_qty)
        ELSE quantity_shipped
      END,
      quantity_fulfilled = CASE
        WHEN public.easyship_fulfillment_rank(v_target) >= 4 THEN GREATEST(quantity_fulfilled, v_qty)
        ELSE quantity_fulfilled
      END,
      quantity_delivered = CASE
        WHEN v_target = 'delivered' THEN GREATEST(quantity_delivered, v_qty)
        ELSE quantity_delivered
      END,
      shipped_at = CASE
        WHEN public.easyship_fulfillment_rank(v_target) >= 4 THEN GREATEST(COALESCE(shipped_at, v_shipped_at, v_now), created_at)
        ELSE shipped_at
      END,
      delivered_at = CASE
        WHEN v_target = 'delivered' THEN GREATEST(COALESCE(delivered_at, v_delivered_at, v_now), COALESCE(shipped_at, created_at))
        ELSE delivered_at
      END,
      fulfillment_metadata = COALESCE(fulfillment_metadata::jsonb, '{}'::jsonb) || jsonb_build_object(
        'source', 'easyship',
        'tracking_url', COALESCE(v_tracking_url, fulfillment_metadata::jsonb ->> 'tracking_url'),
        'easyship_shipment_id', COALESCE(v_easyship_id, fulfillment_metadata::jsonb ->> 'easyship_shipment_id')
      ),
      updated_at = v_now
    WHERE id = v_fulfillment.id;

    IF public.easyship_fulfillment_rank(v_target) > public.easyship_fulfillment_rank(v_fulfillment.fulfillment_status) THEN
      INSERT INTO public.fulfillment_events (
        fulfillment_id, event_type, event_description, event_timestamp,
        previous_status, new_status, source_system, triggered_by, event_data
      ) VALUES (
        v_fulfillment.id,
        CASE WHEN v_tracking IS NOT NULL THEN 'carrier_scan' ELSE 'status_change' END,
        COALESCE('EasyShip ' || v_delivery_status, 'EasyShip fulfillment updated'),
        v_now,
        v_fulfillment.fulfillment_status,
        v_target,
        'easyship',
        v_shop_user,
        jsonb_build_object('tracking_number', v_tracking, 'label_url', v_label)
      );
    END IF;
  END IF;

  RETURN v_fulfillment.id;
END;
$$;

REVOKE ALL ON FUNCTION public.sync_easyship_order_fulfillment(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sync_easyship_order_fulfillment(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.trg_sync_easyship_fulfillment_from_item()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.item_status IS NOT DISTINCT FROM NEW.item_status THEN
    RETURN NEW;
  END IF;
  PERFORM public.sync_easyship_order_fulfillment(NEW.id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_order_items_easyship_fulfillment ON public.order_items;
CREATE TRIGGER trg_order_items_easyship_fulfillment
  AFTER INSERT OR UPDATE OF item_status ON public.order_items
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_sync_easyship_fulfillment_from_item();

CREATE OR REPLACE FUNCTION public.trg_sync_easyship_fulfillment_from_delivery()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.order_item_id IS NULL THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE'
     AND OLD.delivery_status IS NOT DISTINCT FROM NEW.delivery_status
     AND OLD.tracking_number IS NOT DISTINCT FROM NEW.tracking_number
     AND OLD.label_url IS NOT DISTINCT FROM NEW.label_url THEN
    RETURN NEW;
  END IF;
  PERFORM public.sync_easyship_order_fulfillment(NEW.order_item_id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_order_delivery_easyship_fulfillment ON public.order_delivery;
CREATE TRIGGER trg_order_delivery_easyship_fulfillment
  AFTER INSERT OR UPDATE OF delivery_status, tracking_number, label_url ON public.order_delivery
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_sync_easyship_fulfillment_from_delivery();

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT oi.id
    FROM public.order_items oi
    WHERE oi.item_status::text IN (
      'confirmed', 'processing', 'shipped', 'partially_shipped', 'in_transit',
      'out_for_delivery', 'delivered', 'completed', 'failed_delivery', 'returned'
    )
  LOOP
    PERFORM public.sync_easyship_order_fulfillment(r.id);
  END LOOP;
END $$;
