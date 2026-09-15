-- Standardize meeting codes on a single shape: 9 unseparated characters.
--
-- Codes were being minted in two shapes. The RPC produced `ABC-DEF-GHI` while
-- the client fallback produced `ABCDEFGHI`, and the rest of the app (share
-- URLs, recent-code chips, typed input) strips separators before looking a
-- code up. Both generators now emit the plain 9-character form; the dashed
-- rows already in the table keep working through the variant lookup.

CREATE OR REPLACE FUNCTION public.generate_meeting_code()
  RETURNS text
  LANGUAGE plpgsql
  SET search_path = public, pg_temp
AS $function$
DECLARE
  -- I, O, 0 and 1 are omitted: these codes get read aloud and retyped.
  chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  candidate TEXT;
  i INTEGER;
  attempt INTEGER;
BEGIN
  FOR attempt IN 1..20 LOOP
    candidate := '';
    FOR i IN 1..9 LOOP
      candidate := candidate || substr(chars, floor(random() * length(chars) + 1)::int, 1);
    END LOOP;

    -- Compare against the normalized form so a new plain code can never
    -- collide with an existing dashed one.
    IF NOT EXISTS (
      SELECT 1
      FROM public.meetings
      WHERE upper(regexp_replace(meeting_code, '[^a-zA-Z0-9]', '', 'g')) = candidate
    ) THEN
      RETURN candidate;
    END IF;
  END LOOP;

  RAISE EXCEPTION 'generate_meeting_code: no unused code found after 20 attempts';
END;
$function$;

-- The existing unique index covers the raw string, which still lets
-- `ABC-DEF-GHI` and `ABCDEFGHI` coexist and resolve to each other. Enforce
-- uniqueness on the normalized form so a code always names one meeting.
CREATE UNIQUE INDEX IF NOT EXISTS meetings_meeting_code_normalized_key
  ON public.meetings (upper(regexp_replace(meeting_code, '[^a-zA-Z0-9]', '', 'g')));
