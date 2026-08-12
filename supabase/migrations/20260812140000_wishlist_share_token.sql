-- Shareable wishlist collections (public read via token RPC).

ALTER TABLE public.wishlist_collections
  ADD COLUMN IF NOT EXISTS share_token text,
  ADD COLUMN IF NOT EXISTS share_enabled_at timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS wishlist_collections_share_token_uidx
  ON public.wishlist_collections (share_token)
  WHERE share_token IS NOT NULL;

COMMENT ON COLUMN public.wishlist_collections.share_token IS
  'Opaque public token for /w/:token share links. Null means not shared.';

CREATE OR REPLACE FUNCTION public.resolve_wishlist_share(p_token text)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_token text := nullif(trim(p_token), '');
  v_collection public.wishlist_collections%ROWTYPE;
  v_listing_ids uuid[];
  v_owner_name text;
BEGIN
  IF v_token IS NULL OR char_length(v_token) < 16 THEN
    RETURN json_build_object('ok', false, 'error', 'invalid_token');
  END IF;

  SELECT *
  INTO v_collection
  FROM public.wishlist_collections
  WHERE share_token = v_token
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN json_build_object('ok', false, 'error', 'not_found');
  END IF;

  SELECT coalesce(array_agg(w.listing_id ORDER BY w.created_at DESC), '{}'::uuid[])
  INTO v_listing_ids
  FROM public.wishlists w
  WHERE w.collection_id = v_collection.id;

  SELECT coalesce(nullif(trim(p.full_name), ''), nullif(trim(p.username), ''), 'A member')
  INTO v_owner_name
  FROM public.profiles p
  WHERE p.id = v_collection.user_id;

  RETURN json_build_object(
    'ok', true,
    'collectionId', v_collection.id,
    'name', v_collection.name,
    'ownerName', coalesce(v_owner_name, 'A member'),
    'listingIds', to_json(v_listing_ids),
    'sharedAt', v_collection.share_enabled_at
  );
END;
$$;

REVOKE ALL ON FUNCTION public.resolve_wishlist_share(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resolve_wishlist_share(text) TO anon, authenticated;

COMMENT ON FUNCTION public.resolve_wishlist_share(text) IS
  'Public resolver for shared wishlist collections by share_token.';
