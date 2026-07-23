-- Link directory events ↔ feed event posts (LinkedIn-style create once, show everywhere).

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS post_id uuid REFERENCES public.posts(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS events_post_id_uidx
  ON public.events (post_id)
  WHERE post_id IS NOT NULL;

COMMENT ON COLUMN public.events.post_id IS
  'Optional feed post created alongside this event for social distribution.';
