-- Community social notifications: follower + endorsement templates,
-- upgrade channel copy for existing connection templates, and drop a
-- legacy accept trigger that duplicated in-app rows.

INSERT INTO public.notification_templates (
  template_key, platform, category, title_template, message_template,
  email_subject_template, email_body_template, sms_template,
  push_title_template, push_body_template, whatsapp_template,
  action_url_template, default_channels, default_priority, is_active
)
VALUES
(
  'connection_request', 'community', 'social',
  'New connection request',
  '{{requester_name}} wants to connect with you',
  '{{requester_name}} wants to connect on SHEconomy',
  '<p><strong>{{requester_name}}</strong> sent you a connection request.</p><p><a href="{{action_url}}">View request</a></p>',
  'SHEconomy: {{requester_name}} wants to connect. {{action_url}}',
  'New connection request',
  '{{requester_name}} wants to connect',
  'Hi! {{requester_name}} wants to connect on SHEconomy: {{action_url}}',
  '{{action_url}}',
  ARRAY['in_app', 'email', 'push', 'whatsapp'], 5, true
),
(
  'connection_accepted', 'community', 'social',
  'Connection accepted',
  '{{receiver_name}} accepted your connection request',
  '{{receiver_name}} accepted your connection',
  '<p><strong>{{receiver_name}}</strong> accepted your connection request.</p><p><a href="{{action_url}}">View profile</a></p>',
  'SHEconomy: {{receiver_name}} accepted your connection. {{action_url}}',
  'You''re connected',
  '{{receiver_name}} accepted your request',
  '{{receiver_name}} accepted your SHEconomy connection: {{action_url}}',
  '{{action_url}}',
  ARRAY['in_app', 'email', 'push'], 4, true
),
(
  'new_follower', 'community', 'social',
  'New follower',
  '{{follower_name}} started following you',
  '{{follower_name}} followed you on SHEconomy',
  '<p><strong>{{follower_name}}</strong> started following you.</p><p><a href="{{action_url}}">View profile</a></p>',
  'SHEconomy: {{follower_name}} followed you. {{action_url}}',
  'New follower',
  '{{follower_name}} started following you',
  '{{follower_name}} followed you on SHEconomy: {{action_url}}',
  '{{action_url}}',
  ARRAY['in_app', 'email', 'push'], 3, true
),
(
  'skill_endorsed', 'community', 'social',
  'Skill endorsed',
  '{{endorser_name}} endorsed you for {{skill_name}}',
  '{{endorser_name}} endorsed your {{skill_name}} skill',
  '<p><strong>{{endorser_name}}</strong> endorsed you for <strong>{{skill_name}}</strong>.</p><p><a href="{{action_url}}">View profile</a></p>',
  'SHEconomy: {{endorser_name}} endorsed {{skill_name}}. {{action_url}}',
  'Skill endorsed',
  '{{endorser_name}} endorsed {{skill_name}}',
  '{{endorser_name}} endorsed your {{skill_name}} skill on SHEconomy',
  '{{action_url}}',
  ARRAY['in_app', 'email', 'push'], 3, true
)
ON CONFLICT (template_key) DO UPDATE SET
  title_template = EXCLUDED.title_template,
  message_template = EXCLUDED.message_template,
  email_subject_template = EXCLUDED.email_subject_template,
  email_body_template = EXCLUDED.email_body_template,
  sms_template = EXCLUDED.sms_template,
  push_title_template = EXCLUDED.push_title_template,
  push_body_template = EXCLUDED.push_body_template,
  whatsapp_template = EXCLUDED.whatsapp_template,
  action_url_template = EXCLUDED.action_url_template,
  default_channels = EXCLUDED.default_channels,
  default_priority = EXCLUDED.default_priority,
  is_active = true,
  updated_at = now();

-- Duplicate of trigger_connection_notification's accept path (raw INSERT).
DROP TRIGGER IF EXISTS trigger_notify_connection_accepted ON public.connections;

CREATE OR REPLACE FUNCTION public.notify_new_follower()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_name text;
  v_username text;
  v_app_base text := COALESCE(
    NULLIF(current_setting('app.settings.public_app_url', true), ''),
    'https://sheconomy.com'
  );
BEGIN
  IF NEW.status IS DISTINCT FROM 'active' THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(NULLIF(full_name, ''), username, 'Someone'), username
  INTO v_name, v_username
  FROM public.profiles WHERE id = NEW.follower_id;

  BEGIN
    PERFORM public.create_notification_from_template(
      'new_follower',
      NEW.following_id,
      jsonb_build_object(
        'follower_name', v_name,
        'action_url', v_app_base || '/profile/' || COALESCE(v_username, NEW.follower_id::text)
      ),
      'follow',
      NEW.id
    );
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_new_follower ON public.follows;
CREATE TRIGGER trg_notify_new_follower
  AFTER INSERT ON public.follows
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_new_follower();
