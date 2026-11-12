-- Phase 3: hold PayU settlements until delivery + return window + no open dispute.

ALTER TABLE public.shepay_pending_settlements
  ADD COLUMN IF NOT EXISTS order_id uuid REFERENCES public.orders (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS hold_reason text,
  ADD COLUMN IF NOT EXISTS split_status text NOT NULL DEFAULT 'not_split',
  ADD COLUMN IF NOT EXISTS sub_txn_id text,
  ADD COLUMN IF NOT EXISTS split_payload jsonb,
  ADD COLUMN IF NOT EXISTS split_at timestamptz,
  ADD COLUMN IF NOT EXISTS eligible_at timestamptz;

ALTER TABLE public.shepay_pending_settlements
  DROP CONSTRAINT IF EXISTS shepay_pending_settlements_hold_reason_check;
ALTER TABLE public.shepay_pending_settlements
  ADD CONSTRAINT shepay_pending_settlements_hold_reason_check
  CHECK (
    hold_reason IS NULL
    OR hold_reason IN (
      'awaiting_release_window',
      'awaiting_child',
      'dispute',
      'refunded'
    )
  );

ALTER TABLE public.shepay_pending_settlements
  DROP CONSTRAINT IF EXISTS shepay_pending_settlements_split_status_check;
ALTER TABLE public.shepay_pending_settlements
  ADD CONSTRAINT shepay_pending_settlements_split_status_check
  CHECK (split_status IN ('not_split', 'split', 'split_failed'));

UPDATE public.shepay_pending_settlements
SET hold_reason = COALESCE(hold_reason, 'awaiting_child')
WHERE hold_reason IS NULL
  AND status IN ('pending', 'failed', 'releasing');

CREATE INDEX IF NOT EXISTS shepay_pending_settlements_order_idx
  ON public.shepay_pending_settlements (order_id)
  WHERE order_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS shepay_pending_settlements_hold_reason_idx
  ON public.shepay_pending_settlements (hold_reason, status);

COMMENT ON TABLE public.shepay_pending_settlements IS
  'SHEPay amounts held at PayU until delivery + return window with no open dispute (or until child connects).';

-- ---------------------------------------------------------------------------
-- Eligibility helpers
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.shepay_order_has_open_dispute(p_order_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.order_issues oi
    WHERE oi.order_id = p_order_id
      AND COALESCE(oi.status, 'open') NOT IN ('resolved', 'closed', 'cancelled', 'rejected')
  );
$$;

REVOKE ALL ON FUNCTION public.shepay_order_has_open_dispute(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.shepay_order_has_open_dispute(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.shepay_order_release_eligible(p_order_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r RECORD;
  v_delivered_at timestamptz;
  v_window integer;
  v_paid_at timestamptz;
  v_needs_shipping boolean;
  v_active_items integer := 0;
BEGIN
  IF p_order_id IS NULL THEN
    RETURN false;
  END IF;

  IF public.shepay_order_has_open_dispute(p_order_id) THEN
    RETURN false;
  END IF;

  SELECT COALESCE(
           (
             SELECT c.paid_at
             FROM public.commerce_checkout_groups c
             WHERE c.id = nullif(o.order_metadata->>'checkout_group_id', '')::uuid
           ),
           o.created_at
         )
  INTO v_paid_at
  FROM public.orders o
  WHERE o.id = p_order_id;

  IF NOT FOUND OR v_paid_at IS NULL THEN
    RETURN false;
  END IF;

  FOR r IN
    SELECT oi.id, oi.listing_id, l.listing_type, coalesce(l.shipping_required, true) AS shipping_required
    FROM public.order_items oi
    LEFT JOIN public.listings l ON l.id = oi.listing_id
    WHERE oi.order_id = p_order_id
      AND oi.item_status IS DISTINCT FROM 'cancelled'
      AND oi.item_status IS DISTINCT FROM 'refunded'
  LOOP
    v_active_items := v_active_items + 1;
    v_needs_shipping :=
      COALESCE(r.listing_type, 'physical') IS DISTINCT FROM 'digital'
      AND COALESCE(r.shipping_required, true);

    v_delivered_at := public._item_delivered_at(r.id);
    IF v_delivered_at IS NULL AND NOT v_needs_shipping THEN
      v_delivered_at := v_paid_at;
    END IF;
    IF v_delivered_at IS NULL THEN
      RETURN false;
    END IF;

    SELECT COALESCE(p.return_window_days, 30)
    INTO v_window
    FROM public._resolve_item_return_policy(r.id) p;

    IF now() < v_delivered_at + make_interval(days => GREATEST(COALESCE(v_window, 30), 0)) THEN
      RETURN false;
    END IF;
  END LOOP;

  -- Empty order (all cancelled) is not eligible for payout.
  RETURN v_active_items > 0;
END;
$$;

REVOKE ALL ON FUNCTION public.shepay_order_release_eligible(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.shepay_order_release_eligible(uuid) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Dispute hold trigger
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.shepay_sync_dispute_hold_from_issue()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_open boolean;
BEGIN
  IF NEW.order_id IS NULL THEN
    RETURN NEW;
  END IF;

  v_open := public.shepay_order_has_open_dispute(NEW.order_id);

  IF v_open THEN
    UPDATE public.shepay_pending_settlements
    SET hold_reason = 'dispute',
        updated_at = now()
    WHERE order_id = NEW.order_id
      AND status IN ('pending', 'failed', 'releasing')
      AND COALESCE(hold_reason, '') IS DISTINCT FROM 'refunded';
  ELSE
    UPDATE public.shepay_pending_settlements s
    SET hold_reason = CASE
          WHEN s.split_status = 'not_split'
               AND (s.child_merchant_key IS NULL OR s.child_mid IS NULL)
            THEN 'awaiting_child'
          ELSE 'awaiting_release_window'
        END,
        updated_at = now()
    WHERE s.order_id = NEW.order_id
      AND s.status IN ('pending', 'failed')
      AND s.hold_reason = 'dispute';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS shepay_dispute_hold_trg ON public.order_issues;
CREATE TRIGGER shepay_dispute_hold_trg
  AFTER INSERT OR UPDATE OF status, order_id ON public.order_issues
  FOR EACH ROW
  EXECUTE FUNCTION public.shepay_sync_dispute_hold_from_issue();

-- ---------------------------------------------------------------------------
-- Patch process_checkout_payment_webhook: fee stamp + cancel on failure
-- ---------------------------------------------------------------------------

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
  v_cancel jsonb;
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
        metadata = CASE
          WHEN p_status = 'paid' THEN
            coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
              'platform_fee_amount', 0,
              'commission_applies', false
            )
          ELSE metadata
        END,
        updated_at = now()
    WHERE id = v_step.id;
  END IF;

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
            payment_metadata = coalesce(payment_metadata, '{}'::jsonb) || jsonb_build_object(
              'platform_fee_amount', 0,
              'commission_applies', false,
              'shop_id', v_shop_id,
              'payment_step_id', v_step.id
            ),
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
                 'shop_id', v_shop_id,
                 'platform_fee_amount', 0
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
    UPDATE public.order_payments
    SET payment_status = 'completed'::payment_status_enum,
        gateway_transaction_id = coalesce(p_provider_reference, gateway_transaction_id),
        payment_metadata = coalesce(payment_metadata, '{}'::jsonb) || jsonb_build_object(
          'platform_fee_amount', 0,
          'commission_applies', false,
          'payment_step_id', v_step.id
        ),
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
             'provider_reference', p_provider_reference,
             'platform_fee_amount', 0
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

  -- Payment failure: cancel unpaid group, release reservations, restore cart.
  IF p_status = 'failed' AND v_group_status = 'failed' THEN
    BEGIN
      v_cancel := public._cancel_unpaid_checkout_group(v_step.checkout_group_id);
    EXCEPTION WHEN OTHERS THEN
      -- Group may already be cancelled or paid; still release reserved stock.
      UPDATE public.listings l
      SET quantity = CASE WHEN l.quantity IS NULL THEN NULL ELSE l.quantity + r.quantity END,
          updated_at = now()
      FROM public.inventory_reservations r
      WHERE r.checkout_group_id = v_step.checkout_group_id
        AND r.listing_id = l.id
        AND r.status = 'reserved';

      UPDATE public.listing_variations lv
      SET stock = CASE WHEN lv.stock IS NULL THEN NULL ELSE lv.stock + r.quantity END,
          updated_at = now()
      FROM public.inventory_reservations r
      WHERE r.checkout_group_id = v_step.checkout_group_id
        AND r.variation_id = lv.id
        AND r.status = 'reserved';

      UPDATE public.inventory_reservations
      SET status = 'released', released_at = now()
      WHERE checkout_group_id = v_step.checkout_group_id AND status = 'reserved';

      v_cancel := jsonb_build_object('status', 'released_reservations_only', 'error', SQLERRM);
    END;
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
    'kind', v_step.kind,
    'cancel', v_cancel
  );
END;
$$;

REVOKE ALL ON FUNCTION public.process_checkout_payment_webhook(uuid, uuid, payment_provider_enum, text, text, text, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.process_checkout_payment_webhook(uuid, uuid, payment_provider_enum, text, text, text, text, jsonb) TO service_role;

-- ---------------------------------------------------------------------------
-- Hourly release cron → shepay-release-settlement
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  v_project_url text := 'https://zsaqrrzwygzwrlzgymxk.supabase.co';
  v_secret text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    RETURN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_net') THEN
    RETURN;
  END IF;

  BEGIN
    SELECT decrypted_secret INTO v_secret
    FROM vault.decrypted_secrets WHERE name = 'notification_cron_secret' LIMIT 1;
  EXCEPTION WHEN OTHERS THEN
    v_secret := NULL;
  END;

  IF v_secret IS NULL OR length(trim(v_secret)) = 0 THEN
    RAISE NOTICE 'shepay-release-settlement cron skipped: missing notification_cron_secret';
    RETURN;
  END IF;

  PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname = 'shepay-release-settlement';
  PERFORM cron.schedule(
    'shepay-release-settlement',
    '0 * * * *',
    format(
      $cron$
      SELECT net.http_post(
        url := %L || '/functions/v1/shepay-release-settlement',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'x-cron-secret', %L
        ),
        body := jsonb_build_object('limit', 50)
      );
      $cron$,
      rtrim(v_project_url, '/'),
      v_secret
    )
  );
END $$;
