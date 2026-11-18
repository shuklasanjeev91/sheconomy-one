-- Abandoned cart: after 48h, remind daily until conversion.
-- Also nudge buyers who started checkout (awaiting_payment) but never paid.

-- ---------------------------------------------------------------------------
-- Cart cadence: 1h → 24h → 48h, then every 24h (daily)
-- ---------------------------------------------------------------------------
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
  c_daily_gap constant interval := interval '24 hours';
  c_max_stage constant smallint := 20;
  c_max_idle constant interval := interval '30 days';
BEGIN
  FOR r IN
    SELECT
      c.id AS cart_id,
      c.user_id,
      c.total_amount,
      c.currency,
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
      -- Checkout-abandonment emails cover open payment sessions.
      AND NOT EXISTS (
        SELECT 1
        FROM public.commerce_checkout_groups g
        WHERE g.cart_id = c.id
          AND g.status = 'awaiting_payment'
          AND g.paid_at IS NULL
          AND g.cancelled_at IS NULL
      )
    ORDER BY idle_since ASC
    LIMIT GREATEST(p_limit, 1)
  LOOP
    v_idle := now() - r.idle_since;
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
      -- Daily after the 48h (stage 3) nudge.
      IF v_last_sent IS NOT NULL
         AND (now() - v_last_sent) >= c_daily_gap
         AND v_idle >= interval '48 hours' THEN
        v_stage := v_max_stage + 1;
      ELSE
        CONTINUE;
      END IF;
    ELSIF v_idle >= interval '48 hours' AND v_max_stage < 3 THEN
      v_stage := CASE
        WHEN v_max_stage < 1 THEN 1
        WHEN v_max_stage < 2 THEN 2
        ELSE 3
      END;
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
        CASE WHEN v_stage <= 2 THEN 5 WHEN v_stage = 3 THEN 4 ELSE 3 END,
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

COMMENT ON FUNCTION public.process_abandoned_carts(integer) IS
  'Abandoned-cart nudges at 1h/24h/48h then daily until conversion (max 20 sends / 30 days idle). Skips carts with open awaiting_payment checkout.';

-- ---------------------------------------------------------------------------
-- Checkout abandonment (left at payment)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.checkout_reminder_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  checkout_group_id uuid NOT NULL REFERENCES public.commerce_checkout_groups(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  stage smallint NOT NULL CHECK (stage BETWEEN 1 AND 20),
  notification_id uuid REFERENCES public.notifications(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (checkout_group_id, stage)
);

CREATE INDEX IF NOT EXISTS checkout_reminder_log_user_idx
  ON public.checkout_reminder_log (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS checkout_reminder_log_group_idx
  ON public.checkout_reminder_log (checkout_group_id, stage DESC);

ALTER TABLE public.checkout_reminder_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS checkout_reminder_log_select_own ON public.checkout_reminder_log;
CREATE POLICY checkout_reminder_log_select_own
  ON public.checkout_reminder_log
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

INSERT INTO public.notification_templates (
  template_key, platform, category, title_template, message_template,
  email_subject_template, email_body_template,
  push_title_template, push_body_template, whatsapp_template,
  action_url_template, default_channels, default_priority, is_active
)
VALUES (
  'checkout_abandoned_customer',
  'marketplace',
  'promotional',
  'Complete your checkout',
  'Your order of {{checkout_total}} is waiting for payment.',
  'Complete your SHEconomy checkout',
  $html$
<p style="margin:0 0 14px;color:#5c5c6e;font-size:15px;line-height:1.7;">Hi {{customer_name}},</p>
<p style="margin:0 0 14px;color:#5c5c6e;font-size:15px;line-height:1.7;">You started checkout but did not finish payment. Your order (<strong>{{item_count}}</strong> item(s) · <strong>{{checkout_total}}</strong>) is still waiting.</p>
<div style="text-align:center;margin:24px 0 8px;"><a href="{{action_url}}" style="display:inline-block;background:linear-gradient(135deg,#D81B60 0%,#FF5E9B 50%,#FF8C42 100%);color:#ffffff;font-weight:700;font-size:15px;text-decoration:none;padding:14px 36px;border-radius:50px;box-shadow:0 4px 14px rgba(216,27,96,0.35);letter-spacing:0.3px;">Complete payment</a></div>
$html$,
  'Finish your checkout',
  '{{item_count}} item(s) · {{checkout_total}}. Tap to complete payment.',
  'Hi {{customer_name}}! Your SHEconomy checkout ({{checkout_total}}) is waiting. Complete payment: {{action_url}}',
  '/checkout',
  ARRAY['in_app', 'email', 'push', 'whatsapp']::text[],
  4,
  true
)
ON CONFLICT (template_key) DO UPDATE SET
  email_subject_template = EXCLUDED.email_subject_template,
  email_body_template = EXCLUDED.email_body_template,
  push_title_template = EXCLUDED.push_title_template,
  push_body_template = EXCLUDED.push_body_template,
  whatsapp_template = EXCLUDED.whatsapp_template,
  action_url_template = EXCLUDED.action_url_template,
  default_channels = EXCLUDED.default_channels,
  is_active = true,
  updated_at = now();

CREATE OR REPLACE FUNCTION public.process_abandoned_checkouts(
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
  v_checkout_total text;
  v_action_url text;
  v_max_stage smallint;
  v_last_sent timestamptz;
  v_app_base text := COALESCE(
    NULLIF(current_setting('app.settings.public_app_url', true), ''),
    'https://sheconomy.in'
  );
  c_daily_gap constant interval := interval '24 hours';
  c_max_stage constant smallint := 20;
  c_max_idle constant interval := interval '30 days';
BEGIN
  FOR r IN
    SELECT
      g.id AS checkout_group_id,
      g.buyer_id AS user_id,
      g.cart_id,
      g.total_amount,
      g.currency,
      COALESCE(g.updated_at, g.created_at) AS idle_since
    FROM public.commerce_checkout_groups g
    WHERE g.buyer_id IS NOT NULL
      AND g.status = 'awaiting_payment'
      AND g.paid_at IS NULL
      AND g.cancelled_at IS NULL
      AND COALESCE(g.total_amount, 0) > 0
      AND (g.expires_at IS NULL OR g.expires_at > now())
    ORDER BY idle_since ASC
    LIMIT GREATEST(p_limit, 1)
  LOOP
    v_idle := now() - r.idle_since;
    IF v_idle >= c_max_idle THEN
      CONTINUE;
    END IF;

    SELECT COALESCE(MAX(l.stage), 0)::smallint, MAX(l.created_at)
    INTO v_max_stage, v_last_sent
    FROM public.checkout_reminder_log l
    WHERE l.checkout_group_id = r.checkout_group_id;

    IF v_max_stage >= c_max_stage THEN
      CONTINUE;
    END IF;

    v_stage := NULL;

    IF v_max_stage >= 3 THEN
      IF v_last_sent IS NOT NULL
         AND (now() - v_last_sent) >= c_daily_gap
         AND v_idle >= interval '48 hours' THEN
        v_stage := v_max_stage + 1;
      ELSE
        CONTINUE;
      END IF;
    ELSIF v_idle >= interval '48 hours' AND v_max_stage < 3 THEN
      v_stage := CASE
        WHEN v_max_stage < 1 THEN 1
        WHEN v_max_stage < 2 THEN 2
        ELSE 3
      END;
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

    IF EXISTS (
      SELECT 1 FROM public.checkout_reminder_log l
      WHERE l.checkout_group_id = r.checkout_group_id AND l.stage = v_stage
    ) THEN
      CONTINUE;
    END IF;

    -- Prefer reserved lines / selected cart items when present.
    SELECT COALESCE(SUM(ci.quantity), 0)::integer
    INTO v_item_count
    FROM public.cart_items ci
    WHERE r.cart_id IS NOT NULL
      AND ci.cart_id = r.cart_id
      AND ci.saved_for_later = false;

    IF v_item_count <= 0 THEN
      SELECT GREATEST(COALESCE(cardinality(g.selected_cart_item_ids), 0), 1)
      INTO v_item_count
      FROM public.commerce_checkout_groups g
      WHERE g.id = r.checkout_group_id;
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

    v_checkout_total := trim(both from to_char(COALESCE(r.total_amount, 0), 'FM999999990.00'))
      || ' ' || COALESCE(r.currency, 'INR');
    v_action_url := rtrim(v_app_base, '/') || '/checkout';

    BEGIN
      v_notification_id := public.create_notification_from_template(
        'checkout_abandoned_customer',
        r.user_id,
        jsonb_build_object(
          'customer_name', v_customer_name,
          'user_name', v_customer_name,
          'item_count', v_item_count,
          'checkout_total', v_checkout_total,
          'cart_total', v_checkout_total,
          'action_url', v_action_url,
          'checkout_group_id', r.checkout_group_id,
          'cart_id', r.cart_id,
          'stage', v_stage
        ),
        'checkout_group',
        r.checkout_group_id,
        NULL,
        NULL,
        NULL,
        CASE WHEN v_stage <= 2 THEN 5 WHEN v_stage = 3 THEN 4 ELSE 3 END,
        NULL
      );
    EXCEPTION WHEN OTHERS THEN
      v_notification_id := NULL;
    END;

    INSERT INTO public.checkout_reminder_log (
      checkout_group_id, user_id, stage, notification_id
    ) VALUES (
      r.checkout_group_id, r.user_id, v_stage, v_notification_id
    )
    ON CONFLICT (checkout_group_id, stage) DO NOTHING;

    IF v_notification_id IS NOT NULL THEN
      INSERT INTO public.notification_event_queue (
        event_key, recipient_id, payload, scheduled_for, status
      ) VALUES (
        'dispatch_notification',
        r.user_id,
        jsonb_build_object(
          'notification_id', v_notification_id,
          'checkout_group_id', r.checkout_group_id,
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

REVOKE ALL ON FUNCTION public.process_abandoned_checkouts(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.process_abandoned_checkouts(integer) TO service_role;

COMMENT ON FUNCTION public.process_abandoned_checkouts(integer) IS
  'Nudge buyers who left checkout awaiting payment: 1h/24h/48h then daily until paid/cancelled (max 20 / 30 days).';

-- Fold into the existing reminders worker + dedicated cron.
CREATE OR REPLACE FUNCTION public.process_product_reminders(
  p_limit integer DEFAULT 100
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_meetings integer := 0;
  v_orders integer := 0;
  v_events integer := 0;
  v_carts integer := 0;
  v_checkouts integer := 0;
BEGIN
  BEGIN
    v_meetings := public.schedule_meeting_reminders();
  EXCEPTION WHEN OTHERS THEN
    v_meetings := 0;
  END;

  BEGIN
    v_orders := public.process_order_confirmation_reminders(p_limit);
  EXCEPTION WHEN OTHERS THEN
    v_orders := 0;
  END;

  BEGIN
    v_events := public.process_event_reminders();
  EXCEPTION WHEN OTHERS THEN
    v_events := 0;
  END;

  BEGIN
    v_carts := public.process_abandoned_carts(p_limit);
  EXCEPTION WHEN OTHERS THEN
    v_carts := 0;
  END;

  BEGIN
    v_checkouts := public.process_abandoned_checkouts(p_limit);
  EXCEPTION WHEN OTHERS THEN
    v_checkouts := 0;
  END;

  RETURN jsonb_build_object(
    'meetings', v_meetings,
    'order_confirmations', v_orders,
    'events', v_events,
    'abandoned_carts', v_carts,
    'abandoned_checkouts', v_checkouts,
    'at', now()
  );
END;
$$;

SELECT cron.unschedule(jobid)
FROM cron.job
WHERE jobname = 'process-abandoned-checkouts';

SELECT cron.schedule(
  'process-abandoned-checkouts',
  '*/15 * * * *',
  $$SELECT public.process_abandoned_checkouts(100);$$
);
