-- Cross-platform notifications foundation:
-- 1) Move message_received to platform chat + enrich templates
-- 2) Rewrite notify_new_message to use create_notification_from_template (push fanout)
-- 3) Attach AFTER/AFTER INSERT trigger on messages
-- 4) Class enrollment / lesson templates + DB triggers

-- ---------------------------------------------------------------------------
-- Chat: template platform + copy
-- ---------------------------------------------------------------------------
UPDATE public.notification_templates
SET
  platform = 'chat',
  category = 'messages',
  title_template = 'New message from {{sender_name}}',
  message_template = '{{sender_name}}: {{message_preview}}',
  push_title_template = COALESCE(NULLIF(push_title_template, ''), 'New message'),
  push_body_template = COALESCE(NULLIF(push_body_template, ''), '{{sender_name}}: {{message_preview}}'),
  action_url_template = '/chat/{{conversation_id}}',
  default_channels = ARRAY['in_app', 'push']::text[],
  default_priority = 4,
  is_active = true,
  updated_at = now()
WHERE template_key = 'message_received';

INSERT INTO public.notification_templates (
  template_key, platform, category, title_template, message_template,
  email_subject_template, email_body_template, sms_template,
  push_title_template, push_body_template, whatsapp_template,
  action_url_template, default_channels, default_priority, is_active
)
VALUES
(
  'message_received', 'chat', 'messages',
  'New message from {{sender_name}}',
  '{{sender_name}}: {{message_preview}}',
  'New message from {{sender_name}}',
  '<p><strong>{{sender_name}}</strong> sent you a message.</p><p>{{message_preview}}</p><p><a href="{{action_url}}">Open chat</a></p>',
  NULL,
  'New message',
  '{{sender_name}}: {{message_preview}}',
  NULL,
  '/chat/{{conversation_id}}',
  ARRAY['in_app', 'push'], 4, true
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
-- Class templates
-- ---------------------------------------------------------------------------
INSERT INTO public.notification_templates (
  template_key, platform, category, title_template, message_template,
  email_subject_template, email_body_template, sms_template,
  push_title_template, push_body_template, whatsapp_template,
  action_url_template, default_channels, default_priority, is_active
)
VALUES
(
  'class_enrollment_confirmed', 'class', 'transactional',
  'You''re enrolled in {{course_title}}',
  'Your enrollment in "{{course_title}}" is confirmed. Start learning whenever you''re ready.',
  'Enrolled: {{course_title}}',
  '<p>You''re enrolled in <strong>{{course_title}}</strong>.</p><p><a href="{{action_url}}">Open course</a></p>',
  NULL,
  'Enrollment confirmed',
  'You''re in "{{course_title}}"',
  NULL,
  '{{action_url}}',
  ARRAY['in_app', 'email', 'push'], 3, true
),
(
  'class_lesson_published', 'class', 'transactional',
  'New lesson in {{course_title}}',
  '{{lesson_title}} is now available in "{{course_title}}".',
  'New lesson: {{lesson_title}}',
  '<p>A new lesson <strong>{{lesson_title}}</strong> was published in <strong>{{course_title}}</strong>.</p><p><a href="{{action_url}}">View lesson</a></p>',
  NULL,
  'New lesson',
  '{{lesson_title}} · {{course_title}}',
  NULL,
  '{{action_url}}',
  ARRAY['in_app', 'email', 'push'], 3, true
),
(
  'class_starting_soon', 'class', 'transactional',
  '{{course_title}} starts soon',
  '{{course_title}} begins {{starts_in}}. Don''t miss it.',
  '{{course_title}} starts soon',
  '<p><strong>{{course_title}}</strong> starts {{starts_in}}.</p><p><a href="{{action_url}}">Join class</a></p>',
  NULL,
  'Class starting soon',
  '{{course_title}} starts {{starts_in}}',
  NULL,
  '{{action_url}}',
  ARRAY['in_app', 'push'], 4, true
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

-- Co-work meeting invitation: keep community platform but fix relative action URL
UPDATE public.notification_templates
SET
  action_url_template = COALESCE(
    NULLIF(action_url_template, ''),
    '/co-work/meeting/{{room_id}}'
  ),
  updated_at = now()
WHERE template_key = 'meeting_invitation'
  AND (action_url_template IS NULL OR action_url_template LIKE 'https://%');

UPDATE public.notification_templates
SET
  action_url_template = '/co-work/meeting/{{room_id}}',
  updated_at = now()
WHERE template_key = 'meeting_invitation';

-- ---------------------------------------------------------------------------
-- Chat notify_new_message → template pipeline (fail-soft)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.notify_new_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  sender_name text;
  preview text;
  recipient record;
BEGIN
  -- Soft-fail: never block message delivery.
  BEGIN
    SELECT coalesce(nullif(trim(full_name), ''), nullif(trim(username), ''), 'Someone')
      INTO sender_name
    FROM public.profiles
    WHERE id = NEW.sender_id;

    sender_name := coalesce(sender_name, 'Someone');
    preview := left(coalesce(nullif(trim(NEW.content), ''), 'Sent an attachment'), 140);

    FOR recipient IN
      SELECT cp.user_id
      FROM public.conversation_participants cp
      WHERE cp.conversation_id = NEW.conversation_id
        AND cp.user_id IS DISTINCT FROM NEW.sender_id
        AND coalesce(cp.is_muted, false) = false
    LOOP
      PERFORM public.create_notification_from_template(
        'message_received',
        recipient.user_id,
        jsonb_build_object(
          'sender_name', sender_name,
          'message_preview', preview,
          'conversation_id', NEW.conversation_id::text,
          'action_url', '/chat/' || NEW.conversation_id::text
        ),
        'chat',
        NEW.conversation_id,
        NULL,
        NULL,
        ARRAY['in_app', 'push']::text[],
        4,
        NULL
      );
    END LOOP;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_notify_new_message ON public.messages;
CREATE TRIGGER trigger_notify_new_message
  AFTER INSERT ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_new_message();

-- ---------------------------------------------------------------------------
-- Class enrollment / lesson triggers
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.notify_class_enrollment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  course_title text;
  course_slug text;
BEGIN
  BEGIN
    SELECT c.title, c.slug INTO course_title, course_slug
    FROM public.class_course c
    WHERE c.id = NEW.course_id;

    IF course_title IS NULL THEN
      RETURN NEW;
    END IF;

    PERFORM public.create_notification_from_template(
      'class_enrollment_confirmed',
      NEW.user_id,
      jsonb_build_object(
        'course_title', course_title,
        'action_url', '/class/' || coalesce(nullif(course_slug, ''), NEW.course_id::text)
      ),
      'class',
      NEW.course_id,
      NULL,
      NULL,
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

DROP TRIGGER IF EXISTS trigger_notify_class_enrollment ON public.class_enrollment;
CREATE TRIGGER trigger_notify_class_enrollment
  AFTER INSERT ON public.class_enrollment
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_class_enrollment();

CREATE OR REPLACE FUNCTION public.notify_class_lesson_published()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  course_title text;
  course_slug text;
  enrollee record;
BEGIN
  BEGIN
    SELECT c.title, c.slug INTO course_title, course_slug
    FROM public.class_course c
    WHERE c.id = NEW.course_id;

    IF course_title IS NULL THEN
      RETURN NEW;
    END IF;

    FOR enrollee IN
      SELECT e.user_id
      FROM public.class_enrollment e
      WHERE e.course_id = NEW.course_id
    LOOP
      PERFORM public.create_notification_from_template(
        'class_lesson_published',
        enrollee.user_id,
        jsonb_build_object(
          'course_title', course_title,
          'lesson_title', coalesce(nullif(trim(NEW.title), ''), 'New lesson'),
          'action_url', '/class/' || coalesce(nullif(course_slug, ''), NEW.course_id::text)
        ),
        'class',
        NEW.course_id,
        NULL,
        NULL,
        ARRAY['in_app', 'email', 'push']::text[],
        3,
        NULL
      );
    END LOOP;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_notify_class_lesson_published ON public.class_lesson;
CREATE TRIGGER trigger_notify_class_lesson_published
  AFTER INSERT ON public.class_lesson
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_class_lesson_published();
