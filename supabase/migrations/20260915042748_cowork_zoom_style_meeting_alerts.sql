-- Zoom-style Co-Work alerts:
-- 1) Scheduled reminders at 3h / 2h / 1h / 30min / 15min (keep 5min)
-- 2) Host notified of waiting-room join requests
-- 3) Admit / deny notices to the requester
-- 4) Everyone in the meeting (including host) notified when someone joins
-- 5) Invitees notified when the host starts or cancels

INSERT INTO public.notification_templates (
  template_key, platform, category, title_template, message_template,
  email_subject_template, email_body_template, sms_template,
  push_title_template, push_body_template, whatsapp_template,
  action_url_template, default_channels, default_priority, is_active
)
VALUES
(
  'meeting_reminder_3h', 'community', 'transactional',
  '{{meeting_title}} in 3 hours',
  '{{meeting_title}} with {{host_name}} starts at {{scheduled_at}}.',
  '{{meeting_title}} starts in 3 hours',
  '<p><strong>{{meeting_title}}</strong> starts at {{scheduled_at}}.</p><p><a href="{{action_url}}">Open meeting</a></p>',
  NULL,
  'Meeting in 3 hours',
  '{{meeting_title}} · {{scheduled_at}}',
  NULL,
  '/co-work/meeting/{{meeting_code}}',
  ARRAY['in_app', 'push', 'email']::text[], 3, true
),
(
  'meeting_reminder_2h', 'community', 'transactional',
  '{{meeting_title}} in 2 hours',
  '{{meeting_title}} with {{host_name}} starts at {{scheduled_at}}.',
  '{{meeting_title}} starts in 2 hours',
  '<p><strong>{{meeting_title}}</strong> starts at {{scheduled_at}}.</p><p><a href="{{action_url}}">Open meeting</a></p>',
  NULL,
  'Meeting in 2 hours',
  '{{meeting_title}} · {{scheduled_at}}',
  NULL,
  '/co-work/meeting/{{meeting_code}}',
  ARRAY['in_app', 'push', 'email']::text[], 3, true
),
(
  'meeting_reminder_1h', 'community', 'transactional',
  '{{meeting_title}} in 1 hour',
  '{{meeting_title}} with {{host_name}} starts at {{scheduled_at}}.',
  '{{meeting_title}} starts in 1 hour',
  '<p><strong>{{meeting_title}}</strong> starts at {{scheduled_at}}.</p><p><a href="{{action_url}}">Open meeting</a></p>',
  NULL,
  'Meeting in 1 hour',
  '{{meeting_title}} · {{scheduled_at}}',
  NULL,
  '/co-work/meeting/{{meeting_code}}',
  ARRAY['in_app', 'push', 'email']::text[], 2, true
),
(
  'meeting_reminder_15min', 'community', 'transactional',
  '{{meeting_title}} in 15 minutes',
  '{{meeting_title}} starts in about 15 minutes. Join when you are ready.',
  '{{meeting_title}} starts in 15 minutes',
  '<p><strong>{{meeting_title}}</strong> starts in about 15 minutes.</p><p><a href="{{action_url}}">Join meeting</a></p>',
  NULL,
  'Meeting in 15 minutes',
  '{{meeting_title}} starts soon',
  NULL,
  '/co-work/meeting/{{meeting_code}}',
  ARRAY['in_app', 'push']::text[], 1, true
),
(
  'meeting_started', 'community', 'transactional',
  '{{host_name}} started {{meeting_title}}',
  'The meeting is live. Join now.',
  '{{meeting_title}} has started',
  '<p><strong>{{meeting_title}}</strong> is live.</p><p><a href="{{action_url}}">Join meeting</a></p>',
  NULL,
  'Meeting started',
  '{{meeting_title}} is live · join now',
  NULL,
  '/co-work/meeting/{{meeting_code}}',
  ARRAY['in_app', 'push']::text[], 1, true
),
(
  'meeting_cancelled', 'community', 'transactional',
  '{{meeting_title}} was cancelled',
  '{{host_name}} cancelled this Co-Work meeting.',
  '{{meeting_title}} was cancelled',
  '<p><strong>{{meeting_title}}</strong> was cancelled by {{host_name}}.</p>',
  NULL,
  'Meeting cancelled',
  '{{meeting_title}} will not take place',
  NULL,
  '/co-work/meetings',
  ARRAY['in_app', 'push', 'email']::text[], 2, true
),
(
  'meeting_access_request', 'community', 'transactional',
  '{{participant_name}} wants to join {{meeting_title}}',
  'Admit or deny this waiting-room request.',
  NULL,
  NULL,
  NULL,
  'Join request',
  '{{participant_name}} is waiting to join {{meeting_title}}',
  NULL,
  '/co-work/meeting/{{meeting_code}}/live',
  ARRAY['in_app', 'push']::text[], 1, true
),
(
  'meeting_admitted', 'community', 'transactional',
  'You were admitted to {{meeting_title}}',
  'The host let you in. Join the live meeting.',
  NULL,
  NULL,
  NULL,
  'You are in',
  'Join {{meeting_title}} now',
  NULL,
  '/co-work/meeting/{{meeting_code}}/live',
  ARRAY['in_app', 'push']::text[], 1, true
),
(
  'meeting_rejected', 'community', 'transactional',
  'Join request declined',
  'The host did not admit you to {{meeting_title}}.',
  NULL,
  NULL,
  NULL,
  'Join request declined',
  'You were not admitted to {{meeting_title}}',
  NULL,
  '/co-work/meetings',
  ARRAY['in_app', 'push']::text[], 2, true
),
(
  'meeting_participant_joined', 'community', 'transactional',
  '{{participant_name}} joined {{meeting_title}}',
  '{{participant_name}} is now in the meeting.',
  NULL,
  NULL,
  NULL,
  'Someone joined',
  '{{participant_name}} joined {{meeting_title}}',
  NULL,
  '/co-work/meeting/{{meeting_code}}/live',
  ARRAY['in_app', 'push']::text[], 3, true
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

UPDATE public.notification_templates
SET
  action_url_template = '/co-work/meeting/{{meeting_code}}',
  push_title_template = 'Meeting in 30 minutes',
  push_body_template = '{{meeting_title}} starts soon',
  default_channels = ARRAY['in_app', 'push', 'email']::text[],
  platform = 'community',
  category = 'transactional',
  updated_at = now()
WHERE template_key = 'meeting_reminder_30min';

UPDATE public.notification_templates
SET
  action_url_template = '/co-work/meeting/{{meeting_code}}',
  push_title_template = 'Meeting in 5 minutes',
  push_body_template = '{{meeting_title}} is about to start',
  default_channels = ARRAY['in_app', 'push']::text[],
  platform = 'community',
  category = 'transactional',
  updated_at = now()
WHERE template_key = 'meeting_reminder_5min';

CREATE OR REPLACE FUNCTION public.collect_meeting_notify_user_ids(
  p_meeting_id uuid,
  p_host_id uuid,
  p_invitees jsonb
)
RETURNS uuid[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT coalesce(array_agg(DISTINCT x.id), ARRAY[]::uuid[])
  FROM (
    SELECT p_host_id AS id
    WHERE p_host_id IS NOT NULL
    UNION
    SELECT nullif(inv->>'id', '')::uuid
    FROM jsonb_array_elements(
      CASE
        WHEN jsonb_typeof(coalesce(p_invitees, '[]'::jsonb)) = 'array' THEN coalesce(p_invitees, '[]'::jsonb)
        ELSE '[]'::jsonb
      END
    ) inv
    WHERE nullif(inv->>'id', '') IS NOT NULL
    UNION
    SELECT mp.user_id
    FROM public.meeting_participants mp
    WHERE mp.meeting_id = p_meeting_id
      AND mp.user_id IS NOT NULL
      AND mp.status IS DISTINCT FROM 'rejected'
  ) x
  WHERE x.id IS NOT NULL;
$$;

REVOKE ALL ON FUNCTION public.collect_meeting_notify_user_ids(uuid, uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.collect_meeting_notify_user_ids(uuid, uuid, jsonb) TO postgres, service_role;

CREATE OR REPLACE FUNCTION public.schedule_meeting_reminders()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_meeting record;
  v_window record;
  v_recipient uuid;
  v_host_name text;
  v_variables jsonb;
  v_count integer := 0;
  v_now timestamptz := now();
  v_recipients uuid[];
BEGIN
  FOR v_window IN
    SELECT *
    FROM (
      VALUES
        ('meeting_reminder_3h', interval '175 minutes', interval '185 minutes', interval '12 hours', ARRAY['in_app', 'push', 'email']::text[], 3),
        ('meeting_reminder_2h', interval '115 minutes', interval '125 minutes', interval '8 hours', ARRAY['in_app', 'push', 'email']::text[], 3),
        ('meeting_reminder_1h', interval '55 minutes', interval '65 minutes', interval '4 hours', ARRAY['in_app', 'push', 'email']::text[], 2),
        ('meeting_reminder_30min', interval '25 minutes', interval '35 minutes', interval '2 hours', ARRAY['in_app', 'push', 'email']::text[], 2),
        ('meeting_reminder_15min', interval '12 minutes', interval '20 minutes', interval '90 minutes', ARRAY['in_app', 'push']::text[], 1),
        ('meeting_reminder_5min', interval '3 minutes', interval '8 minutes', interval '1 hour', ARRAY['in_app', 'push']::text[], 1)
    ) AS w(template_key, lo, hi, dedup, channels, priority)
  LOOP
    FOR v_meeting IN
      SELECT m.*
      FROM public.meetings m
      WHERE m.status = 'scheduled'
        AND m.scheduled_at IS NOT NULL
        AND m.meeting_code IS NOT NULL
        AND m.scheduled_at BETWEEN v_now + v_window.lo AND v_now + v_window.hi
    LOOP
      SELECT coalesce(nullif(trim(p.full_name), ''), nullif(trim(p.username), ''), 'Host')
        INTO v_host_name
      FROM public.profiles p
      WHERE p.id = v_meeting.host_id;

      v_recipients := public.collect_meeting_notify_user_ids(
        v_meeting.id,
        v_meeting.host_id,
        v_meeting.invitees
      );

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
            AND n.type = v_window.template_key
            AND n.created_at > v_now - v_window.dedup
        ) THEN
          CONTINUE;
        END IF;

        BEGIN
          PERFORM public.create_notification_from_template(
            v_window.template_key,
            v_recipient,
            v_variables,
            'meeting',
            v_meeting.id,
            NULL, NULL,
            v_window.channels,
            v_window.priority,
            NULL
          );
          v_count := v_count + 1;
        EXCEPTION WHEN OTHERS THEN
          NULL;
        END;
      END LOOP;
    END LOOP;
  END LOOP;

  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.schedule_meeting_reminders() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.schedule_meeting_reminders() TO service_role;

CREATE OR REPLACE FUNCTION public.notify_meeting_lifecycle()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_host_name text;
  v_recipient uuid;
  v_template text;
  v_action_url text;
  v_variables jsonb;
BEGIN
  IF TG_OP <> 'UPDATE' THEN
    RETURN NEW;
  END IF;

  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;

  IF NEW.status IS DISTINCT FROM 'active' AND NEW.status IS DISTINCT FROM 'cancelled' THEN
    RETURN NEW;
  END IF;

  v_template := CASE
    WHEN NEW.status = 'active' THEN 'meeting_started'
    ELSE 'meeting_cancelled'
  END;

  SELECT coalesce(nullif(trim(p.full_name), ''), nullif(trim(p.username), ''), 'Host')
    INTO v_host_name
  FROM public.profiles p
  WHERE p.id = NEW.host_id;

  v_action_url := CASE
    WHEN NEW.status = 'active' THEN '/co-work/meeting/' || NEW.meeting_code
    ELSE '/co-work/meetings'
  END;

  v_variables := jsonb_build_object(
    'meeting_id', NEW.id::text,
    'meeting_title', coalesce(NEW.title, 'Meeting'),
    'meeting_code', coalesce(NEW.meeting_code, ''),
    'host_name', coalesce(v_host_name, 'Host'),
    'action_url', v_action_url
  );

  FOREACH v_recipient IN ARRAY public.collect_meeting_notify_user_ids(NEW.id, NEW.host_id, NEW.invitees)
  LOOP
    IF v_recipient = NEW.host_id THEN
      CONTINUE;
    END IF;

    IF EXISTS (
      SELECT 1 FROM public.notifications n
      WHERE n.recipient_id = v_recipient
        AND n.context_id = NEW.id
        AND n.type = v_template
        AND n.created_at > now() - interval '2 hours'
    ) THEN
      CONTINUE;
    END IF;

    BEGIN
      PERFORM public.create_notification_from_template(
        v_template,
        v_recipient,
        v_variables,
        'meeting',
        NEW.id,
        NULL, NULL,
        ARRAY['in_app', 'push']::text[],
        CASE WHEN v_template = 'meeting_started' THEN 1 ELSE 2 END,
        NULL
      );
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_meeting_lifecycle ON public.meetings;
CREATE TRIGGER trg_notify_meeting_lifecycle
  AFTER UPDATE OF status ON public.meetings
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_meeting_lifecycle();

CREATE OR REPLACE FUNCTION public.notify_meeting_participant_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_meeting record;
  v_participant_name text;
  v_action_url text;
  v_recipient uuid;
  v_old_status text;
BEGIN
  v_old_status := CASE WHEN TG_OP = 'UPDATE' THEN OLD.status ELSE NULL END;

  IF NEW.status IS NOT DISTINCT FROM v_old_status THEN
    RETURN NEW;
  END IF;

  SELECT id, title, meeting_code, host_id, status
    INTO v_meeting
  FROM public.meetings
  WHERE id = NEW.meeting_id;

  IF v_meeting.id IS NULL OR v_meeting.status IN ('ended', 'cancelled') THEN
    RETURN NEW;
  END IF;

  SELECT coalesce(nullif(trim(p.full_name), ''), nullif(trim(p.username), ''), 'Someone')
    INTO v_participant_name
  FROM public.profiles p
  WHERE p.id = NEW.user_id;

  v_action_url := '/co-work/meeting/' || v_meeting.meeting_code || '/live';

  IF NEW.status = 'waiting' AND coalesce(NEW.is_host, false) IS NOT TRUE THEN
    IF v_meeting.host_id IS DISTINCT FROM NEW.user_id
       AND NOT EXISTS (
         SELECT 1 FROM public.notifications n
         WHERE n.recipient_id = v_meeting.host_id
           AND n.context_id = v_meeting.id
           AND n.type = 'meeting_access_request'
           AND n.data->>'participant_id' = NEW.id::text
           AND n.created_at > now() - interval '10 minutes'
       )
    THEN
      BEGIN
        PERFORM public.create_notification_from_template(
          'meeting_access_request',
          v_meeting.host_id,
          jsonb_build_object(
            'meeting_id', v_meeting.id::text,
            'meeting_title', coalesce(v_meeting.title, 'Meeting'),
            'meeting_code', coalesce(v_meeting.meeting_code, ''),
            'participant_id', NEW.id::text,
            'participant_user_id', NEW.user_id::text,
            'participant_name', coalesce(v_participant_name, 'Someone'),
            'action_url', v_action_url
          ),
          'meeting',
          v_meeting.id,
          'meeting_participant',
          NEW.id,
          ARRAY['in_app', 'push']::text[],
          1,
          NULL
        );
      EXCEPTION WHEN OTHERS THEN
        NULL;
      END;
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.status = 'admitted' AND coalesce(NEW.is_host, false) IS NOT TRUE THEN
    IF v_old_status = 'waiting' THEN
      BEGIN
        PERFORM public.create_notification_from_template(
          'meeting_admitted',
          NEW.user_id,
          jsonb_build_object(
            'meeting_id', v_meeting.id::text,
            'meeting_title', coalesce(v_meeting.title, 'Meeting'),
            'meeting_code', coalesce(v_meeting.meeting_code, ''),
            'participant_name', coalesce(v_participant_name, 'Someone'),
            'action_url', v_action_url
          ),
          'meeting',
          v_meeting.id,
          'meeting_participant',
          NEW.id,
          ARRAY['in_app', 'push']::text[],
          1,
          NULL
        );
      EXCEPTION WHEN OTHERS THEN
        NULL;
      END;
    END IF;

    FOR v_recipient IN
      SELECT DISTINCT x.id
      FROM (
        SELECT v_meeting.host_id AS id
        UNION
        SELECT mp.user_id
        FROM public.meeting_participants mp
        WHERE mp.meeting_id = NEW.meeting_id
          AND mp.status = 'admitted'
          AND mp.user_id IS NOT NULL
      ) x
      WHERE x.id IS NOT NULL
        AND x.id IS DISTINCT FROM NEW.user_id
    LOOP
      IF EXISTS (
        SELECT 1 FROM public.notifications n
        WHERE n.recipient_id = v_recipient
          AND n.context_id = v_meeting.id
          AND n.type = 'meeting_participant_joined'
          AND n.data->>'participant_user_id' = NEW.user_id::text
          AND n.created_at > now() - interval '5 minutes'
      ) THEN
        CONTINUE;
      END IF;

      BEGIN
        PERFORM public.create_notification_from_template(
          'meeting_participant_joined',
          v_recipient,
          jsonb_build_object(
            'meeting_id', v_meeting.id::text,
            'meeting_title', coalesce(v_meeting.title, 'Meeting'),
            'meeting_code', coalesce(v_meeting.meeting_code, ''),
            'participant_id', NEW.id::text,
            'participant_user_id', NEW.user_id::text,
            'participant_name', coalesce(v_participant_name, 'Someone'),
            'action_url', v_action_url
          ),
          'meeting',
          v_meeting.id,
          'meeting_participant',
          NEW.id,
          ARRAY['in_app', 'push']::text[],
          3,
          NULL
        );
      EXCEPTION WHEN OTHERS THEN
        NULL;
      END;
    END LOOP;

    RETURN NEW;
  END IF;

  IF NEW.status = 'rejected' AND NEW.user_id IS NOT NULL THEN
    BEGIN
      PERFORM public.create_notification_from_template(
        'meeting_rejected',
        NEW.user_id,
        jsonb_build_object(
          'meeting_id', v_meeting.id::text,
          'meeting_title', coalesce(v_meeting.title, 'Meeting'),
          'meeting_code', coalesce(v_meeting.meeting_code, ''),
          'action_url', '/co-work/meetings'
        ),
        'meeting',
        v_meeting.id,
        'meeting_participant',
        NEW.id,
        ARRAY['in_app', 'push']::text[],
        2,
        NULL
      );
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_meeting_participant_status ON public.meeting_participants;
CREATE TRIGGER trg_notify_meeting_participant_status
  AFTER INSERT OR UPDATE OF status ON public.meeting_participants
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_meeting_participant_status();

CREATE OR REPLACE FUNCTION public.notify_upcoming_meeting()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Timed 3h/2h/1h/30/15/5-minute reminders: schedule_meeting_reminders().
  -- Start / cancel / waiting-room / join alerts: notify_meeting_* triggers.
  RETURN NEW;
END;
$$;
