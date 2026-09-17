-- Live mid-meeting security / participant permission patches (Zoom Host tools).
-- Host can change all keys. Co-host can open tools but cannot patch critical settings.

CREATE OR REPLACE FUNCTION public.update_meeting_live_settings(
  meeting_id_input uuid,
  security_settings_patch jsonb DEFAULT NULL,
  meeting_options_patch jsonb DEFAULT NULL
)
RETURNS public.meetings
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  meeting_row public.meetings;
  actor_role text;
  next_security jsonb;
  next_options jsonb;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED';
  END IF;

  actor_role := public.meeting_actor_role(meeting_id_input);
  IF actor_role IS DISTINCT FROM 'host' THEN
    -- Fall back to meeting_roles / host_id so co-hosts admitted as host tools
    -- viewers still fail writes, while hosts outside actor_role still work.
    IF NOT public.is_meeting_host_or_co_host(meeting_id_input) THEN
      RAISE EXCEPTION 'HOST_REQUIRED';
    END IF;
    -- Only the meeting host may change live participant permissions.
    IF (
      SELECT host_id FROM public.meetings WHERE id = meeting_id_input
    ) IS DISTINCT FROM auth.uid()
      AND coalesce(
        (
          SELECT role FROM public.meeting_roles
          WHERE meeting_id = meeting_id_input AND user_id = auth.uid()
          LIMIT 1
        ),
        ''
      ) IS DISTINCT FROM 'host'
    THEN
      RAISE EXCEPTION 'HOST_REQUIRED';
    END IF;
  END IF;

  SELECT * INTO meeting_row
  FROM public.meetings
  WHERE id = meeting_id_input
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'MEETING_NOT_FOUND';
  END IF;
  IF meeting_row.status IN ('cancelled') THEN
    RAISE EXCEPTION 'MEETING_CLOSED';
  END IF;

  next_security := coalesce(meeting_row.security_settings, '{}'::jsonb);
  IF security_settings_patch IS NOT NULL THEN
    IF jsonb_typeof(security_settings_patch) <> 'object' THEN
      RAISE EXCEPTION 'INVALID_SECURITY_SETTINGS';
    END IF;
    next_security := next_security || security_settings_patch;
  END IF;

  next_options := coalesce(meeting_row.meeting_options, '{}'::jsonb);
  IF meeting_options_patch IS NOT NULL THEN
    IF jsonb_typeof(meeting_options_patch) <> 'object' THEN
      RAISE EXCEPTION 'INVALID_MEETING_OPTIONS';
    END IF;
    next_options := next_options || meeting_options_patch;
  END IF;

  UPDATE public.meetings
  SET
    security_settings = next_security,
    meeting_options = next_options,
    updated_at = now()
  WHERE id = meeting_id_input
  RETURNING * INTO meeting_row;

  RETURN meeting_row;
END;
$function$;

REVOKE ALL ON FUNCTION public.update_meeting_live_settings(uuid, jsonb, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_meeting_live_settings(uuid, jsonb, jsonb) TO authenticated;

-- Allow admitted participants to chat with hosts/co-hosts (Zoom "Chat with: Host and co-hosts").
DROP POLICY IF EXISTS meeting_chat_insert_admitted ON public.meeting_chat_messages;
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
      OR EXISTS (
        SELECT 1
        FROM public.meeting_participants sender
        WHERE sender.meeting_id = meeting_chat_messages.meeting_id
          AND sender.user_id = auth.uid()
          AND sender.status = 'admitted'
      )
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

DROP POLICY IF EXISTS meeting_chat_visible_by_audience ON public.meeting_chat_messages;
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
        audience = 'hosts'
        AND (
          public.is_meeting_host_or_co_host(meeting_chat_messages.meeting_id)
          OR sender_id = auth.uid()
        )
      )
    )
  );
