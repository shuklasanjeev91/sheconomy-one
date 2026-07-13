-- Disappearing messages: per-conversation TTL in seconds (null = off).
alter table public.conversations
  add column if not exists disappearing_seconds integer;
