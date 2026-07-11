-- Fix connection-list visibility on public profiles.
--
-- Problem: `get_user_connections` ran as SECURITY INVOKER and read the
-- `connections` table, whose RLS only exposes rows where the *viewer* is the
-- sender/receiver. So visiting another member's profile showed "0 connections"
-- in the list even though the (denormalized, publicly readable)
-- `profiles.connections_count` correctly showed e.g. 7.
--
-- It also sourced display fields from `auth.users.raw_user_meta_data`, which
-- left `headline`/`avatar_url` (and often `full_name`) null.
--
-- Fix: run as SECURITY DEFINER (matching the already-public connection count)
-- and source name/headline/avatar from `public.profiles`. Deleted profiles are
-- excluded. Signature and OUT columns are unchanged, so the client mapping is
-- unaffected.

create or replace function public.get_user_connections(
  target_user_id uuid,
  connection_status character varying default 'accepted'::character varying
)
returns table(
  connection_id uuid,
  user_id uuid,
  full_name character varying,
  headline text,
  avatar_url text,
  status character varying,
  is_sender boolean,
  created_at timestamp with time zone,
  mutual_count integer
)
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  return query
  select
    c.id,
    case when c.sender_id = target_user_id then c.receiver_id else c.sender_id end,
    coalesce(p.full_name, p.username)::varchar,
    p.headline::text,
    p.avatar_url::text,
    c.status,
    (c.sender_id = target_user_id),
    c.created_at,
    public.get_mutual_connections_count(
      target_user_id,
      case when c.sender_id = target_user_id then c.receiver_id else c.sender_id end
    )
  from public.connections c
  join public.profiles p
    on p.id = case when c.sender_id = target_user_id then c.receiver_id else c.sender_id end
  where (c.sender_id = target_user_id or c.receiver_id = target_user_id)
    and c.status = connection_status
    and coalesce(p.is_deleted, false) = false
  order by c.created_at desc;
end;
$function$;

grant execute on function public.get_user_connections(uuid, character varying) to anon, authenticated;
