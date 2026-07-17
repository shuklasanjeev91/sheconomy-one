-- Private Supabase Storage bucket for Co-Work meeting recordings.
-- LiveKit Egress uploads here through Supabase's S3-compatible endpoint;
-- playback/download links are short-lived Supabase signed URLs.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'meeting-recordings',
  'meeting-recordings',
  false,
  null,
  array['video/mp4', 'audio/mp4', 'application/octet-stream']
)
on conflict (id) do update
set
  public = false,
  allowed_mime_types = excluded.allowed_mime_types;

-- No storage.objects policies: clients never touch this bucket directly.
-- All reads go through the meeting-recording-share Edge Function (service role),
-- and all writes come from LiveKit Egress via S3 access keys.
