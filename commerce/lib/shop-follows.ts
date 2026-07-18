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
