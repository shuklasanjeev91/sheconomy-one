-- Storefront categories with active-listing counts (avoids scanning all category_assignments client-side).
create or replace view public.categories_with_counts
with (security_invoker = true) as
select
  c.category_id,
  c.category,
  c.category_image_url,
  c.category_icon,
  count(ca.listing_id)::integer as product_count,
  c.seo_name
from public.categories c
inner join public.category_assignments ca on ca.category_id = c.category_id
inner join public.listings l
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
  c.seo_name;

grant select on public.categories_with_counts to anon, authenticated;
