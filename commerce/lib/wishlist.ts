import { supabase } from '~/lib/supabase/client'
import { buildAbsoluteUrl } from '~/lib/platform/url'

export type WishlistCollection = {
  id: string
  name: string
  createdAt: string
  shareToken?: string | null
}

export type SharedWishlistPayload = {
  ok: true
  collectionId: string
  name: string
  ownerName: string
  listingIds: string[]
  sharedAt: string | null
}

function randomShareToken(): string {
  const bytes = new Uint8Array(18)
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    crypto.getRandomValues(bytes)
  } else {
    for (let i = 0; i < bytes.length; i += 1) bytes[i] = Math.floor(Math.random() * 256)
  }
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

export async function fetchWishlistCollections(userId: string): Promise<{
  collections: WishlistCollection[]
  error: string | null
}> {
  const { data, error } = await supabase
    .from('wishlist_collections')
    .select('id, name, created_at, share_token')
    .eq('user_id', userId)
    .order('created_at', { ascending: true })

  if (error) return { collections: [], error: error.message }
  return {
    collections: (data ?? []).map((row) => ({
      id: row.id,
      name: row.name,
      createdAt: row.created_at,
      shareToken: (row as { share_token?: string | null }).share_token ?? null,
    })),
    error: null,
  }
}

export async function createWishlistCollection(
  userId: string,
  name: string,
): Promise<{ collection: WishlistCollection | null; error: string | null }> {
  const trimmed = name.trim()
  if (!trimmed) return { collection: null, error: 'Name is required' }

  const { data, error } = await supabase
    .from('wishlist_collections')
    .insert({ user_id: userId, name: trimmed })
    .select('id, name, created_at, share_token')
    .single()

  if (error) return { collection: null, error: error.message }
  return {
    collection: {
      id: data.id,
      name: data.name,
      createdAt: data.created_at,
      shareToken: (data as { share_token?: string | null }).share_token ?? null,
    },
    error: null,
  }
}

export async function fetchWishlistListingIds(userId: string): Promise<{
  listingIds: string[]
  error: string | null
}> {
  const { data, error } = await supabase
    .from('wishlists')
    .select('listing_id')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (error) {
    return { listingIds: [], error: error.message }
  }

  return { listingIds: (data ?? []).map((row) => row.listing_id), error: null }
}

export async function fetchWishlistListingIdsInCollection(
  userId: string,
  collectionId: string | null,
): Promise<{ listingIds: string[]; error: string | null }> {
  let query = supabase
    .from('wishlists')
    .select('listing_id')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (collectionId) {
    query = query.eq('collection_id', collectionId)
  } else {
    query = query.is('collection_id', null)
  }

  const { data, error } = await query
  if (error) return { listingIds: [], error: error.message }
  return { listingIds: (data ?? []).map((row) => row.listing_id), error: null }
}

export async function addWishlistItem(
  userId: string,
  listingId: string,
  collectionId?: string | null,
): Promise<{ error: string | null }> {
  const { data: existing } = await supabase
    .from('wishlists')
    .select('id')
    .eq('user_id', userId)
    .eq('listing_id', listingId)
    .maybeSingle()

  if (existing) {
    if (collectionId) {
      const { error } = await supabase
        .from('wishlists')
        .update({ collection_id: collectionId })
        .eq('id', existing.id)
      return { error: error?.message ?? null }
    }
    return { error: null }
  }

  const { error } = await supabase.from('wishlists').insert({
    user_id: userId,
    listing_id: listingId,
    collection_id: collectionId ?? null,
  })

  if (error && !error.message.toLowerCase().includes('duplicate')) {
    return { error: error.message }
  }

  return { error: null }
}

export async function moveWishlistItem(
  userId: string,
  listingId: string,
  collectionId: string | null,
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('wishlists')
    .update({ collection_id: collectionId })
    .eq('user_id', userId)
    .eq('listing_id', listingId)

  return { error: error?.message ?? null }
}

export async function removeWishlistItem(userId: string, listingId: string): Promise<{
  error: string | null
}> {
  const { error } = await supabase
    .from('wishlists')
    .delete()
    .eq('user_id', userId)
    .eq('listing_id', listingId)

  if (error) {
    return { error: error.message }
  }

  return { error: null }
}

export async function syncLocalFavoritesToWishlist(
  userId: string,
  localListingIds: string[],
): Promise<{ error: string | null }> {
  if (!localListingIds.length) return { error: null }

  for (const listingId of localListingIds) {
    const { error } = await addWishlistItem(userId, listingId)
    if (error) return { error }
  }

  return { error: null }
}

/**
 * Ensure a collection has a public share token and return the absolute share URL.
 * When collectionId is null, creates/reuses "My wishlist" and moves current listing ids into it.
 */
export async function ensureWishlistShareLink(input: {
  userId: string
  collectionId: string | null
  listingIds: string[]
}): Promise<{ shareUrl: string | null; collectionId: string | null; error: string | null }> {
  let collectionId = input.collectionId

  if (!collectionId) {
    const existing = await fetchWishlistCollections(input.userId)
    if (existing.error) return { shareUrl: null, collectionId: null, error: existing.error }
    const named =
      existing.collections.find((c) => c.name.toLowerCase() === 'my wishlist') ??
      existing.collections[0] ??
      null
    if (named) {
      collectionId = named.id
    } else {
      const created = await createWishlistCollection(input.userId, 'My wishlist')
      if (created.error || !created.collection) {
        return {
          shareUrl: null,
          collectionId: null,
          error: created.error ?? 'Could not create collection',
        }
      }
      collectionId = created.collection.id
    }

    for (const listingId of input.listingIds) {
      const moved = await addWishlistItem(input.userId, listingId, collectionId)
      if (moved.error) return { shareUrl: null, collectionId, error: moved.error }
    }
  }

  const { data: row, error: readError } = await supabase
    .from('wishlist_collections')
    .select('id, share_token')
    .eq('id', collectionId)
    .eq('user_id', input.userId)
    .maybeSingle()

  if (readError) return { shareUrl: null, collectionId, error: readError.message }
  if (!row) return { shareUrl: null, collectionId, error: 'Collection not found' }

  let token = (row as { share_token?: string | null }).share_token ?? null
  if (!token) {
    token = randomShareToken()
    const { error: updateError } = await supabase
      .from('wishlist_collections')
      .update({
        share_token: token,
        share_enabled_at: new Date().toISOString(),
      } as never)
      .eq('id', collectionId)
      .eq('user_id', input.userId)

    if (updateError) return { shareUrl: null, collectionId, error: updateError.message }
  }

  return {
    shareUrl: buildAbsoluteUrl(`/w/${encodeURIComponent(token)}`),
    collectionId,
    error: null,
  }
}

export async function resolveSharedWishlist(
  token: string,
): Promise<{ payload: SharedWishlistPayload | null; error: string | null }> {
  const trimmed = token.trim()
  if (!trimmed) return { payload: null, error: 'Missing share link' }

  const { data, error } = await supabase.rpc('resolve_wishlist_share' as never, {
    p_token: trimmed,
  } as never)

  if (error) return { payload: null, error: error.message }

  const row = data as Record<string, unknown> | null
  if (!row || row.ok !== true) {
    return {
      payload: null,
      error: typeof row?.error === 'string' ? row.error : 'Wishlist not found',
    }
  }

  const listingIds = Array.isArray(row.listingIds)
    ? row.listingIds.map((id) => String(id)).filter(Boolean)
    : []

  return {
    payload: {
      ok: true,
      collectionId: String(row.collectionId ?? ''),
      name: String(row.name ?? 'Wishlist'),
      ownerName: String(row.ownerName ?? 'A member'),
      listingIds,
      sharedAt: typeof row.sharedAt === 'string' ? row.sharedAt : null,
    },
    error: null,
  }
}
