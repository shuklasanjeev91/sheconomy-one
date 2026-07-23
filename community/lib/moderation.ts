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
  invalidateFeedExclusionCache()
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

  invalidateFeedExclusionCache()
  return { error: null }
}

/** Unblock a member previously blocked by the viewer. */
export async function unblockCommunityMember(
  blockerId: string,
  blockedId: string,
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('blocked_users')
    .delete()
    .eq('blocker_id', blockerId)
    .eq('blocked_id', blockedId)

  invalidateFeedExclusionCache()
  return { error: error?.message ?? null }
}

export type BlockedMember = {
  id: string
  blockedId: string
  createdAt: string
  fullName: string | null
  username: string | null
  avatarUrl: string | null
}

/** List members the viewer has blocked, with profile context for settings UI. */
export async function listBlockedMembers(blockerId: string): Promise<{
  members: BlockedMember[]
  error: string | null
}> {
  const { data, error } = await supabase
    .from('blocked_users')
    .select(
      'id, blocked_id, created_at, profile:profiles!blocked_users_blocked_id_fkey(id, full_name, username, avatar_url)',
    )
    .eq('blocker_id', blockerId)
    .order('created_at', { ascending: false })

  if (error) {
    // Fallback without join if the FK alias differs across environments.
    const fallback = await supabase
      .from('blocked_users')
      .select('id, blocked_id, created_at')
      .eq('blocker_id', blockerId)
      .order('created_at', { ascending: false })

    if (fallback.error) {
      return { members: [], error: fallback.error.message }
    }

    const ids = (fallback.data ?? []).map((row) => row.blocked_id)
    const profiles =
      ids.length === 0
        ? []
        : (
            await supabase
              .from('profiles')
              .select('id, full_name, username, avatar_url')
              .in('id', ids)
          ).data ?? []

    const byId = new Map(profiles.map((p) => [p.id, p]))
    return {
      members: (fallback.data ?? []).map((row) => {
        const profile = byId.get(row.blocked_id)
        return {
          id: row.id,
          blockedId: row.blocked_id,
          createdAt: row.created_at,
          fullName: profile?.full_name ?? null,
          username: profile?.username ?? null,
          avatarUrl: profile?.avatar_url ?? null,
        }
      }),
      error: null,
    }
  }

  return {
    members: (data ?? []).map((row: any) => {
      const profile = Array.isArray(row.profile) ? row.profile[0] : row.profile
      return {
        id: row.id,
        blockedId: row.blocked_id,
        createdAt: row.created_at,
        fullName: profile?.full_name ?? null,
        username: profile?.username ?? null,
        avatarUrl: profile?.avatar_url ?? null,
      }
    }),
    error: null,
  }
}

/** Undo a hide — used by undo toasts after hide-post. */
export async function unhideCommunityPost(
  userId: string,
  postId: string,
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('community_hidden_posts')
    .delete()
    .eq('user_id', userId)
    .eq('post_id', postId)

  invalidateFeedExclusionCache()
  return { error: error?.message ?? null }
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

type FeedExclusionSnapshot = {
  hiddenPostIds: string[]
  blockedUserIds: string[]
}

let feedExclusionCache: { userId: string; snapshot: FeedExclusionSnapshot } | null = null

export function invalidateFeedExclusionCache() {
  feedExclusionCache = null
}

/** IDs the viewer has hidden or whose authors they blocked. */
export async function fetchFeedExclusion(
  userId: string,
): Promise<FeedExclusionSnapshot> {
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

/** Session-scoped cache so feed pagination does not re-query exclusions every page. */
export async function getFeedExclusion(userId: string): Promise<FeedExclusionSnapshot> {
  if (feedExclusionCache?.userId === userId) {
    return feedExclusionCache.snapshot
  }

  const snapshot = await fetchFeedExclusion(userId)
  feedExclusionCache = { userId, snapshot }
  return snapshot
}
