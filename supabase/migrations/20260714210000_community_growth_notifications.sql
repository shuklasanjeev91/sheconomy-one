-- professional growth: company/group updates, RSVPs, profile views,
-- network suggestions digest, and broader WhatsApp channel coverage.

-- ---------------------------------------------------------------------------
-- Templates
-- ---------------------------------------------------------------------------
INSERT INTO public.notification_templates (
  template_key, platform, category, title_template, message_template,
  email_subject_template, email_body_template, sms_template,
  push_title_template, push_body_template, whatsapp_template,
  action_url_template, default_channels, default_priority, is_active
)
VALUES
(
  'company_new_post', 'community', 'social',
  '{{company_name}} posted an update',
  '{{author_name}} shared news from {{company_name}}',
  '{{company_name}} posted on SHEconomy',
  '<p><strong>{{company_name}}</strong> shared an update.</p><p>{{post_preview}}</p><p><a href="{{action_url}}">View update</a></p>',
  'SHEconomy: {{company_name}} posted. {{action_url}}',
  '{{company_name}} posted',
  '{{post_preview}}',
  '{{company_name}} posted on SHEconomy: {{action_url}}',
  '{{action_url}}',
  ARRAY['in_app', 'email', 'push', 'whatsapp'], 3, true
),
(
  'group_new_post', 'community', 'social',
  'New post in {{group_name}}',
  '{{author_name}} posted in {{group_name}}',
  'New post in {{group_name}} on SHEconomy',
  '<p><strong>{{author_name}}</strong> posted in <strong>{{group_name}}</strong>.</p><p>{{post_preview}}</p><p><a href="{{action_url}}">Open group</a></p>',
  'SHEconomy: new post in {{group_name}}. {{action_url}}',
  'New in {{group_name}}',
  '{{author_name}}: {{post_preview}}',
  '{{author_name}} posted in {{group_name}} on SHEconomy: {{action_url}}',
  '{{action_url}}',
  ARRAY['in_app', 'email', 'push'], 3, true
),
(
  'company_followed', 'community', 'social',
  'New page follower',
  '{{follower_name}} started following {{company_name}}',
  '{{follower_name}} followed {{company_name}} on SHEconomy',
  '<p><strong>{{follower_name}}</strong> started following <strong>{{company_name}}</strong>.</p><p><a href="{{action_url}}">View page</a></p>',
  'SHEconomy: {{follower_name}} followed {{company_name}}. {{action_url}}',
  'New follower for {{company_name}}',
  '{{follower_name}} started following your page',
  '{{follower_name}} followed {{company_name}} on SHEconomy: {{action_url}}',
  '{{action_url}}',
  ARRAY['in_app', 'email', 'push'], 2, true
),
(
  'event_rsvp_received', 'community', 'social',
  'New RSVP for your event',
  '{{guest_name}} RSVPed to {{event_title}}',
  '{{guest_name}} RSVPed to your event on SHEconomy',
  '<p><strong>{{guest_name}}</strong> RSVPed to <strong>{{event_title}}</strong>.</p><p><a href="{{action_url}}">View post</a></p>',
  'SHEconomy: {{guest_name}} RSVPed to {{event_title}}. {{action_url}}',
  'New RSVP',
  '{{guest_name}} → {{event_title}}',
  '{{guest_name}} RSVPed to {{event_title}} on SHEconomy: {{action_url}}',
  '{{action_url}}',
  ARRAY['in_app', 'email', 'push', 'whatsapp'], 4, true
),
(
  'event_registration_received', 'community', 'social',
  'New event registration',
  '{{guest_name}} registered for {{event_title}}',
  '{{guest_name}} registered for your event on SHEconomy',
  '<p><strong>{{guest_name}}</strong> registered for <strong>{{event_title}}</strong>.</p><p><a href="{{action_url}}">Manage attendees</a></p>',
  'SHEconomy: {{guest_name}} registered for {{event_title}}. {{action_url}}',
  'New registration',
  '{{guest_name}} → {{event_title}}',
  '{{guest_name}} registered for {{event_title}} on SHEconomy: {{action_url}}',
  '{{action_url}}',
  ARRAY['in_app', 'email', 'push', 'whatsapp'], 4, true
),
(
  'profile_viewed', 'community', 'social',
  'Someone viewed your profile',
  '{{viewer_name}} viewed your profile',
  '{{viewer_name}} viewed your SHEconomy profile',
  '<p><strong>{{viewer_name}}</strong> viewed your profile.</p><p><a href="{{action_url}}">See who viewed your profile</a></p>',
  'SHEconomy: {{viewer_name}} viewed your profile. {{action_url}}',
  'Profile view',
  '{{viewer_name}} viewed your profile',
  '{{viewer_name}} viewed your SHEconomy profile: {{action_url}}',
  '{{action_url}}',
  ARRAY['in_app', 'push'], 1, true
),
(
  'network_suggestions_digest', 'community', 'social',
  'People you may know',
  'We found {{suggestion_count}} people you may want to connect with',
  'People you may know on SHEconomy',
  '<p>Hi {{member_name}},</p><p>We found <strong>{{suggestion_count}}</strong> people you may know, including {{suggestion_preview}}.</p><p><a href="{{action_url}}">Grow your network</a></p>',
  'SHEconomy: {{suggestion_count}} people you may know. {{action_url}}',
  'People you may know',
  '{{suggestion_count}} suggestions · {{suggestion_preview}}',
  'SHEconomy found {{suggestion_count}} people you may know: {{action_url}}',
  '{{action_url}}',
  ARRAY['in_app', 'email', 'push'], 2, true
),
(
  'article_published', 'community', 'social',
  'New article from {{author_name}}',
  '{{author_name}} published "{{article_title}}"',
  '{{author_name}} published an article on SHEconomy',
  '<p><strong>{{author_name}}</strong> published <strong>{{article_title}}</strong>.</p><p>{{post_preview}}</p><p><a href="{{action_url}}">Read article</a></p>',
  'SHEconomy: {{author_name}} published {{article_title}}. {{action_url}}',
  'New article',
  '{{article_title}}',
  '{{author_name}} published "{{article_title}}" on SHEconomy: {{action_url}}',
  '{{action_url}}',
  ARRAY['in_app', 'email', 'push', 'whatsapp'], 3, true
)
ON CONFLICT (template_key) DO UPDATE SET
  title_template = EXCLUDED.title_template,
  message_template = EXCLUDED.message_template,
  email_subject_template = EXCLUDED.email_subject_template,
  email_body_template = EXCLUDED.email_body_template,
  push_title_template = EXCLUDED.push_title_template,
  push_body_template = EXCLUDED.push_body_template,
  whatsapp_template = EXCLUDED.whatsapp_template,
  sms_template = EXCLUDED.sms_template,
  action_url_template = EXCLUDED.action_url_template,
  default_channels = EXCLUDED.default_channels,
  default_priority = EXCLUDED.default_priority,
  is_active = true,
  updated_at = now();

-- Expand WhatsApp on high-signal social templates that were email/push-only
UPDATE public.notification_templates
SET
  whatsapp_template = COALESCE(
    NULLIF(whatsapp_template, ''),
    title_template || ' — ' || message_template || ' {{action_url}}'
  ),
  default_channels = CASE
    WHEN NOT ('whatsapp' = ANY (default_channels))
      THEN array_append(default_channels, 'whatsapp')
    ELSE default_channels
  END,
  updated_at = now()
WHERE template_key IN (
  'connection_new_post',
  'follower_new_post',
  'community_weekly_digest',
  'skill_endorsed',
  'post_commented',
  'post_comment',
  'post_reposted',
  'hashtag_post',
  'group_new_post',
  'company_followed',
  'network_suggestions_digest'
);

-- ---------------------------------------------------------------------------
-- Allow article post type (extend check if present)
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  v_conname text;
  v_def text;
BEGIN
  SELECT c.conname, pg_get_constraintdef(c.oid)
  INTO v_conname, v_def
  FROM pg_constraint c
  JOIN pg_class t ON t.oid = c.conrelid
  JOIN pg_namespace n ON n.oid = t.relnamespace
  WHERE n.nspname = 'public'
    AND t.relname = 'posts'
    AND c.contype = 'c'
    AND pg_get_constraintdef(c.oid) ILIKE '%post_type%'
  LIMIT 1;

  IF v_conname IS NOT NULL AND v_def NOT ILIKE '%article%' THEN
    EXECUTE format('ALTER TABLE public.posts DROP CONSTRAINT %I', v_conname);
    ALTER TABLE public.posts
      ADD CONSTRAINT posts_post_type_check CHECK (
        post_type IS NULL OR post_type::text = ANY (ARRAY[
          'post','text','thought','poll','event','celebration',
          'product','service','group_post','article'
        ]::text[])
      );
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- Dedup log for profile-view notifications (1 alert / viewer / day)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profile_view_notify_log (
  profile_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  viewer_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  view_date date NOT NULL DEFAULT (CURRENT_DATE),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (profile_user_id, viewer_user_id, view_date)
);

ALTER TABLE public.profile_view_notify_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS profile_view_notify_log_owner_read ON public.profile_view_notify_log;
CREATE POLICY profile_view_notify_log_owner_read ON public.profile_view_notify_log
  FOR SELECT TO authenticated
  USING (profile_user_id = auth.uid());

CREATE TABLE IF NOT EXISTS public.network_suggestions_digest_log (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  week_key text NOT NULL,
  notification_id uuid NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, week_key)
);

ALTER TABLE public.network_suggestions_digest_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS network_suggestions_digest_log_own ON public.network_suggestions_digest_log;
CREATE POLICY network_suggestions_digest_log_own ON public.network_suggestions_digest_log
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Company page new post → followers
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.notify_company_new_post()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r record;
  v_author text;
  v_company text;
  v_slug text;
  v_preview text;
  v_app_base text := COALESCE(
    NULLIF(current_setting('app.settings.public_app_url', true), ''),
    'https://sheconomy.com'
  );
  v_notified integer := 0;
BEGIN
  IF TG_OP <> 'INSERT' OR COALESCE(NEW.is_deleted, false) OR NEW.company_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(NULLIF(full_name, ''), username, 'Someone') INTO v_author
  FROM public.profiles WHERE id = NEW.user_id;

  SELECT name, page_slug INTO v_company, v_slug
  FROM public.companypages WHERE id = NEW.company_id;

  IF v_company IS NULL THEN
    RETURN NEW;
  END IF;

  v_preview := left(regexp_replace(COALESCE(NEW.content, ''), '<[^>]+>', ' ', 'g'), 140);

  FOR r IN
    SELECT cf.follower_id AS user_id
    FROM public.company_followers cf
    WHERE cf.company_id = NEW.company_id
      AND cf.follower_id IS DISTINCT FROM NEW.user_id
    LIMIT 200
  LOOP
    BEGIN
      PERFORM public.create_notification_from_template(
        'company_new_post',
        r.user_id,
        jsonb_build_object(
          'author_name', v_author,
          'company_name', v_company,
          'post_preview', COALESCE(NULLIF(v_preview, ''), 'New update'),
          'action_url', v_app_base || '/community/post/' || NEW.id::text
        ),
        'post',
        NEW.id
      );
      v_notified := v_notified + 1;
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
    EXIT WHEN v_notified >= 200;
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_company_new_post ON public.posts;
CREATE TRIGGER trg_notify_company_new_post
  AFTER INSERT ON public.posts
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_company_new_post();

-- ---------------------------------------------------------------------------
-- Group new post → active members
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.notify_group_new_post()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r record;
  v_author text;
  v_group text;
  v_preview text;
  v_app_base text := COALESCE(
    NULLIF(current_setting('app.settings.public_app_url', true), ''),
    'https://sheconomy.com'
  );
  v_notified integer := 0;
BEGIN
  IF TG_OP <> 'INSERT' OR COALESCE(NEW.is_deleted, false) OR NEW.group_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(NULLIF(full_name, ''), username, 'Someone') INTO v_author
  FROM public.profiles WHERE id = NEW.user_id;

  SELECT COALESCE(NULLIF(title, ''), name, 'Group') INTO v_group
  FROM public.groups WHERE id = NEW.group_id;

  IF v_group IS NULL THEN
    RETURN NEW;
  END IF;

  v_preview := left(regexp_replace(COALESCE(NEW.content, ''), '<[^>]+>', ' ', 'g'), 140);

  FOR r IN
    SELECT gm.user_id
    FROM public.group_members gm
    WHERE gm.group_id = NEW.group_id
      AND gm.user_id IS DISTINCT FROM NEW.user_id
      AND (gm.status IS NULL OR gm.status IN ('active', 'approved', 'member'))
    LIMIT 200
  LOOP
    BEGIN
      PERFORM public.create_notification_from_template(
        'group_new_post',
        r.user_id,
        jsonb_build_object(
          'author_name', v_author,
          'group_name', v_group,
          'post_preview', COALESCE(NULLIF(v_preview, ''), 'New post'),
          'action_url', v_app_base || '/community/group/' || NEW.group_id::text
        ),
        'post',
        NEW.id
      );
      v_notified := v_notified + 1;
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
    EXIT WHEN v_notified >= 200;
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_group_new_post ON public.posts;
CREATE TRIGGER trg_notify_group_new_post
  AFTER INSERT ON public.posts
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_group_new_post();

-- ---------------------------------------------------------------------------
-- Article published → accepted connections
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.notify_article_published()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r record;
  v_author text;
  v_title text;
  v_preview text;
  v_app_base text := COALESCE(
    NULLIF(current_setting('app.settings.public_app_url', true), ''),
    'https://sheconomy.com'
  );
  v_notified integer := 0;
BEGIN
  IF TG_OP <> 'INSERT' OR COALESCE(NEW.is_deleted, false) THEN
    RETURN NEW;
  END IF;
  IF NEW.post_type IS DISTINCT FROM 'article' THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(NULLIF(full_name, ''), username, 'Someone') INTO v_author
  FROM public.profiles WHERE id = NEW.user_id;

  v_title := COALESCE(
    NULLIF(NEW.post_data->>'article_title', ''),
    NULLIF(NEW.metadata->>'article_title', ''),
    left(regexp_replace(COALESCE(NEW.content, ''), '<[^>]+>', ' ', 'g'), 80),
    'Untitled article'
  );
  v_preview := left(regexp_replace(COALESCE(NEW.content, ''), '<[^>]+>', ' ', 'g'), 160);

  FOR r IN
    SELECT CASE
             WHEN c.sender_id = NEW.user_id THEN c.receiver_id
             ELSE c.sender_id
           END AS peer_id
    FROM public.connections c
    WHERE c.status = 'accepted'
      AND (c.sender_id = NEW.user_id OR c.receiver_id = NEW.user_id)
    LIMIT 150
  LOOP
    BEGIN
      PERFORM public.create_notification_from_template(
        'article_published',
        r.peer_id,
        jsonb_build_object(
          'author_name', v_author,
          'article_title', v_title,
          'post_preview', COALESCE(NULLIF(v_preview, ''), 'Read the full article'),
          'action_url', v_app_base || '/community/post/' || NEW.id::text
        ),
        'post',
        NEW.id
      );
      v_notified := v_notified + 1;
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
    EXIT WHEN v_notified >= 150;
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_article_published ON public.posts;
CREATE TRIGGER trg_notify_article_published
  AFTER INSERT ON public.posts
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_article_published();

-- ---------------------------------------------------------------------------
-- Company followed → page owner
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.notify_company_followed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner uuid;
  v_company text;
  v_slug text;
  v_follower text;
  v_app_base text := COALESCE(
    NULLIF(current_setting('app.settings.public_app_url', true), ''),
    'https://sheconomy.com'
  );
BEGIN
  IF TG_OP <> 'INSERT' OR NEW.follower_id IS NULL OR NEW.company_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT created_by, name, page_slug INTO v_owner, v_company, v_slug
  FROM public.companypages WHERE id = NEW.company_id;

  IF v_owner IS NULL OR v_owner = NEW.follower_id THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(NULLIF(full_name, ''), username, 'Someone') INTO v_follower
  FROM public.profiles WHERE id = NEW.follower_id;

  BEGIN
    PERFORM public.create_notification_from_template(
      'company_followed',
      v_owner,
      jsonb_build_object(
        'follower_name', v_follower,
        'company_name', COALESCE(v_company, 'your page'),
        'action_url', v_app_base || '/community/company/' || COALESCE(NEW.company_id::text, '')
      ),
      'company',
      NEW.company_id
    );
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_company_followed ON public.company_followers;
CREATE TRIGGER trg_notify_company_followed
  AFTER INSERT ON public.company_followers
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_company_followed();

-- ---------------------------------------------------------------------------
-- Post event RSVP → post author
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.notify_event_rsvp_received()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_author uuid;
  v_title text;
  v_guest text;
  v_app_base text := COALESCE(
    NULLIF(current_setting('app.settings.public_app_url', true), ''),
    'https://sheconomy.com'
  );
BEGIN
  IF TG_OP <> 'INSERT' THEN
    RETURN NEW;
  END IF;

  SELECT user_id, COALESCE(NULLIF(event_title, ''), 'your event')
  INTO v_author, v_title
  FROM public.posts WHERE id = NEW.post_id;

  IF v_author IS NULL OR v_author = NEW.user_id THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(NULLIF(full_name, ''), username, 'Someone') INTO v_guest
  FROM public.profiles WHERE id = NEW.user_id;

  BEGIN
    PERFORM public.create_notification_from_template(
      'event_rsvp_received',
      v_author,
      jsonb_build_object(
        'guest_name', v_guest,
        'event_title', v_title,
        'action_url', v_app_base || '/community/post/' || NEW.post_id::text
      ),
      'event_rsvp',
      NEW.id
    );
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_event_rsvp_received ON public.post_event_rsvps;
CREATE TRIGGER trg_notify_event_rsvp_received
  AFTER INSERT ON public.post_event_rsvps
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_event_rsvp_received();

-- ---------------------------------------------------------------------------
-- Calendar event registration → host
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.notify_event_registration_received()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_host uuid;
  v_title text;
  v_guest text;
  v_app_base text := COALESCE(
    NULLIF(current_setting('app.settings.public_app_url', true), ''),
    'https://sheconomy.com'
  );
BEGIN
  IF TG_OP <> 'INSERT' THEN
    RETURN NEW;
  END IF;
  IF NEW.status IS NOT NULL AND NEW.status NOT IN ('registered', 'confirmed', 'pending', 'attending') THEN
    RETURN NEW;
  END IF;

  SELECT organizer_id, title INTO v_host, v_title
  FROM public.events WHERE id = NEW.event_id;

  IF v_host IS NULL OR v_host = NEW.user_id THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(NULLIF(full_name, ''), username, 'Someone') INTO v_guest
  FROM public.profiles WHERE id = NEW.user_id;

  BEGIN
    PERFORM public.create_notification_from_template(
      'event_registration_received',
      v_host,
      jsonb_build_object(
        'guest_name', v_guest,
        'event_title', COALESCE(v_title, 'your event'),
        'action_url', v_app_base || '/community/events/' || NEW.event_id::text
      ),
      'event',
      NEW.event_id
    );
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_event_registration_received ON public.event_registrations;
CREATE TRIGGER trg_notify_event_registration_received
  AFTER INSERT ON public.event_registrations
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_event_registration_received();

-- ---------------------------------------------------------------------------
-- Profile view → owner (once per viewer per day, named viewers only)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.track_profile_view(
  p_profile_user_id uuid,
  p_viewer_user_id uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_viewer_name text;
  v_app_base text := COALESCE(
    NULLIF(current_setting('app.settings.public_app_url', true), ''),
    'https://sheconomy.com'
  );
BEGIN
  IF p_viewer_user_id IS NOT NULL AND p_viewer_user_id = p_profile_user_id THEN
    RETURN;
  END IF;

  INSERT INTO public.profile_views (profile_user_id, viewer_user_id, view_date)
  VALUES (p_profile_user_id, p_viewer_user_id, CURRENT_DATE)
  ON CONFLICT (profile_user_id, COALESCE(viewer_user_id, '00000000-0000-0000-0000-000000000000'::uuid), view_date)
  DO UPDATE SET viewed_at = now();

  INSERT INTO public.profile_view_details (profile_user_id, viewer_user_id, is_anonymous)
  VALUES (p_profile_user_id, p_viewer_user_id, p_viewer_user_id IS NULL);

  IF p_viewer_user_id IS NULL THEN
    RETURN;
  END IF;

  INSERT INTO public.profile_view_notify_log (profile_user_id, viewer_user_id, view_date)
  VALUES (p_profile_user_id, p_viewer_user_id, CURRENT_DATE)
  ON CONFLICT DO NOTHING;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  SELECT COALESCE(NULLIF(full_name, ''), username, 'Someone') INTO v_viewer_name
  FROM public.profiles WHERE id = p_viewer_user_id;

  BEGIN
    PERFORM public.create_notification_from_template(
      'profile_viewed',
      p_profile_user_id,
      jsonb_build_object(
        'viewer_name', COALESCE(v_viewer_name, 'Someone'),
        'action_url', v_app_base || '/community/analytics'
      ),
      'profile_view',
      p_viewer_user_id
    );
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
END;
$$;

REVOKE ALL ON FUNCTION public.track_profile_view(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.track_profile_view(uuid, uuid) TO authenticated, anon, service_role;

-- ---------------------------------------------------------------------------
-- Weekly "People you may know" digest (Wednesdays)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.process_network_suggestions_digest(
  p_limit integer DEFAULT 400
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
  v_app_base text := COALESCE(
    NULLIF(current_setting('app.settings.public_app_url', true), ''),
    'https://sheconomy.com'
  );
  v_count integer;
  v_preview text;
  v_name text;
  v_notification_id uuid;
  s record;
BEGIN
  FOR r IN
    SELECT p.id, p.full_name, p.username
    FROM public.profiles p
    WHERE NOT EXISTS (
        SELECT 1 FROM public.network_suggestions_digest_log d
        WHERE d.user_id = p.id AND d.week_key = v_week_key
      )
      AND EXISTS (
        SELECT 1 FROM public.connections c
        WHERE c.status = 'accepted'
          AND (c.sender_id = p.id OR c.receiver_id = p.id)
      )
    ORDER BY p.created_at DESC NULLS LAST
    LIMIT GREATEST(p_limit, 1)
  LOOP
    v_count := 0;
    v_preview := '';

    BEGIN
      FOR s IN
        SELECT * FROM public.get_connection_suggestions(r.id, 5)
      LOOP
        v_count := v_count + 1;
        IF v_preview = '' THEN
          v_preview := COALESCE(NULLIF(s.full_name, ''), 'a member');
        ELSIF v_count <= 3 THEN
          v_preview := v_preview || ', ' || COALESCE(NULLIF(s.full_name, ''), 'a member');
        END IF;
      END LOOP;
    EXCEPTION WHEN OTHERS THEN
      v_count := 0;
    END;

    IF v_count < 2 THEN
      INSERT INTO public.network_suggestions_digest_log (user_id, week_key)
      VALUES (r.id, v_week_key)
      ON CONFLICT DO NOTHING;
      CONTINUE;
    END IF;

    v_name := COALESCE(NULLIF(r.full_name, ''), r.username, 'there');

    BEGIN
      v_notification_id := public.create_notification_from_template(
        'network_suggestions_digest',
        r.id,
        jsonb_build_object(
          'member_name', v_name,
          'suggestion_count', v_count::text,
          'suggestion_preview', v_preview,
          'action_url', v_app_base || '/community/people/suggestions'
        ),
        'network_digest',
        NULL
      );
    EXCEPTION WHEN OTHERS THEN
      v_notification_id := NULL;
    END;

    INSERT INTO public.network_suggestions_digest_log (user_id, week_key, notification_id)
    VALUES (r.id, v_week_key, v_notification_id)
    ON CONFLICT DO NOTHING;

    v_processed := v_processed + 1;
  END LOOP;

  RETURN v_processed;
END;
$$;

REVOKE ALL ON FUNCTION public.process_network_suggestions_digest(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.process_network_suggestions_digest(integer) TO service_role;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    BEGIN
      PERFORM cron.unschedule('network-suggestions-digest-weekly');
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
    PERFORM cron.schedule(
      'network-suggestions-digest-weekly',
      '0 10 * * 3',
      $$SELECT public.process_network_suggestions_digest(500);$$
    );
  END IF;
END $$;
