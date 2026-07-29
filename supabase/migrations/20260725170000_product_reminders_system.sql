-- Unified product reminder system:
-- Co-Work meeting reminders, order confirmation nudges, low-stock vendor alerts,
-- community event reminders. Cart abandoned + back-in-stock already cron/trigger-backed.

-- ---------------------------------------------------------------------------
-- Templates: in-app deep links (web + native) + event reminders
-- ---------------------------------------------------------------------------
UPDATE public.notification_templates
SET
  action_url_template = '/co-work/meeting/{{meeting_code}}',
  push_title_template = 'Meeting in 30 minutes',
  push_body_template = '{{meeting_title}} starts soon',
  default_channels = ARRAY['in_app', 'push', 'email']::text[],
  updated_at = now()
WHERE template_key = 'meeting_reminder_30min';

UPDATE public.notification_templates
SET
  action_url_template = '/co-work/meeting/{{meeting_code}}',
  push_title_template = 'Meeting in 5 minutes',
  push_body_template = '{{meeting_title}} is about to start',
  default_channels = ARRAY['in_app', 'push']::text[],
  updated_at = now()
WHERE template_key = 'meeting_reminder_5min';

UPDATE public.notification_templates
SET
  action_url_template = '/vendor/orders',
  push_title_template = 'Confirm order',
  push_body_template = 'Order {{order_number}} still needs confirmation',
  default_channels = ARRAY['in_app', 'push', 'email']::text[],
  updated_at = now()
WHERE template_key = 'order_confirmation_reminder_vendor';

UPDATE public.notification_templates
SET
  action_url_template = '/vendor/products',
  push_title_template = 'Low stock',
  push_body_template = '{{listing_title}} is running low ({{stock_left}} left)',
  default_channels = ARRAY['in_app', 'email', 'push']::text[],
  updated_at = now()
WHERE template_key = 'low_stock_alert_vendor';

UPDATE public.notification_templates
SET
  action_url_template = '/listing/{{product_id}}',
  push_title_template = 'Back in stock',
  push_body_template = '{{product_name}} is available again',
  updated_at = now()
WHERE template_key = 'product_back_in_stock';

UPDATE public.notification_templates
SET
  action_url_template = '/cart',
  push_title_template = 'Items waiting in your cart',
  updated_at = now()
WHERE template_key = 'cart_abandoned_customer';

INSERT INTO public.notification_templates (
  template_key, platform, category, title_template, message_template,
  email_subject_template, email_body_template, sms_template,
  push_title_template, push_body_template, whatsapp_template,
  action_url_template, default_channels, default_priority, is_active
)
VALUES
(
  'event_reminder_60min', 'community', 'transactional',
  '{{event_title}} starts in 1 hour',
  'Your registered event "{{event_title}}" begins at {{starts_at}}.',
  '{{event_title}} starts in 1 hour',
  '<p>Your event <strong>{{event_title}}</strong> starts at {{starts_at}}.</p><p><a href="{{action_url}}">Open event</a></p>',
  NULL,
  'Event in 1 hour',
  '{{event_title}} · {{starts_at}}',
  NULL,
  '/community/events/{{event_id}}',
  ARRAY['in_app', 'push', 'email']::text[], 2, true
),
(
  'event_reminder_15min', 'community', 'transactional',
  '{{event_title}} starts soon',
  '"{{event_title}}" begins in about 15 minutes.',
  '{{event_title}} starts soon',
  '<p><strong>{{event_title}}</strong> starts in about 15 minutes.</p><p><a href="{{action_url}}">Join / open event</a></p>',
  NULL,
  'Event starting soon',
  '{{event_title}} · 15 minutes',
  NULL,
  '/community/events/{{event_id}}',
  ARRAY['in_app', 'push']::text[], 1, true
)
ON CONFLICT (template_key) DO UPDATE SET
  platform = EXCLUDED.platform,
  category = EXCLUDED.category,
  title_template = EXCLUDED.title_template,
  message_template = EXCLUDED.message_template,
  email_subject_template = EXCLUDED.email_subject_template,
  email_body_template = EXCLUDED.email_body_template,
  push_title_template = EXCLUDED.push_title_template,
  push_body_template = EXCLUDED.push_body_template,
  action_url_template = EXCLUDED.action_url_template,
  default_channels = EXCLUDED.default_channels,
  default_priority = EXCLUDED.default_priority,
  is_active = true,
  updated_at = now();

-- ---------------------------------------------------------------------------
-- Co-Work meeting reminders (host + invitees + participants)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.schedule_meeting_reminders()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_meeting record;
  v_recipient uuid;
  v_host_name text;
  v_variables jsonb;
  v_count integer := 0;
  v_now timestamptz := now();
  v_recipients uuid[];
BEGIN
  -- 30-minute window
  FOR v_meeting IN
    SELECT m.*
    FROM public.meetings m
    WHERE m.status = 'scheduled'
      AND m.scheduled_at IS NOT NULL
      AND m.meeting_code IS NOT NULL
      AND m.scheduled_at BETWEEN v_now + interval '25 minutes' AND v_now + interval '35 minutes'
  LOOP
    SELECT coalesce(nullif(trim(p.full_name), ''), nullif(trim(p.username), ''), 'Host')
      INTO v_host_name
    FROM public.profiles p
    WHERE p.id = v_meeting.host_id;

    v_recipients := ARRAY[v_meeting.host_id]::uuid[];

    IF v_meeting.invitees IS NOT NULL THEN
      SELECT array_agg(DISTINCT x.id)
        INTO v_recipients
      FROM (
        SELECT unnest(v_recipients) AS id
        UNION
        SELECT nullif(inv->>'id', '')::uuid
        FROM jsonb_array_elements(v_meeting.invitees) inv
        WHERE nullif(inv->>'id', '') IS NOT NULL
      ) x
      WHERE x.id IS NOT NULL;
    END IF;

    SELECT array_agg(DISTINCT x.id)
      INTO v_recipients
    FROM (
      SELECT unnest(coalesce(v_recipients, ARRAY[]::uuid[])) AS id
      UNION
      SELECT mp.user_id
      FROM public.meeting_participants mp
      WHERE mp.meeting_id = v_meeting.id
        AND mp.user_id IS NOT NULL
    ) x
    WHERE x.id IS NOT NULL;

    v_variables := jsonb_build_object(
      'meeting_id', v_meeting.id::text,
      'meeting_title', coalesce(v_meeting.title, 'Meeting'),
      'meeting_code', v_meeting.meeting_code,
      'room_id', coalesce(v_meeting.room_id, v_meeting.meeting_code),
      'host_name', coalesce(v_host_name, 'Host'),
      'scheduled_at', to_char(v_meeting.scheduled_at at time zone 'Asia/Kolkata', 'Mon DD, YYYY at HH12:MI AM IST'),
      'action_url', '/co-work/meeting/' || v_meeting.meeting_code
    );

    FOREACH v_recipient IN ARRAY coalesce(v_recipients, ARRAY[]::uuid[])
    LOOP
      IF EXISTS (
        SELECT 1 FROM public.notifications n
        WHERE n.recipient_id = v_recipient
          AND n.context_id = v_meeting.id
          AND n.type = 'meeting_reminder_30min'
          AND n.created_at > v_now - interval '2 hours'
      ) THEN
        CONTINUE;
      END IF;

      BEGIN
        PERFORM public.create_notification_from_template(
          'meeting_reminder_30min',
          v_recipient,
          v_variables,
          'meeting',
          v_meeting.id,
          NULL, NULL,
          ARRAY['in_app', 'push', 'email']::text[],
          2,
          NULL
        );
        v_count := v_count + 1;
      EXCEPTION WHEN OTHERS THEN
        NULL;
      END;
    END LOOP;
  END LOOP;

  -- 5-minute window
  FOR v_meeting IN
    SELECT m.*
    FROM public.meetings m
    WHERE m.status = 'scheduled'
      AND m.scheduled_at IS NOT NULL
      AND m.meeting_code IS NOT NULL
      AND m.scheduled_at BETWEEN v_now + interval '3 minutes' AND v_now + interval '8 minutes'
  LOOP
    SELECT coalesce(nullif(trim(p.full_name), ''), nullif(trim(p.username), ''), 'Host')
      INTO v_host_name
    FROM public.profiles p
    WHERE p.id = v_meeting.host_id;

    v_recipients := ARRAY[v_meeting.host_id]::uuid[];

    IF v_meeting.invitees IS NOT NULL THEN
      SELECT array_agg(DISTINCT x.id)
        INTO v_recipients
      FROM (
        SELECT unnest(v_recipients) AS id
        UNION
        SELECT nullif(inv->>'id', '')::uuid
        FROM jsonb_array_elements(v_meeting.invitees) inv
        WHERE nullif(inv->>'id', '') IS NOT NULL
      ) x
      WHERE x.id IS NOT NULL;
    END IF;

    SELECT array_agg(DISTINCT x.id)
      INTO v_recipients
    FROM (
      SELECT unnest(coalesce(v_recipients, ARRAY[]::uuid[])) AS id
      UNION
      SELECT mp.user_id
      FROM public.meeting_participants mp
      WHERE mp.meeting_id = v_meeting.id
        AND mp.user_id IS NOT NULL
    ) x
    WHERE x.id IS NOT NULL;

    v_variables := jsonb_build_object(
      'meeting_id', v_meeting.id::text,
      'meeting_title', coalesce(v_meeting.title, 'Meeting'),
      'meeting_code', v_meeting.meeting_code,
      'room_id', coalesce(v_meeting.room_id, v_meeting.meeting_code),
      'host_name', coalesce(v_host_name, 'Host'),
      'scheduled_at', to_char(v_meeting.scheduled_at at time zone 'Asia/Kolkata', 'Mon DD, YYYY at HH12:MI AM IST'),
      'action_url', '/co-work/meeting/' || v_meeting.meeting_code
    );

    FOREACH v_recipient IN ARRAY coalesce(v_recipients, ARRAY[]::uuid[])
    LOOP
      IF EXISTS (
        SELECT 1 FROM public.notifications n
        WHERE n.recipient_id = v_recipient
          AND n.context_id = v_meeting.id
          AND n.type = 'meeting_reminder_5min'
          AND n.created_at > v_now - interval '1 hour'
      ) THEN
        CONTINUE;
      END IF;

      BEGIN
        PERFORM public.create_notification_from_template(
          'meeting_reminder_5min',
          v_recipient,
          v_variables,
          'meeting',
          v_meeting.id,
          NULL, NULL,
          ARRAY['in_app', 'push']::text[],
          1,
          NULL
        );
        v_count := v_count + 1;
      EXCEPTION WHEN OTHERS THEN
        NULL;
      END;
    END LOOP;
  END LOOP;

  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.schedule_meeting_reminders() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.schedule_meeting_reminders() TO service_role;

-- ---------------------------------------------------------------------------
-- Vendor: confirm pending order items
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.process_order_confirmation_reminders(p_limit integer DEFAULT 100)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r record;
  v_seller uuid;
  v_count integer := 0;
  v_now timestamptz := now();
BEGIN
  FOR r IN
    SELECT
      oi.id AS item_id,
      oi.order_id,
      oi.vendor_id AS shop_id,
      oi.product_title,
      oi.created_at,
      o.order_number,
      o.user_id AS buyer_id
    FROM public.order_items oi
    JOIN public.orders o ON o.id = oi.order_id
    WHERE oi.item_status = 'pending'
      AND oi.created_at <= v_now - interval '30 minutes'
      AND oi.created_at > v_now - interval '3 days'
    ORDER BY oi.created_at ASC
    LIMIT greatest(p_limit, 1)
  LOOP
    SELECT s.user_id INTO v_seller FROM public.shops s WHERE s.id = r.shop_id;
    IF v_seller IS NULL THEN CONTINUE; END IF;

    IF EXISTS (
      SELECT 1 FROM public.notifications n
      WHERE n.recipient_id = v_seller
        AND n.context_id = r.order_id
        AND n.type = 'order_confirmation_reminder_vendor'
        AND n.created_at > v_now - interval '12 hours'
    ) THEN
      CONTINUE;
    END IF;

    BEGIN
      PERFORM public.create_notification_from_template(
        'order_confirmation_reminder_vendor',
        v_seller,
        jsonb_build_object(
          'order_id', r.order_id::text,
          'order_number', coalesce(r.order_number::text, left(r.order_id::text, 8)),
          'product_title', coalesce(r.product_title, 'an item'),
          'action_url', '/vendor/orders'
        ),
        'order',
        r.order_id,
        NULL, NULL,
        ARRAY['in_app', 'push', 'email']::text[],
        2,
        NULL
      );
      v_count := v_count + 1;
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END LOOP;

  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.process_order_confirmation_reminders(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.process_order_confirmation_reminders(integer) TO service_role;

-- ---------------------------------------------------------------------------
-- Community event reminders for registered attendees
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.process_event_reminders()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event record;
  v_user uuid;
  v_count integer := 0;
  v_now timestamptz := now();
  v_template text;
  v_starts text;
BEGIN
  FOR v_event IN
    SELECT e.*
    FROM public.events e
    WHERE coalesce(e.status, 'upcoming') NOT IN ('cancelled', 'canceled', 'ended', 'draft', 'past')
      AND e.start_time IS NOT NULL
      AND (
        e.start_time BETWEEN v_now + interval '50 minutes' AND v_now + interval '70 minutes'
        OR e.start_time BETWEEN v_now + interval '12 minutes' AND v_now + interval '20 minutes'
      )
  LOOP
    v_template := CASE
      WHEN v_event.start_time BETWEEN v_now + interval '50 minutes' AND v_now + interval '70 minutes'
        THEN 'event_reminder_60min'
      ELSE 'event_reminder_15min'
    END;
    v_starts := to_char(v_event.start_time at time zone 'Asia/Kolkata', 'Mon DD, YYYY at HH12:MI AM IST');

    FOR v_user IN
      SELECT er.user_id
      FROM public.event_registrations er
      WHERE er.event_id = v_event.id
        AND er.user_id IS NOT NULL
        AND coalesce(er.status, 'registered') NOT IN ('cancelled', 'declined')
    LOOP
      IF EXISTS (
        SELECT 1 FROM public.notifications n
        WHERE n.recipient_id = v_user
          AND n.context_id = v_event.id
          AND n.type = v_template
          AND n.created_at > v_now - interval '3 hours'
      ) THEN
        CONTINUE;
      END IF;

      BEGIN
        PERFORM public.create_notification_from_template(
          v_template,
          v_user,
          jsonb_build_object(
            'event_id', v_event.id::text,
            'event_title', coalesce(v_event.title, 'Event'),
            'starts_at', v_starts,
            'action_url', '/community/events/' || v_event.id::text
          ),
          'event',
          v_event.id,
          NULL, NULL,
          CASE WHEN v_template = 'event_reminder_60min'
            THEN ARRAY['in_app', 'push', 'email']::text[]
            ELSE ARRAY['in_app', 'push']::text[]
          END,
          CASE WHEN v_template = 'event_reminder_60min' THEN 2 ELSE 1 END,
          NULL
        );
        v_count := v_count + 1;
      EXCEPTION WHEN OTHERS THEN
        NULL;
      END;
    END LOOP;
  END LOOP;

  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.process_event_reminders() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.process_event_reminders() TO service_role;

-- ---------------------------------------------------------------------------
-- Low-stock vendor alert when stock crosses threshold (default 5)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.notify_listing_low_stock()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old integer;
  v_new integer;
  v_threshold integer;
  v_shop record;
  v_title text;
BEGIN
  IF TG_OP <> 'UPDATE' THEN
    RETURN NEW;
  END IF;

  v_old := coalesce(OLD.quantity, OLD.stock, 0);
  v_new := coalesce(NEW.quantity, NEW.stock, 0);
  BEGIN
    v_threshold := greatest(
      coalesce(nullif(NEW.listing_metadata->>'low_stock_threshold', '')::integer, 5),
      1
    );
  EXCEPTION WHEN OTHERS THEN
    v_threshold := 5;
  END;

  -- Fire once when crossing from above threshold into the low band (still > 0).
  IF NOT (v_new > 0 AND v_new <= v_threshold AND v_old > v_threshold) THEN
    RETURN NEW;
  END IF;

  SELECT s.id, s.user_id, s.shop_name INTO v_shop
  FROM public.shops s
  WHERE s.id = NEW.shop_id;

  IF v_shop.user_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.notifications n
    WHERE n.recipient_id = v_shop.user_id
      AND n.context_id = NEW.id
      AND n.type = 'low_stock_alert_vendor'
      AND n.created_at > now() - interval '24 hours'
  ) THEN
    RETURN NEW;
  END IF;

  v_title := coalesce(NEW.title, 'A listing');

  BEGIN
    PERFORM public.create_notification_from_template(
      'low_stock_alert_vendor',
      v_shop.user_id,
      jsonb_build_object(
        'listing_id', NEW.id::text,
        'listing_title', v_title,
        'stock_left', v_new::text,
        'shop_name', coalesce(v_shop.shop_name, 'your shop'),
        'action_url', '/vendor/products'
      ),
      'listing',
      NEW.id,
      'shop',
      NEW.shop_id,
      ARRAY['in_app', 'email', 'push']::text[],
      3,
      NULL
    );
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_listing_low_stock ON public.listings;
CREATE TRIGGER trg_listing_low_stock
  AFTER UPDATE OF quantity, stock ON public.listings
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_listing_low_stock();

-- Avoid broken raw inserts from the legacy upcoming-meeting trigger.
CREATE OR REPLACE FUNCTION public.notify_upcoming_meeting()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Meeting invitees are notified via notify_meeting_invitees.
  -- Timed 30/5-minute reminders are handled by schedule_meeting_reminders().
  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- Orchestrator + cron
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.process_product_reminders(p_limit integer DEFAULT 100)
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

  RETURN jsonb_build_object(
    'meetings', v_meetings,
    'order_confirmations', v_orders,
    'events', v_events,
    'abandoned_carts', v_carts,
    'at', now()
  );
END;
$$;

REVOKE ALL ON FUNCTION public.process_product_reminders(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.process_product_reminders(integer) TO service_role;

SELECT cron.unschedule(jobid)
FROM cron.job
WHERE jobname IN ('process-product-reminders', 'schedule-meeting-reminders');

SELECT cron.schedule(
  'process-product-reminders',
  '*/5 * * * *',
  $$SELECT public.process_product_reminders(100);$$
);
