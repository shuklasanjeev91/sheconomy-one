-- Fix get_post_comments_threaded runtime type mismatch.
--
-- The function declares `author_name text`, but comments_with_stats.author_name
-- is `character varying(100)`. Postgres raises
--   "structure of query does not match function result type ... column 9"
-- whenever the function tries to return rows, so the client's comment fetch
-- always errored and the comment list rendered empty (even though the post
-- showed a non-zero comment count). Casting author_name to text fixes it.

create or replace function public.get_post_comments_threaded(
  post_id_param uuid,
  limit_param integer default 20,
  offset_param integer default 0
)
returns table(
  id uuid,
  post_id uuid,
  user_id uuid,
  parent_comment_id uuid,
  content text,
  thread_level integer,
  created_at timestamptz,
  updated_at timestamptz,
  author_name text,
  author_avatar text,
  author_headline text,
  total_likes bigint,
  reply_count integer
)
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  return query
  select
    c.id,
    c.post_id,
    c.user_id,
    c.parent_comment_id,
    c.content,
    c.thread_level,
    c.created_at,
    c.updated_at,
    c.author_name::text,
    c.author_avatar,
    c.author_headline,
    c.total_likes,
    c.reply_count
  from comments_with_stats c
  where c.post_id = post_id_param
  order by c.created_at asc
  limit limit_param
  offset offset_param;
end;
$function$;
