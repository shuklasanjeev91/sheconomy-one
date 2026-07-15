-- Help & Support hub: ticket product context, RLS, seed knowledge base.

ALTER TABLE public.support_tickets
  ADD COLUMN IF NOT EXISTS product text,
  ADD COLUMN IF NOT EXISTS priority text NOT NULL DEFAULT 'normal',
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

UPDATE public.support_tickets
SET product = coalesce(nullif(trim(product), ''), 'commerce')
WHERE product IS NULL;

ALTER TABLE public.support_tickets
  ALTER COLUMN product SET DEFAULT 'commerce';

UPDATE public.support_tickets
SET priority = 'normal'
WHERE priority IS NULL OR trim(priority) = '';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'support_tickets_product_check'
  ) THEN
    ALTER TABLE public.support_tickets
      ADD CONSTRAINT support_tickets_product_check
      CHECK (product IN ('commerce', 'community', 'chat', 'class', 'cowork', 'shop'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'support_tickets_priority_check'
  ) THEN
    ALTER TABLE public.support_tickets
      ADD CONSTRAINT support_tickets_priority_check
      CHECK (priority IN ('normal', 'high'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'support_tickets_status_check'
  ) THEN
    ALTER TABLE public.support_tickets
      ADD CONSTRAINT support_tickets_status_check
      CHECK (status IN ('open', 'in_progress', 'resolved', 'closed'));
  END IF;
EXCEPTION
  WHEN check_violation THEN
    -- Existing rows may use legacy status values; normalize then retry status check.
    UPDATE public.support_tickets
    SET status = CASE
      WHEN lower(coalesce(status, '')) IN ('open', 'new', 'pending') THEN 'open'
      WHEN lower(coalesce(status, '')) IN ('in_progress', 'progress', 'active') THEN 'in_progress'
      WHEN lower(coalesce(status, '')) IN ('resolved', 'done') THEN 'resolved'
      WHEN lower(coalesce(status, '')) IN ('closed', 'cancelled', 'canceled') THEN 'closed'
      ELSE 'open'
    END;
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint WHERE conname = 'support_tickets_status_check'
    ) THEN
      ALTER TABLE public.support_tickets
        ADD CONSTRAINT support_tickets_status_check
        CHECK (status IN ('open', 'in_progress', 'resolved', 'closed'));
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS support_tickets_user_id_created_at_idx
  ON public.support_tickets (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS support_tickets_product_idx
  ON public.support_tickets (product);

CREATE INDEX IF NOT EXISTS support_knowledge_base_category_active_idx
  ON public.support_knowledge_base (category)
  WHERE is_active IS TRUE;

ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_knowledge_base ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS support_tickets_select_own ON public.support_tickets;
CREATE POLICY support_tickets_select_own
  ON public.support_tickets
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS support_tickets_insert_own ON public.support_tickets;
CREATE POLICY support_tickets_insert_own
  ON public.support_tickets
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS support_tickets_update_own ON public.support_tickets;
CREATE POLICY support_tickets_update_own
  ON public.support_tickets
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS support_kb_select_active ON public.support_knowledge_base;
CREATE POLICY support_kb_select_active
  ON public.support_knowledge_base
  FOR SELECT
  TO anon, authenticated
  USING (is_active IS TRUE);

DROP POLICY IF EXISTS support_kb_update_helpful ON public.support_knowledge_base;
CREATE POLICY support_kb_update_helpful
  ON public.support_knowledge_base
  FOR UPDATE
  TO authenticated
  USING (is_active IS TRUE)
  WITH CHECK (is_active IS TRUE);

GRANT SELECT ON public.support_knowledge_base TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.support_tickets TO authenticated;

INSERT INTO public.support_knowledge_base (
  title, content, category, user_type, tags, is_active, view_count, helpful_count
)
SELECT v.title, v.content, v.category, v.user_type, v.tags, true, 0, 0
FROM (
  VALUES
  ('How do I track my order?',
   'Open Orders from your account menu (or Marketplace → Orders). Each order shows status from placed to delivered, plus tracking when the shop adds a shipment.',
   'commerce', 'customer', ARRAY['orders','shipping']::text[]),
  ('How do returns and refunds work?',
   'Open the listing or order details and check Shipping & policies for that shop''s return window. Start a return from Order details when the policy allows it. Refunds credit the original payment method after the shop confirms.',
   'commerce', 'customer', ARRAY['returns','refunds']::text[]),
  ('Why was payment declined?',
   'Confirm card details, available balance, and that 3-D Secure / OTP completed. Try another saved payment method under Payment methods, or contact your bank if the charge is still blocked.',
   'commerce', 'customer', ARRAY['payments','checkout']::text[]),
  ('How do coupons and offers apply?',
   'Eligible shop and marketplace offers appear on the cart and checkout. Enter a coupon code in the cart coupon field. Only one discount may apply depending on offer rules.',
   'commerce', 'customer', ARRAY['offers','coupons']::text[]),
  ('How do I create a shop?',
   'If your account can sell, open Manage shop / Create shop from the menu and complete onboarding (shop name, logo, policies). You can edit settings anytime from the seller hub.',
   'shop', 'vendor', ARRAY['onboarding','seller']::text[]),
  ('How do I manage orders as a seller?',
   'Open Manage shop → Overview / Listings. New order alerts appear in Notifications when push/email are enabled. Confirm, ship, and mark statuses from the seller order tools.',
   'shop', 'vendor', ARRAY['orders','seller']::text[]),
  ('How do I set shipping and return policies?',
   'In Manage shop settings, configure delivery profiles (processing time, fixed fee, free-shipping threshold) and return policies. Buyers see these on each listing''s product details.',
   'shop', 'vendor', ARRAY['shipping','returns','policies']::text[]),
  ('Why is my listing not visible?',
   'Check listing status (active/paused), stock, and shop verification. Paused or out-of-stock listings are hidden from browse. Publish again after fixing inventory or media.',
   'shop', 'vendor', ARRAY['listings','visibility']::text[]),
  ('How do connection requests work?',
   'Send a request from a profile. The other person accepts or ignores it. You get in-app and optional push/email when someone connects with you.',
   'community', 'customer', ARRAY['network','connections']::text[]),
  ('How do I control community notifications?',
   'Go to Settings → Community alerts to toggle in-app, email, push, and WhatsApp for social updates (follows, mentions, digests, and more).',
   'community', 'customer', ARRAY['notifications','settings']::text[]),
  ('How do I report a post or profile?',
   'Open the post or profile menu and choose Report. Our trust team reviews reports; abusive accounts may be limited or removed.',
   'community', 'customer', ARRAY['safety','report']::text[]),
  ('How do groups and events work?',
   'Join groups from Community → Groups. RSVP to events from Events. Organizers can post updates that appear in your feed and notifications when enabled.',
   'community', 'customer', ARRAY['groups','events']::text[]),
  ('How do I start a new chat?',
   'Open Chat and tap New message. Search people you can message (based on network rules) and send your first note. Group chats are under the Groups tab.',
   'chat', 'customer', ARRAY['messaging','dm']::text[]),
  ('Can I mute a conversation?',
   'Open the chat options and mute notifications for that conversation. You can still open the thread anytime; muted chats skip push alerts.',
   'chat', 'customer', ARRAY['mute','privacy']::text[]),
  ('Is chat end-to-end encrypted?',
   'Messages are stored securely on SHEconomy servers with transport encryption. Treat chats as private among participants — do not share OTPs or payment secrets in chat.',
   'chat', 'customer', ARRAY['privacy','security']::text[]),
  ('How do I enroll in a class?',
   'Open Class, pick a course or program, and enroll when enrollment is available. You receive a confirmation notification (in-app, email, or push based on Settings → Class alerts).',
   'class', 'customer', ARRAY['enrollment','courses']::text[]),
  ('Where do I find new lessons?',
   'Enrolled courses show new lessons in Class. You also get a Class alert when an instructor publishes a lesson if notifications are enabled.',
   'class', 'customer', ARRAY['lessons','courses']::text[]),
  ('Video or audio will not play',
   'Check your connection and try another browser or app build. Clear cache if web playback stalls. If a specific lesson fails, note the lesson title and contact support with product Class.',
   'class', 'customer', ARRAY['playback','media']::text[]),
  ('How do I host a Co-Work meeting?',
   'Open Co-Work → schedule or start a meeting. Share the meeting code or invite link with participants. Host controls include waiting room, mute, and screen share.',
   'cowork', 'customer', ARRAY['meetings','host']::text[]),
  ('I did not get a meeting invite',
   'Ask the host to resend the invite. Check Notifications (Co-Work filter) and email spam. Enable Co-Work alerts in Settings. You can also join with the meeting code from Co-Work → Join.',
   'cowork', 'customer', ARRAY['invites','notifications']::text[]),
  ('Camera or mic is blocked',
   'Allow camera/microphone for your browser or app, then refresh the meeting room. Close other apps using the camera. On iOS/Android, check system privacy settings for SHEconomy.',
   'cowork', 'customer', ARRAY['av','permissions']::text[])
) AS v(title, content, category, user_type, tags)
WHERE NOT EXISTS (
  SELECT 1 FROM public.support_knowledge_base k WHERE k.title = v.title
);
