-- Paid marketplace orders auto-accept into processing (no manual Accept).
-- Fulfillment then buys the label; tracking + customer notifications follow carrier events.

-- Fix referral trigger: cast enum → text before coalesce (avoids ''::order_status_enum).
CREATE OR REPLACE FUNCTION public.referral_on_order_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_paid boolean;
  v_was_paid boolean;
  v_refunded boolean;
  v_shop uuid;
  v_new text := lower(coalesce(NEW.order_status::text, ''));
  v_old text := lower(coalesce(OLD.order_status::text, ''));
BEGIN
  v_paid := v_new IN (
    'paid', 'processing', 'shipped', 'delivered', 'completed', 'awaiting_fulfillment',
    'confirmed', 'in_transit', 'out_for_delivery', 'partially_shipped'
  );
  v_was_paid := v_old IN (
    'paid', 'processing', 'shipped', 'delivered', 'completed', 'awaiting_fulfillment',
    'confirmed', 'in_transit', 'out_for_delivery', 'partially_shipped'
  );
  v_refunded := v_new IN ('refunded', 'cancelled', 'canceled');

  IF v_paid AND NOT v_was_paid THEN
    PERFORM public.referral_try_credit_buyer_first_order(NEW.id);
    FOR v_shop IN
      SELECT DISTINCT oi.vendor_id
      FROM public.order_items oi
      WHERE oi.order_id = NEW.id AND oi.vendor_id IS NOT NULL
    LOOP
      PERFORM public.referral_try_credit_seller_first_sale(v_shop, NEW.id);
    END LOOP;
  END IF;

  IF v_refunded AND v_was_paid THEN
    PERFORM public.referral_try_clawback_for_order(NEW.id);
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.marketplace_auto_accept_paid_order(p_order_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order public.orders%ROWTYPE;
  v_items int := 0;
BEGIN
  IF p_order_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'order_required');
  END IF;

  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'order_not_found');
  END IF;

  UPDATE public.order_items
  SET
    item_status = 'processing'::public.order_status_enum,
    updated_at = now()
  WHERE order_id = p_order_id
    AND item_status IN (
      'awaiting_payment'::public.order_status_enum,
      'pending'::public.order_status_enum,
      'confirmed'::public.order_status_enum
    )
    AND item_status IS DISTINCT FROM 'cancelled'::public.order_status_enum
    AND item_status IS DISTINCT FROM 'refunded'::public.order_status_enum;

  GET DIAGNOSTICS v_items = ROW_COUNT;

  IF v_order.order_status IN (
    'awaiting_payment'::public.order_status_enum,
    'pending'::public.order_status_enum,
    'confirmed'::public.order_status_enum
  ) THEN
    UPDATE public.orders
    SET
      order_status = 'processing'::public.order_status_enum,
      updated_at = now()
    WHERE id = p_order_id;

    INSERT INTO public.order_status_logs (
      order_id, from_status, to_status, note, system_generated, change_metadata
    ) VALUES (
      p_order_id,
      v_order.order_status,
      'processing',
      'Payment completed — marketplace order auto-accepted for fulfillment',
      true,
      jsonb_build_object('trigger', 'marketplace_auto_accept_paid_order')
    );
  END IF;

  RETURN jsonb_build_object('ok', true, 'order_id', p_order_id, 'items_updated', v_items);
END;
$$;

REVOKE ALL ON FUNCTION public.marketplace_auto_accept_paid_order(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.marketplace_auto_accept_paid_order(uuid) TO service_role;

-- Payment row completed → auto-accept (replaces pending/Accept queue for paid orders).
CREATE OR REPLACE FUNCTION public.release_order_items_on_payment_completed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.payment_status IS DISTINCT FROM 'completed'::public.payment_status_enum THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE'
     AND OLD.payment_status IS NOT DISTINCT FROM 'completed'::public.payment_status_enum THEN
    RETURN NEW;
  END IF;

  IF NEW.order_id IS NULL THEN
    RETURN NEW;
  END IF;

  PERFORM public.marketplace_auto_accept_paid_order(NEW.order_id);

  UPDATE public.inventory_reservations r
  SET status = 'converted',
      converted_at = COALESCE(r.converted_at, now())
  FROM public.orders o
  WHERE o.id = NEW.order_id
    AND r.checkout_group_id IS NOT NULL
    AND r.checkout_group_id = NULLIF(o.order_metadata ->> 'checkout_group_id', '')::uuid
    AND r.status = 'reserved';

  RETURN NEW;
END;
$$;

-- When carrier tracking advances, keep line-item status in sync for vendor UI.
CREATE OR REPLACE FUNCTION public.sync_order_item_status_from_delivery()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item_status public.order_status_enum;
  v_order_status public.order_status_enum;
BEGIN
  IF NEW.order_item_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.delivery_status IS NOT DISTINCT FROM NEW.delivery_status THEN
    RETURN NEW;
  END IF;

  v_item_status := CASE NEW.delivery_status
    WHEN 'ready_to_ship'::public.delivery_status_enum THEN 'processing'::public.order_status_enum
    WHEN 'shipped'::public.delivery_status_enum THEN 'shipped'::public.order_status_enum
    WHEN 'in_transit'::public.delivery_status_enum THEN 'in_transit'::public.order_status_enum
    WHEN 'out_for_delivery'::public.delivery_status_enum THEN 'out_for_delivery'::public.order_status_enum
    WHEN 'delivered'::public.delivery_status_enum THEN 'delivered'::public.order_status_enum
    WHEN 'failed_delivery'::public.delivery_status_enum THEN 'failed_delivery'::public.order_status_enum
    WHEN 'returned_to_sender'::public.delivery_status_enum THEN 'returned'::public.order_status_enum
    WHEN 'cancelled'::public.delivery_status_enum THEN NULL
    ELSE NULL
  END;

  IF v_item_status IS NULL THEN
    RETURN NEW;
  END IF;

  UPDATE public.order_items
  SET item_status = v_item_status, updated_at = now()
  WHERE id = NEW.order_item_id
    AND item_status IS DISTINCT FROM 'cancelled'::public.order_status_enum
    AND item_status IS DISTINCT FROM 'refunded'::public.order_status_enum
    AND item_status IS DISTINCT FROM v_item_status;

  v_order_status := v_item_status;
  UPDATE public.orders
  SET order_status = v_order_status, updated_at = now()
  WHERE id = NEW.order_id
    AND order_status IS DISTINCT FROM 'cancelled'::public.order_status_enum
    AND order_status IS DISTINCT FROM 'refunded'::public.order_status_enum
    AND order_status IS DISTINCT FROM v_order_status
    -- Don't regress a multi-item parent that is already further along.
    AND (
      CASE order_status::text
        WHEN 'delivered' THEN 5
        WHEN 'out_for_delivery' THEN 4
        WHEN 'in_transit' THEN 3
        WHEN 'shipped' THEN 2
        WHEN 'processing' THEN 1
        ELSE 0
      END
    ) <= (
      CASE v_order_status::text
        WHEN 'delivered' THEN 5
        WHEN 'out_for_delivery' THEN 4
        WHEN 'in_transit' THEN 3
        WHEN 'shipped' THEN 2
        WHEN 'processing' THEN 1
        ELSE 0
      END
    );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_order_item_status_from_delivery ON public.order_delivery;
CREATE TRIGGER trg_sync_order_item_status_from_delivery
  AFTER INSERT OR UPDATE OF delivery_status ON public.order_delivery
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_order_item_status_from_delivery();

-- Extend live delivery notifier: ready_to_ship → processing customer ping.
DO $$
DECLARE
  v_def text;
BEGIN
  SELECT pg_get_functiondef(p.oid) INTO v_def
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'notify_delivery_status_change'
  LIMIT 1;

  IF v_def IS NULL THEN
    RAISE NOTICE 'notify_delivery_status_change missing — skip patch';
    RETURN;
  END IF;

  IF position('ready_to_ship'::text in v_def) = 0 THEN
    v_def := replace(
      v_def,
      'v_customer_template := CASE NEW.delivery_status
    WHEN ''shipped''::public.delivery_status_enum THEN',
      'v_customer_template := CASE NEW.delivery_status
    WHEN ''ready_to_ship''::public.delivery_status_enum THEN ''order_processing_customer''
    WHEN ''shipped''::public.delivery_status_enum THEN'
    );
    EXECUTE v_def;
  END IF;
END $$;

-- Backfill: paid items still waiting on Accept → auto-processing.
UPDATE public.order_items oi
SET item_status = 'processing'::public.order_status_enum, updated_at = now()
FROM public.orders o
WHERE o.id = oi.order_id
  AND oi.item_status = 'pending'::public.order_status_enum
  AND o.order_status IN (
    'pending'::public.order_status_enum,
    'confirmed'::public.order_status_enum,
    'processing'::public.order_status_enum
  )
  AND EXISTS (
    SELECT 1 FROM public.order_payments op
    WHERE op.order_id = o.id AND op.payment_status = 'completed'
  );

UPDATE public.orders o
SET order_status = 'processing'::public.order_status_enum, updated_at = now()
WHERE o.order_status IN (
  'pending'::public.order_status_enum,
  'confirmed'::public.order_status_enum
)
AND EXISTS (
  SELECT 1 FROM public.order_payments op
  WHERE op.order_id = o.id AND op.payment_status = 'completed'
)
AND EXISTS (
  SELECT 1 FROM public.order_items oi
  WHERE oi.order_id = o.id AND oi.item_status = 'processing'
);
