-- AI module: product context on sessions/suggestions, RLS, seed chips per tab.

ALTER TABLE public.smart_suggestions
  ADD COLUMN IF NOT EXISTS product text;

ALTER TABLE public.ai_sessions
  ADD COLUMN IF NOT EXISTS product text,
  ADD COLUMN IF NOT EXISTS context jsonb NOT NULL DEFAULT '{}'::jsonb;

UPDATE public.smart_suggestions
SET product = CASE
  WHEN lower(coalesce(context_page, '')) LIKE '%vendor%' OR lower(coalesce(suggestion_text, '')) LIKE '%shop%' THEN 'shop'
  WHEN lower(coalesce(context_page, '')) LIKE '%community%' THEN 'community'
  WHEN lower(coalesce(context_page, '')) LIKE '%chat%' THEN 'chat'
  WHEN lower(coalesce(context_page, '')) LIKE '%class%' THEN 'class'
  WHEN lower(coalesce(context_page, '')) LIKE '%co-work%' OR lower(coalesce(context_page, '')) LIKE '%meeting%' THEN 'cowork'
  ELSE 'commerce'
END
WHERE product IS NULL;

ALTER TABLE public.smart_suggestions
  ALTER COLUMN product SET DEFAULT 'commerce';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'smart_suggestions_product_check'
  ) THEN
    ALTER TABLE public.smart_suggestions
      ADD CONSTRAINT smart_suggestions_product_check
      CHECK (product IN ('commerce', 'community', 'chat', 'class', 'cowork', 'shop', 'account'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ai_sessions_product_check'
  ) THEN
    ALTER TABLE public.ai_sessions
      ADD CONSTRAINT ai_sessions_product_check
      CHECK (product IS NULL OR product IN ('commerce', 'community', 'chat', 'class', 'cowork', 'shop', 'account'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS smart_suggestions_product_active_idx
  ON public.smart_suggestions (product, priority)
  WHERE is_active IS TRUE;

CREATE INDEX IF NOT EXISTS ai_sessions_user_id_updated_at_idx
  ON public.ai_sessions (user_id, updated_at DESC);

ALTER TABLE public.smart_suggestions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS smart_suggestions_select_active ON public.smart_suggestions;
CREATE POLICY smart_suggestions_select_active
  ON public.smart_suggestions
  FOR SELECT
  TO anon, authenticated
  USING (is_active IS TRUE);

DROP POLICY IF EXISTS smart_suggestions_update_metrics ON public.smart_suggestions;
CREATE POLICY smart_suggestions_update_metrics
  ON public.smart_suggestions
  FOR UPDATE
  TO authenticated
  USING (is_active IS TRUE)
  WITH CHECK (is_active IS TRUE);

DROP POLICY IF EXISTS ai_sessions_select_own ON public.ai_sessions;
CREATE POLICY ai_sessions_select_own
  ON public.ai_sessions FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS ai_sessions_insert_own ON public.ai_sessions;
CREATE POLICY ai_sessions_insert_own
  ON public.ai_sessions FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS ai_sessions_update_own ON public.ai_sessions;
CREATE POLICY ai_sessions_update_own
  ON public.ai_sessions FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS ai_messages_select_own ON public.ai_messages;
CREATE POLICY ai_messages_select_own
  ON public.ai_messages FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.ai_sessions s
      WHERE s.id = ai_messages.session_id AND s.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS ai_messages_insert_own ON public.ai_messages;
CREATE POLICY ai_messages_insert_own
  ON public.ai_messages FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.ai_sessions s
      WHERE s.id = ai_messages.session_id AND s.user_id = auth.uid()
    )
  );

GRANT SELECT ON public.smart_suggestions TO anon, authenticated;
GRANT UPDATE ON public.smart_suggestions TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.ai_sessions TO authenticated;
GRANT SELECT, INSERT ON public.ai_messages TO authenticated;

-- Seed product chips (skip if same suggestion_text already exists for product)
INSERT INTO public.smart_suggestions (
  user_type, product, context_page, suggestion_text, suggestion_action,
  icon_name, priority, is_active, usage_count, success_rate
)
SELECT v.user_type, v.product, v.context_page, v.suggestion_text, v.suggestion_action,
       v.icon_name, v.priority, true, 0, 0
FROM (
  VALUES
  -- Commerce
  ('customer', 'commerce', 'home', 'Track my order', 'Help me track my recent orders', 'package', 1),
  ('customer', 'commerce', 'home', 'Find gifts', 'Suggest gift ideas from women-owned shops', 'gift', 2),
  ('customer', 'commerce', 'home', 'Return help', 'How do returns and refunds work?', 'rotate-ccw', 3),
  ('customer', 'commerce', 'listing', 'Similar items', 'Suggest similar listings to what I am viewing', 'sparkles', 1),
  ('customer', 'commerce', 'cart', 'Checkout tips', 'Help me finish checkout and apply offers', 'shopping-cart', 1),
  -- Community
  ('customer', 'community', 'feed', 'Grow my network', 'Suggest people and companies to connect with', 'users', 1),
  ('customer', 'community', 'feed', 'What to post', 'Suggest a professional post topic for today', 'pen-line', 2),
  ('customer', 'community', 'network', 'Warm intros', 'How can I ask for an introduction?', 'handshake', 1),
  ('customer', 'community', 'jobs', 'Job match tips', 'Help me find roles that fit my profile', 'briefcase', 1),
  -- Chat
  ('customer', 'chat', 'home', 'Start a chat', 'How do I start a new conversation?', 'message-circle', 1),
  ('customer', 'chat', 'home', 'Mute tips', 'How do I mute a noisy conversation?', 'bell-off', 2),
  ('customer', 'chat', 'home', 'Group chat', 'How do group chats work?', 'users-round', 3),
  -- Class
  ('customer', 'class', 'home', 'Enroll help', 'How do I enroll in a class or program?', 'graduation-cap', 1),
  ('customer', 'class', 'home', 'Playback issue', 'Video or audio will not play — what should I try?', 'play', 2),
  ('customer', 'class', 'home', 'New lessons', 'How will I know when a new lesson is published?', 'book-open', 3),
  -- Co-Work
  ('customer', 'cowork', 'home', 'Host a meeting', 'How do I host a Co-Work meeting?', 'video', 1),
  ('customer', 'cowork', 'home', 'Join with code', 'How do I join a meeting with a code?', 'hash', 2),
  ('customer', 'cowork', 'home', 'Camera blocked', 'Camera or mic is blocked — how do I fix it?', 'camera', 3),
  -- Manage shop
  ('vendor', 'shop', 'dashboard', 'New orders', 'Show me how to manage new shop orders', 'package', 1),
  ('vendor', 'shop', 'dashboard', 'Shipping policy', 'Help me set shipping and return policies', 'truck', 2),
  ('vendor', 'shop', 'dashboard', 'Low stock', 'What should I do about low-stock listings?', 'alert-triangle', 3),
  ('vendor', 'shop', 'listings', 'Listing visibility', 'Why is my listing not visible to buyers?', 'eye-off', 1),
  -- Account
  ('customer', 'account', 'settings', 'Notification prefs', 'Help me tune alerts across products', 'bell', 1),
  ('customer', 'account', 'help', 'Open Help Center', 'Take me to Help & Support for this product', 'help-circle', 2)
) AS v(user_type, product, context_page, suggestion_text, suggestion_action, icon_name, priority)
WHERE NOT EXISTS (
  SELECT 1
  FROM public.smart_suggestions s
  WHERE s.suggestion_text = v.suggestion_text
    AND coalesce(s.product, 'commerce') = v.product
);
