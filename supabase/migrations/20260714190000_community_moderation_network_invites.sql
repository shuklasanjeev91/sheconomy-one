-- professional community moderation + connection post alerts + network invites

CREATE TABLE IF NOT EXISTS public.community_hidden_posts (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, post_id)
);

ALTER TABLE public.community_hidden_posts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS community_hidden_posts_own ON public.community_hidden_posts;
CREATE POLICY community_hidden_posts_own ON public.community_hidden_posts
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE TABLE IF NOT EXISTS public.community_post_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  reason text NOT NULL DEFAULT 'other',
  details text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (reporter_id, post_id)
);

ALTER TABLE public.community_post_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS community_post_reports_insert_own ON public.community_post_reports;
CREATE POLICY community_post_reports_insert_own ON public.community_post_reports
  FOR INSERT TO authenticated
  WITH CHECK (reporter_id = auth.uid());

DROP POLICY IF EXISTS community_post_reports_select_own ON public.community_post_reports;
CREATE POLICY community_post_reports_select_own ON public.community_post_reports
  FOR SELECT TO authenticated
  USING (reporter_id = auth.uid());

CREATE TABLE IF NOT EXISTS public.network_email_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inviter_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  invitee_user_id uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  message text NULL,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'sent', 'accepted', 'expired')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (inviter_id, email)
);

ALTER TABLE public.network_email_invites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS network_email_invites_own ON public.network_email_invites;
CREATE POLICY network_email_invites_own ON public.network_email_invites
  FOR ALL TO authenticated
  USING (inviter_id = auth.uid())
  WITH CHECK (inviter_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_network_email_invites_email
  ON public.network_email_invites (lower(email));

-- Templates
INSERT INTO public.notification_templates (
  template_key, platform, category, title_template, message_template,
  email_subject_template, email_body_template, sms_template,
  push_title_template, push_body_template, whatsapp_template,
  action_url_template, default_channels, default_priority, is_active
)
VALUES
(
  'connection_new_post', 'community', 'social',
  'New post from your network',
  '{{author_name}} shared a new update',
  '{{author_name}} posted on SHEconomy',
  '<p><strong>{{author_name}}</strong> shared a new update.</p><p>{{post_preview}}</p><p><a href="{{action_url}}">View post</a></p>',
  'SHEconomy: {{author_name}} posted. {{action_url}}',
  'New post from {{author_name}}',
  '{{post_preview}}',
  '{{author_name}} posted on SHEconomy: {{action_url}}',
  '{{action_url}}',
  ARRAY['in_app', 'email', 'push'], 2, true
),
(
  'network_invite_received', 'community', 'social',
  'You are invited to connect',
  '{{inviter_name}} invited you to connect on SHEconomy',
  '{{inviter_name}} invited you on SHEconomy',
  '<p><strong>{{inviter_name}}</strong> invited you to connect.</p><p>{{invite_message}}</p><p><a href="{{action_url}}">View invitation</a></p>',
  'SHEconomy: {{inviter_name}} invited you. {{action_url}}',
  'Network invitation',
  '{{inviter_name}} invited you to connect',
  '{{inviter_name}} invited you on SHEconomy: {{action_url}}',
  '{{action_url}}',
  ARRAY['in_app', 'email', 'push', 'whatsapp'], 5, true
)
ON CONFLICT (template_key) DO UPDATE SET
  title_template = EXCLUDED.title_template,
  message_template = EXCLUDED.message_template,
  email_subject_template = EXCLUDED.email_subject_template,
  email_body_template = EXCLUDED.email_body_template,
  push_title_template = EXCLUDED.push_title_template,
  push_body_template = EXCLUDED.push_body_template,
  whatsapp_template = EXCLUDED.whatsapp_template,
  default_channels = EXCLUDED.default_channels,
  is_active = true,
  updated_at = now();

-- Ensure core social templates carry WhatsApp where prefs allow
UPDATE public.notification_templates
SET
  whatsapp_template = COALESCE(
    NULLIF(whatsapp_template, ''),
    message_template || ' {{action_url}}'
  ),
  default_channels = CASE
    WHEN template_key IN (
      'connection_request',
      'connection_accepted',
      'new_follower',
      'post_mentioned',
      'comment_mentioned',
      'recommendation_received',
      'network_invite_received'
    ) AND NOT ('whatsapp' = ANY (default_channels))
      THEN array_append(default_channels, 'whatsapp')
    ELSE default_channels
  END,
  updated_at = now()
WHERE platform = 'community'
  AND template_key IN (
    'connection_request',
    'connection_accepted',
    'new_follower',
    'post_mentioned',
    'comment_mentioned',
    'recommendation_received',
    'network_invite_received'
  );

-- Notify accepted connections when a member publishes a feed post
CREATE OR REPLACE FUNCTION public.notify_connection_new_post()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r record;
  v_name text;
  v_username text;
  v_preview text;
  v_app_base text := COALESCE(
    NULLIF(current_setting('app.settings.public_app_url', true), ''),
    'https://sheconomy.com'
  );
  v_count integer := 0;
BEGIN
  IF TG_OP <> 'INSERT' THEN
    RETURN NEW;
  END IF;

  -- Only first-class feed posts
  IF COALESCE(NEW.is_deleted, false) THEN
    RETURN NEW;
  END IF;
  IF NEW.visibility IS NOT NULL AND NEW.visibility NOT IN ('public', 'connections', 'network') THEN
    RETURN NEW;
  END IF;
  IF NEW.post_type IS NOT NULL AND NEW.post_type IN ('comment', 'reply') THEN
    RETURN NEW;
  END IF;
  -- Skip pure reposts? Allow; professional network notifies shares too.
  IF NEW.group_id IS NOT NULL OR NEW.company_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(NULLIF(full_name, ''), username, 'Someone'), username
  INTO v_name, v_username
  FROM public.profiles
  WHERE id = NEW.user_id;

  v_preview := left(regexp_replace(COALESCE(NEW.content, ''), E'\\s+', ' ', 'g'), 120);
  IF v_preview IS NULL OR length(trim(v_preview)) = 0 THEN
    v_preview := 'Shared an update';
  END IF;

  FOR r IN
    SELECT
      CASE
        WHEN c.sender_id = NEW.user_id THEN c.receiver_id
        ELSE c.sender_id
      END AS peer_id
    FROM public.connections c
    WHERE c.status = 'accepted'
      AND (c.sender_id = NEW.user_id OR c.receiver_id = NEW.user_id)
    LIMIT 75
  LOOP
    BEGIN
      PERFORM public.create_notification_from_template(
        'connection_new_post',
        r.peer_id,
        jsonb_build_object(
          'author_name', v_name,
          'post_preview', v_preview,
          'action_url', v_app_base || '/community/post/' || NEW.id::text
        ),
        'post',
        NEW.id
      );
      v_count := v_count + 1;
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_connection_new_post ON public.posts;
CREATE TRIGGER trg_notify_connection_new_post
  AFTER INSERT ON public.posts
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_connection_new_post();

-- Invite existing member by email (or queue invite for later)
CREATE OR REPLACE FUNCTION public.invite_network_by_email(
  p_email text,
  p_message text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inviter uuid := auth.uid();
  v_email text := lower(trim(p_email));
  v_invitee uuid;
  v_connection_id uuid;
  v_invite_id uuid;
BEGIN
  IF v_inviter IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF v_email IS NULL OR v_email !~ '^[^@]+@[^@]+\.[^@]+$' THEN
    RAISE EXCEPTION 'Enter a valid email address';
  END IF;

  SELECT u.id INTO v_invitee
  FROM auth.users u
  WHERE lower(u.email) = v_email
  LIMIT 1;

  IF v_invitee IS NOT NULL AND v_invitee = v_inviter THEN
    RAISE EXCEPTION 'You cannot invite yourself';
  END IF;

  INSERT INTO public.network_email_invites (inviter_id, email, invitee_user_id, message, status)
  VALUES (
    v_inviter,
    v_email,
    v_invitee,
    NULLIF(trim(COALESCE(p_message, '')), ''),
    CASE WHEN v_invitee IS NULL THEN 'pending' ELSE 'sent' END
  )
  ON CONFLICT (inviter_id, email) DO UPDATE SET
    invitee_user_id = EXCLUDED.invitee_user_id,
    message = COALESCE(EXCLUDED.message, network_email_invites.message),
    status = EXCLUDED.status
  RETURNING id INTO v_invite_id;

  IF v_invitee IS NULL THEN
    RETURN jsonb_build_object(
      'status', 'pending_signup',
      'invite_id', v_invite_id,
      'message', 'Invite saved. We will notify them when they join SHEconomy.'
    );
  END IF;

  -- Existing connection?
  SELECT id INTO v_connection_id
  FROM public.connections
  WHERE status IN ('pending', 'accepted')
    AND (
      (sender_id = v_inviter AND receiver_id = v_invitee)
      OR (sender_id = v_invitee AND receiver_id = v_inviter)
    )
  LIMIT 1;

  IF v_connection_id IS NULL THEN
    INSERT INTO public.connections (sender_id, receiver_id, status)
    VALUES (v_inviter, v_invitee, 'pending')
    RETURNING id INTO v_connection_id;
  END IF;

  -- connection_request DB trigger notifies invitee across email/push/in-app/whatsapp

  RETURN jsonb_build_object(
    'status', 'sent',
    'invite_id', v_invite_id,
    'invitee_user_id', v_invitee,
    'connection_id', v_connection_id,
    'message', 'Invitation sent.'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.invite_network_by_email(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.invite_network_by_email(text, text) TO authenticated;
