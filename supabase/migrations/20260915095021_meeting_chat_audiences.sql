-- Meeting chat audiences and privacy boundaries.
-- Does not require public.meeting_roles at apply time. Host/co-host checks use
-- meetings.host_id (and meeting_participants.is_host), then meeting_roles if it exists.

ALTER TABLE public.meeting_chat_messages
  ADD COLUMN IF NOT EXISTS audience text NOT NULL DEFAULT 'everyone',
  ADD COLUMN IF NOT EXISTS recipient_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS system_event_type text;

ALTER TABLE public.meeting_chat_messages
  DROP CONSTRAINT IF EXISTS meeting_chat_messages_audience_check;
ALTER TABLE public.meeting_chat_messages
  ADD CONSTRAINT meeting_chat_messages_audience_check
  CHECK (audience IN ('everyone', 'private', 'hosts', 'system'));
ALTER TABLE public.meeting_chat_messages
  DROP CONSTRAINT IF EXISTS meeting_chat_messages_recipient_check;
ALTER TABLE public.meeting_chat_messages
  ADD CONSTRAINT meeting_chat_messages_recipient_check
  CHECK (
    (audience = 'private' AND recipient_id IS NOT NULL)
    OR (audience <> 'private' AND recipient_id IS NULL)
  );

CREATE INDEX IF NOT EXISTS meeting_chat_meeting_created_idx
  ON public.meeting_chat_messages(meeting_id, created_at DESC);
CREATE INDEX IF NOT EXISTS meeting_chat_private_recipient_idx
  ON public.meeting_chat_messages(meeting_id, recipient_id, created_at DESC)
  WHERE audience = 'private';

CREATE OR REPLACE FUNCTION public.is_meeting_host_or_co_host(
  p_meeting_id uuid,
  p_user_id uuid DEFAULT auth.uid()
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  is_moderator boolean := false;
BEGIN
  IF p_user_id IS NULL THEN
    RETURN false;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.meetings m
    WHERE m.id = p_meeting_id
      AND m.host_id = p_user_id
  ) OR EXISTS (
    SELECT 1
    FROM public.meeting_participants mp
    WHERE mp.meeting_id = p_meeting_id
      AND mp.user_id = p_user_id
      AND coalesce(mp.is_host, false)
  )
  INTO is_moderator;

  IF is_moderator THEN
    RETURN true;
  END IF;

  IF to_regclass('public.meeting_roles') IS NULL THEN
    RETURN false;
  END IF;

  EXECUTE
    'SELECT EXISTS (
       SELECT 1 FROM public.meeting_roles
       WHERE meeting_id = $1 AND user_id = $2 AND role IN (''host'', ''co_host'')
     )'
    INTO is_moderator
    USING p_meeting_id, p_user_id;

  RETURN coalesce(is_moderator, false);
END;
$function$;

REVOKE ALL ON FUNCTION public.is_meeting_host_or_co_host(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_meeting_host_or_co_host(uuid, uuid) TO authenticated, service_role;

DROP POLICY IF EXISTS "Meeting questions insert by meeting viewers" ON public.meeting_chat_messages;
DROP POLICY IF EXISTS "Meeting questions update by moderators" ON public.meeting_chat_messages;
DROP POLICY IF EXISTS "Meeting questions visible to meeting viewers" ON public.meeting_chat_messages;
DROP POLICY IF EXISTS "Users can send messages to meetings they participate in" ON public.meeting_chat_messages;
DROP POLICY IF EXISTS chat_insert_own ON public.meeting_chat_messages;
DROP POLICY IF EXISTS chat_select_room_participants ON public.meeting_chat_messages;
DROP POLICY IF EXISTS chat_update_own ON public.meeting_chat_messages;
DROP POLICY IF EXISTS mcm_insert ON public.meeting_chat_messages;
DROP POLICY IF EXISTS mcm_read ON public.meeting_chat_messages;
DROP POLICY IF EXISTS mcm_update ON public.meeting_chat_messages;
DROP POLICY IF EXISTS meeting_participants_insert_chat ON public.meeting_chat_messages;
DROP POLICY IF EXISTS meeting_participants_read_chat ON public.meeting_chat_messages;
DROP POLICY IF EXISTS meeting_chat_visible_by_audience ON public.meeting_chat_messages;
DROP POLICY IF EXISTS meeting_chat_insert_admitted ON public.meeting_chat_messages;
DROP POLICY IF EXISTS meeting_chat_update_own ON public.meeting_chat_messages;

CREATE POLICY meeting_chat_visible_by_audience
  ON public.meeting_chat_messages
  FOR SELECT TO authenticated
  USING (
    (
      EXISTS (
        SELECT 1
        FROM public.meeting_participants viewer
        WHERE viewer.meeting_id = meeting_chat_messages.meeting_id
          AND viewer.user_id = auth.uid()
          AND viewer.status = 'admitted'
      )
      OR EXISTS (
        SELECT 1 FROM public.meetings m
        WHERE m.id = meeting_chat_messages.meeting_id
          AND m.host_id = auth.uid()
      )
    )
    AND (
      audience IN ('everyone', 'system')
      OR (audience = 'private' AND auth.uid() IN (sender_id, recipient_id))
      OR (
        audience IN ('private', 'hosts')
        AND public.is_meeting_host_or_co_host(meeting_chat_messages.meeting_id)
      )
    )
  );

CREATE POLICY meeting_chat_insert_admitted
  ON public.meeting_chat_messages
  FOR INSERT TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND audience <> 'system'
    AND system_event_type IS NULL
    AND EXISTS (
      SELECT 1
      FROM public.meeting_participants sender
      WHERE sender.meeting_id = meeting_chat_messages.meeting_id
        AND sender.user_id = auth.uid()
        AND sender.status = 'admitted'
    )
    AND (
      audience <> 'hosts'
      OR public.is_meeting_host_or_co_host(meeting_chat_messages.meeting_id)
    )
    AND (
      recipient_id IS NULL
      OR EXISTS (
        SELECT 1
        FROM public.meeting_participants recipient
        WHERE recipient.meeting_id = meeting_chat_messages.meeting_id
          AND recipient.user_id = meeting_chat_messages.recipient_id
          AND recipient.status = 'admitted'
      )
    )
  );

CREATE POLICY meeting_chat_update_own
  ON public.meeting_chat_messages
  FOR UPDATE TO authenticated
  USING (sender_id = auth.uid() AND audience <> 'system')
  WITH CHECK (
    sender_id = auth.uid()
    AND audience <> 'system'
    AND system_event_type IS NULL
  );

CREATE OR REPLACE FUNCTION public.notify_meeting_chat_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_meeting record;
  v_sender_name text;
  v_preview text;
  v_action_url text;
  v_recipient uuid;
BEGIN
  IF NEW.is_deleted IS TRUE OR NEW.audience = 'system' THEN
    RETURN NEW;
  END IF;
  IF NEW.message_type NOT IN ('text', 'question') THEN
    RETURN NEW;
  END IF;

  SELECT id, title, meeting_code INTO v_meeting
  FROM public.meetings WHERE id = NEW.meeting_id;
  IF v_meeting.id IS NULL THEN RETURN NEW; END IF;

  SELECT COALESCE(NULLIF(full_name, ''), NULLIF(username, ''), 'Someone')
    INTO v_sender_name FROM public.profiles WHERE id = NEW.sender_id;
  v_preview := left(regexp_replace(coalesce(NEW.message_text, ''), '\s+', ' ', 'g'), 120);
  IF length(trim(v_preview)) = 0 THEN RETURN NEW; END IF;
  v_action_url := '/co-work/meeting/' || v_meeting.meeting_code || '/live';

  FOR v_recipient IN
    SELECT DISTINCT mp.user_id
    FROM public.meeting_participants mp
    WHERE mp.meeting_id = NEW.meeting_id
      AND mp.user_id IS DISTINCT FROM NEW.sender_id
      AND mp.status = 'admitted'
      AND (
        NEW.audience = 'everyone'
        OR (NEW.audience = 'private' AND mp.user_id = NEW.recipient_id)
        OR (
          NEW.audience = 'hosts'
          AND public.is_meeting_host_or_co_host(NEW.meeting_id, mp.user_id)
        )
      )
  LOOP
    PERFORM public.create_notification_from_template(
      p_template_key := 'meeting_chat_message',
      p_recipient_id := v_recipient,
      p_variables := jsonb_build_object(
        'sender_name', coalesce(v_sender_name, 'Someone'),
        'meeting_title', coalesce(v_meeting.title, 'Co-Work'),
        'message_preview', v_preview,
        'action_url', v_action_url,
        'meeting_id', NEW.meeting_id::text,
        'message_id', NEW.id::text
      ),
      p_context_type := 'meeting',
      p_context_id := NEW.meeting_id,
      p_parent_context_type := NULL,
      p_parent_context_id := NULL,
      p_override_channels := ARRAY['push']::text[],
      p_override_priority := 3,
      p_scheduled_for := NULL
    );
  END LOOP;
  RETURN NEW;
END;
$function$;
