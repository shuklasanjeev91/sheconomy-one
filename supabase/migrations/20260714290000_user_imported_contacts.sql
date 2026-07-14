-- Privacy-safe contact import: only user-selected rows, with consent timestamp.
CREATE TABLE IF NOT EXISTS public.user_imported_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  display_name text NOT NULL,
  phone_numbers text[] NOT NULL DEFAULT '{}',
  emails text[] NOT NULL DEFAULT '{}',
  consent boolean NOT NULL DEFAULT true,
  consented_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_imported_contacts_user
  ON public.user_imported_contacts (user_id);

ALTER TABLE public.user_imported_contacts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS user_imported_contacts_own ON public.user_imported_contacts;
CREATE POLICY user_imported_contacts_own ON public.user_imported_contacts
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

COMMENT ON TABLE public.user_imported_contacts IS
  'Contacts explicitly selected and consented by the user. Never store full address books.';
