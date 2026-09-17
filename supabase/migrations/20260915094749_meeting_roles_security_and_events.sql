-- Server-authoritative meeting roles, moderation settings, and control events.
-- All mutations are exposed through narrow SECURITY DEFINER RPCs. Clients have
-- read-only access to the normalized state required to render the meeting UI.

CREATE TABLE public.meeting_roles (
  meeting_id uuid NOT NULL REFERENCES public.meetings(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('host', 'co_host', 'participant')),
  assigned_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (meeting_id, user_id)
);

CREATE UNIQUE INDEX meeting_roles_one_host
  ON public.meeting_roles (meeting_id)
  WHERE role = 'host';

CREATE TABLE public.meeting_role_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id uuid NOT NULL REFERENCES public.meetings(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  previous_role text CHECK (previous_role IS NULL OR previous_role IN ('host', 'co_host', 'participant')),
  new_role text CHECK (new_role IS NULL OR new_role IN ('host', 'co_host', 'participant')),
  changed_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  reason text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX meeting_role_history_meeting_created
  ON public.meeting_role_history (meeting_id, created_at DESC);

CREATE TABLE public.meeting_moderation_settings (
  meeting_id uuid PRIMARY KEY REFERENCES public.meetings(id) ON DELETE CASCADE,
  is_locked boolean NOT NULL DEFAULT false,
  host_leave_behavior text NOT NULL DEFAULT 'end'
    CHECK (host_leave_behavior IN ('end', 'transfer_to_co_host')),
  updated_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.meeting_control_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id uuid NOT NULL REFERENCES public.meetings(id) ON DELETE CASCADE,
  actor_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  target_user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  action text NOT NULL CHECK (
    action IN (
      'request_mute',
      'stop_video',
      'mute_all',
      'ask_all_to_mute',
      'removed',
      'remove_all_except_host',
      'meeting_ended'
    )
  ),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '10 minutes')
);

CREATE INDEX meeting_control_events_target
  ON public.meeting_control_events (meeting_id, target_user_id, created_at DESC);

ALTER TABLE public.meeting_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meeting_role_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meeting_moderation_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meeting_control_events ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.meeting_actor_role(meeting_id_input uuid)
RETURNS text
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $function$
  SELECT mr.role
  FROM public.meeting_roles mr
  WHERE mr.meeting_id = meeting_id_input
    AND mr.user_id = auth.uid()
    AND (
      mr.role = 'host'
      OR (
        mr.role = 'co_host'
        AND EXISTS (
          SELECT 1
          FROM public.meeting_participants mp
          WHERE mp.meeting_id = mr.meeting_id
            AND mp.user_id = mr.user_id
            AND mp.status = 'admitted'
        )
      )
      OR mr.role = 'participant'
    );
$function$;

REVOKE ALL ON FUNCTION public.meeting_actor_role(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.meeting_actor_role(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.is_meeting_member(meeting_id_input uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.meeting_participants mp
    WHERE mp.meeting_id = meeting_id_input
      AND mp.user_id = auth.uid()
      AND mp.status = 'admitted'
  ) OR EXISTS (
    SELECT 1
    FROM public.meeting_roles mr
    WHERE mr.meeting_id = meeting_id_input
      AND mr.user_id = auth.uid()
      AND mr.role = 'host'
  );
$function$;

REVOKE ALL ON FUNCTION public.is_meeting_member(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_meeting_member(uuid) TO authenticated, service_role;

CREATE POLICY meeting_roles_select_member ON public.meeting_roles
  FOR SELECT TO authenticated
  USING (public.is_meeting_member(meeting_id));

CREATE POLICY meeting_role_history_select_managers ON public.meeting_role_history
  FOR SELECT TO authenticated
  USING (public.meeting_actor_role(meeting_id) IN ('host', 'co_host'));

CREATE POLICY meeting_moderation_settings_select_member ON public.meeting_moderation_settings
  FOR SELECT TO authenticated
  USING (public.is_meeting_member(meeting_id));

CREATE POLICY meeting_control_events_select_relevant ON public.meeting_control_events
  FOR SELECT TO authenticated
  USING (
    expires_at > now()
    AND (
      (
        action = 'meeting_ended'
        AND EXISTS (
          SELECT 1 FROM public.meeting_participants mp
          WHERE mp.meeting_id = meeting_control_events.meeting_id
            AND mp.user_id = auth.uid()
        )
      )
      OR (
        public.is_meeting_member(meeting_id)
        AND (
          target_user_id = auth.uid()
          OR target_user_id IS NULL
          OR public.meeting_actor_role(meeting_id) IN ('host', 'co_host')
        )
      )
    )
  );

-- Bootstrap one normalized host and participant role for existing meetings.
INSERT INTO public.meeting_roles (meeting_id, user_id, role, assigned_by)
SELECT m.id, m.host_id, 'host', m.host_id
FROM public.meetings m
ON CONFLICT (meeting_id, user_id) DO UPDATE
SET role = 'host', updated_at = now();

INSERT INTO public.meeting_roles (meeting_id, user_id, role, assigned_by)
SELECT mp.meeting_id, mp.user_id, 'participant', m.host_id
FROM public.meeting_participants mp
JOIN public.meetings m ON m.id = mp.meeting_id
WHERE mp.user_id <> m.host_id
ON CONFLICT (meeting_id, user_id) DO NOTHING;

INSERT INTO public.meeting_moderation_settings (meeting_id, updated_by)
SELECT m.id, m.host_id
FROM public.meetings m
ON CONFLICT (meeting_id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.bootstrap_meeting_security()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
BEGIN
  INSERT INTO public.meeting_roles (meeting_id, user_id, role, assigned_by)
  VALUES (NEW.id, NEW.host_id, 'host', NEW.host_id)
  ON CONFLICT (meeting_id, user_id) DO UPDATE
  SET role = 'host', assigned_by = NEW.host_id, updated_at = now();

  INSERT INTO public.meeting_moderation_settings (meeting_id, updated_by)
  VALUES (NEW.id, NEW.host_id)
  ON CONFLICT (meeting_id) DO NOTHING;

  IF NEW.room_id IS NOT NULL THEN
    INSERT INTO public.meeting_rooms (
      meeting_id, host_id, room_code, is_active, activated_at, max_participants
    ) VALUES (
      NEW.id, NEW.host_id, NEW.room_id, NEW.status IN ('active', 'instant'),
      CASE WHEN NEW.status IN ('active', 'instant') THEN coalesce(NEW.started_at, now()) END,
      coalesce(NEW.max_participants, 100)
    );
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_bootstrap_meeting_security ON public.meetings;
CREATE TRIGGER trg_bootstrap_meeting_security
  AFTER INSERT ON public.meetings
  FOR EACH ROW EXECUTE FUNCTION public.bootstrap_meeting_security();

CREATE OR REPLACE FUNCTION public.ensure_meeting_participant_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
BEGIN
  INSERT INTO public.meeting_roles (meeting_id, user_id, role, assigned_by)
  SELECT NEW.meeting_id, NEW.user_id,
    CASE WHEN m.host_id = NEW.user_id THEN 'host' ELSE 'participant' END,
    m.host_id
  FROM public.meetings m
  WHERE m.id = NEW.meeting_id
  ON CONFLICT (meeting_id, user_id) DO NOTHING;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_ensure_meeting_participant_role ON public.meeting_participants;
CREATE TRIGGER trg_ensure_meeting_participant_role
  AFTER INSERT ON public.meeting_participants
  FOR EACH ROW EXECUTE FUNCTION public.ensure_meeting_participant_role();

CREATE OR REPLACE FUNCTION public.set_meeting_locked(
  meeting_id_input uuid,
  locked_input boolean
)
RETURNS public.meeting_moderation_settings
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  actor_id uuid := auth.uid();
  result_row public.meeting_moderation_settings;
BEGIN
  IF actor_id IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;
  IF public.meeting_actor_role(meeting_id_input) <> 'host' THEN
    RAISE EXCEPTION 'HOST_REQUIRED';
  END IF;

  INSERT INTO public.meeting_moderation_settings (meeting_id, is_locked, updated_by)
  VALUES (meeting_id_input, locked_input, actor_id)
  ON CONFLICT (meeting_id) DO UPDATE
  SET is_locked = EXCLUDED.is_locked, updated_by = actor_id, updated_at = now()
  RETURNING * INTO result_row;
  RETURN result_row;
END;
$function$;

CREATE OR REPLACE FUNCTION public.set_meeting_host_leave_behavior(
  meeting_id_input uuid,
  behavior_input text
)
RETURNS public.meeting_moderation_settings
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  actor_id uuid := auth.uid();
  result_row public.meeting_moderation_settings;
BEGIN
  IF behavior_input NOT IN ('end', 'transfer_to_co_host') THEN
    RAISE EXCEPTION 'INVALID_HOST_LEAVE_BEHAVIOR';
  END IF;
  IF public.meeting_actor_role(meeting_id_input) <> 'host' THEN
    RAISE EXCEPTION 'HOST_REQUIRED';
  END IF;

  INSERT INTO public.meeting_moderation_settings
    (meeting_id, host_leave_behavior, updated_by)
  VALUES (meeting_id_input, behavior_input, actor_id)
  ON CONFLICT (meeting_id) DO UPDATE
  SET host_leave_behavior = EXCLUDED.host_leave_behavior,
      updated_by = actor_id,
      updated_at = now()
  RETURNING * INTO result_row;
  RETURN result_row;
END;
$function$;

CREATE OR REPLACE FUNCTION public.assign_meeting_co_host(
  meeting_id_input uuid,
  target_user_id_input uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  actor_id uuid := auth.uid();
  old_role text;
BEGIN
  IF public.meeting_actor_role(meeting_id_input) <> 'host' THEN
    RAISE EXCEPTION 'HOST_REQUIRED';
  END IF;
  IF actor_id = target_user_id_input THEN RAISE EXCEPTION 'HOST_ALREADY_ASSIGNED'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.meeting_participants
    WHERE meeting_id = meeting_id_input
      AND user_id = target_user_id_input
      AND status = 'admitted'
  ) THEN RAISE EXCEPTION 'TARGET_NOT_ADMITTED'; END IF;

  SELECT role INTO old_role FROM public.meeting_roles
  WHERE meeting_id = meeting_id_input AND user_id = target_user_id_input
  FOR UPDATE;

  INSERT INTO public.meeting_roles (meeting_id, user_id, role, assigned_by)
  VALUES (meeting_id_input, target_user_id_input, 'co_host', actor_id)
  ON CONFLICT (meeting_id, user_id) DO UPDATE
  SET role = 'co_host', assigned_by = actor_id, assigned_at = now(), updated_at = now();

  INSERT INTO public.meeting_role_history
    (meeting_id, user_id, previous_role, new_role, changed_by, reason)
  VALUES (meeting_id_input, target_user_id_input, old_role, 'co_host', actor_id, 'assigned_co_host');
END;
$function$;

CREATE OR REPLACE FUNCTION public.remove_meeting_co_host(
  meeting_id_input uuid,
  target_user_id_input uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE actor_id uuid := auth.uid();
BEGIN
  IF public.meeting_actor_role(meeting_id_input) <> 'host' THEN
    RAISE EXCEPTION 'HOST_REQUIRED';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.meeting_roles
    WHERE meeting_id = meeting_id_input
      AND user_id = target_user_id_input
      AND role = 'co_host'
  ) THEN RAISE EXCEPTION 'TARGET_NOT_CO_HOST'; END IF;

  UPDATE public.meeting_roles
  SET role = 'participant', assigned_by = actor_id, updated_at = now()
  WHERE meeting_id = meeting_id_input AND user_id = target_user_id_input;

  INSERT INTO public.meeting_role_history
    (meeting_id, user_id, previous_role, new_role, changed_by, reason)
  VALUES (meeting_id_input, target_user_id_input, 'co_host', 'participant', actor_id, 'removed_co_host');
END;
$function$;

CREATE OR REPLACE FUNCTION public.transfer_meeting_host(
  meeting_id_input uuid,
  target_user_id_input uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE actor_id uuid := auth.uid(); target_role text;
BEGIN
  IF public.meeting_actor_role(meeting_id_input) <> 'host' THEN
    RAISE EXCEPTION 'HOST_REQUIRED';
  END IF;
  SELECT role INTO target_role
  FROM public.meeting_roles
  WHERE meeting_id = meeting_id_input AND user_id = target_user_id_input
  FOR UPDATE;
  IF target_role NOT IN ('co_host', 'participant') OR NOT EXISTS (
    SELECT 1 FROM public.meeting_participants
    WHERE meeting_id = meeting_id_input
      AND user_id = target_user_id_input
      AND status = 'admitted'
  ) THEN RAISE EXCEPTION 'TARGET_NOT_ADMITTED'; END IF;

  -- Demote first to satisfy the partial unique host index.
  UPDATE public.meeting_roles
  SET role = 'co_host', assigned_by = actor_id, updated_at = now()
  WHERE meeting_id = meeting_id_input AND user_id = actor_id;
  UPDATE public.meeting_roles
  SET role = 'host', assigned_by = actor_id, assigned_at = now(), updated_at = now()
  WHERE meeting_id = meeting_id_input AND user_id = target_user_id_input;

  UPDATE public.meetings SET host_id = target_user_id_input, updated_at = now()
  WHERE id = meeting_id_input;
  UPDATE public.meeting_rooms SET host_id = target_user_id_input
  WHERE meeting_id = meeting_id_input;
  UPDATE public.meeting_participants
  SET is_host = (user_id = target_user_id_input)
  WHERE meeting_id = meeting_id_input
    AND user_id IN (actor_id, target_user_id_input);

  INSERT INTO public.meeting_role_history
    (meeting_id, user_id, previous_role, new_role, changed_by, reason)
  VALUES
    (meeting_id_input, actor_id, 'host', 'co_host', actor_id, 'transferred_host'),
    (meeting_id_input, target_user_id_input, target_role, 'host', actor_id, 'received_host');
END;
$function$;

CREATE OR REPLACE FUNCTION public.review_meeting_participant(
  participant_id_input uuid,
  decision_input text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  actor_id uuid := auth.uid();
  participant_row public.meeting_participants;
BEGIN
  SELECT * INTO participant_row
  FROM public.meeting_participants
  WHERE id = participant_id_input
  FOR UPDATE;
  IF participant_row.id IS NULL THEN RAISE EXCEPTION 'PARTICIPANT_NOT_FOUND'; END IF;
  IF public.meeting_actor_role(participant_row.meeting_id) NOT IN ('host', 'co_host') THEN
    RAISE EXCEPTION 'MODERATOR_REQUIRED';
  END IF;
  IF decision_input NOT IN ('admit', 'reject', 'allow_rejoin') THEN
    RAISE EXCEPTION 'INVALID_DECISION';
  END IF;

  UPDATE public.meeting_participants
  SET status = CASE
      WHEN decision_input = 'admit' THEN 'admitted'
      WHEN decision_input = 'reject' THEN 'rejected'
      ELSE 'waiting'
    END,
    joined_at = CASE WHEN decision_input = 'admit' THEN now() ELSE joined_at END,
    left_at = CASE WHEN decision_input = 'reject' THEN now() ELSE NULL END,
    reviewed_at = CASE WHEN decision_input = 'allow_rejoin' THEN NULL ELSE now() END,
    reviewed_by = CASE WHEN decision_input = 'allow_rejoin' THEN NULL ELSE actor_id END,
    session_id = CASE WHEN decision_input = 'allow_rejoin' THEN NULL ELSE session_id END
  WHERE id = participant_id_input;
END;
$function$;

CREATE OR REPLACE FUNCTION public.moderate_meeting_participants(
  meeting_id_input uuid,
  action_input text,
  target_user_id_input uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  actor_id uuid := auth.uid();
  actor_role text := public.meeting_actor_role(meeting_id_input);
  event_id uuid;
BEGIN
  IF actor_role NOT IN ('host', 'co_host') THEN RAISE EXCEPTION 'MODERATOR_REQUIRED'; END IF;
  IF action_input NOT IN (
    'request_mute', 'stop_video', 'mute_all', 'ask_all_to_mute',
    'remove', 'remove_all_except_host'
  ) THEN RAISE EXCEPTION 'INVALID_ACTION'; END IF;

  IF action_input IN ('request_mute', 'stop_video', 'remove') THEN
    IF target_user_id_input IS NULL OR target_user_id_input = actor_id THEN
      RAISE EXCEPTION 'INVALID_TARGET';
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM public.meeting_participants
      WHERE meeting_id = meeting_id_input
        AND user_id = target_user_id_input
        AND status = 'admitted'
    ) THEN RAISE EXCEPTION 'TARGET_NOT_ADMITTED'; END IF;
    IF public.meeting_actor_role(meeting_id_input) = 'co_host'
       AND (SELECT role FROM public.meeting_roles
            WHERE meeting_id = meeting_id_input AND user_id = target_user_id_input)
           IN ('host', 'co_host') THEN
      RAISE EXCEPTION 'HOST_REQUIRED_FOR_TARGET';
    END IF;
  END IF;

  IF action_input IN ('mute_all', 'remove_all_except_host') AND actor_role <> 'host' THEN
    RAISE EXCEPTION 'HOST_REQUIRED';
  END IF;

  IF action_input = 'remove' THEN
    UPDATE public.meeting_participants
    SET status = 'removed', left_at = now(), reviewed_at = now(), reviewed_by = actor_id
    WHERE meeting_id = meeting_id_input AND user_id = target_user_id_input;
  ELSIF action_input = 'remove_all_except_host' THEN
    UPDATE public.meeting_participants mp
    SET status = 'removed', left_at = now(), reviewed_at = now(), reviewed_by = actor_id
    WHERE mp.meeting_id = meeting_id_input
      AND mp.user_id <> actor_id
      AND mp.status IN ('admitted', 'waiting');
  END IF;

  INSERT INTO public.meeting_control_events
    (meeting_id, actor_id, target_user_id, action)
  VALUES (
    meeting_id_input,
    actor_id,
    CASE
      WHEN action_input IN ('request_mute', 'stop_video', 'remove') THEN target_user_id_input
      ELSE NULL
    END,
    CASE WHEN action_input = 'remove' THEN 'removed' ELSE action_input END
  )
  RETURNING id INTO event_id;
  RETURN event_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.start_meeting_secure(meeting_id_input uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
BEGIN
  IF public.meeting_actor_role(meeting_id_input) <> 'host' THEN
    RAISE EXCEPTION 'HOST_REQUIRED';
  END IF;
  UPDATE public.meetings
  SET status = 'active', started_at = now(), ended_at = NULL, updated_at = now()
  WHERE id = meeting_id_input AND status <> 'cancelled';
  IF NOT FOUND THEN RAISE EXCEPTION 'MEETING_CLOSED'; END IF;
  UPDATE public.meeting_rooms
  SET is_active = true, activated_at = now(), ended_at = NULL
  WHERE meeting_id = meeting_id_input;
END;
$function$;

CREATE OR REPLACE FUNCTION public.end_meeting_secure(meeting_id_input uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE actor_id uuid := auth.uid();
BEGIN
  IF public.meeting_actor_role(meeting_id_input) <> 'host' THEN
    RAISE EXCEPTION 'HOST_REQUIRED';
  END IF;
  UPDATE public.meetings
  SET status = 'ended', ended_at = now(), updated_at = now()
  WHERE id = meeting_id_input;
  UPDATE public.meeting_rooms SET is_active = false, ended_at = now()
  WHERE meeting_id = meeting_id_input;
  UPDATE public.meeting_participants
  SET status = 'left', left_at = now()
  WHERE meeting_id = meeting_id_input AND status IN ('admitted', 'waiting');
  INSERT INTO public.meeting_control_events (meeting_id, actor_id, action)
  VALUES (meeting_id_input, actor_id, 'meeting_ended');
END;
$function$;

CREATE OR REPLACE FUNCTION public.cancel_meeting_secure(meeting_id_input uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
BEGIN
  IF public.meeting_actor_role(meeting_id_input) <> 'host' THEN
    RAISE EXCEPTION 'HOST_REQUIRED';
  END IF;
  UPDATE public.meetings
  SET status = 'cancelled', ended_at = now(), updated_at = now()
  WHERE id = meeting_id_input;
  UPDATE public.meeting_rooms SET is_active = false, ended_at = now()
  WHERE meeting_id = meeting_id_input;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_meeting_invitees_secure(
  meeting_id_input uuid,
  invitees_input jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
BEGIN
  IF public.meeting_actor_role(meeting_id_input) <> 'host' THEN
    RAISE EXCEPTION 'HOST_REQUIRED';
  END IF;
  IF jsonb_typeof(coalesce(invitees_input, '[]'::jsonb)) <> 'array' THEN
    RAISE EXCEPTION 'INVALID_INVITEES';
  END IF;
  UPDATE public.meetings
  SET invitees = invitees_input, updated_at = now()
  WHERE id = meeting_id_input;
END;
$function$;

CREATE OR REPLACE FUNCTION public.leave_meeting_participant(
  meeting_id_input uuid,
  session_id_input uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  actor_id uuid := auth.uid();
  actor_role text := public.meeting_actor_role(meeting_id_input);
  leave_behavior text;
  next_host uuid;
BEGIN
  IF actor_id IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;

  IF actor_role = 'host' THEN
    SELECT host_leave_behavior INTO leave_behavior
    FROM public.meeting_moderation_settings
    WHERE meeting_id = meeting_id_input;

    IF leave_behavior = 'transfer_to_co_host' THEN
      SELECT mr.user_id INTO next_host
      FROM public.meeting_roles mr
      JOIN public.meeting_participants mp
        ON mp.meeting_id = mr.meeting_id AND mp.user_id = mr.user_id
      WHERE mr.meeting_id = meeting_id_input
        AND mr.role = 'co_host'
        AND mp.status = 'admitted'
      ORDER BY mr.assigned_at
      LIMIT 1;
    END IF;

    IF next_host IS NOT NULL THEN
      PERFORM public.transfer_meeting_host(meeting_id_input, next_host);
    ELSE
      PERFORM public.end_meeting_secure(meeting_id_input);
      RETURN;
    END IF;
  END IF;

  UPDATE public.meeting_participants
  SET status = 'left', left_at = now(), last_seen_at = now()
  WHERE meeting_id = meeting_id_input
    AND user_id = actor_id
    AND session_id = session_id_input
    AND status <> 'removed';
END;
$function$;

-- Locking is enforced at the join boundary. Existing admitted users may
-- reconnect; new/waiting users cannot enter a locked room.
CREATE OR REPLACE FUNCTION public.join_meeting_participant(
  meeting_id_input uuid,
  session_id_input uuid
)
RETURNS public.meeting_participants
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  actor_id uuid := auth.uid();
  meeting_row public.meetings;
  existing_row public.meeting_participants;
  result_row public.meeting_participants;
  waiting_room_enabled boolean;
  room_locked boolean;
  next_status text;
  joined_time timestamptz;
BEGIN
  IF actor_id IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;
  SELECT * INTO meeting_row FROM public.meetings WHERE id = meeting_id_input;
  IF meeting_row.id IS NULL THEN RAISE EXCEPTION 'MEETING_NOT_FOUND'; END IF;
  IF meeting_row.status = 'cancelled'
     OR (meeting_row.status = 'ended' AND meeting_row.host_id <> actor_id) THEN
    RAISE EXCEPTION 'MEETING_CLOSED';
  END IF;

  SELECT * INTO existing_row FROM public.meeting_participants
  WHERE meeting_id = meeting_id_input AND user_id = actor_id FOR UPDATE;
  IF existing_row.status = 'removed' THEN RAISE EXCEPTION 'PARTICIPANT_REMOVED'; END IF;

  SELECT is_locked INTO room_locked
  FROM public.meeting_moderation_settings WHERE meeting_id = meeting_id_input;
  IF coalesce(room_locked, false)
     AND meeting_row.host_id <> actor_id
     AND existing_row.status IS DISTINCT FROM 'admitted' THEN
    RAISE EXCEPTION 'MEETING_LOCKED';
  END IF;

  waiting_room_enabled :=
    coalesce((meeting_row.security_settings->>'waitingRoom')::boolean, false)
    OR coalesce((meeting_row.security_settings->>'waiting_room')::boolean, false);
  next_status := CASE
    WHEN meeting_row.host_id = actor_id THEN 'admitted'
    WHEN existing_row.status = 'admitted' THEN 'admitted'
    WHEN existing_row.status = 'left' AND existing_row.joined_at IS NOT NULL THEN 'admitted'
    WHEN waiting_room_enabled THEN 'waiting'
    ELSE 'admitted'
  END;
  joined_time := CASE WHEN next_status = 'admitted' THEN now() ELSE existing_row.joined_at END;

  INSERT INTO public.meeting_participants (
    meeting_id, user_id, is_host, status, joined_at, left_at,
    is_muted, is_video_off, session_id, last_seen_at
  ) VALUES (
    meeting_id_input, actor_id, meeting_row.host_id = actor_id, next_status,
    joined_time, NULL, false, false, session_id_input, now()
  )
  ON CONFLICT (meeting_id, user_id) DO UPDATE SET
    is_host = EXCLUDED.is_host,
    status = EXCLUDED.status,
    joined_at = CASE WHEN EXCLUDED.status = 'admitted'
      THEN coalesce(meeting_participants.joined_at, EXCLUDED.joined_at)
      ELSE meeting_participants.joined_at END,
    left_at = NULL,
    session_id = EXCLUDED.session_id,
    last_seen_at = now()
  RETURNING * INTO result_row;
  RETURN result_row;
END;
$function$;

-- Table writes are no longer an authorization compatibility path.
DROP POLICY IF EXISTS mp_insert ON public.meeting_participants;
DROP POLICY IF EXISTS mp_update ON public.meeting_participants;
DROP POLICY IF EXISTS mp_delete ON public.meeting_participants;

-- Meetings may be read through existing policies, but lifecycle and host
-- ownership changes must only happen through the guarded RPCs above.
DROP POLICY IF EXISTS meetings_update ON public.meetings;
DROP POLICY IF EXISTS "Hosts can update own meetings" ON public.meetings;
DROP POLICY IF EXISTS meeting_update ON public.meetings;

REVOKE ALL ON FUNCTION public.set_meeting_locked(uuid, boolean) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.set_meeting_host_leave_behavior(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.assign_meeting_co_host(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.remove_meeting_co_host(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.transfer_meeting_host(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.review_meeting_participant(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.moderate_meeting_participants(uuid, text, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.start_meeting_secure(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.end_meeting_secure(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.cancel_meeting_secure(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.update_meeting_invitees_secure(uuid, jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.join_meeting_participant(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.leave_meeting_participant(uuid, uuid) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.set_meeting_locked(uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_meeting_host_leave_behavior(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.assign_meeting_co_host(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.remove_meeting_co_host(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.transfer_meeting_host(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.review_meeting_participant(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.moderate_meeting_participants(uuid, text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.start_meeting_secure(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.end_meeting_secure(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_meeting_secure(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_meeting_invitees_secure(uuid, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.join_meeting_participant(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.leave_meeting_participant(uuid, uuid) TO authenticated;

REVOKE INSERT, UPDATE, DELETE ON public.meeting_roles FROM authenticated, anon;
REVOKE INSERT, UPDATE, DELETE ON public.meeting_role_history FROM authenticated, anon;
REVOKE INSERT, UPDATE, DELETE ON public.meeting_moderation_settings FROM authenticated, anon;
REVOKE INSERT, UPDATE, DELETE ON public.meeting_control_events FROM authenticated, anon;
REVOKE INSERT, UPDATE, DELETE ON public.meeting_participants FROM authenticated, anon;
REVOKE UPDATE, DELETE ON public.meetings FROM authenticated, anon;
REVOKE INSERT, UPDATE, DELETE ON public.meeting_rooms FROM authenticated, anon;

GRANT SELECT ON public.meeting_roles TO authenticated;
GRANT SELECT ON public.meeting_role_history TO authenticated;
GRANT SELECT ON public.meeting_moderation_settings TO authenticated;
GRANT SELECT ON public.meeting_control_events TO authenticated;

ALTER PUBLICATION supabase_realtime ADD TABLE public.meeting_roles;
ALTER PUBLICATION supabase_realtime ADD TABLE public.meeting_moderation_settings;
ALTER PUBLICATION supabase_realtime ADD TABLE public.meeting_control_events;
