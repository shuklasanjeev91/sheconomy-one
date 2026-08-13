-- Give categories a representative product photo, Myntra-style.
--
-- There are 8,345 real listing images on the CDN but `category_assignments` is
-- empty, so nothing links a listing to a category. Instead we match on listing
-- titles, which are descriptive enough ("Beige & Blue Bengal Handloom Cotton
-- Saree", "Plum Cake", "AMLA Capsule") to pick a plausible cover image.
--
-- Two passes, both skipping rows that already have an image so an admin upload
-- always wins. Deliberately no inheritance pass: a parent's photo repeated
-- across a dozen children reads as a rendering bug in the rail, whereas the
-- emoji fallback stays distinct per category.
--
-- Matching notes:
--   * `\m` anchors the term to a word start, so `ring` no longer matches
--     "Soaring Souls" and `craft` no longer matches "Handcrafted Tea".
--   * No trailing `\M`, so a singular term still matches its plural.
--   * Shortest title wins — "Painting" is a better cover than a 200-character
--     SEO-stuffed title, and width >= 400 filters out thumbnail-sized icons.

-- 1) Roots. Their names ("Home & Living") never appear in a product title, so
--    each maps to a set of representative product nouns instead.
with rules(category, rx) as (
  values
    ('Art & Collectibles', '\m(painting|paintings|artwork|sketch|wall.hanging)'),
    ('Art & Craft', '\m(craft kit|colouring|coloring|macrame|applique)'),
    ('Automotive', '\m(car|bike|automotive)'),
    ('Baby & Kids', '\m(baby|kids|kid|infant|toddler)'),
    ('Bags & Travel', '\m(bag|bags|tote|pouch|backpack|luggage)'),
    ('Beauty & Personal Care', '\m(moisturiser|serum|lipstick|scrub|facewash|skincare|shampoo)'),
    ('Books & Stationery', '\m(book|books|journal|notebook|diary|bookmark)'),
    ('Business & Digital Services', '\m(consulting|consultation|branding|marketing)'),
    ('Courses & Workshops', '\m(course|courses|workshop|classes|training)'),
    ('Digital Products', '\m(template|templates|ebook|printable|preset)'),
    ('Electronics', '\m(speaker|charger|earphones|headphones)'),
    ('Events', '\m(party|events|invitation|bunting)'),
    ('Fashion', '\m(saree|sarees|kurta|dress|stole|dupatta|blouse)'),
    ('Flowers', '\m(bouquet|bouquets|floral)'),
    ('Food & Beverages', '\m(cake|cookies|chocolate|noodles|pickle|masala)'),
    ('Gifts', '\m(gift|gifts|hamper|hampers)'),
    ('Handmade & Artisan', '\m(handloom|handwoven|macrame|terracotta|crochet)'),
    ('Health & Wellness', '\m(tablet|tablets|capsule|capsules|ayurvedic|herbal)'),
    ('Home & Living', '\m(cushion|bedsheet|bedcover|planter|candle|candles|vase)'),
    ('Jewellery', '\m(necklace|earrings|earring|bangles|bracelet|jewellery)'),
    ('Memberships & Communities', '\m(membership|community|club)'),
    ('Pets', '\m(pet|pets|puppy|kitten)'),
    ('Services', '\m(service|services|session)'),
    ('Stationery & Office', '\m(pen|pens|stationery|planner)'),
    ('Toys & Games', '\m(toy|toys|puzzle|puzzles|board game|doll)')
),
root_pick as (
  select c.category_id, img.image_url
  from public.categories c
  join rules r on r.category = c.category
  cross join lateral (
    select li.image_url
    from public.listings l
    join public.listing_images li on li.listing_id = l.id and li.is_primary
    where l.is_active
      and l.listing_status = 'active'
      and li.image_url is not null
      and coalesce(li.width, 0) >= 400
      and l.title ~* r.rx
    order by length(l.title) asc
    limit 1
  ) img
  where c.level = 0
    and c.status = 'A'
    and nullif(trim(c.category_image_url), '') is null
)
update public.categories c
set category_image_url = p.image_url
from root_pick p
where c.category_id = p.category_id;

-- 2) Everything else matches on its own name, singularised so "Sarees" finds
--    "saree". Terms shorter than four characters are too collision-prone.
with term as (
  select
    category_id,
    regexp_replace(
      regexp_replace(lower(trim(regexp_replace(category, '^.*[>/]', ''))), '[^a-z0-9 ]', '', 'g'),
      's$', ''
    ) as singular
  from public.categories
  where status = 'A'
    and nullif(trim(category_image_url), '') is null
),
name_pick as (
  select t.category_id, img.image_url
  from term t
  cross join lateral (
    select li.image_url
    from public.listings l
    join public.listing_images li on li.listing_id = l.id and li.is_primary
    where l.is_active
      and l.listing_status = 'active'
      and li.image_url is not null
      and coalesce(li.width, 0) >= 400
      and l.title ~* ('\m' || t.singular)
    order by length(l.title) asc
    limit 1
  ) img
  where length(t.singular) >= 4
)
update public.categories c
set category_image_url = p.image_url
from name_pick p
where c.category_id = p.category_id;
