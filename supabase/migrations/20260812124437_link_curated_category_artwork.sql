-- Point categories at their curated artwork, overriding auto-picked photos.
--
-- `categories_media/category_images/` holds 29 designed covers named after the
-- categories they belong to, but only 12 were wired up — the rest of the roots
-- were still showing a product photo auto-picked from listing titles. Curated
-- art always wins, so this overwrites rather than filling blanks.
--
-- Object names carry spaces and ampersands. Only the space needs escaping in a
-- path segment; `&` is already path-safe (verified: all four sample URLs return
-- 200 image/png).

update public.categories c
set category_image_url =
  'https://zsaqrrzwygzwrlzgymxk.supabase.co/storage/v1/object/public/categories_media/'
  || replace(o.name, ' ', '%20')
from storage.objects o
where o.bucket_id = 'categories_media'
  and o.name like 'category_images/%'
  and c.status = 'A'
  and lower(c.category) = lower(
    regexp_replace(regexp_replace(o.name, '^category_images/', ''), '\.(png|jpg|jpeg|webp)$', '')
  );

-- The curated set predates a taxonomy rename, so one cover is filed under the
-- old name. The other stale names (Grocery, Kids & Baby, Software & Apps,
-- Home & Living-2, Bags & Accessories, Education) all duplicate a cover that
-- already matches exactly, so they are intentionally left unused.
update public.categories
set category_image_url =
  'https://zsaqrrzwygzwrlzgymxk.supabase.co/storage/v1/object/public/categories_media/category_images/Books%20&%20Learning.png'
where status = 'A'
  and level = 0
  and category = 'Books & Stationery';
