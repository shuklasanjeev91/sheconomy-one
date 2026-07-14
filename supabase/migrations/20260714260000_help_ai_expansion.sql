-- Help + AI expansion: KB slugs, more FAQs, more smart_suggestions.

ALTER TABLE public.support_knowledge_base
  ADD COLUMN IF NOT EXISTS slug text;

CREATE UNIQUE INDEX IF NOT EXISTS support_knowledge_base_slug_unique
  ON public.support_knowledge_base (slug)
  WHERE slug IS NOT NULL;

-- Backfill slugs for known titles (idempotent)
UPDATE public.support_knowledge_base SET slug = 'track-order'
WHERE title = 'How do I track my order?' AND slug IS NULL;
UPDATE public.support_knowledge_base SET slug = 'returns'
WHERE title ILIKE 'How do returns%' AND slug IS NULL;
UPDATE public.support_knowledge_base SET slug = 'payment-declined'
WHERE title = 'Why was payment declined?' AND slug IS NULL;
UPDATE public.support_knowledge_base SET slug = 'coupons'
WHERE title = 'How do coupons and offers apply?' AND slug IS NULL;
UPDATE public.support_knowledge_base SET slug = 'create-shop'
WHERE title = 'How do I create a shop?' AND slug IS NULL;
UPDATE public.support_knowledge_base SET slug = 'seller-orders'
WHERE title = 'How do I manage orders as a seller?' AND slug IS NULL;
UPDATE public.support_knowledge_base SET slug = 'shop-policies'
WHERE title = 'How do I set shipping and return policies?' AND slug IS NULL;
UPDATE public.support_knowledge_base SET slug = 'listing-visibility'
WHERE title = 'Why is my listing not visible?' AND slug IS NULL;
UPDATE public.support_knowledge_base SET slug = 'connections'
WHERE title = 'How do connection requests work?' AND slug IS NULL;
UPDATE public.support_knowledge_base SET slug = 'community-notifications'
WHERE title = 'How do I control community notifications?' AND slug IS NULL;
UPDATE public.support_knowledge_base SET slug = 'report-content'
WHERE title = 'How do I report a post or profile?' AND slug IS NULL;
UPDATE public.support_knowledge_base SET slug = 'groups-events'
WHERE title = 'How do groups and events work?' AND slug IS NULL;
UPDATE public.support_knowledge_base SET slug = 'start-chat'
WHERE title = 'How do I start a new chat?' AND slug IS NULL;
UPDATE public.support_knowledge_base SET slug = 'mute-chat'
WHERE title = 'Can I mute a conversation?' AND slug IS NULL;
UPDATE public.support_knowledge_base SET slug = 'chat-security'
WHERE title = 'Is chat end-to-end encrypted?' AND slug IS NULL;
UPDATE public.support_knowledge_base SET slug = 'enroll-class'
WHERE title = 'How do I enroll in a class?' AND slug IS NULL;
UPDATE public.support_knowledge_base SET slug = 'new-lessons'
WHERE title = 'Where do I find new lessons?' AND slug IS NULL;
UPDATE public.support_knowledge_base SET slug = 'class-playback'
WHERE title = 'Video or audio will not play' AND slug IS NULL;
UPDATE public.support_knowledge_base SET slug = 'host-meeting'
WHERE title = 'How do I host a Co-Work meeting?' AND slug IS NULL;
UPDATE public.support_knowledge_base SET slug = 'meeting-invite'
WHERE title = 'I did not get a meeting invite' AND slug IS NULL;
UPDATE public.support_knowledge_base SET slug = 'av-blocked'
WHERE title = 'Camera or mic is blocked' AND slug IS NULL;

INSERT INTO public.support_knowledge_base (
  title, content, category, user_type, tags, is_active, view_count, helpful_count, slug
)
SELECT v.title, v.content, v.category, v.user_type, v.tags, true, 0, 0, v.slug
FROM (
  VALUES
  ('How do I checkout from my cart?',
   'Open Cart, review quantities and shop offers, apply a coupon if eligible, then tap Checkout. Add a delivery address and payment method when prompted. You can save items for later or remove them from the cart.',
   'commerce', 'customer', ARRAY['cart','checkout']::text[], 'checkout-cart'),
  ('Where do I manage payment methods and addresses?',
   'Open Payment methods and Addresses from your account menu. Saved cards and addresses appear at checkout. Remove outdated methods anytime under those screens.',
   'commerce', 'customer', ARRAY['payments','addresses']::text[], 'payment-methods'),
  ('What if my order is delayed?',
   'Open Orders and check the latest status and estimated delivery. If shipping passed the estimate, contact the shop from the order or open Help → Contact with product Commerce and your order number.',
   'commerce', 'customer', ARRAY['orders','shipping']::text[], 'order-delayed'),
  ('How do seller payouts work?',
   'After you fulfill orders, payouts follow your Manage shop payment settings. Keep bank details current under Payments & delivery. Issues usually resolve after confirming shipment and clearing order problems.',
   'shop', 'vendor', ARRAY['payouts','seller']::text[], 'seller-payouts'),
  ('What should I do about low-stock listings?',
   'Open Manage shop → Listings, raise stock quantities, and keep listings active. Zero-stock active listings are typically hidden from browse until you restock.',
   'shop', 'vendor', ARRAY['inventory','listings']::text[], 'low-stock'),
  ('How do Community jobs work?',
   'Browse Community → Jobs for open roles. Open a posting to apply or save it. Keep your profile headline and experience current so recruiters see accurate context.',
   'community', 'customer', ARRAY['jobs','career']::text[], 'community-jobs'),
  ('Where are my saved posts?',
   'Open Community → Saved to review bookmarked posts. Unsave from the post menu when you no longer need them.',
   'community', 'customer', ARRAY['saved','feed']::text[], 'saved-posts'),
  ('How do I ask for a warm introduction?',
   'Find mutual connections on a profile, then message someone you trust with a clear ask. Keep intros concise and professional. Use Network suggestions to grow mutuals first.',
   'community', 'customer', ARRAY['network','intros']::text[], 'warm-intros'),
  ('Why will my chat photo not send?',
   'Check file size and network, then retry. Large attachments may fail on slow connections — compress the image or send a link instead.',
   'chat', 'customer', ARRAY['attachments','media']::text[], 'chat-attachments'),
  ('Can I block or report someone in chat?',
   'Use the conversation menu for mute or leave where available. For harassment, report from the profile/post menus and contact Support with product Chat.',
   'chat', 'customer', ARRAY['safety','block']::text[], 'chat-safety'),
  ('Do classes offer certificates?',
   'Some programs show completion in Class. Check the program page for certificate wording. If you finished but see nothing, contact Support with product Class and the course title.',
   'class', 'customer', ARRAY['certificates']::text[], 'class-certificates'),
  ('Can I get a refund on a paid class?',
   'Refund rules depend on the program listing. Review details before enrolling. For a review, contact Support with product Class, the course name, and purchase date.',
   'class', 'customer', ARRAY['refunds']::text[], 'class-refunds'),
  ('What is the waiting room in Co-Work?',
   'Hosts can hold participants before admitting them live. Stay on the waiting screen until admitted, or ask the host to resend the invite or share the meeting code.',
   'cowork', 'customer', ARRAY['waiting-room','meetings']::text[], 'waiting-room'),
  ('Can Co-Work meetings be recorded?',
   'Recording depends on host controls. When recording is on, participants are typically notified in-room. Ask the host before sharing sensitive material.',
   'cowork', 'customer', ARRAY['recording']::text[], 'meeting-recording')
) AS v(title, content, category, user_type, tags, slug)
WHERE NOT EXISTS (
  SELECT 1 FROM public.support_knowledge_base k
  WHERE k.title = v.title OR (k.slug IS NOT NULL AND k.slug = v.slug)
);

INSERT INTO public.smart_suggestions (
  user_type, product, context_page, suggestion_text, suggestion_action,
  icon_name, priority, is_active, usage_count, success_rate
)
SELECT v.user_type, v.product, v.context_page, v.suggestion_text, v.suggestion_action,
       v.icon_name, v.priority, true, 0, 0
FROM (
  VALUES
  ('customer', 'commerce', 'cart', 'Apply an offer', 'Help me apply the best offer or coupon on my cart', 'tag', 2),
  ('customer', 'commerce', 'cart', 'Delivery help', 'How do delivery estimates and addresses work at checkout?', 'truck', 3),
  ('customer', 'commerce', 'orders', 'Track shipment', 'Help me track my recent order shipments', 'package', 1),
  ('customer', 'commerce', 'orders', 'Delayed order', 'My order seems delayed — what should I do?', 'clock', 2),
  ('customer', 'commerce', 'orders', 'Start a return', 'How do I start a return or refund?', 'rotate-ccw', 3),
  ('customer', 'commerce', 'shop', 'Shop policies', 'Explain this shop''s shipping and return policies', 'file-text', 1),
  ('customer', 'community', 'network', 'Grow network', 'Suggest how to grow my professional network this week', 'users', 1),
  ('customer', 'community', 'network', 'Accept tips', 'How should I handle connection requests?', 'user-plus', 2),
  ('customer', 'community', 'jobs', 'Improve profile', 'How can I improve my profile for job matches?', 'badge-check', 2),
  ('customer', 'community', 'jobs', 'Apply tips', 'Tips for applying to roles on SHEconomy', 'send', 3),
  ('vendor', 'shop', 'listings', 'Improve listing', 'How can I make my listings sell better?', 'sparkles', 2),
  ('vendor', 'shop', 'listings', 'Restock flow', 'Walk me through updating stock on a listing', 'package-plus', 3),
  ('customer', 'account', 'help', 'Find FAQ', 'Help me find the right Help Center article', 'book-open', 1),
  ('customer', 'chat', 'home', 'Share media', 'Why might a photo fail to send in chat?', 'image', 4),
  ('customer', 'class', 'home', 'Certificates', 'Do classes offer certificates after completion?', 'award', 4),
  ('customer', 'cowork', 'home', 'Waiting room', 'How does the Co-Work waiting room work?', 'door-open', 4)
) AS v(user_type, product, context_page, suggestion_text, suggestion_action, icon_name, priority)
WHERE NOT EXISTS (
  SELECT 1
  FROM public.smart_suggestions s
  WHERE s.suggestion_text = v.suggestion_text
    AND coalesce(s.product, 'commerce') = v.product
);
