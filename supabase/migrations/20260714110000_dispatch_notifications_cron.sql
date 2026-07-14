-- Schedule multi-channel notification dispatch every 5 minutes.
-- Requires vault secret `notification_cron_secret` matching edge secret
-- `NOTIFICATION_CRON_SECRET` (already provisioned in production).

SELECT cron.unschedule(jobid)
FROM cron.job
WHERE jobname = 'dispatch-marketplace-notifications';

SELECT cron.schedule(
  'dispatch-marketplace-notifications',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://zsaqrrzwygzwrlzgymxk.supabase.co/functions/v1/dispatch-notifications',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (
        SELECT decrypted_secret
        FROM vault.decrypted_secrets
        WHERE name = 'notification_cron_secret'
        LIMIT 1
      )
    ),
    body := jsonb_build_object('limit', 50)
  );
  $$
);
