-- Storefront categories view: every active category, with active-listing counts.
--
-- Supersedes 20260718153000_categories_with_counts.sql, which was never applied
-- to the live database — the app had been silently falling back to a raw
-- `categories` scan ordered by product_count. With category_assignments empty
-- (all counts are 0), that sort is a 997-way tie, so the home rail showed
-- categories in arbitrary physical row order.
--
-- Differences from the original:
--   * LEFT JOIN instead of INNER JOIN — categories without listings still
--     appear (today that is all of them, since listings.category holds legacy
--     CS-Cart ids/breadcrumbs and category_assignments has no rows).
--   * Exposes level + position so the client can order deterministically:
--     the 25 curated roots first, then subcategories.

create or replace view public.categories_with_counts
with (security_invoker = true) as
select
  c.category_id,
  c.category,
  c.category_image_url,
  c.category_icon,
  count(l.id)::integer as product_count,
  c.seo_name,
  c.level,
  c.position
from public.categories c
left join public.category_assignments ca on ca.category_id = c.category_id
left join public.listings l
  on l.id = ca.listing_id
 and l.is_active = true
 and l.listing_status = 'active'
where c.status = 'A'
  and c.category_id <> '220'
  and c.category not ilike '%without category%'
group by
  c.category_id,
  c.category,
  c.category_image_url,
  c.category_icon,
  c.seo_name,
  c.level,
  c.position;

grant select on public.categories_with_counts to anon, authenticated;
