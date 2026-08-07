-- SHEPay multi-vendor bundle: force shepay routing, charge-step kind,
-- and webhook that marks the whole checkout group paid.

-- ─── Schema ─────────────────────────────────────────────────────────────────

ALTER TABLE public.commerce_checkout_payment_steps
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'shop';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'commerce_checkout_payment_steps_kind_check'
  ) THEN
    ALTER TABLE public.commerce_checkout_payment_steps
      ADD CONSTRAINT commerce_checkout_payment_steps_kind_check
      CHECK (kind IN ('shop', 'charge'));
  END IF;
END $$;

ALTER TABLE public.commerce_checkout_payment_steps
  ALTER COLUMN shop_id DROP NOT NULL;

ALTER TABLE public.commerce_checkout_payment_steps
  DROP CONSTRAINT IF EXISTS commerce_checkout_payment_steps_checkout_group_id_shop_id_key;

CREATE UNIQUE INDEX IF NOT EXISTS commerce_checkout_steps_group_shop_unique
  ON public.commerce_checkout_payment_steps (checkout_group_id, shop_id)
  WHERE shop_id IS NOT NULL AND kind = 'shop';

CREATE UNIQUE INDEX IF NOT EXISTS commerce_checkout_steps_one_charge_per_group
  ON public.commerce_checkout_payment_steps (checkout_group_id)
  WHERE kind = 'charge';

-- ─── Consolidate N shepay shop steps → 1 charge step ───────────────────────

CREATE OR REPLACE FUNCTION public.finalize_shepay_bundle_charge(p_checkout_group_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_group public.commerce_checkout_groups%ROWTYPE;
  v_charge_id uuid;
  v_total numeric := 0;
  v_currency text := 'INR';
  v_allocations jsonb := '[]'::jsonb;
  v_key text;
BEGIN
  SELECT * INTO v_group
  FROM public.commerce_checkout_groups
  WHERE id = p_checkout_group_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Checkout group not found';
  END IF;

  IF v_group.payment_mode = 'cod' THEN
    RETURN jsonb_build_object('success', true, 'skipped', true, 'reason', 'cod');
  END IF;

  -- Already bundled
  SELECT id INTO v_charge_id
  FROM public.commerce_checkout_payment_steps
  WHERE checkout_group_id = p_checkout_group_id AND kind = 'charge'
  LIMIT 1;

  IF v_charge_id IS NOT NULL THEN
    RETURN jsonb_build_object('success', true, 'charge_step_id', v_charge_id, 'idempotent', true);
  END IF;

  SELECT coalesce(sum(ps.amount), 0),
         coalesce(max(ps.currency), v_group.currency, 'INR'),
         coalesce(
           jsonb_agg(
             jsonb_build_object(
               'shop_id', ps.shop_id,
               'order_id', ps.order_id,
               'amount', ps.amount,
               'currency', ps.currency,
               'order_number', ps.metadata->>'order_number'
             )
             ORDER BY ps.created_at
           ),
           '[]'::jsonb
         )
  INTO v_total, v_currency, v_allocations
  FROM public.commerce_checkout_payment_steps ps
  WHERE ps.checkout_group_id = p_checkout_group_id
    AND ps.collection = 'shepay'
    AND ps.kind = 'shop';

  IF v_total <= 0 OR jsonb_array_length(v_allocations) = 0 THEN
    RAISE EXCEPTION 'No SHEPay shop steps to bundle';
  END IF;

  v_key := v_group.idempotency_key || ':shepay_charge';

  DELETE FROM public.commerce_checkout_payment_steps
  WHERE checkout_group_id = p_checkout_group_id
    AND collection = 'shepay'
    AND kind = 'shop';

  INSERT INTO public.commerce_checkout_payment_steps (
    checkout_group_id, order_id, shop_id, collection, provider, status,
    amount, currency, idempotency_key, kind, metadata
  ) VALUES (
    p_checkout_group_id,
    NULL,
    NULL,
    'shepay',
    'shepay',
    'pending',
    v_total,
    v_currency,
    v_key,
    'charge',
    jsonb_build_object('allocations', v_allocations, 'bundle', true)
  )
  RETURNING id INTO v_charge_id;

  RETURN jsonb_build_object(
    'success', true,
    'charge_step_id', v_charge_id,
    'amount', v_total,
    'allocations', v_allocations
  );
END;
$$;

REVOKE ALL ON FUNCTION public.finalize_shepay_bundle_charge(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.finalize_shepay_bundle_charge(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_shepay_bundle_charge(uuid) TO service_role;

-- ─── Force online shops onto SHEPay inside atomic checkout ───────────────────
-- Patch via wrapping: after atomic creates per-shop steps, callers must call
-- finalize_shepay_bundle_charge. Also force routing on insert by replacing the
-- collection CASE through a trigger on INSERT.

CREATE OR REPLACE FUNCTION public.commerce_checkout_force_shepay_online()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.collection = 'direct' THEN
    NEW.collection := 'shepay';
    NEW.provider := 'shepay';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_force_shepay_online ON public.commerce_checkout_payment_steps;
CREATE TRIGGER trg_force_shepay_online
  BEFORE INSERT ON public.commerce_checkout_payment_steps
  FOR EACH ROW
  EXECUTE FUNCTION public.commerce_checkout_force_shepay_online();

-- ─── Webhook: charge step pays entire group ──────────────────────────────────

CREATE OR REPLACE FUNCTION public.process_checkout_payment_webhook(
  p_payment_step_id uuid,
  p_shop_id uuid,
  p_provider payment_provider_enum,
  p_webhook_id text,
  p_event_type text,
  p_status text,
  p_provider_reference text DEFAULT NULL,
  p_payload jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_step public.commerce_checkout_payment_steps%ROWTYPE;
  v_inserted uuid;
  v_group_status text;
  v_alloc jsonb;
  v_order_id uuid;
  v_shop_id uuid;
  v_webhook_shop uuid;
BEGIN
  IF p_status NOT IN ('requires_action', 'processing', 'paid', 'failed', 'cancelled') THEN
    RAISE EXCEPTION 'Invalid payment status';
  END IF;

  SELECT * INTO v_step
  FROM public.commerce_checkout_payment_steps
  WHERE id = p_payment_step_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Payment step not found';
  END IF;

  -- For legacy shop steps, keep shop_id check when provided and step has a shop.
  IF v_step.kind = 'shop' AND p_shop_id IS NOT NULL AND v_step.shop_id IS DISTINCT FROM p_shop_id THEN
    RAISE EXCEPTION 'Payment step shop mismatch';
  END IF;

  v_webhook_shop := coalesce(
    p_shop_id,
    v_step.shop_id,
    nullif(v_step.metadata->'allocations'->0->>'shop_id', '')::uuid
  );

  INSERT INTO public.payment_webhooks (
    shop_id, provider, webhook_id, event_type, payload, processed
  ) VALUES (
    v_webhook_shop,
    p_provider, p_webhook_id, p_event_type, coalesce(p_payload, '{}'::jsonb), false
  )
  ON CONFLICT (provider, webhook_id) DO NOTHING
  RETURNING id INTO v_inserted;

  IF v_inserted IS NULL THEN
    RETURN jsonb_build_object('duplicate', true, 'webhook_id', p_webhook_id);
  END IF;

  IF v_step.status <> 'paid' OR p_status = 'paid' THEN
    UPDATE public.commerce_checkout_payment_steps
    SET status = p_status,
        provider_reference = coalesce(p_provider_reference, provider_reference),
        last_error = CASE WHEN p_status = 'failed' THEN p_payload->>'error' ELSE NULL END,
        processed_at = CASE WHEN p_status IN ('paid', 'failed', 'cancelled') THEN now() ELSE processed_at END,
        updated_at = now()
    WHERE id = v_step.id;
  END IF;

  -- Bundle charge: promote every allocated order when paid
  IF p_status = 'paid' AND v_step.kind = 'charge' THEN
    FOR v_alloc IN
      SELECT * FROM jsonb_array_elements(coalesce(v_step.metadata->'allocations', '[]'::jsonb))
    LOOP
      v_order_id := nullif(v_alloc->>'order_id', '')::uuid;
      v_shop_id := nullif(v_alloc->>'shop_id', '')::uuid;

      IF v_order_id IS NOT NULL THEN
        UPDATE public.order_payments
        SET payment_status = 'completed'::payment_status_enum,
            gateway_transaction_id = coalesce(p_provider_reference, gateway_transaction_id),
            processed_at = now(),
            updated_at = now()
        WHERE order_id = v_order_id;

        WITH status_update AS (
          UPDATE public.orders
          SET order_status = 'pending', updated_at = now()
          WHERE id = v_order_id AND order_status = 'awaiting_payment'
          RETURNING id
        )
        INSERT INTO public.order_status_logs (
          order_id, from_status, to_status, note, system_generated, change_metadata
        )
        SELECT id, 'awaiting_payment', 'pending',
               'Payment confirmed — order released to vendor', true,
               jsonb_build_object(
                 'payment_step_id', v_step.id,
                 'provider', p_provider,
                 'provider_reference', p_provider_reference,
                 'shop_id', v_shop_id
               )
        FROM status_update;

        UPDATE public.order_items
        SET item_status = 'pending', updated_at = now()
        WHERE order_id = v_order_id AND item_status = 'awaiting_payment';

        BEGIN
          PERFORM public.dispatch_marketplace_order_notifications(v_order_id);
        EXCEPTION WHEN OTHERS THEN
          RAISE WARNING 'notification dispatch failed for order %: %', v_order_id, SQLERRM;
        END;
      END IF;
    END LOOP;
  ELSIF p_status = 'paid' AND v_step.order_id IS NOT NULL THEN
    -- Legacy single-shop step
    UPDATE public.order_payments
    SET payment_status = 'completed'::payment_status_enum,
        gateway_transaction_id = coalesce(p_provider_reference, gateway_transaction_id),
        processed_at = now(),
        updated_at = now()
    WHERE order_id = v_step.order_id;

    WITH status_update AS (
      UPDATE public.orders
      SET order_status = 'pending', updated_at = now()
      WHERE id = v_step.order_id AND order_status = 'awaiting_payment'
      RETURNING id
    )
    INSERT INTO public.order_status_logs (
      order_id, from_status, to_status, note, system_generated, change_metadata
    )
    SELECT id, 'awaiting_payment', 'pending',
           'Payment confirmed — order released to vendor', true,
           jsonb_build_object(
             'payment_step_id', v_step.id,
             'provider', p_provider,
             'provider_reference', p_provider_reference
           )
    FROM status_update;

    UPDATE public.order_items
    SET item_status = 'pending', updated_at = now()
    WHERE order_id = v_step.order_id AND item_status = 'awaiting_payment';

    BEGIN
      PERFORM public.dispatch_marketplace_order_notifications(v_step.order_id);
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'notification dispatch failed for order %: %', v_step.order_id, SQLERRM;
    END;
  END IF;

  SELECT CASE
    WHEN bool_and(status = 'paid') THEN 'paid'
    WHEN bool_or(status = 'paid') THEN 'partially_paid'
    WHEN bool_or(status IN ('pending', 'requires_action', 'processing')) THEN 'awaiting_payment'
    WHEN bool_and(status = 'cancelled') THEN 'cancelled'
    ELSE 'failed'
  END INTO v_group_status
  FROM public.commerce_checkout_payment_steps
  WHERE checkout_group_id = v_step.checkout_group_id;

  UPDATE public.commerce_checkout_groups
  SET status = v_group_status,
      paid_at = CASE WHEN v_group_status = 'paid' THEN now() ELSE paid_at END,
      last_error = CASE WHEN v_group_status = 'failed' THEN p_payload->>'error' ELSE NULL END,
      updated_at = now()
  WHERE id = v_step.checkout_group_id;

  IF v_group_status = 'paid' THEN
    UPDATE public.inventory_reservations
    SET status = 'converted', converted_at = now()
    WHERE checkout_group_id = v_step.checkout_group_id AND status = 'reserved';
  END IF;

  UPDATE public.payment_webhooks
  SET processed = true, processed_at = now(), updated_at = now()
  WHERE id = v_inserted;

  RETURN jsonb_build_object(
    'duplicate', false,
    'payment_step_id', v_step.id,
    'checkout_group_id', v_step.checkout_group_id,
    'status', p_status,
    'group_status', v_group_status,
    'kind', v_step.kind
  );
END;
$$;

REVOKE ALL ON FUNCTION public.process_checkout_payment_webhook(uuid, uuid, payment_provider_enum, text, text, text, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.process_checkout_payment_webhook(uuid, uuid, payment_provider_enum, text, text, text, text, jsonb) TO service_role;
