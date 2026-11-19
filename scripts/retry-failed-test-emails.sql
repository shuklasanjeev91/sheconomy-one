-- Re-queue rate-limited test emails for slow retry.
WITH failed AS (
  SELECT n.id
  FROM public.notifications n
  WHERE n.recipient_id = '589ae4f0-7b9c-4c51-8c3f-7be87fc057af'
    AND n.data->>'_test_label' = 'mailchimp-template-sweep'
    AND n.delivery_status->'email'->>'status' = 'failed'
),
cleared AS (
  UPDATE public.notifications n
  SET
    delivery_status = COALESCE(n.delivery_status, '{}'::jsonb) - 'email',
    delivered_at = NULL,
    updated_at = now()
  FROM failed f
  WHERE n.id = f.id
  RETURNING n.id
)
INSERT INTO public.notification_event_queue (
  event_key, recipient_id, payload, scheduled_for, status
)
SELECT
  'dispatch_notification',
  '589ae4f0-7b9c-4c51-8c3f-7be87fc057af'::uuid,
  jsonb_build_object(
    'notification_id', c.id,
    'test_batch', 'mailchimp-template-sweep',
    'retry', true
  ),
  now(),
  'pending'
FROM cleared c;

SELECT COUNT(*) AS requeued
FROM notification_event_queue
WHERE status = 'pending'
  AND payload->>'test_batch' = 'mailchimp-template-sweep'
  AND COALESCE((payload->>'retry')::boolean, false);
