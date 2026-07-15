import { supabase } from '~/lib/supabase/client'

/** Hide a post from the viewer’s feed. */
export async function hideCommunityPost(
  userId: string,
  postId: string,
): Promise<{ error: string | null }> {
  const { error } = await supabase.from('community_hidden_posts').upsert(
    { user_id: userId, post_id: postId },
    { onConflict: 'user_id,post_id' },
  )
  return { error: error?.message ?? null }
}

/** Report a post for review. */
export async function reportCommunityPost(
  reporterId: string,
  postId: string,
  reason = 'other',
  details?: string,
): Promise<{ error: string | null }> {
  const { error } = await supabase.from('community_post_reports').upsert(
    {
      reporter_id: reporterId,
      post_id: postId,
      reason,
      details: details ?? null,
    },
    { onConflict: 'reporter_id,post_id' },
  )
  return { error: error?.message ?? null }
}

/** Block a member (uses blocked_users). Also removes follows both ways. */
export async function blockCommunityMember(
  blockerId: string,
  blockedId: string,
): Promise<{ error: string | null }> {
  if (blockerId === blockedId) return { error: 'You cannot block yourself.' }

  const { error: blockError } = await supabase.from('blocked_users').insert({
    blocker_id: blockerId,
    blocked_id: blockedId,
  })

  if (blockError && !blockError.message.toLowerCase().includes('duplicate')) {
    return { error: blockError.message }
  }

  await supabase
    .from('connections')
    .delete()
    .or(
      `and(sender_id.eq.${blockerId},receiver_id.eq.${blockedId}),and(sender_id.eq.${blockedId},receiver_id.eq.${blockerId})`,
    )

  await supabase
    .from('follows')
    .delete()
    .or(
      `and(follower_id.eq.${blockerId},following_id.eq.${blockedId}),and(follower_id.eq.${blockedId},following_id.eq.${blockerId})`,
    )

  return { error: null }
}

/** Report a member for review. */
export async function reportCommunityMember(
  reporterId: string,
  reportedUserId: string,
  reason = 'inappropriate',
): Promise<{ error: string | null }> {
  if (reporterId === reportedUserId) return { error: 'You cannot report yourself.' }

  const { error } = await supabase.from('user_reports').insert({
    reporter_id: reporterId,
    reported_user_id: reportedUserId,
    reason,
    status: 'open',
  })

  if (error && error.message.toLowerCase().includes('duplicate')) {
    return { error: null }
  }

  return { error: error?.message ?? null }
}

/** IDs the viewer has hidden or whose authors they blocked. */
export async function fetchFeedExclusion(
  userId: string,
): Promise<{ hiddenPostIds: string[]; blockedUserIds: string[] }> {
  const [{ data: hidden }, { data: blocked }, { data: blockedBy }] = await Promise.all([
    supabase.from('community_hidden_posts').select('post_id').eq('user_id', userId),
    supabase.from('blocked_users').select('blocked_id').eq('blocker_id', userId),
    supabase.from('blocked_users').select('blocker_id').eq('blocked_id', userId),
  ])

  const blockedUserIds = [
    ...(blocked ?? []).map((row) => row.blocked_id),
    ...(blockedBy ?? []).map((row) => row.blocker_id),
  ]

  return {
    hiddenPostIds: (hidden ?? []).map((row) => row.post_id),
    blockedUserIds: [...new Set(blockedUserIds)],
  }
}
