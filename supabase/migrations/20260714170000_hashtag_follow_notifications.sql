-- Hashtag follow notifications + profile_views owner read policy

INSERT INTO public.notification_templates (
  template_key, platform, category, title_template, message_template,
  email_subject_template, email_body_template, sms_template,
  push_title_template, push_body_template, whatsapp_template,
  action_url_template, default_channels, default_priority, is_active
)
VALUES
(
  'hashtag_post', 'community', 'social',
  'New post on #{{hashtag}}',
  '{{author_name}} posted about #{{hashtag}}',
  '{{author_name}} posted about #{{hashtag}}',
  '<p><strong>{{author_name}}</strong> posted about <strong>#{{hashtag}}</strong>.</p><p><a href="{{action_url}}">View post</a></p>',
  'SHEconomy: {{author_name}} posted about #{{hashtag}}. {{action_url}}',
  'New #{{hashtag}} post',
  '{{author_name}} posted about #{{hashtag}}',
  '{{author_name}} posted about #{{hashtag}} on SHEconomy: {{action_url}}',
  '{{action_url}}',
  ARRAY['in_app', 'email', 'push'], 3, true
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

-- Owners can read their own profile view analytics
ALTER TABLE public.profile_views ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owners can view own profile views" ON public.profile_views;
CREATE POLICY "Owners can view own profile views"
  ON public.profile_views
  FOR SELECT
  USING (auth.uid() = profile_user_id);

DROP POLICY IF EXISTS "Authenticated users can insert profile views" ON public.profile_views;
CREATE POLICY "Authenticated users can insert profile views"
  ON public.profile_views
  FOR INSERT
  WITH CHECK (
    viewer_user_id IS NULL
    OR viewer_user_id = auth.uid()
  );
