-- Train AI suggestion chips across Marketplace, Community, Manage shop, Chat, Class, Co-Work.

INSERT INTO public.smart_suggestions (
  user_type, product, context_page, suggestion_text, suggestion_action,
  icon_name, priority, is_active, usage_count, success_rate
)
SELECT v.user_type, v.product, v.context_page, v.suggestion_text, v.suggestion_action,
       v.icon_name, v.priority, true, 0, 0
FROM (
  VALUES
  -- Marketplace / commerce
  ('customer', 'commerce', 'home', 'Buy a t-shirt', 'I want to buy a t-shirt — show me matching listings', 'shirt', 1),
  ('customer', 'commerce', 'home', 'Find sarees', 'Help me find sarees from women-owned shops', 'sparkles', 2),
  ('customer', 'commerce', 'home', 'Gift ideas', 'Suggest gift ideas under ₹1000', 'gift', 3),
  ('customer', 'commerce', 'home', 'Track order', 'Help me track my recent orders', 'package', 4),
  ('customer', 'commerce', 'cart', 'Apply coupon', 'Help me apply the best coupon on my cart', 'badge-percent', 1),
  ('customer', 'commerce', 'cart', 'Finish checkout', 'Walk me through checkout from my cart', 'shopping-cart', 2),
  ('customer', 'commerce', 'orders', 'Delayed delivery', 'My order seems delayed — what should I do?', 'truck', 1),
  ('customer', 'commerce', 'orders', 'Start return', 'How do I start a return or refund?', 'rotate-ccw', 2),
  ('customer', 'commerce', 'listing', 'Size help', 'Help me choose the right size for this product', 'ruler', 2),
  ('customer', 'commerce', 'listing', 'Ask seller', 'How do I ask the seller a question about this listing?', 'message-circle', 3),

  -- Community
  ('customer', 'community', 'feed', 'What to post', 'Suggest a professional post topic for today', 'pen-line', 1),
  ('customer', 'community', 'feed', 'Hashtag tips', 'Which hashtags should I use on my next post?', 'hash', 2),
  ('customer', 'community', 'feed', 'Engage more', 'How can I get more comments and reactions on my posts?', 'heart', 3),
  ('customer', 'community', 'network', 'Grow network', 'Suggest how to grow my professional network this week', 'users', 1),
  ('customer', 'community', 'network', 'Warm intro', 'How can I ask for an introduction to someone?', 'handshake', 2),
  ('customer', 'community', 'network', 'Accept requests', 'How do connection requests work?', 'user-plus', 3),
  ('customer', 'community', 'jobs', 'Job tips', 'Tips for applying to roles on SHEconomy', 'briefcase', 1),
  ('customer', 'community', 'jobs', 'Profile for jobs', 'How can I improve my profile for job matches?', 'badge-check', 2),
  ('customer', 'community', 'jobs', 'Open to work', 'How do I show that I am open to work?', 'sparkles', 3),

  -- Manage shop
  ('vendor', 'shop', 'dashboard', 'New orders', 'Show me how to manage new shop orders', 'package', 1),
  ('vendor', 'shop', 'dashboard', 'Boost sales', 'How can I increase my shop sales this week?', 'trending-up', 2),
  ('vendor', 'shop', 'dashboard', 'Low stock', 'What should I do about low-stock listings?', 'alert-triangle', 3),
  ('vendor', 'shop', 'dashboard', 'Shipping policy', 'Help me set shipping and return policies', 'truck', 4),
  ('vendor', 'shop', 'listings', 'Create listing', 'How do I create a new product listing?', 'plus-circle', 1),
  ('vendor', 'shop', 'listings', 'Listing visibility', 'Why is my listing not visible to buyers?', 'eye-off', 2),
  ('vendor', 'shop', 'listings', 'Optimize title', 'Help me write a better listing title and description', 'pen-line', 3),
  ('vendor', 'shop', 'orders', 'Fulfill order', 'How do I fulfill and ship a seller order?', 'package-check', 1),
  ('vendor', 'shop', 'orders', 'Payout timing', 'When do sellers get paid on SHEconomy?', 'wallet', 2),

  -- Chat
  ('customer', 'chat', 'home', 'Start chat', 'How do I start a new conversation?', 'message-circle', 1),
  ('customer', 'chat', 'home', 'Mute chat', 'How do I mute a noisy conversation?', 'bell-off', 2),
  ('customer', 'chat', 'home', 'Group chat', 'How do group chats work?', 'users-round', 3),
  ('customer', 'chat', 'home', 'Share media', 'How do I send photos or files in chat?', 'image', 4),
  ('customer', 'chat', 'thread', 'Disappearing msgs', 'How do disappearing messages work?', 'timer', 1),
  ('customer', 'chat', 'thread', 'Read receipts', 'How do read receipts work in chat?', 'check-check', 2),

  -- Class
  ('customer', 'class', 'home', 'Browse classes', 'Help me find a class to enroll in', 'graduation-cap', 1),
  ('customer', 'class', 'home', 'Enroll help', 'How do I enroll in a class or program?', 'book-open', 2),
  ('customer', 'class', 'home', 'Playback issue', 'Video or audio will not play — what should I try?', 'play', 3),
  ('customer', 'class', 'home', 'My enrollments', 'Show me how to open my enrolled classes', 'library', 4),
  ('customer', 'class', 'home', 'Certificates', 'Do classes offer certificates after completion?', 'award', 5),

  -- Co-Work
  ('customer', 'cowork', 'home', 'Host meeting', 'How do I host a Co-Work meeting?', 'video', 1),
  ('customer', 'cowork', 'home', 'Join with code', 'How do I join a meeting with a code?', 'hash', 2),
  ('customer', 'cowork', 'home', 'Camera blocked', 'Camera or mic is blocked — how do I fix it?', 'camera', 3),
  ('customer', 'cowork', 'home', 'Invite people', 'How do I invite others to a Co-Work meeting?', 'user-plus', 4),
  ('customer', 'cowork', 'meeting', 'AV troubleshooting', 'My audio or video is not working in the meeting', 'headphones', 1),
  ('customer', 'cowork', 'meeting', 'Meeting controls', 'What controls are available during a meeting?', 'sliders', 2)
) AS v(user_type, product, context_page, suggestion_text, suggestion_action, icon_name, priority)
WHERE NOT EXISTS (
  SELECT 1
  FROM public.smart_suggestions s
  WHERE s.suggestion_text = v.suggestion_text
    AND coalesce(s.product, 'commerce') = v.product
    AND coalesce(s.context_page, '') = coalesce(v.context_page, '')
);
