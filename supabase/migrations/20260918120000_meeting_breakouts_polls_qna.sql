-- Meeting large-room features: breakouts, polls, Q&A (Zoom-like Co-Work pack B)

-- ---------------------------------------------------------------------------
-- Breakout rooms
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.meeting_breakout_rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id uuid NOT NULL REFERENCES public.meetings(id) ON DELETE CASCADE,
  room_number integer NOT NULL,
  title text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'open', 'closed')),
  livekit_room_name text,
  created_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (meeting_id, room_number)
);

CREATE TABLE IF NOT EXISTS public.meeting_breakout_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  breakout_id uuid NOT NULL REFERENCES public.meeting_breakout_rooms(id) ON DELETE CASCADE,
  meeting_id uuid NOT NULL REFERENCES public.meetings(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  assigned_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (meeting_id, user_id)
);

CREATE INDEX IF NOT EXISTS meeting_breakout_rooms_meeting_idx
  ON public.meeting_breakout_rooms (meeting_id);
CREATE INDEX IF NOT EXISTS meeting_breakout_assignments_breakout_idx
  ON public.meeting_breakout_assignments (breakout_id);

ALTER TABLE public.meeting_breakout_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meeting_breakout_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Breakout rooms visible to meeting participants"
  ON public.meeting_breakout_rooms FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.meeting_participants mp
      WHERE mp.meeting_id = meeting_breakout_rooms.meeting_id
        AND mp.user_id = auth.uid()
        AND mp.status IN ('admitted', 'waiting')
    )
    OR EXISTS (
      SELECT 1 FROM public.meetings m
      WHERE m.id = meeting_breakout_rooms.meeting_id AND m.host_id = auth.uid()
    )
  );

CREATE POLICY "Breakout rooms managed by host or co-host"
  ON public.meeting_breakout_rooms FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.meetings m
      WHERE m.id = meeting_breakout_rooms.meeting_id AND m.host_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.meeting_participants mp
      WHERE mp.meeting_id = meeting_breakout_rooms.meeting_id
        AND mp.user_id = auth.uid()
        AND mp.status = 'admitted'
        AND coalesce(mp.role, 'participant') IN ('host', 'co_host')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.meetings m
      WHERE m.id = meeting_breakout_rooms.meeting_id AND m.host_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.meeting_participants mp
      WHERE mp.meeting_id = meeting_breakout_rooms.meeting_id
        AND mp.user_id = auth.uid()
        AND mp.status = 'admitted'
        AND coalesce(mp.role, 'participant') IN ('host', 'co_host')
    )
  );

CREATE POLICY "Breakout assignments visible to meeting participants"
  ON public.meeting_breakout_assignments FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.meeting_participants mp
      WHERE mp.meeting_id = meeting_breakout_assignments.meeting_id
        AND mp.user_id = auth.uid()
        AND mp.status IN ('admitted', 'waiting')
    )
    OR EXISTS (
      SELECT 1 FROM public.meetings m
      WHERE m.id = meeting_breakout_assignments.meeting_id AND m.host_id = auth.uid()
    )
  );

CREATE POLICY "Breakout assignments managed by host or co-host"
  ON public.meeting_breakout_assignments FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.meetings m
      WHERE m.id = meeting_breakout_assignments.meeting_id AND m.host_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.meeting_participants mp
      WHERE mp.meeting_id = meeting_breakout_assignments.meeting_id
        AND mp.user_id = auth.uid()
        AND mp.status = 'admitted'
        AND coalesce(mp.role, 'participant') IN ('host', 'co_host')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.meetings m
      WHERE m.id = meeting_breakout_assignments.meeting_id AND m.host_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.meeting_participants mp
      WHERE mp.meeting_id = meeting_breakout_assignments.meeting_id
        AND mp.user_id = auth.uid()
        AND mp.status = 'admitted'
        AND coalesce(mp.role, 'participant') IN ('host', 'co_host')
    )
  );

-- ---------------------------------------------------------------------------
-- In-meeting polls
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.meeting_polls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id uuid NOT NULL REFERENCES public.meetings(id) ON DELETE CASCADE,
  created_by uuid NOT NULL REFERENCES auth.users(id),
  question text NOT NULL,
  allow_multiple boolean NOT NULL DEFAULT false,
  anonymous boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'shared', 'closed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz
);

CREATE TABLE IF NOT EXISTS public.meeting_poll_options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id uuid NOT NULL REFERENCES public.meeting_polls(id) ON DELETE CASCADE,
  option_text text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  vote_count integer NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS public.meeting_poll_votes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id uuid NOT NULL REFERENCES public.meeting_polls(id) ON DELETE CASCADE,
  option_id uuid NOT NULL REFERENCES public.meeting_poll_options(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (poll_id, option_id, user_id)
);

CREATE INDEX IF NOT EXISTS meeting_polls_meeting_idx ON public.meeting_polls (meeting_id);

ALTER TABLE public.meeting_polls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meeting_poll_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meeting_poll_votes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Meeting polls visible to participants"
  ON public.meeting_polls FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.meeting_participants mp
      WHERE mp.meeting_id = meeting_polls.meeting_id
        AND mp.user_id = auth.uid()
        AND mp.status = 'admitted'
    )
    OR EXISTS (
      SELECT 1 FROM public.meetings m
      WHERE m.id = meeting_polls.meeting_id AND m.host_id = auth.uid()
    )
  );

CREATE POLICY "Meeting polls managed by host or co-host"
  ON public.meeting_polls FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.meetings m
      WHERE m.id = meeting_polls.meeting_id AND m.host_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.meeting_participants mp
      WHERE mp.meeting_id = meeting_polls.meeting_id
        AND mp.user_id = auth.uid()
        AND mp.status = 'admitted'
        AND coalesce(mp.role, 'participant') IN ('host', 'co_host')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.meetings m
      WHERE m.id = meeting_polls.meeting_id AND m.host_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.meeting_participants mp
      WHERE mp.meeting_id = meeting_polls.meeting_id
        AND mp.user_id = auth.uid()
        AND mp.status = 'admitted'
        AND coalesce(mp.role, 'participant') IN ('host', 'co_host')
    )
  );

CREATE POLICY "Meeting poll options visible with poll"
  ON public.meeting_poll_options FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.meeting_polls p
      JOIN public.meeting_participants mp ON mp.meeting_id = p.meeting_id
      WHERE p.id = meeting_poll_options.poll_id
        AND mp.user_id = auth.uid()
        AND mp.status = 'admitted'
    )
  );

CREATE POLICY "Meeting poll options managed by host"
  ON public.meeting_poll_options FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.meeting_polls p
      JOIN public.meetings m ON m.id = p.meeting_id
      WHERE p.id = meeting_poll_options.poll_id AND m.host_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.meeting_polls p
      JOIN public.meeting_participants mp ON mp.meeting_id = p.meeting_id
      WHERE p.id = meeting_poll_options.poll_id
        AND mp.user_id = auth.uid()
        AND mp.status = 'admitted'
        AND coalesce(mp.role, 'participant') IN ('host', 'co_host')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.meeting_polls p
      JOIN public.meetings m ON m.id = p.meeting_id
      WHERE p.id = meeting_poll_options.poll_id AND m.host_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.meeting_polls p
      JOIN public.meeting_participants mp ON mp.meeting_id = p.meeting_id
      WHERE p.id = meeting_poll_options.poll_id
        AND mp.user_id = auth.uid()
        AND mp.status = 'admitted'
        AND coalesce(mp.role, 'participant') IN ('host', 'co_host')
    )
  );

CREATE POLICY "Meeting poll votes visible to participants"
  ON public.meeting_poll_votes FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.meeting_polls p
      JOIN public.meeting_participants mp ON mp.meeting_id = p.meeting_id
      WHERE p.id = meeting_poll_votes.poll_id
        AND mp.user_id = auth.uid()
        AND mp.status = 'admitted'
    )
  );

CREATE POLICY "Meeting poll votes insert by voter"
  ON public.meeting_poll_votes FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.meeting_polls p
      JOIN public.meeting_participants mp ON mp.meeting_id = p.meeting_id
      WHERE p.id = meeting_poll_votes.poll_id
        AND p.status = 'open'
        AND mp.user_id = auth.uid()
        AND mp.status = 'admitted'
    )
  );

CREATE OR REPLACE FUNCTION public.cast_meeting_poll_vote(
  p_poll_id uuid,
  p_option_id uuid
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  poll_row public.meeting_polls%ROWTYPE;
BEGIN
  SELECT * INTO poll_row FROM public.meeting_polls WHERE id = p_poll_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'POLL_NOT_FOUND'; END IF;
  IF poll_row.status <> 'open' THEN RAISE EXCEPTION 'POLL_CLOSED'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.meeting_participants mp
    WHERE mp.meeting_id = poll_row.meeting_id
      AND mp.user_id = auth.uid()
      AND mp.status = 'admitted'
  ) THEN
    RAISE EXCEPTION 'NOT_IN_MEETING';
  END IF;

  IF NOT poll_row.allow_multiple THEN
    DELETE FROM public.meeting_poll_votes WHERE poll_id = p_poll_id AND user_id = auth.uid();
  END IF;

  INSERT INTO public.meeting_poll_votes (poll_id, option_id, user_id)
  VALUES (p_poll_id, p_option_id, auth.uid())
  ON CONFLICT (poll_id, option_id, user_id) DO NOTHING;

  UPDATE public.meeting_poll_options o
  SET vote_count = (
    SELECT count(*)::integer FROM public.meeting_poll_votes v WHERE v.option_id = o.id
  )
  WHERE o.poll_id = p_poll_id;
END;
$$;

REVOKE ALL ON FUNCTION public.cast_meeting_poll_vote(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cast_meeting_poll_vote(uuid, uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- Q&A
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.meeting_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id uuid NOT NULL REFERENCES public.meetings(id) ON DELETE CASCADE,
  asker_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  body text NOT NULL,
  anonymous boolean NOT NULL DEFAULT false,
  upvote_count integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'answered', 'dismissed')),
  answered_by uuid REFERENCES auth.users(id),
  pinned boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.meeting_question_votes (
  question_id uuid NOT NULL REFERENCES public.meeting_questions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (question_id, user_id)
);

CREATE INDEX IF NOT EXISTS meeting_questions_meeting_idx ON public.meeting_questions (meeting_id);

ALTER TABLE public.meeting_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meeting_question_votes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Meeting questions visible to participants"
  ON public.meeting_questions FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.meeting_participants mp
      WHERE mp.meeting_id = meeting_questions.meeting_id
        AND mp.user_id = auth.uid()
        AND mp.status = 'admitted'
    )
    OR EXISTS (
      SELECT 1 FROM public.meetings m
      WHERE m.id = meeting_questions.meeting_id AND m.host_id = auth.uid()
    )
  );

CREATE POLICY "Meeting questions insert by admitted participants"
  ON public.meeting_questions FOR INSERT TO authenticated
  WITH CHECK (
    asker_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.meeting_participants mp
      WHERE mp.meeting_id = meeting_questions.meeting_id
        AND mp.user_id = auth.uid()
        AND mp.status = 'admitted'
    )
  );

CREATE POLICY "Meeting questions update by asker or host"
  ON public.meeting_questions FOR UPDATE TO authenticated
  USING (
    asker_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.meetings m
      WHERE m.id = meeting_questions.meeting_id AND m.host_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.meeting_participants mp
      WHERE mp.meeting_id = meeting_questions.meeting_id
        AND mp.user_id = auth.uid()
        AND mp.status = 'admitted'
        AND coalesce(mp.role, 'participant') IN ('host', 'co_host')
    )
  );

CREATE POLICY "Meeting question votes visible"
  ON public.meeting_question_votes FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.meeting_questions q
      JOIN public.meeting_participants mp ON mp.meeting_id = q.meeting_id
      WHERE q.id = meeting_question_votes.question_id
        AND mp.user_id = auth.uid()
        AND mp.status = 'admitted'
    )
  );

CREATE POLICY "Meeting question votes by voter"
  ON public.meeting_question_votes FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Meeting question votes delete own"
  ON public.meeting_question_votes FOR DELETE TO authenticated
  USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.upvote_meeting_question(p_question_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.meeting_question_votes (question_id, user_id)
  VALUES (p_question_id, auth.uid())
  ON CONFLICT DO NOTHING;

  UPDATE public.meeting_questions
  SET upvote_count = (
    SELECT count(*)::integer FROM public.meeting_question_votes v WHERE v.question_id = p_question_id
  ),
  updated_at = now()
  WHERE id = p_question_id;
END;
$$;

REVOKE ALL ON FUNCTION public.upvote_meeting_question(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.upvote_meeting_question(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- Capacity: reject join when admitted count >= max_participants
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enforce_meeting_capacity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cap integer;
  admitted_count integer;
BEGIN
  IF NEW.status IS DISTINCT FROM 'admitted' THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.status = 'admitted' THEN
    RETURN NEW;
  END IF;

  SELECT coalesce(max_participants, 100) INTO cap FROM public.meetings WHERE id = NEW.meeting_id;
  SELECT count(*)::integer INTO admitted_count
  FROM public.meeting_participants
  WHERE meeting_id = NEW.meeting_id AND status = 'admitted' AND id IS DISTINCT FROM NEW.id;

  IF admitted_count >= cap THEN
    RAISE EXCEPTION 'MEETING_FULL';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_meeting_capacity ON public.meeting_participants;
CREATE TRIGGER trg_enforce_meeting_capacity
  BEFORE INSERT OR UPDATE OF status ON public.meeting_participants
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_meeting_capacity();
