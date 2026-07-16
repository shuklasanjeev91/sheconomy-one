-- Phase 4: geo metadata on buyer addresses (lat/lng, Places id, capture source).

ALTER TABLE public.addresses
  ADD COLUMN IF NOT EXISTS latitude double precision,
  ADD COLUMN IF NOT EXISTS longitude double precision,
  ADD COLUMN IF NOT EXISTS place_id text,
  ADD COLUMN IF NOT EXISTS source text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'addresses_source_check'
  ) THEN
    ALTER TABLE public.addresses
      ADD CONSTRAINT addresses_source_check
      CHECK (
        source IS NULL
        OR source IN ('manual', 'places', 'current_location', 'map')
      );
  END IF;
END $$;

COMMENT ON COLUMN public.addresses.latitude IS 'WGS84 latitude from Places, map pin, or device location.';
COMMENT ON COLUMN public.addresses.longitude IS 'WGS84 longitude from Places, map pin, or device location.';
COMMENT ON COLUMN public.addresses.place_id IS 'Google Places place_id when resolved via autocomplete.';
COMMENT ON COLUMN public.addresses.source IS 'How the address was captured: manual | places | current_location | map.';
