-- Shop follow persistence notifications:
-- 1) Owner gets shop_new_follower when someone follows
-- 2) Followers get shop_follower_new_listing when a listing becomes storefront-visible
-- Replaces legacy profile-follows fan-out in notify_new_listing().

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
  'shop_new_follower', 'marketplace', 'social',
  'New shop follower',
  '{{follower_name}} started following {{shop_name}}',
  '{{follower_name}} followed {{shop_name}} on SHEconomy',
  '<p><strong>{{follower_name}}</strong> started following <strong>{{shop_name}}</strong>.</p><p><a href="{{action_url}}">View shop</a></p>',
  'SHEconomy: {{follower_name}} followed {{shop_name}}. {{action_url}}',
  'New shop follower',
  '{{follower_name}} started following {{shop_name}}',
  '{{follower_name}} followed {{shop_name}} on SHEconomy: {{action_url}}',
  '{{action_url}}',
  ARRAY['in_app', 'email', 'push'], 2, true
),
(
  'shop_follower_new_listing', 'marketplace', 'social',
  'New from {{shop_name}}',
  '{{shop_name}} added {{listing_title}}',
  '{{shop_name}} listed {{listing_title}} on SHEconomy',
  '<p><strong>{{shop_name}}</strong> added a new product.</p><p>{{listing_title}}</p><p><a href="{{action_url}}">View listing</a></p>',
  'SHEconomy: {{shop_name}} added {{listing_title}}. {{action_url}}',
  'New from {{shop_name}}',
  '{{listing_title}}',
  '{{shop_name}} added {{listing_title}} on SHEconomy: {{action_url}}',
  '{{action_url}}',
  ARRAY['in_app', 'email', 'push'], 3, true
)
ON CONFLICT (template_key) DO UPDATE SET
  platform = EXCLUDED.platform,
  category = EXCLUDED.category,
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

-- ---------------------------------------------------------------------------
-- Shop follow → owner (replace legacy raw INSERT type shop_follow)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.notify_shop_follow()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner uuid;
  v_shop_name text;
  v_shop_slug text;
  v_follower text;
  v_app_base text := COALESCE(
    NULLIF(current_setting('app.settings.public_app_url', true), ''),
    'https://sheconomy.com'
  );
BEGIN
  IF NEW.status IS DISTINCT FROM 'active' THEN
    RETURN NEW;
  END IF;

  -- Skip no-op updates that stay active
  IF TG_OP = 'UPDATE' AND OLD.status IS NOT DISTINCT FROM 'active' THEN
    RETURN NEW;
  END IF;

  SELECT s.user_id, s.shop_name, COALESCE(s.slug, s.id::text)
  INTO v_owner, v_shop_name, v_shop_slug
  FROM public.shops s
  WHERE s.id = NEW.shop_id;

  IF v_owner IS NULL OR v_owner = NEW.user_id THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(NULLIF(full_name, ''), username, 'Someone') INTO v_follower
  FROM public.profiles
  WHERE id = NEW.user_id;

  BEGIN
    PERFORM public.create_notification_from_template(
      'shop_new_follower',
      v_owner,
      jsonb_build_object(
        'follower_name', COALESCE(v_follower, 'Someone'),
        'shop_name', COALESCE(v_shop_name, 'your shop'),
        'action_url', v_app_base || '/shop/' || v_shop_slug
      ),
      'shop',
      NEW.shop_id
    );
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_notify_shop_follow ON public.shop_follows;
CREATE TRIGGER trigger_notify_shop_follow
  AFTER INSERT OR UPDATE OF status ON public.shop_follows
  FOR EACH ROW
  WHEN (NEW.status = 'active')
  EXECUTE FUNCTION public.notify_shop_follow();

-- ---------------------------------------------------------------------------
-- New listing → shop followers (was profile follows of shop owner)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.notify_new_listing()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r record;
  v_shop_name text;
  v_shop_owner uuid;
  v_app_base text := COALESCE(
    NULLIF(current_setting('app.settings.public_app_url', true), ''),
    'https://sheconomy.com'
  );
  v_action_url text;
  v_became_visible boolean := false;
  v_notified integer := 0;
BEGIN
  -- Align with notify_listing_change storefront visibility rules
  IF TG_OP = 'INSERT' THEN
    v_became_visible := (
      NEW.listing_status = 'active'
      AND COALESCE(NEW.is_active, false) = true
    );
  ELSIF TG_OP = 'UPDATE' THEN
    v_became_visible := (
      NEW.listing_status = 'active'
      AND COALESCE(NEW.is_active, false) = true
      AND (
        OLD.listing_status IS DISTINCT FROM 'active'
        OR COALESCE(OLD.is_active, false) = false
      )
    );
  END IF;

  IF NOT v_became_visible OR NEW.shop_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT shop_name, user_id INTO v_shop_name, v_shop_owner
  FROM public.shops
  WHERE id = NEW.shop_id;

  IF v_shop_name IS NULL THEN
    RETURN NEW;
  END IF;

  v_action_url := v_app_base || '/listing/' || COALESCE(NEW.slug, NEW.id::text);

  FOR r IN
    SELECT sf.user_id
    FROM public.shop_follows sf
    WHERE sf.shop_id = NEW.shop_id
      AND sf.status = 'active'
      AND sf.user_id IS DISTINCT FROM v_shop_owner
    LIMIT 200
  LOOP
    BEGIN
      PERFORM public.create_notification_from_template(
        'shop_follower_new_listing',
        r.user_id,
        jsonb_build_object(
          'shop_name', v_shop_name,
          'listing_title', COALESCE(NEW.title, 'a new product'),
          'action_url', v_action_url
        ),
        'listing',
        NEW.id,
        'shop',
        NEW.shop_id
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

DROP TRIGGER IF EXISTS trigger_notify_new_listing ON public.listings;
CREATE TRIGGER trigger_notify_new_listing
  AFTER INSERT OR UPDATE OF listing_status, is_active ON public.listings
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_new_listing();
