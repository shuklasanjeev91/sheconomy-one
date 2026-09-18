-- Host is never blocked by meeting capacity (Zoom-like: host always gets in).
-- Guests still hit MEETING_FULL when admitted count >= max_participants.

CREATE OR REPLACE FUNCTION public.enforce_meeting_capacity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cap integer;
  admitted_count integer;
  meeting_host uuid;
BEGIN
  IF NEW.status IS DISTINCT FROM 'admitted' THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.status = 'admitted' THEN
    RETURN NEW;
  END IF;

  SELECT host_id, coalesce(max_participants, 100)
  INTO meeting_host, cap
  FROM public.meetings
  WHERE id = NEW.meeting_id;

  -- Host always admitted (and can reopen after leave).
  IF meeting_host IS NOT NULL AND NEW.user_id = meeting_host THEN
    RETURN NEW;
  END IF;

  SELECT count(*)::integer INTO admitted_count
  FROM public.meeting_participants
  WHERE meeting_id = NEW.meeting_id
    AND status = 'admitted'
    AND id IS DISTINCT FROM NEW.id;

  IF admitted_count >= cap THEN
    RAISE EXCEPTION 'MEETING_FULL';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_meeting_capacity ON public.meeting_participants;
CREATE TRIGGER trg_enforce_meeting_capacity
  BEFORE INSERT OR UPDATE OF status ON public.meeting_participants
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_meeting_capacity();
