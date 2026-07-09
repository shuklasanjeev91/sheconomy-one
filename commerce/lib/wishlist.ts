import { supabase } from '~/lib/supabase/client'

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

export async function addWishlistItem(userId: string, listingId: string): Promise<{
  error: string | null
}> {
  const { data: existing } = await supabase
    .from('wishlists')
    .select('id')
    .eq('user_id', userId)
    .eq('listing_id', listingId)
    .maybeSingle()

  if (existing) return { error: null }

  const { error } = await supabase.from('wishlists').insert({
    user_id: userId,
    listing_id: listingId,
  })

  if (error && !error.message.toLowerCase().includes('duplicate')) {
    return { error: error.message }
  }

  return { error: null }
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
