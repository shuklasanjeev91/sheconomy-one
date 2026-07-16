-- Community groups + company pages: multi-admin (LinkedIn-style page/group admins).
--
-- 1. Normalize group_members.status approved -> active (app already writes active).
-- 2. Helper is_community_group_admin + set_community_group_member_role RPC.
-- 3. Fix group RLS so admins can edit groups and manage join requests.
-- 4. company_members table (owner/admin) + RPCs to assign/remove admins.
-- 5. Backfill company owners from companypages.created_by.

-- ---------------------------------------------------------------------------
-- 1. Normalize membership status vocabulary
-- ---------------------------------------------------------------------------
update public.group_members
set status = 'active'
where status = 'approved';

-- ---------------------------------------------------------------------------
-- 2. Group admin helpers + role RPC
-- ---------------------------------------------------------------------------
create or replace function public.is_community_group_admin(p_group_id uuid, p_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select exists (
    select 1
    from public.group_members gm
    where gm.group_id = p_group_id
      and gm.user_id = p_user_id
      and gm.role = 'admin'
      and coalesce(gm.status, 'active') = 'active'
  )
  or exists (
    select 1
    from public.groups g
    where g.id = p_group_id
      and g.created_by = p_user_id
  );
$$;

revoke all on function public.is_community_group_admin(uuid, uuid) from public;
grant execute on function public.is_community_group_admin(uuid, uuid) to authenticated;

create or replace function public.set_community_group_member_role(
  p_group_id uuid,
  p_user_id uuid,
  p_role text
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_admin_count integer;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if not public.is_community_group_admin(p_group_id, auth.uid()) then
    raise exception 'Only group admins can change roles';
  end if;

  if p_role not in ('admin', 'member') then
    raise exception 'Invalid role';
  end if;

  if p_role = 'member' then
    select count(*)::integer into v_admin_count
    from public.group_members
    where group_id = p_group_id
      and role = 'admin'
      and coalesce(status, 'active') = 'active'
      and user_id is distinct from p_user_id;

    if v_admin_count < 1 then
      raise exception 'Cannot demote the last group admin';
    end if;
  end if;

  update public.group_members
  set role = p_role
  where group_id = p_group_id
    and user_id = p_user_id
    and coalesce(status, 'active') = 'active';

  if not found then
    raise exception 'Member not found';
  end if;
end;
$$;

revoke all on function public.set_community_group_member_role(uuid, uuid, text) from public;
grant execute on function public.set_community_group_member_role(uuid, uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Group RLS: admins can update groups + manage join requests
-- ---------------------------------------------------------------------------
drop policy if exists groups_update_creator on public.groups;
create policy groups_update_admins
  on public.groups
  for update
  to authenticated
  using (public.is_community_group_admin(id, auth.uid()))
  with check (public.is_community_group_admin(id, auth.uid()));

drop policy if exists group_join_requests_select on public.group_join_requests;
create policy group_join_requests_select
  on public.group_join_requests
  for select
  to authenticated
  using (
    user_id = auth.uid()
    or public.is_community_group_admin(group_id, auth.uid())
  );

drop policy if exists group_join_requests_update_admins on public.group_join_requests;
create policy group_join_requests_update_admins
  on public.group_join_requests
  for update
  to authenticated
  using (public.is_community_group_admin(group_id, auth.uid()))
  with check (public.is_community_group_admin(group_id, auth.uid()));

drop policy if exists group_members_insert_admin on public.group_members;
create policy group_members_insert_admin
  on public.group_members
  for insert
  to authenticated
  with check (
    user_id = auth.uid()
    or public.is_community_group_admin(group_id, auth.uid())
  );

-- ---------------------------------------------------------------------------
-- 4. Company page members (owner / admin)
-- ---------------------------------------------------------------------------
create table if not exists public.company_members (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companypages (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('owner', 'admin')),
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  unique (company_id, user_id)
);

create index if not exists company_members_user_id_idx on public.company_members (user_id);
create index if not exists company_members_company_role_idx on public.company_members (company_id, role);

alter table public.company_members enable row level security;

create or replace function public.is_company_page_manager(p_company_id uuid, p_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select exists (
    select 1
    from public.company_members cm
    where cm.company_id = p_company_id
      and cm.user_id = p_user_id
      and cm.role in ('owner', 'admin')
  )
  or exists (
    select 1
    from public.companypages c
    where c.id = p_company_id
      and c.created_by = p_user_id
  );
$$;

create or replace function public.is_company_page_owner(p_company_id uuid, p_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select exists (
    select 1
    from public.company_members cm
    where cm.company_id = p_company_id
      and cm.user_id = p_user_id
      and cm.role = 'owner'
  )
  or exists (
    select 1
    from public.companypages c
    where c.id = p_company_id
      and c.created_by = p_user_id
      and not exists (
        select 1 from public.company_members cm2
        where cm2.company_id = p_company_id and cm2.role = 'owner'
      )
  );
$$;

revoke all on function public.is_company_page_manager(uuid, uuid) from public;
revoke all on function public.is_company_page_owner(uuid, uuid) from public;
grant execute on function public.is_company_page_manager(uuid, uuid) to authenticated;
grant execute on function public.is_company_page_owner(uuid, uuid) to authenticated;

drop policy if exists company_members_select on public.company_members;
create policy company_members_select
  on public.company_members
  for select
  to authenticated
  using (
    user_id = auth.uid()
    or public.is_company_page_manager(company_id, auth.uid())
  );

create or replace function public.set_company_member_role(
  p_company_id uuid,
  p_user_id uuid,
  p_role text
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if not public.is_company_page_owner(p_company_id, auth.uid()) then
    raise exception 'Only the page owner can assign admins';
  end if;

  if p_role not in ('admin', 'member') then
    raise exception 'Invalid role';
  end if;

  if p_user_id = auth.uid() then
    raise exception 'Cannot change your own owner role this way';
  end if;

  if exists (
    select 1
    from public.company_members
    where company_id = p_company_id
      and user_id = p_user_id
      and role = 'owner'
  ) then
    raise exception 'Cannot change the page owner role';
  end if;

  if p_role = 'admin' then
    insert into public.company_members (company_id, user_id, role, created_by)
    values (p_company_id, p_user_id, 'admin', auth.uid())
    on conflict (company_id, user_id) do update
      set role = 'admin';
  else
    delete from public.company_members
    where company_id = p_company_id
      and user_id = p_user_id
      and role = 'admin';
  end if;
end;
$$;

revoke all on function public.set_company_member_role(uuid, uuid, text) from public;
grant execute on function public.set_company_member_role(uuid, uuid, text) to authenticated;

create or replace function public.trg_companypages_ensure_owner_member()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if new.created_by is not null then
    insert into public.company_members (company_id, user_id, role, created_by)
    values (new.id, new.created_by, 'owner', new.created_by)
    on conflict (company_id, user_id) do update
      set role = 'owner';
  end if;
  return new;
end;
$$;

drop trigger if exists companypages_ensure_owner_member on public.companypages;
create trigger companypages_ensure_owner_member
  after insert on public.companypages
  for each row
  execute function public.trg_companypages_ensure_owner_member();

insert into public.company_members (company_id, user_id, role, created_by)
select c.id, c.created_by, 'owner', c.created_by
from public.companypages c
where c.created_by is not null
on conflict (company_id, user_id) do update
  set role = excluded.role;
