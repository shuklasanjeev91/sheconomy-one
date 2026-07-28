-- Dispatch push as soon as a notification with the push channel is created.
-- Previously only priority >= 5 (calls) fired immediately; chat/messages (priority 4)
-- waited up to 5 minutes for the cron and felt "broken" during web↔ native tests.

CREATE OR REPLACE FUNCTION public.dispatch_notification_immediately()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_secret text;
BEGIN
  IF NEW.recipient_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM unnest(COALESCE(NEW.channels, ARRAY[]::text[])) AS c
    WHERE lower(c) = 'push'
  ) THEN
    RETURN NEW;
  END IF;

  BEGIN
    SELECT decrypted_secret INTO v_secret
    FROM vault.decrypted_secrets
    WHERE name = 'notification_cron_secret'
    LIMIT 1;

    IF v_secret IS NULL OR length(trim(v_secret)) = 0 THEN
      RETURN NEW;
    END IF;

    PERFORM net.http_post(
      url := 'https://zsaqrrzwygzwrlzgymxk.supabase.co/functions/v1/dispatch-notifications',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-cron-secret', v_secret
      ),
      body := jsonb_build_object('limit', 20, 'notification_id', NEW.id)
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING '[dispatch_notification_immediately] %', SQLERRM;
  END;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_dispatch_notification_immediately ON public.notifications;
CREATE TRIGGER trg_dispatch_notification_immediately
  AFTER INSERT ON public.notifications
  FOR EACH ROW
  EXECUTE FUNCTION public.dispatch_notification_immediately();
