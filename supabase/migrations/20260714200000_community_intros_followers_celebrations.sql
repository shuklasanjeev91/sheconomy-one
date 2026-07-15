-- professional: introductions, follower/celebration alerts, services framing

CREATE TABLE IF NOT EXISTS public.introduction_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  introducer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  message text NULL,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'declined', 'cancelled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (requester_id, introducer_id, target_id)
);

ALTER TABLE public.introduction_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS introduction_requests_select ON public.introduction_requests;
CREATE POLICY introduction_requests_select ON public.introduction_requests
  FOR SELECT TO authenticated
  USING (
    requester_id = auth.uid()
    OR introducer_id = auth.uid()
    OR target_id = auth.uid()
  );

DROP POLICY IF EXISTS introduction_requests_insert ON public.introduction_requests;
CREATE POLICY introduction_requests_insert ON public.introduction_requests
  FOR INSERT TO authenticated
  WITH CHECK (requester_id = auth.uid());

DROP POLICY IF EXISTS introduction_requests_update ON public.introduction_requests;
CREATE POLICY introduction_requests_update ON public.introduction_requests
  FOR UPDATE TO authenticated
  USING (introducer_id = auth.uid() OR requester_id = auth.uid())
  WITH CHECK (introducer_id = auth.uid() OR requester_id = auth.uid());

INSERT INTO public.notification_templates (
  template_key, platform, category, title_template, message_template,
  email_subject_template, email_body_template, sms_template,
  push_title_template, push_body_template, whatsapp_template,
  action_url_template, default_channels, default_priority, is_active
)
VALUES
(
  'introduction_requested', 'community', 'social',
  'Introduction request',
  '{{requester_name}} asked you to introduce them to {{target_name}}',
  '{{requester_name}} asked for an introduction on SHEconomy',
  '<p><strong>{{requester_name}}</strong> asked you to introduce them to <strong>{{target_name}}</strong>.</p><p>{{intro_message}}</p><p><a href="{{action_url}}">View request</a></p>',
  'SHEconomy: {{requester_name}} wants an intro to {{target_name}}. {{action_url}}',
  'Introduction request',
  '{{requester_name}} → {{target_name}}',
  '{{requester_name}} asked you to introduce them to {{target_name}} on SHEconomy: {{action_url}}',
  '{{action_url}}',
  ARRAY['in_app', 'email', 'push', 'whatsapp'], 5, true
),
(
  'follower_new_post', 'community', 'social',
  'New post from someone you follow',
  '{{author_name}} shared a new update',
  '{{author_name}} posted on SHEconomy',
  '<p><strong>{{author_name}}</strong> shared a new update.</p><p>{{post_preview}}</p><p><a href="{{action_url}}">View post</a></p>',
  'SHEconomy: {{author_name}} posted. {{action_url}}',
  '{{author_name}} posted',
  '{{post_preview}}',
  '{{author_name}} posted on SHEconomy: {{action_url}}',
  '{{action_url}}',
  ARRAY['in_app', 'email', 'push'], 2, true
),
(
  'celebration_posted', 'community', 'social',
  'A celebration in your network',
  '{{author_name}} is celebrating {{celebration_title}}',
  '{{author_name}} shared a celebration on SHEconomy',
  '<p><strong>{{author_name}}</strong> is celebrating <strong>{{celebration_title}}</strong>.</p><p><a href="{{action_url}}">Congratulate them</a></p>',
  'SHEconomy: {{author_name}} is celebrating {{celebration_title}}. {{action_url}}',
  'Celebrate with {{author_name}}',
  '{{celebration_title}}',
  '{{author_name}} is celebrating {{celebration_title}} on SHEconomy: {{action_url}}',
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
  default_channels = EXCLUDED.default_channels,
  is_active = true,
  updated_at = now();

-- Request an intro via a mutual connection
CREATE OR REPLACE FUNCTION public.request_introduction(
  p_introducer_id uuid,
  p_target_id uuid,
  p_message text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_requester uuid := auth.uid();
  v_id uuid;
  v_requester_name text;
  v_target_name text;
  v_app_base text := COALESCE(
    NULLIF(current_setting('app.settings.public_app_url', true), ''),
    'https://sheconomy.com'
  );
  v_msg text := NULLIF(trim(COALESCE(p_message, '')), '');
BEGIN
  IF v_requester IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF p_introducer_id IS NULL OR p_target_id IS NULL THEN
    RAISE EXCEPTION 'Missing introducer or target';
  END IF;
  IF v_requester = p_introducer_id OR v_requester = p_target_id OR p_introducer_id = p_target_id THEN
    RAISE EXCEPTION 'Invalid introduction participants';
  END IF;

  -- Requester connected to introducer
  IF NOT EXISTS (
    SELECT 1 FROM public.connections c
    WHERE c.status = 'accepted'
      AND (
        (c.sender_id = v_requester AND c.receiver_id = p_introducer_id)
        OR (c.sender_id = p_introducer_id AND c.receiver_id = v_requester)
      )
  ) THEN
    RAISE EXCEPTION 'You must be connected to the introducer';
  END IF;

  -- Introducer connected to target
  IF NOT EXISTS (
    SELECT 1 FROM public.connections c
    WHERE c.status = 'accepted'
      AND (
        (c.sender_id = p_introducer_id AND c.receiver_id = p_target_id)
        OR (c.sender_id = p_target_id AND c.receiver_id = p_introducer_id)
      )
  ) THEN
    RAISE EXCEPTION 'That person is not connected to your contact';
  END IF;

  INSERT INTO public.introduction_requests (requester_id, introducer_id, target_id, message, status)
  VALUES (v_requester, p_introducer_id, p_target_id, v_msg, 'pending')
  ON CONFLICT (requester_id, introducer_id, target_id) DO UPDATE SET
    message = COALESCE(EXCLUDED.message, introduction_requests.message),
    status = 'pending',
    created_at = now()
  RETURNING id INTO v_id;

  SELECT COALESCE(NULLIF(full_name, ''), username, 'Someone') INTO v_requester_name
  FROM public.profiles WHERE id = v_requester;
  SELECT COALESCE(NULLIF(full_name, ''), username, 'Someone') INTO v_target_name
  FROM public.profiles WHERE id = p_target_id;

  BEGIN
    PERFORM public.create_notification_from_template(
      'introduction_requested',
      p_introducer_id,
      jsonb_build_object(
        'requester_name', v_requester_name,
        'target_name', v_target_name,
        'intro_message', COALESCE(v_msg, 'Would you introduce us?'),
        'action_url', v_app_base || '/community/network'
      ),
      'introduction',
      v_id
    );
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  RETURN jsonb_build_object('status', 'sent', 'id', v_id);
END;
$$;

REVOKE ALL ON FUNCTION public.request_introduction(uuid, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.request_introduction(uuid, uuid, text) TO authenticated;

-- Notify followers when a creator posts (complements connection_new_post)
CREATE OR REPLACE FUNCTION public.notify_follower_new_post()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r record;
  v_name text;
  v_preview text;
  v_app_base text := COALESCE(
    NULLIF(current_setting('app.settings.public_app_url', true), ''),
    'https://sheconomy.com'
  );
  v_creator boolean := false;
BEGIN
  IF TG_OP <> 'INSERT' OR COALESCE(NEW.is_deleted, false) THEN
    RETURN NEW;
  END IF;
  IF NEW.group_id IS NOT NULL OR NEW.company_id IS NOT NULL THEN
    RETURN NEW;
  END IF;
  IF NEW.visibility IS NOT NULL AND NEW.visibility NOT IN ('public', 'connections', 'network') THEN
    RETURN NEW;
  END IF;

  -- Prefer creator-mode authors; still notify followers for everyone (capped)
  SELECT COALESCE((job_preferences->'creator_mode'->>'enabled')::boolean, false)
  INTO v_creator
  FROM public.profiles WHERE id = NEW.user_id;

  SELECT COALESCE(NULLIF(full_name, ''), username, 'Someone') INTO v_name
  FROM public.profiles WHERE id = NEW.user_id;

  v_preview := left(regexp_replace(COALESCE(NEW.content, ''), E'\\s+', ' ', 'g'), 120);
  IF v_preview IS NULL OR length(trim(v_preview)) = 0 THEN
    v_preview := 'Shared an update';
  END IF;

  FOR r IN
    SELECT f.follower_id AS peer_id
    FROM public.follows f
    WHERE f.following_id = NEW.user_id
      AND COALESCE(f.status, 'active') = 'active'
      AND f.follower_id IS DISTINCT FROM NEW.user_id
      -- Skip peers who already get connection_new_post
      AND NOT EXISTS (
        SELECT 1 FROM public.connections c
        WHERE c.status = 'accepted'
          AND (
            (c.sender_id = NEW.user_id AND c.receiver_id = f.follower_id)
            OR (c.sender_id = f.follower_id AND c.receiver_id = NEW.user_id)
          )
      )
    ORDER BY f.created_at DESC NULLS LAST
    LIMIT CASE WHEN v_creator THEN 100 ELSE 40 END
  LOOP
    BEGIN
      PERFORM public.create_notification_from_template(
        'follower_new_post',
        r.peer_id,
        jsonb_build_object(
          'author_name', v_name,
          'post_preview', v_preview,
          'action_url', v_app_base || '/community/post/' || NEW.id::text
        ),
        'post',
        NEW.id
      );
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_follower_new_post ON public.posts;
CREATE TRIGGER trg_notify_follower_new_post
  AFTER INSERT ON public.posts
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_follower_new_post();

-- Celebrate posts → notify connections
CREATE OR REPLACE FUNCTION public.notify_celebration_posted()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r record;
  v_name text;
  v_title text;
  v_app_base text := COALESCE(
    NULLIF(current_setting('app.settings.public_app_url', true), ''),
    'https://sheconomy.com'
  );
BEGIN
  IF TG_OP <> 'INSERT' THEN RETURN NEW; END IF;
  IF NEW.celebration_data IS NULL THEN RETURN NEW; END IF;
  IF COALESCE(NEW.is_deleted, false) THEN RETURN NEW; END IF;

  v_title := COALESCE(
    NULLIF(NEW.celebration_data->>'title', ''),
    NULLIF(NEW.celebration_data->>'occasion', ''),
    'a milestone'
  );

  SELECT COALESCE(NULLIF(full_name, ''), username, 'Someone') INTO v_name
  FROM public.profiles WHERE id = NEW.user_id;

  FOR r IN
    SELECT CASE WHEN c.sender_id = NEW.user_id THEN c.receiver_id ELSE c.sender_id END AS peer_id
    FROM public.connections c
    WHERE c.status = 'accepted'
      AND (c.sender_id = NEW.user_id OR c.receiver_id = NEW.user_id)
    LIMIT 75
  LOOP
    BEGIN
      PERFORM public.create_notification_from_template(
        'celebration_posted',
        r.peer_id,
        jsonb_build_object(
          'author_name', v_name,
          'celebration_title', v_title,
          'action_url', v_app_base || '/community/post/' || NEW.id::text
        ),
        'post',
        NEW.id
      );
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_celebration_posted ON public.posts;
CREATE TRIGGER trg_notify_celebration_posted
  AFTER INSERT ON public.posts
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_celebration_posted();
