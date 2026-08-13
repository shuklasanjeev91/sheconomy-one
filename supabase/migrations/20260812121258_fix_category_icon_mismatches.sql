-- Corrects glyphs the icon seed got wrong on the already-migrated database.
--
-- Two classes of defect:
--   * Wrong codepoint written by the seed run — U+1F951 (avocado) instead of
--     U+1FA91 (chair), and the unassigned U+1FA25 instead of U+1FAA5
--     (toothbrush), which renders as tofu on device.
--   * Substring collisions in the keyword rules: `%hair%` matched "Chairs",
--     `%tea%` matched "Teacher Resources", and the broad `%food%` rule
--     outranked `%dog%` for "Dog Food & Treats".
--
-- The seed migration has been corrected too, so a fresh database skips this.

update public.categories set category_icon = '🪑' where category_icon = '🥑';
update public.categories set category_icon = '🪥' where category_icon = U&'\+01FA25';

update public.categories set category_icon = '🪑' where category ilike '%chair%';
update public.categories set category_icon = '🎓' where category ilike '%teacher%';
update public.categories set category_icon = '🎓' where category ilike '%medical course%';
update public.categories set category_icon = '🐶' where category ilike '%dog%';
update public.categories set category_icon = '🛏️' where category ilike '%bedsheet%' or category ilike '%bed sheet%';
