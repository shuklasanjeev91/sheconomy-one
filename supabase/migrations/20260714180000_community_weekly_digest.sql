-- Weekly community digest: email + in-app + push for network activity

INSERT INTO public.notification_templates (
  template_key, platform, category, title_template, message_template,
  email_subject_template, email_body_template, sms_template,
  push_title_template, push_body_template, whatsapp_template,
  action_url_template, default_channels, default_priority, is_active
)
VALUES
(
  'community_weekly_digest', 'community', 'social',
  'Your weekly network update',
  'You have {{unread_count}} unread alerts, {{connection_requests}} connection requests, and {{profile_views}} profile views this week.',
  'Your SHEconomy weekly network digest',
  '<p>Hi {{member_name}},</p>
   <p>Here is your weekly network summary:</p>
   <ul>
     <li><strong>{{unread_count}}</strong> unread notifications</li>
     <li><strong>{{connection_requests}}</strong> pending connection requests</li>
     <li><strong>{{profile_views}}</strong> profile views this week</li>
     <li><strong>{{new_followers}}</strong> new followers</li>
   </ul>
   <p><a href="{{action_url}}">Open your inbox</a></p>',
  'SHEconomy weekly: {{unread_count}} unread, {{connection_requests}} requests. {{action_url}}',
  'Your weekly network update',
  '{{unread_count}} unread · {{connection_requests}} requests · {{profile_views}} views',
  'Your SHEconomy weekly digests: {{unread_count}} unread alerts. {{action_url}}',
  '{{action_url}}',
  ARRAY['in_app', 'email', 'push'], 2, true
)
ON CONFLICT (template_key) DO UPDATE SET
  title_template = EXCLUDED.title_template,
  message_template = EXCLUDED.message_template,
  email_subject_template = EXCLUDED.email_subject_template,
  email_body_template = EXCLUDED.email_body_template,
  push_title_template = EXCLUDED.push_title_template,
  push_body_template = EXCLUDED.push_body_template,
  whatsapp_template = EXCLUDED.whatsapp_template,
  category = EXCLUDED.category,
  default_channels = EXCLUDED.default_channels,
  is_active = true,
  updated_at = now();

CREATE TABLE IF NOT EXISTS public.community_digest_log (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  week_key text NOT NULL,
  notification_id uuid NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, week_key)
);

ALTER TABLE public.community_digest_log ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.process_community_weekly_digest(
  p_limit integer DEFAULT 500
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r record;
  v_processed integer := 0;
  v_week_key text := to_char(date_trunc('week', now() AT TIME ZONE 'UTC'), 'IYYY-"W"IW');
  v_week_start timestamptz := date_trunc('week', now() AT TIME ZONE 'UTC');
  v_app_base text := COALESCE(
    NULLIF(current_setting('app.settings.public_app_url', true), ''),
    'https://sheconomy.com'
  );
  v_unread integer;
  v_requests integer;
  v_views integer;
  v_followers integer;
  v_name text;
  v_notification_id uuid;
BEGIN
  FOR r IN
    SELECT p.id, p.full_name, p.username
    FROM public.profiles p
    WHERE COALESCE(p.is_active, true) = true
      AND NOT EXISTS (
        SELECT 1 FROM public.community_digest_log d
        WHERE d.user_id = p.id AND d.week_key = v_week_key
      )
    ORDER BY p.updated_at DESC NULLS LAST
    LIMIT GREATEST(p_limit, 1)
  LOOP
    SELECT COUNT(*)::integer INTO v_unread
    FROM public.notifications n
    WHERE n.recipient_id = r.id
      AND COALESCE(n.read, false) = false
      AND n.platform = 'community'
      AND n.created_at >= v_week_start;

    SELECT COUNT(*)::integer INTO v_requests
    FROM public.connections c
    WHERE c.receiver_id = r.id AND c.status = 'pending';

    SELECT COUNT(*)::integer INTO v_views
    FROM public.profile_views pv
    WHERE pv.profile_user_id = r.id
      AND pv.viewed_at >= v_week_start;

    SELECT COUNT(*)::integer INTO v_followers
    FROM public.follows f
    WHERE f.following_id = r.id
      AND COALESCE(f.status, 'active') = 'active'
      AND COALESCE(f.created_at, now()) >= v_week_start;

    -- Skip quiet weeks with no useful activity
    IF v_unread = 0 AND v_requests = 0 AND v_views = 0 AND v_followers = 0 THEN
      INSERT INTO public.community_digest_log (user_id, week_key, notification_id)
      VALUES (r.id, v_week_key, NULL)
      ON CONFLICT DO NOTHING;
      CONTINUE;
    END IF;

    v_name := COALESCE(NULLIF(r.full_name, ''), NULLIF(r.username, ''), 'there');

    BEGIN
      v_notification_id := public.create_notification_from_template(
        'community_weekly_digest',
        r.id,
        jsonb_build_object(
          'member_name', v_name,
          'unread_count', v_unread::text,
          'connection_requests', v_requests::text,
          'profile_views', v_views::text,
          'new_followers', v_followers::text,
          'action_url', v_app_base || '/notifications'
        ),
        'digest',
        r.id
      );
    EXCEPTION WHEN OTHERS THEN
      v_notification_id := NULL;
    END;

    INSERT INTO public.community_digest_log (user_id, week_key, notification_id)
    VALUES (r.id, v_week_key, v_notification_id)
    ON CONFLICT DO NOTHING;

    v_processed := v_processed + 1;
  END LOOP;

  RETURN v_processed;
END;
$$;

REVOKE ALL ON FUNCTION public.process_community_weekly_digest(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.process_community_weekly_digest(integer) TO service_role;

DO $$
DECLARE
  jid bigint;
BEGIN
  SELECT jobid INTO jid FROM cron.job WHERE jobname = 'process-community-weekly-digest';
  IF jid IS NOT NULL THEN
    PERFORM cron.unschedule(jid);
  END IF;
END $$;

SELECT cron.schedule(
  'process-community-weekly-digest',
  '15 9 * * 1',
  $$SELECT public.process_community_weekly_digest(400);$$
);
