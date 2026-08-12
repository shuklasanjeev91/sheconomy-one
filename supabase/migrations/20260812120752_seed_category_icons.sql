-- Seed `categories.category_icon` with emoji glyphs.
--
-- All 997 category rows shipped with `category_image_url`, `category_icon`,
-- `og_image` and `main_pair` empty, so every tile in the app fell back to the
-- same generic sparkle. Icons are the cheapest fix: no asset hosting, no CDN.
--
-- Three passes, each only filling rows that are still blank so hand-edits made
-- in the admin UI survive: explicit glyphs for the 25 roots, keyword matching
-- on the name, then inheritance down the parent chain.

-- 1) Roots — matched on name rather than id so the mapping stays readable.
update public.categories c
set category_icon = v.icon
from (
  values
    ('Art & Collectibles', '🖼️'),
    ('Art & Craft', '🎨'),
    ('Automotive', '🚗'),
    ('Baby & Kids', '🧸'),
    ('Bags & Travel', '👜'),
    ('Beauty & Personal Care', '💄'),
    ('Books & Stationery', '📚'),
    ('Business & Digital Services', '💼'),
    ('Courses & Workshops', '🎓'),
    ('Digital Products', '💾'),
    ('Electronics', '📱'),
    ('Events', '🎉'),
    ('Fashion', '👗'),
    ('Flowers', '💐'),
    ('Food & Beverages', '🍽️'),
    ('Gifts', '🎁'),
    ('Handmade & Artisan', '🧶'),
    ('Health & Wellness', '🌿'),
    ('Home & Living', '🏠'),
    ('Jewellery', '💍'),
    ('Memberships & Communities', '🤝'),
    ('Pets', '🐾'),
    ('Services', '🛠️'),
    ('Stationery & Office', '✏️'),
    ('Toys & Games', '🧩')
) as v(category, icon)
where c.level = 0
  and c.category = v.category
  and nullif(trim(c.category_icon), '') is null;

-- 2) Keyword rules. Lowest priority number wins, so specific patterns are
--    listed above the broad ones they would otherwise be swallowed by
--    (e.g. `carpet` before `pet`, `footwear` before `wear`).
with rules(priority, pattern, icon) as (
  values
    -- Guards: real words that contain a broader rule's keyword as a substring
    -- ("chair" holds "hair", "teacher" holds "tea"). These must sort first.
    (5, '%chair%', '🪑'),
    (5, '%teacher%', '🎓'),
    (5, '%medical course%', '🎓'),
    (5, '%dog%', '🐶'),

    -- Spiritual / traditional
    (10, '%rudraksha%', '📿'),
    (10, '%pooja%', '🪔'),
    (10, '%spiritual%', '🪔'),
    (10, '%astrolog%', '🔮'),
    (12, '%saree%', '🥻'),
    (12, '%ethnic%', '🥻'),
    (12, '%bindi%', '💠'),

    -- Beauty & personal care
    (20, '%skincare%', '🧴'),
    (20, '%skin care%', '🧴'),
    (20, '%makeup%', '💄'),
    (20, '%lip care%', '💋'),
    (20, '%nail%', '💅'),
    (20, '%hair%', '💇'),
    (20, '%fragrance%', '🌸'),
    (20, '%perfume%', '🌸'),
    (20, '%essential oil%', '🌿'),
    (20, '%bath%', '🛁'),
    (20, '%soap%', '🧼'),
    (20, '%body care%', '🧴'),
    (20, '%oral care%', '🪥'),
    (20, '%sun care%', '☀️'),
    (20, '%feminine hygiene%', '🌸'),
    (20, '%intimate care%', '🌸'),
    (22, '%beauty%', '💄'),

    -- Food & beverages
    (30, '%drinkware%', '🥤'),
    (30, '%tableware%', '🍽️'),
    (30, '%chocolate%', '🍫'),
    (30, '%confectioner%', '🍬'),
    (30, '%bakery%', '🍰'),
    (30, '%coffee%', '☕'),
    (30, '%tea%', '🍵'),
    (30, '%salt%', '🧂'),
    (30, '%season%', '🧂'),
    (30, '%spice%', '🌶️'),
    (30, '%pickle%', '🥒'),
    (30, '%chutney%', '🥒'),
    (30, '%sweeten%', '🍯'),
    (30, '%honey%', '🍯'),
    (30, '%grain%', '🌾'),
    (30, '%staple%', '🌾'),
    (30, '%pulses%', '🫘'),
    (30, '%lentil%', '🫘'),
    (30, '%dairy%', '🥛'),
    (30, '%ready to eat%', '🍱'),
    (30, '%ready to cook%', '🍲'),
    (30, '%snack%', '🍿'),
    (30, '%spread%', '🥜'),
    (32, '%beverage%', '🥤'),
    (32, '%drink%', '🥤'),
    (32, '%food%', '🍽️'),

    -- Health & wellness
    (40, '%ayurved%', '🌿'),
    (40, '%herbal%', '🌿'),
    (40, '%protein%', '💪'),
    (40, '%fitness%', '💪'),
    (40, '%supplement%', '💊'),
    (40, '%medicine%', '💊'),
    (40, '%remed%', '💊'),
    (40, '%medical%', '🩺'),
    (40, '%weight management%', '⚖️'),
    (40, '%smoking cessation%', '🚭'),
    (40, '%water purifier%', '💧'),
    (40, '%yoga%', '🧘'),
    (42, '%wellness%', '🧘'),
    (42, '%nutrition%', '🥗'),
    (42, '%health%', '🌿'),

    -- Fashion
    (50, '%footwear%', '👠'),
    (50, '%shoe%', '👟'),
    (50, '%sandal%', '👡'),
    (50, '%handbag%', '👜'),
    (50, '%wallet%', '👛'),
    (50, '%luggage%', '🧳'),
    (50, '%watch%', '⌚'),
    (50, '%eyewear%', '👓'),
    (50, '%sunglass%', '👓'),
    (50, '%activewear%', '🏃'),
    (50, '%sleepwear%', '🛌'),
    (50, '%lingerie%', '🩱'),
    (50, '%scarf%', '🧣'),
    (50, '%fabric%', '🧵'),
    (52, '%bag%', '👜'),
    (52, '%clothing%', '👗'),
    (52, '%apparel%', '👗'),
    (52, '%wear%', '👗'),

    -- Jewellery
    (60, '%necklace%', '📿'),
    (60, '%bracelet%', '📿'),
    (60, '%bangle%', '📿'),
    (60, '%earring%', '💎'),
    (60, '%gemstone%', '💎'),
    (62, '%jewell%', '💍'),
    (62, '%jewel%', '💍'),

    -- Home & living
    (70, '%carpet%', '🧶'),
    (70, '%rug%', '🧶'),
    (70, '%furniture%', '🪑'),
    (70, '%bedding%', '🛏️'),
    (70, '%bedsheet%', '🛏️'),
    (70, '%bed sheet%', '🛏️'),
    (70, '%lighting%', '💡'),
    (70, '%candle%', '🕯️'),
    (70, '%wall art%', '🖼️'),
    (70, '%wall decor%', '🖼️'),
    (70, '%wall décor%', '🖼️'),
    (70, '%home decor%', '🏠'),
    (70, '%home décor%', '🏠'),
    (70, '%office decor%', '🏢'),
    (70, '%kitchen%', '🍳'),
    (70, '%dining%', '🍽️'),
    (70, '%laundry%', '🧺'),
    (70, '%furnishing%', '🛋️'),
    (70, '%planter%', '🪴'),
    (70, '%garden%', '🌱'),
    (70, '%plant%', '🪴'),
    (70, '%bouquet%', '💐'),
    (70, '%flower%', '💐'),
    (72, '%storage%', '📦'),
    (72, '%organiz%', '📦'),

    -- Books, stationery & office
    (80, '%notebook%', '📓'),
    (80, '%journal%', '📓'),
    (80, '%diar%', '📔'),
    (80, '%bookmark%', '🔖'),
    (80, '%sticker%', '✨'),
    (80, '%school%', '🎒'),
    (80, '%stationery%', '✏️'),
    (82, '%book%', '📖'),
    (82, '%office%', '📎'),

    -- Toys, games & kids
    (90, '%board game%', '🎲'),
    (90, '%puzzle%', '🧩'),
    (90, '%soft toy%', '🧸'),
    (90, '%doll%', '🪆'),
    (90, '%outdoor play%', '🛝'),
    (90, '%baby%', '👶'),
    (92, '%toy%', '🧸'),
    (92, '%kids%', '🧒'),
    (92, '%children%', '🧒'),

    -- Art, craft & handmade
    (100, '%crochet%', '🧶'),
    (100, '%knit%', '🧶'),
    (100, '%sewing%', '🧵'),
    (100, '%paint%', '🖌️'),
    (100, '%artwork%', '🖼️'),
    (100, '%collectible%', '🏺'),
    (100, '%keepsake%', '🏺'),
    (100, '%handmade%', '🧶'),
    (102, '%craft%', '🎨'),
    (102, 'art%', '🎨'),
    (102, '% art%', '🎨'),

    -- Digital, learning & services
    (110, '%online course%', '🎓'),
    (110, '%course%', '🎓'),
    (110, '%learning%', '🎓'),
    (110, '%education%', '🎓'),
    (110, '%training%', '🎓'),
    (110, '%coaching%', '🧑‍🏫'),
    (110, '%software%', '💻'),
    (110, '%template%', '🗂️'),
    (110, '%photograph%', '📷'),
    (110, '%marketing%', '📣'),
    (110, '%recruit%', '🧑‍💼'),
    (110, '%consult%', '💼'),
    (110, '%franchise%', '🏪'),
    (110, '%membership%', '🤝'),
    (112, '%digital%', '💾'),
    (112, '%technology%', '💻'),
    (112, '%business%', '💼'),
    (112, '%service%', '🛠️'),

    -- Electronics
    (120, '%mobile%', '📱'),
    (120, '%laptop%', '💻'),
    (120, '%audio%', '🎧'),
    (120, '%appliance%', '🔌'),

    -- Automotive & travel
    (130, '%car care%', '🚗'),
    (130, '%bike%', '🚲'),
    (130, '%automotive%', '🚗'),
    (130, '%travel%', '✈️'),
    (130, '%tour%', '🗺️'),

    -- Pets
    (140, '%pet suppl%', '🐾'),

    -- Gifts & occasions
    (150, '%hamper%', '🧺'),
    (150, '%personalized%', '✨'),
    (150, '%personalised%', '✨'),
    (150, '%festival%', '🎊'),
    (150, '%occasion%', '🎊'),
    (150, '%keychain%', '🔑'),
    (152, '%gift%', '🎁'),
    (152, '%event%', '🎉'),
    (152, '%accessor%', '✨')
),
matched as (
  select c.category_id, r.icon
  from public.categories c
  cross join lateral (
    select rr.icon
    from rules rr
    where c.category ilike rr.pattern
    order by rr.priority, rr.pattern
    limit 1
  ) r
  where nullif(trim(c.category_icon), '') is null
)
update public.categories c
set category_icon = m.icon
from matched m
where c.category_id = m.category_id;

-- 3) Anything still blank inherits its parent's glyph. The tree is three deep,
--    so three passes carry a root icon all the way to the leaves.
do $$
begin
  for i in 1..3 loop
    update public.categories c
    set category_icon = p.category_icon
    from public.categories p
    where c.parent_id = p.category_id
      and nullif(trim(c.category_icon), '') is null
      and nullif(trim(p.category_icon), '') is not null;
  end loop;
end $$;

-- 4) Orphans with no parent and no keyword hit.
update public.categories
set category_icon = '🛍️'
where nullif(trim(category_icon), '') is null;
