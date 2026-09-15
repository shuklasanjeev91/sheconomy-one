CREATE TABLE IF NOT EXISTS public.virtual_backgrounds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  image_url text NOT NULL,
  blur_enabled boolean DEFAULT false,
  is_default boolean DEFAULT false,
  background_type text NOT NULL DEFAULT 'image'
    CHECK (background_type IN ('image', 'blur', 'solid_color')),
  solid_color text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.virtual_backgrounds ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS virtual_backgrounds_select ON public.virtual_backgrounds;
CREATE POLICY virtual_backgrounds_select ON public.virtual_backgrounds
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR user_id IS NULL);

DROP POLICY IF EXISTS virtual_backgrounds_insert ON public.virtual_backgrounds;
CREATE POLICY virtual_backgrounds_insert ON public.virtual_backgrounds
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS virtual_backgrounds_update ON public.virtual_backgrounds;
CREATE POLICY virtual_backgrounds_update ON public.virtual_backgrounds
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS virtual_backgrounds_delete ON public.virtual_backgrounds;
CREATE POLICY virtual_backgrounds_delete ON public.virtual_backgrounds
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS virtual_backgrounds_user_created_idx
  ON public.virtual_backgrounds (user_id, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS virtual_backgrounds_one_default_per_user
  ON public.virtual_backgrounds (user_id)
  WHERE is_default IS TRUE;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'meeting-backgrounds',
  'meeting-backgrounds',
  false,
  8388608,
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "meeting_backgrounds_select_own" ON storage.objects;
CREATE POLICY "meeting_backgrounds_select_own"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'meeting-backgrounds'
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
  );

DROP POLICY IF EXISTS "meeting_backgrounds_insert_own" ON storage.objects;
CREATE POLICY "meeting_backgrounds_insert_own"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'meeting-backgrounds'
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
  );

DROP POLICY IF EXISTS "meeting_backgrounds_update_own" ON storage.objects;
CREATE POLICY "meeting_backgrounds_update_own"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'meeting-backgrounds'
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
  )
  WITH CHECK (
    bucket_id = 'meeting-backgrounds'
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
  );

DROP POLICY IF EXISTS "meeting_backgrounds_delete_own" ON storage.objects;
CREATE POLICY "meeting_backgrounds_delete_own"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'meeting-backgrounds'
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
  );
