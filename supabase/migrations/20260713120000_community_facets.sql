-- Distinct filter option values ("facets") for the community filter menus.
--
-- Each function aggregates distinct values for a resource so the LinkedIn-style
-- filter pills can show a complete, stable option list regardless of the caller's
-- row-level visibility or the current page of results. SECURITY DEFINER lets the
-- menus reflect the whole community; results are read-only distinct lists.

-- Companies: industry / location (location + headquarters) / size.
create or replace function public.community_company_facets()
returns table(facet text, value text)
language sql
stable
security definer
set search_path to 'public'
as $function$
  select 'industry' as facet, trim(c.industry) as value
  from public.companypages c
  where c.industry is not null and trim(c.industry) <> ''
  group by trim(c.industry)
  union
  select 'location' as facet, trim(loc) as value
  from public.companypages c
  cross join lateral (values (c.location), (c.headquarters)) as l(loc)
  where loc is not null and trim(loc) <> ''
  group by trim(loc)
  union
  select 'size' as facet, trim(c.size) as value
  from public.companypages c
  where c.size is not null and trim(c.size) <> ''
  group by trim(c.size)
  order by facet asc, value asc;
$function$;

-- Groups: location / industry (industries is a text[]).
create or replace function public.community_group_facets()
returns table(facet text, value text)
language sql
stable
security definer
set search_path to 'public'
as $function$
  select 'location' as facet, trim(g.location) as value
  from public.groups g
  where g.location is not null and trim(g.location) <> ''
  group by trim(g.location)
  union
  select 'industry' as facet, trim(t.value) as value
  from public.groups g
  cross join lateral unnest(g.industries) as t(value)
  where g.industries is not null and trim(t.value) <> ''
  group by trim(t.value)
  order by facet asc, value asc;
$function$;

-- Events: distinct upcoming, non-cancelled event types.
create or replace function public.community_event_types()
returns table(value text)
language sql
stable
security definer
set search_path to 'public'
as $function$
  select trim(e.event_type) as value
  from public.events e
  where e.event_type is not null
    and trim(e.event_type) <> ''
    and e.start_time >= now()
    and coalesce(e.status, '') <> 'cancelled'
  group by trim(e.event_type)
  order by value asc;
$function$;

-- Notifications: distinct categories for the signed-in recipient.
create or replace function public.community_notification_categories(p_user uuid)
returns table(value text)
language sql
stable
security definer
set search_path to 'public'
as $function$
  select trim(n.category) as value
  from public.notifications n
  where n.recipient_id = p_user
    and n.category is not null
    and trim(n.category) <> ''
  group by trim(n.category)
  order by value asc;
$function$;

grant execute on function public.community_company_facets() to anon, authenticated, service_role;
grant execute on function public.community_group_facets() to anon, authenticated, service_role;
grant execute on function public.community_event_types() to anon, authenticated, service_role;
grant execute on function public.community_notification_categories(uuid) to authenticated, service_role;
