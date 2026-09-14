-- Connection notifications use connections.id as their primary context. Keep
-- that context for Accept/Ignore, but provide the peer profile as the parent
-- context and a real action URL for push, toast, and email entry points.
CREATE OR REPLACE FUNCTION public.notify_connection_request()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_variables jsonb;
  v_sender_name text;
  v_receiver_name text;
BEGIN
  SELECT COALESCE(NULLIF(full_name, ''), NULLIF(username, ''), 'Someone')
  INTO v_sender_name
  FROM public.profiles
  WHERE id = NEW.sender_id;

  SELECT COALESCE(NULLIF(full_name, ''), NULLIF(username, ''), 'Someone')
  INTO v_receiver_name
  FROM public.profiles
  WHERE id = NEW.receiver_id;

  IF TG_OP = 'INSERT' AND NEW.status = 'pending' THEN
    v_variables := jsonb_build_object(
      'requester_name', COALESCE(v_sender_name, 'Someone'),
      'requester_id', NEW.sender_id,
      'action_url', '/profile/' || NEW.sender_id::text
    );

    PERFORM public.create_smart_notification(
      'connection_request'::varchar,
      NEW.receiver_id,
      v_variables,
      'connection'::varchar,
      NEW.id,
      'user_profile'::varchar,
      NEW.sender_id,
      3,
      NULL::timestamptz,
      'trigger'::varchar
    );
  ELSIF TG_OP = 'UPDATE'
    AND OLD.status IS DISTINCT FROM NEW.status
    AND OLD.status = 'pending'
    AND NEW.status = 'accepted'
  THEN
    v_variables := jsonb_build_object(
      'receiver_name', COALESCE(v_receiver_name, 'Someone'),
      'receiver_id', NEW.receiver_id,
      'sender_name', COALESCE(v_sender_name, 'Someone'),
      'sender_id', NEW.sender_id,
      'connection_id', NEW.id,
      'action_url', '/profile/' || NEW.receiver_id::text
    );

    PERFORM public.create_smart_notification(
      'connection_accepted'::varchar,
      NEW.sender_id,
      v_variables,
      'connection'::varchar,
      NEW.id,
      'user_profile'::varchar,
      NEW.receiver_id,
      3,
      NULL::timestamptz,
      'trigger'::varchar
    );
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING '[notify_connection_request] %: %', SQLERRM, SQLSTATE;
  RETURN NEW;
END;
$$;

-- Repair existing rows, including legacy notifications that did not record a
-- parent profile. The connection row remains the actionable context.
UPDATE public.notifications AS notification
SET
  action_url = '/profile/' ||
    CASE
      WHEN notification.type = 'connection_request' THEN connection.sender_id::text
      ELSE connection.receiver_id::text
    END,
  parent_context_type = 'user_profile',
  parent_context_id = CASE
    WHEN notification.type = 'connection_request' THEN connection.sender_id
    ELSE connection.receiver_id
  END,
  data = COALESCE(notification.data, '{}'::jsonb) || CASE
    WHEN notification.type = 'connection_request'
      THEN jsonb_build_object('requester_id', connection.sender_id)
    ELSE jsonb_build_object('receiver_id', connection.receiver_id)
  END,
  updated_at = now()
FROM public.connections AS connection
WHERE notification.context_type IN ('connection', 'connection_accepted')
  AND notification.context_id = connection.id
  AND notification.type IN ('connection_request', 'connection_accepted');
