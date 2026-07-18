-- Stories were inserted with privacy_level='connections', but SELECT RLS only
-- allowed public/own — so network (and often the strip after stale fetch) never
-- saw them. Align visibility with get_status_feed and add SECURITY DEFINER RPCs.

drop policy if exists "Users can view public stories" on public.stories;

create policy "Users can view active stories in network"
  on public.stories
  for select
  using (
    coalesce(is_active, false) = true
    and expires_at > now()
    and (
      privacy_level = 'public'
      or user_id = auth.uid()
      or (
        privacy_level = 'connections'
        and (
          user_id in (
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
                (c.sender_id = auth.uid() and c.receiver_id = stories.user_id)
                or (c.receiver_id = auth.uid() and c.sender_id = stories.user_id)
              )
          )
        )
      )
    )
  );

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
    exists(
      select 1
      from public.story_views sv
      where sv.story_id = s.id
        and sv.viewer_id = auth.uid()
    ) as user_viewed,
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
    exists(
      select 1
      from public.story_views sv
      where sv.story_id = s.id
        and sv.viewer_id = auth.uid()
    ) as user_viewed,
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
