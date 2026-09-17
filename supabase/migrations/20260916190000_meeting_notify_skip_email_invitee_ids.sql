-- Email invitees use ids like "email:user@example.com". Casting those to uuid
-- in collect_meeting_notify_user_ids crashes join/start when a meeting has
-- external invitees ("invalid input syntax for type uuid: email:…").

CREATE OR REPLACE FUNCTION public.collect_meeting_notify_user_ids(
  p_meeting_id uuid,
  p_host_id uuid,
  p_invitees jsonb
)
RETURNS uuid[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT coalesce(array_agg(DISTINCT x.id), ARRAY[]::uuid[])
  FROM (
    SELECT p_host_id AS id
    WHERE p_host_id IS NOT NULL
    UNION
    SELECT (inv->>'id')::uuid
    FROM jsonb_array_elements(
      CASE
        WHEN jsonb_typeof(coalesce(p_invitees, '[]'::jsonb)) = 'array'
          THEN coalesce(p_invitees, '[]'::jsonb)
        ELSE '[]'::jsonb
      END
    ) inv
    WHERE coalesce(inv->>'type', 'user') = 'user'
      AND nullif(inv->>'id', '') IS NOT NULL
      AND inv->>'id' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    UNION
    SELECT mp.user_id
    FROM public.meeting_participants mp
    WHERE mp.meeting_id = p_meeting_id
      AND mp.user_id IS NOT NULL
      AND mp.status IS DISTINCT FROM 'rejected'
  ) x
  WHERE x.id IS NOT NULL;
$$;

REVOKE ALL ON FUNCTION public.collect_meeting_notify_user_ids(uuid, uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.collect_meeting_notify_user_ids(uuid, uuid, jsonb) TO postgres, service_role;
