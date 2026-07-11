-- Hashtag autocomplete suggestions for the community composer.
--
-- Aggregates distinct hashtags from posts.tags (text[]), optionally filtered by
-- a case-insensitive prefix, ordered by how often they are used. Runs as
-- SECURITY DEFINER so suggestions reflect the whole community regardless of the
-- caller's row-level visibility.

create or replace function public.get_hashtag_suggestions(
  prefix text default '',
  max_results integer default 8
)
returns table(tag text, usage_count bigint)
language sql
stable
security definer
set search_path to 'public'
as $function$
  select t.tag, count(*)::bigint as usage_count
  from public.posts p
  cross join lateral unnest(p.tags) as t(tag)
  where p.tags is not null
    and coalesce(p.is_deleted, false) = false
    and (coalesce(prefix, '') = '' or t.tag ilike prefix || '%')
  group by t.tag
  order by usage_count desc, t.tag asc
  limit greatest(coalesce(max_results, 8), 1);
$function$;

grant execute on function public.get_hashtag_suggestions(text, integer) to anon, authenticated, service_role;
