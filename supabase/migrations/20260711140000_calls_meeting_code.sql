-- Link a 1:1 call to the LiveKit meeting room that carries its audio/video.
alter table public.calls
  add column if not exists meeting_code text;
