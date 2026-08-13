-- Make curated category artwork load permanently instead of expiring.
--
-- 39 category images were uploaded to `categories_media`, but the bucket was
-- private and the 94 category rows pointing at it used *signed* URLs with a
-- seven-day token (the earliest expires 2026-08-19). Once those lapse the CDN
-- returns 403, CategoryImage's onError fires, and every tile silently drops
-- back to its emoji — a failure that would have shown up a week after launch
-- with no code change to blame.
--
-- The bucket holds only marketing artwork (category_images, banner_images,
-- icons, ug_images), matching every other image bucket in the project, so the
-- fix is to publish it and rewrite the URLs to their permanent public form.

update storage.buckets
set public = true
where id = 'categories_media';

update public.categories
set category_image_url =
  split_part(replace(category_image_url, '/object/sign/', '/object/public/'), '?', 1)
where category_image_url like '%/storage/v1/object/sign/categories_media/%';
