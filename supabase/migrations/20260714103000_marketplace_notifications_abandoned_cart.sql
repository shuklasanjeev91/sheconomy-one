-- Marketplace notifications: abandoned-cart reminders + back-in-stock interest + dispatch queue hooks.

-- ---------------------------------------------------------------------------
-- Reminder log (idempotent stages per cart)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.cart_reminder_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cart_id uuid NOT NULL REFERENCES public.carts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  stage smallint NOT NULL CHECK (stage BETWEEN 1 AND 3),
  notification_id uuid REFERENCES public.notifications(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (cart_id, stage)
);

CREATE INDEX IF NOT EXISTS cart_reminder_log_user_idx ON public.cart_reminder_log (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS cart_reminder_log_cart_idx ON public.cart_reminder_log (cart_id);

ALTER TABLE public.cart_reminder_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS cart_reminder_log_select_own ON public.cart_reminder_log;
CREATE POLICY cart_reminder_log_select_own
  ON public.cart_reminder_log
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Back-in-stock waitlist (marketplace “notify me”)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.listing_stock_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  notified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (listing_id, user_id)
);

CREATE INDEX IF NOT EXISTS listing_stock_alerts_listing_idx
  ON public.listing_stock_alerts (listing_id)
  WHERE notified_at IS NULL;

ALTER TABLE public.listing_stock_alerts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS listing_stock_alerts_select_own ON public.listing_stock_alerts;
CREATE POLICY listing_stock_alerts_select_own
  ON public.listing_stock_alerts FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS listing_stock_alerts_insert_own ON public.listing_stock_alerts;
CREATE POLICY listing_stock_alerts_insert_own
  ON public.listing_stock_alerts FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS listing_stock_alerts_delete_own ON public.listing_stock_alerts;
CREATE POLICY listing_stock_alerts_delete_own
  ON public.listing_stock_alerts FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Enrich abandoned-cart template channels + copy
-- ---------------------------------------------------------------------------
UPDATE public.notification_templates
SET
  default_channels = ARRAY['in_app', 'email', 'push', 'whatsapp'],
  email_subject_template = COALESCE(
    NULLIF(email_subject_template, ''),
    'You left {{item_count}} items in your SHEconomy cart'
  ),
  email_body_template = COALESCE(
    NULLIF(email_body_template, ''),
    '<p>Hi {{customer_name}},</p><p>Your cart worth <strong>{{cart_total}}</strong> ({{item_count}} items) is still waiting.</p><p><a href="{{action_url}}">Complete checkout</a> before popular items sell out.</p><p>— SHEconomy</p>'
  ),
  push_title_template = COALESCE(NULLIF(push_title_template, ''), 'You left items in your cart'),
  push_body_template = COALESCE(
    NULLIF(push_body_template, ''),
    '{{item_count}} items · {{cart_total}}. Tap to finish checkout.'
  ),
  whatsapp_template = COALESCE(
    NULLIF(whatsapp_template, ''),
    'Hi {{customer_name}}! You left {{item_count}} items ({{cart_total}}) in your SHEconomy cart. Complete checkout: {{action_url}}'
  ),
  action_url_template = COALESCE(NULLIF(action_url_template, ''), '{{action_url}}'),
  updated_at = now()
WHERE template_key = 'cart_abandoned_customer';

-- ---------------------------------------------------------------------------
-- Process idle carts → mark abandoned + create multi-channel notifications
-- Stages: 1 (~1h), 2 (~24h), 3 (~72h)
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
  v_app_base text := COALESCE(
    NULLIF(current_setting('app.settings.public_app_url', true), ''),
    'https://sheconomy.com'
  );
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
      AND EXISTS (SELECT 1 FROM public.cart_items ci WHERE ci.cart_id = c.id)
      AND c.converted_at IS NULL
    ORDER BY idle_since ASC
    LIMIT GREATEST(p_limit, 1)
  LOOP
    v_idle := now() - r.idle_since;

    IF v_idle >= interval '72 hours' THEN
      v_stage := 3;
    ELSIF v_idle >= interval '24 hours' THEN
      v_stage := 2;
    ELSIF v_idle >= interval '1 hour' THEN
      v_stage := 1;
    ELSE
      CONTINUE;
    END IF;

    -- Skip if this stage (or higher) already sent.
    IF EXISTS (
      SELECT 1 FROM public.cart_reminder_log l
      WHERE l.cart_id = r.cart_id AND l.stage >= v_stage
    ) THEN
      CONTINUE;
    END IF;

    -- Only send the next sequential stage.
    IF v_stage > 1 AND NOT EXISTS (
      SELECT 1 FROM public.cart_reminder_log l
      WHERE l.cart_id = r.cart_id AND l.stage = v_stage - 1
    ) THEN
      -- Catch-up: send missed intermediate stage first.
      v_stage := v_stage - 1;
      IF EXISTS (
        SELECT 1 FROM public.cart_reminder_log l
        WHERE l.cart_id = r.cart_id AND l.stage = v_stage
      ) THEN
        CONTINUE;
      END IF;
    END IF;

    SELECT COALESCE(SUM(ci.quantity), 0)::integer
    INTO v_item_count
    FROM public.cart_items ci
    WHERE ci.cart_id = r.cart_id;

    IF v_item_count <= 0 THEN
      CONTINUE;
    END IF;

    SELECT COALESCE(NULLIF(p.full_name, ''), split_part(COALESCE(u.email, 'there'), '@', 1), 'there')
    INTO v_customer_name
    FROM auth.users u
    LEFT JOIN public.profiles p ON p.id = u.id
    WHERE u.id = r.user_id;

    v_cart_total := trim(both FROM to_char(COALESCE(r.total_amount, 0), 'FM999999990.00'))
      || ' ' || COALESCE(r.currency, 'INR');
    v_action_url := v_app_base || '/cart';

    -- Mark cart abandoned (keeps admin abandoned reporting accurate).
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
        CASE WHEN v_stage = 1 THEN 5 WHEN v_stage = 2 THEN 4 ELSE 3 END,
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
        jsonb_build_object('notification_id', v_notification_id, 'cart_id', r.cart_id, 'stage', v_stage),
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

-- ---------------------------------------------------------------------------
-- Notify waitlisted buyers when a listing returns to stock
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.notify_listing_back_in_stock()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r RECORD;
  v_notification_id uuid;
  v_shop_name text;
  v_product_name text;
  v_action_url text;
  v_app_base text := COALESCE(
    NULLIF(current_setting('app.settings.public_app_url', true), ''),
    'https://sheconomy.com'
  );
  v_prev_qty numeric;
  v_new_qty numeric;
BEGIN
  v_prev_qty := COALESCE(OLD.quantity, OLD.stock, 0);
  v_new_qty := COALESCE(NEW.quantity, NEW.stock, 0);

  IF NOT (v_prev_qty <= 0 AND v_new_qty > 0) THEN
    RETURN NEW;
  END IF;

  v_product_name := NEW.title;
  SELECT s.shop_name INTO v_shop_name FROM public.shops s WHERE s.id = NEW.shop_id;

  v_action_url := v_app_base || '/listing/' || COALESCE(NEW.slug, NEW.id::text);

  FOR r IN
    SELECT a.id AS alert_id, a.user_id
    FROM public.listing_stock_alerts a
    WHERE a.listing_id = NEW.id
      AND a.notified_at IS NULL
    LIMIT 200
  LOOP
    BEGIN
      v_notification_id := public.create_notification_from_template(
        'product_back_in_stock',
        r.user_id,
        jsonb_build_object(
          'product_name', COALESCE(v_product_name, 'An item'),
          'shop_name', COALESCE(v_shop_name, 'a shop'),
          'product_id', NEW.id,
          'action_url', v_action_url
        ),
        'listing',
        NEW.id
      );
    EXCEPTION WHEN OTHERS THEN
      v_notification_id := NULL;
    END;

    UPDATE public.listing_stock_alerts
    SET notified_at = now()
    WHERE id = r.alert_id;

    IF v_notification_id IS NOT NULL THEN
      INSERT INTO public.notification_event_queue (
        event_key, recipient_id, payload, scheduled_for, status
      ) VALUES (
        'dispatch_notification',
        r.user_id,
        jsonb_build_object('notification_id', v_notification_id, 'listing_id', NEW.id),
        now(),
        'pending'
      );
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_listing_back_in_stock ON public.listings;
CREATE TRIGGER trg_listing_back_in_stock
  AFTER UPDATE OF quantity, stock ON public.listings
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_listing_back_in_stock();

-- ---------------------------------------------------------------------------
-- Cron: mark/notify abandoned carts every 15 minutes
-- ---------------------------------------------------------------------------
SELECT cron.unschedule(jobid)
FROM cron.job
WHERE jobname = 'process-abandoned-carts';

SELECT cron.schedule(
  'process-abandoned-carts',
  '*/15 * * * *',
  $$SELECT public.process_abandoned_carts(100);$$
);
