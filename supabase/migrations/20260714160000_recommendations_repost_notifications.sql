-- professional recommendations + repost notifications (multi-channel)

INSERT INTO public.notification_templates (
  template_key, platform, category, title_template, message_template,
  email_subject_template, email_body_template, sms_template,
  push_title_template, push_body_template, whatsapp_template,
  action_url_template, default_channels, default_priority, is_active
)
VALUES
(
  'recommendation_received', 'community', 'social',
  'New recommendation',
  '{{recommender_name}} recommended you',
  '{{recommender_name}} wrote you a recommendation',
  '<p><strong>{{recommender_name}}</strong> recommended you on SHEconomy.</p><p>{{recommendation_preview}}</p><p><a href="{{action_url}}">View profile</a></p>',
  'SHEconomy: {{recommender_name}} recommended you. {{action_url}}',
  'New recommendation',
  '{{recommender_name}} recommended you',
  '{{recommender_name}} recommended you on SHEconomy: {{action_url}}',
  '{{action_url}}',
  ARRAY['in_app', 'email', 'push', 'whatsapp'], 4, true
),
(
  'recommendation_requested', 'community', 'social',
  'Recommendation request',
  '{{requester_name}} asked you for a recommendation',
  '{{requester_name}} asked for a recommendation',
  '<p><strong>{{requester_name}}</strong> asked you to write a recommendation.</p><p>{{message}}</p><p><a href="{{action_url}}">View profile</a></p>',
  'SHEconomy: {{requester_name}} asked for a recommendation. {{action_url}}',
  'Recommendation request',
  '{{requester_name}} asked you for a recommendation',
  '{{requester_name}} asked you for a SHEconomy recommendation: {{action_url}}',
  '{{action_url}}',
  ARRAY['in_app', 'email', 'push'], 4, true
),
(
  'post_reposted', 'community', 'social',
  'Your post was reposted',
  '{{reposter_name}} reposted your post',
  '{{reposter_name}} reposted your post on SHEconomy',
  '<p><strong>{{reposter_name}}</strong> reposted your post.</p><p>{{post_preview}}</p><p><a href="{{action_url}}">View post</a></p>',
  'SHEconomy: {{reposter_name}} reposted your post. {{action_url}}',
  'Post reposted',
  '{{reposter_name}} reposted your post',
  '{{reposter_name}} reposted your post on SHEconomy: {{action_url}}',
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

UPDATE public.notification_templates
SET
  whatsapp_template = COALESCE(
    NULLIF(whatsapp_template, ''),
    'SHEconomy: {{mentioner_name}} mentioned you. {{action_url}}'
  ),
  default_channels = ARRAY['in_app', 'email', 'push', 'whatsapp'],
  updated_at = now()
WHERE template_key IN ('post_mentioned', 'comment_mentioned');

DROP POLICY IF EXISTS "Users can view recommendations they gave or received" ON public.recommendations;
CREATE POLICY "Public can view approved recommendations"
  ON public.recommendations
  FOR SELECT
  USING (
    status = 'approved'
    OR auth.uid() = recommender_id
    OR auth.uid() = recommended_user_id
  );

DROP TRIGGER IF EXISTS trigger_notify_post_comment ON public.comments;

CREATE OR REPLACE FUNCTION public.notify_post_repost()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_original RECORD;
  v_reposter_name text;
  v_post_preview text;
  v_app_base text := COALESCE(
    NULLIF(current_setting('app.settings.public_app_url', true), ''),
    'https://sheconomy.com'
  );
BEGIN
  IF NEW.original_post_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT user_id, content INTO v_original
  FROM public.posts
  WHERE id = NEW.original_post_id;

  IF NOT FOUND OR v_original.user_id = NEW.user_id THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(NULLIF(full_name, ''), username, 'Someone')
  INTO v_reposter_name
  FROM public.profiles
  WHERE id = NEW.user_id;

  v_post_preview := LEFT(COALESCE(v_original.content, ''), 100);

  BEGIN
    PERFORM public.create_notification_from_template(
      'post_reposted',
      v_original.user_id,
      jsonb_build_object(
        'reposter_name', v_reposter_name,
        'post_preview', v_post_preview,
        'action_url', v_app_base || '/community/post/' || NEW.original_post_id::text
      ),
      'post',
      NEW.original_post_id
    );
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_post_repost ON public.posts;
CREATE TRIGGER trg_notify_post_repost
  AFTER INSERT ON public.posts
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_post_repost();
