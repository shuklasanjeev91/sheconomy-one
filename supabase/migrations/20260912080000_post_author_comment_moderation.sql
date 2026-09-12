-- Let post authors delete comments on their own posts.
--
-- The existing DELETE policies only match `auth.uid() = user_id`, so a post
-- author could not remove spam or abuse left under their post — the comment
-- author was the only person able to delete it. Policies are permissive and
-- OR'd together, so this adds post-author moderation without widening who can
-- delete their own comments. Replies cascade via comments_parent_comment_id_fkey.

drop policy if exists "post authors delete comments on their posts" on public.comments;

create policy "post authors delete comments on their posts"
  on public.comments
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.posts p
      where p.id = comments.post_id
        and p.user_id = auth.uid()
    )
  );
