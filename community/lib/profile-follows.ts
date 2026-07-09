import { supabase } from '~/lib/supabase/client'

export async function fetchProfileFollowState(
  followerId: string,
  followingId: string,
): Promise<{ isFollowing: boolean; followId: string | null }> {
  const { data } = await supabase
    .from('follows')
    .select('id')
    .eq('follower_id', followerId)
    .eq('following_id', followingId)
    .eq('status', 'active')
    .maybeSingle()

  return { isFollowing: !!data, followId: data?.id ?? null }
}

export async function followProfile(
  followerId: string,
  followingId: string,
): Promise<{ error: string | null }> {
  const { error } = await supabase.from('follows').insert({
    follower_id: followerId,
    following_id: followingId,
    status: 'active',
  })

  return { error: error?.message ?? null }
}

export async function unfollowProfile(
  followerId: string,
  followingId: string,
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('follows')
    .delete()
    .eq('follower_id', followerId)
    .eq('following_id', followingId)

  return { error: error?.message ?? null }
}
