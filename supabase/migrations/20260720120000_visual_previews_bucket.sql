-- Private bucket for Gemini visual try-on / view-in-space inputs and results.
-- Clients may upload to their own folder; results are returned as short-lived signed URLs.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'visual-previews',
  'visual-previews',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'image/jpg']
)
on conflict (id) do update
set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Authenticated users can upload/read/delete only under {userId}/...
drop policy if exists "visual_previews_select_own" on storage.objects;
create policy "visual_previews_select_own"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'visual-previews'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "visual_previews_insert_own" on storage.objects;
create policy "visual_previews_insert_own"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'visual-previews'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "visual_previews_update_own" on storage.objects;
create policy "visual_previews_update_own"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'visual-previews'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'visual-previews'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "visual_previews_delete_own" on storage.objects;
create policy "visual_previews_delete_own"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'visual-previews'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
