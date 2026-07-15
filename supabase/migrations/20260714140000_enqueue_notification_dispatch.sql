-- Auto-enqueue email / push / sms / whatsapp dispatch whenever a notification is created.
-- Idempotent: safe even when callers also insert into notification_event_queue.

CREATE OR REPLACE FUNCTION public.enqueue_notification_dispatch()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_has_outbound boolean;
BEGIN
  IF NEW.recipient_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM unnest(COALESCE(NEW.channels, ARRAY[]::text[])) AS c
    WHERE lower(c) IN ('email', 'push', 'sms', 'whatsapp')
  ) INTO v_has_outbound;

  IF v_has_outbound THEN
    IF NOT EXISTS (
      SELECT 1
      FROM public.notification_event_queue q
      WHERE q.event_key = 'dispatch_notification'
        AND q.status IN ('pending', 'processing')
        AND (q.payload->>'notification_id') = NEW.id::text
    ) THEN
      INSERT INTO public.notification_event_queue (
        event_key,
        recipient_id,
        payload,
        scheduled_for,
        status
      ) VALUES (
        'dispatch_notification',
        NEW.recipient_id,
        jsonb_build_object(
          'notification_id', NEW.id,
          'channels', to_jsonb(NEW.channels)
        ),
        COALESCE(NEW.scheduled_for, now()),
        'pending'
      );
    END IF;
  ELSE
    UPDATE public.notifications
    SET
      delivered_at = COALESCE(delivered_at, now()),
      delivery_status = COALESCE(delivery_status, '{}'::jsonb) || jsonb_build_object(
        'in_app', jsonb_build_object('status', 'sent', 'at', now())
      ),
      updated_at = now()
    WHERE id = NEW.id
      AND delivered_at IS NULL;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enqueue_notification_dispatch ON public.notifications;
CREATE TRIGGER trg_enqueue_notification_dispatch
  AFTER INSERT ON public.notifications
  FOR EACH ROW
  EXECUTE FUNCTION public.enqueue_notification_dispatch();

INSERT INTO public.notification_event_queue (
  event_key,
  recipient_id,
  payload,
  scheduled_for,
  status
)
SELECT
  'dispatch_notification',
  n.recipient_id,
  jsonb_build_object('notification_id', n.id, 'channels', to_jsonb(n.channels)),
  COALESCE(n.scheduled_for, n.created_at, now()),
  'pending'
FROM public.notifications n
WHERE n.delivered_at IS NULL
  AND n.recipient_id IS NOT NULL
  AND n.created_at > now() - interval '14 days'
  AND EXISTS (
    SELECT 1
    FROM unnest(COALESCE(n.channels, ARRAY[]::text[])) AS c
    WHERE lower(c) IN ('email', 'push', 'sms', 'whatsapp')
  )
  AND NOT EXISTS (
    SELECT 1
    FROM public.notification_event_queue q
    WHERE q.event_key = 'dispatch_notification'
      AND q.status = 'pending'
      AND (q.payload->>'notification_id') = n.id::text
  )
LIMIT 500;

UPDATE public.notifications n
SET
  delivered_at = COALESCE(n.delivered_at, n.created_at, now()),
  delivery_status = COALESCE(n.delivery_status, '{}'::jsonb) || jsonb_build_object(
    'in_app', jsonb_build_object('status', 'sent', 'at', now())
  ),
  updated_at = now()
WHERE n.delivered_at IS NULL
  AND (
    n.channels IS NULL
    OR n.channels = ARRAY['in_app']::text[]
    OR (
      coalesce(array_length(n.channels, 1), 0) = 1
      AND lower(n.channels[1]) = 'in_app'
    )
  );
