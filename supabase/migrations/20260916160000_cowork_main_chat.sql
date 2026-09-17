-- Co-Work Main Chat: persistent collaboration threads on conversations/messages.
-- Distinct from meeting_chat_messages (per-meeting only).

CREATE OR REPLACE FUNCTION public.create_cowork_direct_conversation(p_other_user_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_conversation_id uuid;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF p_other_user_id IS NULL OR p_other_user_id = v_user_id THEN
    RAISE EXCEPTION 'Invalid user';
  END IF;

  SELECT c.id
  INTO v_conversation_id
  FROM public.conversations c
  WHERE coalesce(c.conversation_type, 'direct') = 'cowork'
    AND exists (
      SELECT 1 FROM public.conversation_participants cp
      WHERE cp.conversation_id = c.id AND cp.user_id = v_user_id
    )
    AND exists (
      SELECT 1 FROM public.conversation_participants cp
      WHERE cp.conversation_id = c.id AND cp.user_id = p_other_user_id
    )
    AND (
      SELECT count(*) FROM public.conversation_participants cp
      WHERE cp.conversation_id = c.id
    ) = 2
  LIMIT 1;

  IF v_conversation_id IS NOT NULL THEN
    RETURN v_conversation_id;
  END IF;

  INSERT INTO public.conversations (conversation_type, owner_id, metadata)
  VALUES (
    'cowork',
    v_user_id,
    jsonb_build_object('surface', 'cowork_main_chat')
  )
  RETURNING id INTO v_conversation_id;

  INSERT INTO public.conversation_participants (conversation_id, user_id, role)
  VALUES
    (v_conversation_id, v_user_id, 'member'),
    (v_conversation_id, p_other_user_id, 'member');

  RETURN v_conversation_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.create_cowork_group_conversation(
  p_participant_ids uuid[],
  p_title text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_conversation_id uuid;
  v_participant_id uuid;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  INSERT INTO public.conversations (conversation_type, title, owner_id, metadata)
  VALUES (
    'cowork',
    nullif(trim(coalesce(p_title, '')), ''),
    v_user_id,
    jsonb_build_object('surface', 'cowork_main_chat', 'cowork_group', true)
  )
  RETURNING id INTO v_conversation_id;

  INSERT INTO public.conversation_participants (conversation_id, user_id, role)
  VALUES (v_conversation_id, v_user_id, 'owner');

  FOREACH v_participant_id IN ARRAY coalesce(p_participant_ids, ARRAY[]::uuid[])
  LOOP
    IF v_participant_id IS NULL OR v_participant_id = v_user_id THEN
      CONTINUE;
    END IF;
    INSERT INTO public.conversation_participants (conversation_id, user_id, role)
    SELECT v_conversation_id, v_participant_id, 'member'
    WHERE NOT EXISTS (
      SELECT 1 FROM public.conversation_participants
      WHERE conversation_id = v_conversation_id AND user_id = v_participant_id
    );
  END LOOP;

  RETURN v_conversation_id;
END;
$function$;

DROP FUNCTION IF EXISTS public.get_cowork_user_chats(uuid);

CREATE OR REPLACE FUNCTION public.get_cowork_user_chats(p_user_id uuid)
RETURNS TABLE(
  chat_id uuid,
  chat_name text,
  chat_type text,
  last_message text,
  last_message_time timestamptz,
  unread_count bigint,
  avatar_url text,
  other_user_id uuid,
  other_user_name text,
  other_user_avatar text,
  is_online boolean,
  is_pinned boolean,
  is_muted boolean,
  is_archived boolean,
  current_user_role text,
  last_message_sender_name text,
  last_seen timestamptz,
  other_user_role text,
  last_message_type text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT
    c.id AS chat_id,
    CASE
      WHEN coalesce(c.metadata->>'cowork_group', 'false') = 'true'
        OR coalesce(c.title, '') <> ''
        THEN coalesce(nullif(trim(c.title), ''), 'Co-Work group')
      ELSE coalesce(other_p.full_name, other_p.username, 'Co-Work chat')
    END AS chat_name,
    CASE
      WHEN coalesce(c.metadata->>'cowork_group', 'false') = 'true' THEN 'group'
      ELSE 'direct'
    END AS chat_type,
    coalesce(lm.content, '') AS last_message,
    coalesce(lm.created_at, c.updated_at, c.created_at) AS last_message_time,
    (
      SELECT count(*)::bigint
      FROM public.messages m
      WHERE m.conversation_id = c.id
        AND m.sender_id IS DISTINCT FROM p_user_id
        AND m.deleted_at IS NULL
        AND m.created_at > greatest(
          coalesce(
            (SELECT mr.read_at FROM public.message_reads mr
             WHERE mr.conversation_id = c.id AND mr.user_id = p_user_id),
            '1970-01-01'::timestamptz
          ),
          coalesce(me_cp.cleared_at, '1970-01-01'::timestamptz)
        )
    ) AS unread_count,
    coalesce(
      CASE
        WHEN coalesce(c.metadata->>'cowork_group', 'false') = 'true'
          THEN c.metadata->>'avatar_url'
        ELSE other_p.avatar_url
      END,
      ''
    ) AS avatar_url,
    other_p.id AS other_user_id,
    coalesce(other_p.full_name, other_p.username, '') AS other_user_name,
    coalesce(other_p.avatar_url, '') AS other_user_avatar,
    coalesce(other_p.is_online, false) AS is_online,
    coalesce(me_cp.is_pinned, false) AS is_pinned,
    coalesce(me_cp.is_muted, false) AS is_muted,
    coalesce(me_cp.is_archived, false) AS is_archived,
    coalesce(me_cp.role, 'member') AS current_user_role,
    coalesce(sender_p.full_name, sender_p.username, '') AS last_message_sender_name,
    other_p.last_seen AS last_seen,
    coalesce(other_cp.role, 'member') AS other_user_role,
    coalesce(lm.message_type, 'text') AS last_message_type
  FROM public.conversations c
  INNER JOIN public.conversation_participants me_cp
    ON me_cp.conversation_id = c.id AND me_cp.user_id = p_user_id
  LEFT JOIN LATERAL (
    SELECT m.content, m.created_at, m.message_type, m.sender_id
    FROM public.messages m
    WHERE m.conversation_id = c.id
      AND m.deleted_at IS NULL
      AND m.created_at > coalesce(me_cp.cleared_at, '1970-01-01'::timestamptz)
    ORDER BY m.created_at DESC
    LIMIT 1
  ) lm ON true
  LEFT JOIN public.profiles sender_p ON sender_p.id = lm.sender_id
  LEFT JOIN LATERAL (
    SELECT cp.user_id, cp.role
    FROM public.conversation_participants cp
    WHERE cp.conversation_id = c.id AND cp.user_id <> p_user_id
    ORDER BY cp.joined_at NULLS LAST
    LIMIT 1
  ) other_cp ON true
  LEFT JOIN public.profiles other_p ON other_p.id = other_cp.user_id
  WHERE auth.uid() = p_user_id
    AND coalesce(c.conversation_type, 'direct') = 'cowork'
  ORDER BY
    coalesce(me_cp.is_pinned, false) DESC,
    coalesce(lm.created_at, c.updated_at, c.created_at) DESC NULLS LAST;
$function$;

-- Keep the general Chat inbox free of Co-Work Main Chat threads.
CREATE OR REPLACE FUNCTION public.get_user_chats(p_user_id uuid)
RETURNS TABLE(
  chat_id uuid,
  chat_name text,
  chat_type text,
  last_message text,
  last_message_time timestamptz,
  unread_count bigint,
  avatar_url text,
  other_user_id uuid,
  other_user_name text,
  other_user_avatar text,
  is_online boolean,
  is_pinned boolean,
  is_muted boolean,
  is_archived boolean,
  current_user_role text,
  last_message_sender_name text,
  last_seen timestamptz,
  other_user_role text,
  last_message_type text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT
    c.id AS chat_id,
    CASE
      WHEN coalesce(c.conversation_type, 'direct') = 'group' THEN coalesce(c.title, 'Group chat')
      ELSE coalesce(other_p.full_name, other_p.username, 'Chat')
    END AS chat_name,
    coalesce(c.conversation_type, 'direct') AS chat_type,
    coalesce(lm.content, '') AS last_message,
    coalesce(lm.created_at, c.updated_at, c.created_at) AS last_message_time,
    (
      SELECT count(*)::bigint
      FROM public.messages m
      WHERE m.conversation_id = c.id
        AND m.sender_id IS DISTINCT FROM p_user_id
        AND m.deleted_at IS NULL
        AND m.created_at > greatest(
          coalesce(
            (SELECT mr.read_at FROM public.message_reads mr
             WHERE mr.conversation_id = c.id AND mr.user_id = p_user_id),
            '1970-01-01'::timestamptz
          ),
          coalesce(me_cp.cleared_at, '1970-01-01'::timestamptz)
        )
    ) AS unread_count,
    coalesce(
      CASE
        WHEN coalesce(c.conversation_type, 'direct') = 'group' THEN c.metadata->>'avatar_url'
        ELSE other_p.avatar_url
      END,
      ''
    ) AS avatar_url,
    other_p.id AS other_user_id,
    coalesce(other_p.full_name, other_p.username, '') AS other_user_name,
    coalesce(other_p.avatar_url, '') AS other_user_avatar,
    coalesce(other_p.is_online, false) AS is_online,
    coalesce(me_cp.is_pinned, false) AS is_pinned,
    coalesce(me_cp.is_muted, false) AS is_muted,
    coalesce(me_cp.is_archived, false) AS is_archived,
    coalesce(me_cp.role, 'member') AS current_user_role,
    coalesce(sender_p.full_name, sender_p.username, '') AS last_message_sender_name,
    other_p.last_seen AS last_seen,
    coalesce(other_cp.role, 'member') AS other_user_role,
    coalesce(lm.message_type, 'text') AS last_message_type
  FROM public.conversations c
  INNER JOIN public.conversation_participants me_cp
    ON me_cp.conversation_id = c.id AND me_cp.user_id = p_user_id
  LEFT JOIN LATERAL (
    SELECT m.content, m.created_at, m.message_type, m.sender_id
    FROM public.messages m
    WHERE m.conversation_id = c.id
      AND m.deleted_at IS NULL
      AND m.created_at > coalesce(me_cp.cleared_at, '1970-01-01'::timestamptz)
    ORDER BY m.created_at DESC
    LIMIT 1
  ) lm ON true
  LEFT JOIN public.profiles sender_p ON sender_p.id = lm.sender_id
  LEFT JOIN LATERAL (
    SELECT cp.user_id, cp.role
    FROM public.conversation_participants cp
    WHERE cp.conversation_id = c.id AND cp.user_id <> p_user_id
    ORDER BY cp.joined_at NULLS LAST
    LIMIT 1
  ) other_cp ON true
  LEFT JOIN public.profiles other_p ON other_p.id = other_cp.user_id
  WHERE auth.uid() = p_user_id
    AND coalesce(c.conversation_type, 'direct') <> 'cowork'
  ORDER BY
    coalesce(me_cp.is_pinned, false) DESC,
    coalesce(lm.created_at, c.updated_at, c.created_at) DESC NULLS LAST;
$function$;

REVOKE ALL ON FUNCTION public.create_cowork_direct_conversation(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.create_cowork_group_conversation(uuid[], text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_cowork_user_chats(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_cowork_direct_conversation(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_cowork_group_conversation(uuid[], text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_cowork_user_chats(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_chats(uuid) TO authenticated;
