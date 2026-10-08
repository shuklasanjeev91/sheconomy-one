-- Add emoji reaction types to comment likes while preserving existing likes.
alter table public.comment_likes
  add column if not exists reaction_type text not null default 'like';

alter table public.comment_likes
  drop constraint if exists comment_likes_reaction_type_check;

alter table public.comment_likes
  add constraint comment_likes_reaction_type_check
  check (
    reaction_type in (
      'like',
      'celebrate',
      'love',
      'insightful',
      'funny',
      'support',
      'empower',
      'together',
      'inspire',
      'proud'
    )
  );
