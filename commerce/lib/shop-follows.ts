import { supabase } from '~/lib/supabase/client'

export type FollowedShopSummary = {
  id: string
  shop_name: string
  slug: string | null
  logo_url: string | null
  shop_description: string | null
  average_rating: number | null
  total_reviews: number | null
  verified: boolean
  shop_currency: string | null
  followed_at: string | null
}

const followListeners = new Set<() => void>()

export function subscribeToShopFollowChanges(listener: () => void) {
  followListeners.add(listener)
  return () => {
    followListeners.delete(listener)
  }
}

export function notifyShopFollowChanged() {
  for (const listener of followListeners) listener()
}

export async function fetchShopFollowState(
  userId: string | null | undefined,
  shopId: string | null | undefined,
): Promise<{ isFollowing: boolean; error: string | null }> {
  if (!userId || !shopId) {
    return { isFollowing: false, error: null }
  }

  const { data, error } = await supabase
    .from('shop_follows')
    .select('id')
    .eq('user_id', userId)
    .eq('shop_id', shopId)
    .eq('status', 'active')
    .maybeSingle()

  if (error) {
    return { isFollowing: false, error: error.message }
  }

  return { isFollowing: !!data, error: null }
}

export async function fetchFollowedShopIds(
  userId: string | null | undefined,
): Promise<{ ids: string[]; error: string | null }> {
  if (!userId) return { ids: [], error: null }

  const { data, error } = await supabase
    .from('shop_follows')
    .select('shop_id')
    .eq('user_id', userId)
    .eq('status', 'active')

  if (error) {
    return { ids: [], error: error.message }
  }

  const ids = (data ?? [])
    .map((row) => row.shop_id)
    .filter((value): value is string => typeof value === 'string' && value.length > 0)

  return { ids, error: null }
}

export async function fetchFollowedShops(
  userId: string | null | undefined,
  limit = 12,
): Promise<{ items: FollowedShopSummary[]; error: string | null }> {
  if (!userId) return { items: [], error: null }

  const { data: follows, error: followsError } = await supabase
    .from('shop_follows')
    .select('shop_id, updated_at')
    .eq('user_id', userId)
    .eq('status', 'active')
    .order('updated_at', { ascending: false })
    .limit(limit)

  if (followsError) {
    return { items: [], error: followsError.message }
  }

  const followRows = (follows ?? []).filter(
    (row): row is { shop_id: string; updated_at: string | null } =>
      typeof row.shop_id === 'string' && row.shop_id.length > 0,
  )
  if (!followRows.length) return { items: [], error: null }

  const followedAtById = new Map(followRows.map((row) => [row.shop_id, row.updated_at ?? null]))
  const orderedIds = followRows.map((row) => row.shop_id)

  const { data: shops, error: shopsError } = await supabase
    .from('shops')
    .select(
      'id, shop_name, slug, logo_url, shop_description, average_rating, total_reviews, verified, shop_currency',
    )
    .in('id', orderedIds)

  if (shopsError) {
    return { items: [], error: shopsError.message }
  }

  const shopById = new Map((shops ?? []).map((shop) => [shop.id, shop]))
  const items = orderedIds
    .map((shopId) => {
      const shop = shopById.get(shopId)
      if (!shop) return null
      return {
        id: shop.id,
        shop_name: shop.shop_name ?? 'Shop',
        slug: shop.slug ?? null,
        logo_url: shop.logo_url ?? null,
        shop_description: shop.shop_description ?? null,
        average_rating: shop.average_rating ?? null,
        total_reviews: shop.total_reviews ?? null,
        verified: shop.verified ?? false,
        shop_currency: shop.shop_currency ?? null,
        followed_at: followedAtById.get(shop.id) ?? null,
      } satisfies FollowedShopSummary
    })
    .filter((item): item is FollowedShopSummary => !!item)

  return { items, error: null }
}

/** Upsert an active follow; unique (user_id, shop_id) conflicts become active follows. */
export async function followShop(
  userId: string,
  shopId: string,
): Promise<{ error: string | null }> {
  const { error } = await supabase.from('shop_follows').upsert(
    {
      user_id: userId,
      shop_id: shopId,
      status: 'active',
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,shop_id' },
  )

  if (!error) notifyShopFollowChanged()
  return { error: error?.message ?? null }
}

export async function unfollowShop(
  userId: string,
  shopId: string,
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('shop_follows')
    .delete()
    .eq('user_id', userId)
    .eq('shop_id', shopId)

  if (!error) notifyShopFollowChanged()
  return { error: error?.message ?? null }
}
