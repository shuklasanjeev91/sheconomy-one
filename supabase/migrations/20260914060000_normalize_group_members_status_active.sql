-- Every application write sets status = 'active', but the column default was
-- 'approved', so any insert that omitted status produced a row that all the
-- membership checks (which test for 'active') read as "not a member" —
-- surfacing a "Join" button to people who were already in the group.
alter table public.group_members alter column status set default 'active';

update public.group_members set status = 'active' where status = 'approved';
