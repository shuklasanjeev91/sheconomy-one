-- Normalize companypages.page_slug into clean, URL-safe, unique slugs.
--
-- Slugs were user-entered and often contained spaces, slashes and full
-- addresses (e.g. "sheconomy.in/page/glamgorakhpur"), which broke URL routing.
-- Navigation now resolves companies by id, but this tidies page_slug so share
-- links read nicely. Slugs are derived from the company name; collisions get a
-- short id suffix to stay unique.

with base as (
  select
    id,
    nullif(
      trim(both '-' from regexp_replace(lower(coalesce(name, '')), '[^a-z0-9]+', '-', 'g')),
      ''
    ) as base_slug
  from public.companypages
),
numbered as (
  select
    id,
    coalesce(base_slug, 'page') as base_slug,
    row_number() over (
      partition by coalesce(base_slug, 'page')
      order by id
    ) as rn
  from base
)
update public.companypages c
set page_slug = case
  when n.rn = 1 then n.base_slug
  else n.base_slug || '-' || left(c.id::text, 8)
end
from numbered n
where c.id = n.id;
