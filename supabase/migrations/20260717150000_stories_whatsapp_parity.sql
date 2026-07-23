-- Baseline + WhatsApp-style story receipts, own-ring seen fix, viewers RPC,
-- and expired-story cleanup helper.

-- ---------------------------------------------------------------------------
-- Baseline schema (idempotent) for environments that lack story tables
-- ---------------------------------------------------------------------------
create table if not exists public.stories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  content text,
  media_url text,
  media_type text,
  background_color text,
  text_color text,
  font_size integer,
  privacy_level text default 'connections',
  view_count integer default 0,
  is_active boolean default true,
  expires_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.story_views (
  id uuid primary key default gen_random_uuid(),
  story_id uuid not null references public.stories(id) on delete cascade,
  viewer_id uuid not null references public.profiles(id) on delete cascade,
  viewed_at timestamptz default now()
);

create index if not exists idx_stories_user_id on public.stories (user_id);
create index if not exists idx_stories_expires_at on public.stories (expires_at);
create index if not exists idx_stories_active on public.stories (is_active);
create index if not exists idx_story_views_story_id on public.story_views (story_id);

create unique index if not exists story_views_story_id_viewer_id_key
  on public.story_views (story_id, viewer_id);

alter table public.stories enable row level security;
alter table public.story_views enable row level security;

drop policy if exists "Users can manage their own stories" on public.stories;
create policy "Users can manage their own stories"
  on public.stories
  for all
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists "Users can view public stories" on public.stories;
drop policy if exists "Users can view active stories in network" on public.stories;
create policy "Users can view active stories in network"
  on public.stories
  for select
  using (
    coalesce(is_active, false) = true
    and expires_at > now()
    and (
      privacy_level = 'public'
      or user_id = (select auth.uid())
      or (
        privacy_level = 'connections'
        and (
          user_id in (
            select f.following_id
            from public.follows f
            where f.follower_id = (select auth.uid())
              and f.status = 'active'
          )
          or exists (
            select 1
            from public.connections c
            where c.status = 'accepted'
              and (
                (c.sender_id = (select auth.uid()) and c.receiver_id = stories.user_id)
                or (c.receiver_id = (select auth.uid()) and c.sender_id = stories.user_id)
              )
          )
        )
      )
    )
  );

drop policy if exists "Users can create story views" on public.story_views;
create policy "Users can create story views"
  on public.story_views
  for insert
  to authenticated
  with check (viewer_id = (select auth.uid()));

drop policy if exists "Users can view story views" on public.story_views;
create policy "Users can view story views"
  on public.story_views
  for select
  to authenticated
  using (
    viewer_id = (select auth.uid())
    or exists (
      select 1
      from public.stories s
      where s.id = story_views.story_id
        and s.user_id = (select auth.uid())
    )
  );

-- ---------------------------------------------------------------------------
-- Increment view_count on non-self views
-- ---------------------------------------------------------------------------
create or replace function public.trg_story_views_increment_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_author uuid;
begin
  select user_id into v_author from public.stories where id = new.story_id;
  if v_author is not null and v_author is distinct from new.viewer_id then
    update public.stories
    set view_count = coalesce(view_count, 0) + 1,
        updated_at = now()
    where id = new.story_id;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_story_views_increment_count on public.story_views;
create trigger trg_story_views_increment_count
  after insert on public.story_views
  for each row
  execute function public.trg_story_views_increment_count();

-- ---------------------------------------------------------------------------
-- Own stories always count as viewed for the author (no colored "New" ring)
-- ---------------------------------------------------------------------------
create or replace function public.get_story_feed()
returns table(
  id uuid,
  user_id uuid,
  user_name text,
  user_avatar text,
  user_username text,
  content text,
  media_url text,
  media_type text,
  background_color text,
  text_color text,
  view_count integer,
  user_viewed boolean,
  created_at timestamp with time zone,
  expires_at timestamp with time zone
)
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  return query
  select
    s.id,
    s.user_id,
    coalesce(nullif(trim(p.full_name), ''), p.username, 'Member')::text as user_name,
    p.avatar_url::text as user_avatar,
    p.username::text as user_username,
    s.content::text,
    s.media_url::text,
    s.media_type::text,
    s.background_color::text,
    s.text_color::text,
    s.view_count,
    case
      when s.user_id = auth.uid() then true
      else exists(
        select 1
        from public.story_views sv
        where sv.story_id = s.id
          and sv.viewer_id = auth.uid()
      )
    end as user_viewed,
    s.created_at,
    s.expires_at
  from public.stories s
  join public.profiles p on p.id = s.user_id
  where coalesce(s.is_active, false) = true
    and s.expires_at > now()
    and coalesce(p.is_deleted, false) = false
    and (
      s.privacy_level = 'public'
      or s.user_id = auth.uid()
      or (
        s.privacy_level = 'connections'
        and (
          s.user_id in (
            select f.following_id
            from public.follows f
            where f.follower_id = auth.uid()
              and f.status = 'active'
          )
          or exists (
            select 1
            from public.connections c
            where c.status = 'accepted'
              and (
                (c.sender_id = auth.uid() and c.receiver_id = s.user_id)
                or (c.receiver_id = auth.uid() and c.sender_id = s.user_id)
              )
          )
        )
      )
    )
  order by s.created_at desc;
end;
$function$;

grant execute on function public.get_story_feed() to anon, authenticated;

create or replace function public.get_user_stories_with_views(target_user_id uuid)
returns table(
  id uuid,
  user_id uuid,
  content text,
  media_url text,
  media_type text,
  background_color text,
  text_color text,
  view_count integer,
  user_viewed boolean,
  created_at timestamp with time zone,
  expires_at timestamp with time zone
)
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  return query
  select
    s.id,
    s.user_id,
    s.content::text,
    s.media_url::text,
    s.media_type::text,
    s.background_color::text,
    s.text_color::text,
    s.view_count,
    case
      when s.user_id = auth.uid() then true
      else exists(
        select 1
        from public.story_views sv
        where sv.story_id = s.id
          and sv.viewer_id = auth.uid()
      )
    end as user_viewed,
    s.created_at,
    s.expires_at
  from public.stories s
  where s.user_id = target_user_id
    and coalesce(s.is_active, false) = true
    and s.expires_at > now()
    and (
      s.privacy_level = 'public'
      or s.user_id = auth.uid()
      or (
        s.privacy_level = 'connections'
        and (
          s.user_id in (
            select f.following_id
            from public.follows f
            where f.follower_id = auth.uid()
              and f.status = 'active'
          )
          or exists (
            select 1
            from public.connections c
            where c.status = 'accepted'
              and (
                (c.sender_id = auth.uid() and c.receiver_id = s.user_id)
                or (c.receiver_id = auth.uid() and c.sender_id = s.user_id)
              )
          )
        )
      )
    )
  order by s.created_at asc;
end;
$function$;

grant execute on function public.get_user_stories_with_views(uuid) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Author-only viewer list
-- ---------------------------------------------------------------------------
create or replace function public.get_story_viewers(p_story_id uuid)
returns table(
  viewer_id uuid,
  full_name text,
  username text,
  avatar_url text,
  viewed_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1
    from public.stories s
    where s.id = p_story_id
      and s.user_id = auth.uid()
  ) then
    raise exception 'Not authorized to view story viewers';
  end if;

  return query
  select
    sv.viewer_id,
    coalesce(nullif(trim(p.full_name), ''), p.username, 'Member')::text as full_name,
    p.username::text,
    p.avatar_url::text,
    sv.viewed_at
  from public.story_views sv
  join public.profiles p on p.id = sv.viewer_id
  where sv.story_id = p_story_id
    and sv.viewer_id is distinct from auth.uid()
    and coalesce(p.is_deleted, false) = false
  order by sv.viewed_at desc
  limit 200;
end;
$$;

grant execute on function public.get_story_viewers(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Soft-delete helper used by cleanup job (service role) / optional cron
-- Returns media URLs of stories past expiry so an edge function can purge storage.
-- ---------------------------------------------------------------------------
create or replace function public.list_expired_stories_for_cleanup(p_grace_hours integer default 24)
returns table(
  id uuid,
  media_url text
)
language sql
security definer
set search_path = public
as $$
  select s.id, s.media_url
  from public.stories s
  where s.expires_at is not null
    and s.expires_at < now() - make_interval(hours => greatest(p_grace_hours, 0));
$$;

revoke all on function public.list_expired_stories_for_cleanup(integer) from public, anon, authenticated;
grant execute on function public.list_expired_stories_for_cleanup(integer) to service_role;

create or replace function public.delete_expired_stories(p_ids uuid[])
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  deleted_count integer;
begin
  delete from public.stories
  where id = any(p_ids);
  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$$;

revoke all on function public.delete_expired_stories(uuid[]) from public, anon, authenticated;
grant execute on function public.delete_expired_stories(uuid[]) to service_role;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
       where pubname = 'supabase_realtime'
         and schemaname = 'public'
         and tablename = 'stories'
     ) then
    execute 'alter publication supabase_realtime add table public.stories';
  end if;
end $$;
