-- Fix get_post_reactions_detailed: profiles.full_name (and other columns) are
-- varchar, but the function declares text return types. Postgres raises
-- "structure of query does not match function result type" at runtime, so the
-- reactions list always came back empty even when a post had reactions.
-- Cast the profile columns to text so the returned shape matches the signature.
create or replace function public.get_post_reactions_detailed(post_id_param uuid)
returns table(
  reaction_type text,
  user_id uuid,
  user_name text,
  user_avatar text,
  user_headline text,
  created_at timestamp with time zone
)
language plpgsql
security definer
as $function$
begin
  return query
  select
    pr.reaction_type::text,
    pr.user_id,
    p.full_name::text as user_name,
    p.avatar_url::text as user_avatar,
    p.headline::text as user_headline,
    pr.created_at
  from post_reactions pr
  left join profiles p on pr.user_id = p.id
  where pr.post_id = post_id_param
  order by pr.created_at desc;
end;
$function$;
