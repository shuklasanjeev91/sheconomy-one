-- Allow LinkedIn-style reposts (`post_type = 'repost'`).
-- App insert path: community/lib/post-engagement.ts → repostPost()

DO $$
DECLARE
  v_conname text;
BEGIN
  SELECT c.conname
  INTO v_conname
  FROM pg_constraint c
  JOIN pg_class t ON t.oid = c.conrelid
  JOIN pg_namespace n ON n.oid = t.relnamespace
  WHERE n.nspname = 'public'
    AND t.relname = 'posts'
    AND c.contype = 'c'
    AND pg_get_constraintdef(c.oid) ILIKE '%post_type%'
  LIMIT 1;

  IF v_conname IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.posts DROP CONSTRAINT %I', v_conname);
  END IF;

  ALTER TABLE public.posts
    ADD CONSTRAINT posts_post_type_check CHECK (
      post_type IS NULL OR post_type::text = ANY (ARRAY[
        'post',
        'text',
        'thought',
        'poll',
        'event',
        'celebration',
        'product',
        'service',
        'group_post',
        'article',
        'repost'
      ]::text[])
    );
END $$;
