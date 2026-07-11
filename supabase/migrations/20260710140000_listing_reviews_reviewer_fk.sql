-- PostgREST embed: listing_reviews.reviewer_id -> profiles.id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'listing_reviews_reviewer_id_fkey'
      AND conrelid = 'public.listing_reviews'::regclass
  ) THEN
    ALTER TABLE public.listing_reviews
      ADD CONSTRAINT listing_reviews_reviewer_id_fkey
      FOREIGN KEY (reviewer_id) REFERENCES public.profiles(id)
      ON DELETE CASCADE;
  END IF;
END $$;
