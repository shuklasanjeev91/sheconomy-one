-- Abandoned-cart reminders continue regularly until conversion (or cart expires).
-- Cadence: 1h → 24h → 72h, then every 48h up to 12 total sends, max 30 days idle.

ALTER TABLE public.cart_reminder_log
  DROP CONSTRAINT IF EXISTS cart_reminder_log_stage_check;

ALTER TABLE public.cart_reminder_log
  ADD CONSTRAINT cart_reminder_log_stage_check
  CHECK (stage BETWEEN 1 AND 20);

CREATE INDEX IF NOT EXISTS cart_reminder_log_cart_stage_idx
  ON public.cart_reminder_log (cart_id, stage DESC);

CREATE OR REPLACE FUNCTION public.process_abandoned_carts(
  p_limit integer DEFAULT 50
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r RECORD;
  v_stage smallint;
  v_idle interval;
  v_item_count integer;
  v_notification_id uuid;
  v_processed integer := 0;
  v_customer_name text;
  v_cart_total text;
  v_action_url text;
  v_max_stage smallint;
  v_last_sent timestamptz;
  v_app_base text := COALESCE(
    NULLIF(current_setting('app.settings.public_app_url', true), ''),
    'https://sheconomy.in'
  );
  -- After the 72h (stage 3) nudge, keep reminding every 48h.
  c_recurring_gap constant interval := interval '48 hours';
  c_max_stage constant smallint := 12;
  c_max_idle constant interval := interval '30 days';
BEGIN
  FOR r IN
    SELECT
      c.id AS cart_id,
      c.user_id,
      c.total_amount,
      c.currency,
      c.last_activity_at,
      c.status,
      GREATEST(
        COALESCE(c.last_activity_at, c.updated_at, c.created_at),
        COALESCE(c.updated_at, c.created_at)
      ) AS idle_since
    FROM public.carts c
    WHERE c.user_id IS NOT NULL
      AND c.status IN ('active', 'abandoned')
      AND COALESCE(c.total_amount, 0) > 0
      AND EXISTS (
        SELECT 1 FROM public.cart_items ci
        WHERE ci.cart_id = c.id AND ci.saved_for_later = false
      )
      AND c.converted_at IS NULL
    ORDER BY idle_since ASC
    LIMIT GREATEST(p_limit, 1)
  LOOP
    v_idle := now() - r.idle_since;

    -- Stop nagging very old carts (no conversion after 30 days idle).
    IF v_idle >= c_max_idle THEN
      CONTINUE;
    END IF;

    SELECT COALESCE(MAX(l.stage), 0)::smallint, MAX(l.created_at)
    INTO v_max_stage, v_last_sent
    FROM public.cart_reminder_log l
    WHERE l.cart_id = r.cart_id;

    IF v_max_stage >= c_max_stage THEN
      CONTINUE;
    END IF;

    v_stage := NULL;

    IF v_max_stage >= 3 THEN
      -- Recurring until conversion: every 48h after stage 3.
      IF v_last_sent IS NOT NULL
         AND (now() - v_last_sent) >= c_recurring_gap
         AND v_idle >= interval '72 hours' THEN
        v_stage := v_max_stage + 1;
      ELSE
        CONTINUE;
      END IF;
    ELSIF v_idle >= interval '72 hours' AND v_max_stage < 3 THEN
      v_stage := 3;
      IF v_max_stage < 2 THEN
        -- Must walk stages in order.
        v_stage := CASE WHEN v_max_stage < 1 THEN 1 ELSE 2 END;
      END IF;
    ELSIF v_idle >= interval '24 hours' AND v_max_stage < 2 THEN
      v_stage := CASE WHEN v_max_stage < 1 THEN 1 ELSE 2 END;
    ELSIF v_idle >= interval '1 hour' AND v_max_stage < 1 THEN
      v_stage := 1;
    ELSE
      CONTINUE;
    END IF;

    IF v_stage IS NULL OR v_stage <= v_max_stage THEN
      CONTINUE;
    END IF;

    -- Idempotency for initial stages (and safety for recurring).
    IF EXISTS (
      SELECT 1 FROM public.cart_reminder_log l
      WHERE l.cart_id = r.cart_id AND l.stage = v_stage
    ) THEN
      CONTINUE;
    END IF;

    SELECT COALESCE(SUM(ci.quantity), 0)::integer
    INTO v_item_count
    FROM public.cart_items ci
    WHERE ci.cart_id = r.cart_id
      AND ci.saved_for_later = false;

    IF v_item_count <= 0 THEN
      CONTINUE;
    END IF;

    SELECT COALESCE(
      NULLIF(p.full_name, ''),
      split_part(COALESCE(u.email, 'there'), '@', 1),
      'there'
    )
    INTO v_customer_name
    FROM auth.users u
    LEFT JOIN public.profiles p ON p.id = u.id
    WHERE u.id = r.user_id;

    v_cart_total := trim(both from to_char(COALESCE(r.total_amount, 0), 'FM999999990.00'))
      || ' ' || COALESCE(r.currency, 'INR');
    v_action_url := rtrim(v_app_base, '/') || '/cart';

    UPDATE public.carts
    SET status = 'abandoned', updated_at = now()
    WHERE id = r.cart_id
      AND status = 'active';

    BEGIN
      v_notification_id := public.create_notification_from_template(
        'cart_abandoned_customer',
        r.user_id,
        jsonb_build_object(
          'customer_name', v_customer_name,
          'user_name', v_customer_name,
          'item_count', v_item_count,
          'cart_total', v_cart_total,
          'action_url', v_action_url,
          'cart_id', r.cart_id,
          'stage', v_stage
        ),
        'cart',
        r.cart_id,
        NULL,
        NULL,
        NULL,
        CASE
          WHEN v_stage = 1 THEN 5
          WHEN v_stage = 2 THEN 4
          WHEN v_stage = 3 THEN 3
          ELSE 2
        END,
        NULL
      );
    EXCEPTION WHEN OTHERS THEN
      v_notification_id := NULL;
    END;

    INSERT INTO public.cart_reminder_log (cart_id, user_id, stage, notification_id)
    VALUES (r.cart_id, r.user_id, v_stage, v_notification_id)
    ON CONFLICT (cart_id, stage) DO NOTHING;

    IF v_notification_id IS NOT NULL THEN
      INSERT INTO public.notification_event_queue (
        event_key, recipient_id, payload, scheduled_for, status
      ) VALUES (
        'dispatch_notification',
        r.user_id,
        jsonb_build_object(
          'notification_id', v_notification_id,
          'cart_id', r.cart_id,
          'stage', v_stage
        ),
        now(),
        'pending'
      );
    END IF;

    v_processed := v_processed + 1;
  END LOOP;

  RETURN v_processed;
END;
$$;

REVOKE ALL ON FUNCTION public.process_abandoned_carts(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.process_abandoned_carts(integer) TO service_role;

COMMENT ON FUNCTION public.process_abandoned_carts(integer) IS
  'Sends abandoned-cart nudges at 1h/24h/72h then every 48h until conversion, empty cart, 12 sends, or 30 days idle.';
