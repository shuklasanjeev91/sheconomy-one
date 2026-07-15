-- Listing inquiries (marketplace "Ask a question") + richer restock / SMS templates.

-- ---------------------------------------------------------------------------
-- Buyer → seller listing questions
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.listing_inquiries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  shop_id uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  buyer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  seller_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  message text NOT NULL CHECK (char_length(trim(message)) BETWEEN 3 AND 2000),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'answered', 'closed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS listing_inquiries_listing_idx
  ON public.listing_inquiries (listing_id, created_at DESC);
CREATE INDEX IF NOT EXISTS listing_inquiries_seller_idx
  ON public.listing_inquiries (seller_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS listing_inquiries_buyer_idx
  ON public.listing_inquiries (buyer_id, created_at DESC);

ALTER TABLE public.listing_inquiries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS listing_inquiries_select_participants ON public.listing_inquiries;
CREATE POLICY listing_inquiries_select_participants
  ON public.listing_inquiries FOR SELECT TO authenticated
  USING (buyer_id = auth.uid() OR seller_id = auth.uid());

DROP POLICY IF EXISTS listing_inquiries_insert_buyer ON public.listing_inquiries;
CREATE POLICY listing_inquiries_insert_buyer
  ON public.listing_inquiries FOR INSERT TO authenticated
  WITH CHECK (buyer_id = auth.uid());

DROP POLICY IF EXISTS listing_inquiries_update_seller ON public.listing_inquiries;
CREATE POLICY listing_inquiries_update_seller
  ON public.listing_inquiries FOR UPDATE TO authenticated
  USING (seller_id = auth.uid())
  WITH CHECK (seller_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Templates
-- ---------------------------------------------------------------------------
INSERT INTO public.notification_templates (
  template_key,
  platform,
  category,
  title_template,
  message_template,
  email_subject_template,
  email_body_template,
  sms_template,
  push_title_template,
  push_body_template,
  whatsapp_template,
  action_url_template,
  default_channels,
  default_priority,
  is_active
)
VALUES (
  'listing_inquiry_seller',
  'marketplace',
  'transactional',
  'New question about {{product_name}}',
  '{{buyer_name}} asked: {{inquiry_preview}}',
  'Someone asked about {{product_name}} on SHEconomy',
  '<p>Hi {{seller_name}},</p><p><strong>{{buyer_name}}</strong> asked about <strong>{{product_name}}</strong>:</p><blockquote>{{inquiry_message}}</blockquote><p><a href="{{action_url}}">View listing & reply</a></p>',
  'SHEconomy: {{buyer_name}} asked about {{product_name}}. Open: {{action_url}}',
  'New buyer question',
  '{{buyer_name}}: {{inquiry_preview}}',
  'Hi {{seller_name}}! {{buyer_name}} asked about {{product_name}}: "{{inquiry_preview}}". Reply: {{action_url}}',
  '{{action_url}}',
  ARRAY['in_app', 'email', 'push', 'whatsapp'],
  4,
  true
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
  updated_at = now();

UPDATE public.notification_templates
SET
  default_channels = ARRAY['in_app', 'email', 'push', 'whatsapp', 'sms'],
  sms_template = COALESCE(
    NULLIF(sms_template, ''),
    'SHEconomy: you left {{item_count}} items ({{cart_total}}) in your cart. Checkout: {{action_url}}'
  ),
  updated_at = now()
WHERE template_key = 'cart_abandoned_customer';

UPDATE public.notification_templates
SET
  default_channels = ARRAY['in_app', 'email', 'push', 'whatsapp'],
  push_title_template = COALESCE(NULLIF(push_title_template, ''), 'Back in stock'),
  push_body_template = COALESCE(
    NULLIF(push_body_template, ''),
    '{{product_name}} from {{shop_name}} is available again.'
  ),
  whatsapp_template = COALESCE(
    NULLIF(whatsapp_template, ''),
    'Good news! {{product_name}} is back in stock on SHEconomy. Grab it: {{action_url}}'
  ),
  email_subject_template = COALESCE(
    NULLIF(email_subject_template, ''),
    '{{product_name}} is back in stock'
  ),
  email_body_template = COALESCE(
    NULLIF(email_body_template, ''),
    '<p>{{product_name}} from {{shop_name}} is available again.</p><p><a href="{{action_url}}">View listing</a></p>'
  ),
  updated_at = now()
WHERE template_key = 'product_back_in_stock';

-- ---------------------------------------------------------------------------
-- Notify seller when buyer submits an inquiry
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.notify_listing_inquiry()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_notification_id uuid;
  v_product_name text;
  v_seller_name text;
  v_buyer_name text;
  v_slug text;
  v_action_url text;
  v_preview text;
  v_app_base text := COALESCE(
    NULLIF(current_setting('app.settings.public_app_url', true), ''),
    'https://sheconomy.com'
  );
BEGIN
  SELECT l.title, l.slug INTO v_product_name, v_slug
  FROM public.listings l WHERE l.id = NEW.listing_id;

  SELECT COALESCE(NULLIF(p.full_name, ''), 'there') INTO v_seller_name
  FROM public.profiles p WHERE p.id = NEW.seller_id;

  SELECT COALESCE(NULLIF(p.full_name, ''), 'A buyer') INTO v_buyer_name
  FROM public.profiles p WHERE p.id = NEW.buyer_id;

  v_preview := left(trim(NEW.message), 120);
  v_action_url := v_app_base || '/listing/' || COALESCE(v_slug, NEW.listing_id::text);

  BEGIN
    v_notification_id := public.create_notification_from_template(
      'listing_inquiry_seller',
      NEW.seller_id,
      jsonb_build_object(
        'product_name', COALESCE(v_product_name, 'your listing'),
        'seller_name', v_seller_name,
        'buyer_name', v_buyer_name,
        'inquiry_message', NEW.message,
        'inquiry_preview', v_preview,
        'action_url', v_action_url,
        'listing_id', NEW.listing_id,
        'inquiry_id', NEW.id
      ),
      'listing',
      NEW.listing_id
    );
  EXCEPTION WHEN OTHERS THEN
    v_notification_id := NULL;
  END;

  IF v_notification_id IS NOT NULL THEN
    INSERT INTO public.notification_event_queue (
      event_key, recipient_id, payload, scheduled_for, status
    ) VALUES (
      'dispatch_notification',
      NEW.seller_id,
      jsonb_build_object('notification_id', v_notification_id, 'inquiry_id', NEW.id),
      now(),
      'pending'
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_listing_inquiry_notify ON public.listing_inquiries;
CREATE TRIGGER trg_listing_inquiry_notify
  AFTER INSERT ON public.listing_inquiries
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_listing_inquiry();
