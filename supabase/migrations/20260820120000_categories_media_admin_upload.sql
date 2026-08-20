-- Allow admins to upload/replace category artwork in the existing
-- public `categories_media` bucket (used by category_image_url).

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'categories_media',
  'categories_media',
  true,
  8388608,
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE
SET
  public = true,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "categories_media: public read" ON storage.objects;
DROP POLICY IF EXISTS "categories_media: admin upload" ON storage.objects;
DROP POLICY IF EXISTS "categories_media: admin update" ON storage.objects;
DROP POLICY IF EXISTS "categories_media: admin delete" ON storage.objects;

CREATE POLICY "categories_media: public read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'categories_media');

CREATE POLICY "categories_media: admin upload"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'categories_media' AND public.cms_get_role() = 'A');

CREATE POLICY "categories_media: admin update"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'categories_media' AND public.cms_get_role() = 'A');

CREATE POLICY "categories_media: admin delete"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'categories_media' AND public.cms_get_role() = 'A');
