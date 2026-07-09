import { supabase } from '~/lib/supabase/client'

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

export async function followShop(
  userId: string,
  shopId: string,
): Promise<{ error: string | null }> {
  const { isFollowing } = await fetchShopFollowState(userId, shopId)
  if (isFollowing) return { error: null }

  const { error } = await supabase.from('shop_follows').insert({
    user_id: userId,
    shop_id: shopId,
    status: 'active',
  })

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

  return { error: error?.message ?? null }
}
