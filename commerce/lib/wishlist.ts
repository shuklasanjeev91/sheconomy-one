import { supabase } from '~/lib/supabase/client'

export type WishlistCollection = {
  id: string
  name: string
  createdAt: string
}

export async function fetchWishlistCollections(userId: string): Promise<{
  collections: WishlistCollection[]
  error: string | null
}> {
  const { data, error } = await supabase
    .from('wishlist_collections')
    .select('id, name, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: true })

  if (error) return { collections: [], error: error.message }
  return {
    collections: (data ?? []).map((row) => ({
      id: row.id,
      name: row.name,
      createdAt: row.created_at,
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
    .select('id, name, created_at')
    .single()

  if (error) return { collection: null, error: error.message }
  return {
    collection: { id: data.id, name: data.name, createdAt: data.created_at },
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
