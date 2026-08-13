-- Order issue comment threads (buyer ↔ vendor ↔ admin).
-- Participants who can already see the parent issue may SELECT/INSERT comments.

CREATE TABLE IF NOT EXISTS public.order_issue_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_id uuid NOT NULL REFERENCES public.order_issues(id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  body text NOT NULL CHECK (char_length(trim(body)) > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS order_issue_comments_issue_id_created_at_idx
  ON public.order_issue_comments (issue_id, created_at ASC);

ALTER TABLE public.order_issue_comments ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.can_access_order_issue(p_issue_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.order_issues oi
    WHERE oi.id = p_issue_id
      AND (
        EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.id = auth.uid() AND p.role = 'A'
        )
        OR oi.reported_by = auth.uid()
        OR oi.order_id IN (
          SELECT o.id FROM public.orders o WHERE o.user_id = auth.uid()
        )
        OR oi.order_id IN (
          SELECT DISTINCT oi2.order_id
          FROM public.order_items oi2
          JOIN public.shops s ON oi2.vendor_id = s.id
          WHERE s.user_id = auth.uid()
        )
      )
  );
$$;

DROP POLICY IF EXISTS "participants_select_order_issue_comments" ON public.order_issue_comments;
CREATE POLICY "participants_select_order_issue_comments"
  ON public.order_issue_comments
  FOR SELECT
  USING (public.can_access_order_issue(issue_id));

DROP POLICY IF EXISTS "participants_insert_order_issue_comments" ON public.order_issue_comments;
CREATE POLICY "participants_insert_order_issue_comments"
  ON public.order_issue_comments
  FOR INSERT
  WITH CHECK (
    author_id = auth.uid()
    AND public.can_access_order_issue(issue_id)
  );

-- Fix admin role string on order_issue_events if the legacy 'admin' check exists.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'order_issue_events'
      AND policyname = 'order_issue_events_select'
  ) THEN
    DROP POLICY IF EXISTS "order_issue_events_select" ON public.order_issue_events;
  END IF;
EXCEPTION
  WHEN undefined_table THEN
    NULL;
END $$;

COMMENT ON TABLE public.order_issue_comments IS
  'Threaded discussion on order issues between buyer, vendor, and admin.';
