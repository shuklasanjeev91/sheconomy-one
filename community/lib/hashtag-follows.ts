import { supabase } from '~/lib/supabase/client'
import { INVALIDATION_TOPICS, invalidateCache } from '~/lib/cache/invalidation'
import { notifyFromTemplate } from '~/lib/notifications/notify'

function normalizeTag(tag: string): string {
  return tag.replace(/^#/, '').trim().toLowerCase()
}

export async function fetchHashtagFollowState(
  userId: string,
  hashtag: string,
): Promise<{ isFollowing: boolean; followId: string | null }> {
  const tag = normalizeTag(hashtag)
  if (!tag) return { isFollowing: false, followId: null }

  const { data } = await supabase
    .from('hashtag_follows')
    .select('id')
    .eq('user_id', userId)
    .eq('hashtag', tag)
    .maybeSingle()

  return { isFollowing: !!data, followId: data?.id ?? null }
}

export async function followHashtag(
  userId: string,
  hashtag: string,
): Promise<{ error: string | null }> {
  const tag = normalizeTag(hashtag)
  if (!tag) return { error: 'Invalid hashtag.' }

  const { error } = await supabase.from('hashtag_follows').insert({
    user_id: userId,
    hashtag: tag,
  })

  if (error?.code === '23505') return { error: null }
  if (!error) invalidateCache(INVALIDATION_TOPICS.communityHashtagFollows)
  return { error: error?.message ?? null }
}

export async function unfollowHashtag(
  userId: string,
  hashtag: string,
): Promise<{ error: string | null }> {
  const tag = normalizeTag(hashtag)
  if (!tag) return { error: 'Invalid hashtag.' }

  const { error } = await supabase
    .from('hashtag_follows')
    .delete()
    .eq('user_id', userId)
    .eq('hashtag', tag)

  if (!error) invalidateCache(INVALIDATION_TOPICS.communityHashtagFollows)
  return { error: error?.message ?? null }
}

/** Notify hashtag followers about a new post (skips the author). */
export async function notifyHashtagFollowers(options: {
  authorId: string
  authorName: string
  postId: string
  tags: string[]
}): Promise<void> {
  const tags = [...new Set(options.tags.map(normalizeTag).filter(Boolean))]
  if (!tags.length) return

  const { data: follows } = await supabase
    .from('hashtag_follows')
    .select('user_id, hashtag')
    .in('hashtag', tags)

  if (!follows?.length) return

  const notified = new Set<string>()
  for (const row of follows) {
    if (!row.user_id || row.user_id === options.authorId || notified.has(row.user_id)) continue
    notified.add(row.user_id)
    void notifyFromTemplate({
      templateKey: 'hashtag_post',
      recipientId: row.user_id,
      contextType: 'post',
      contextId: options.postId,
      variables: {
        author_name: options.authorName,
        hashtag: row.hashtag,
        action_url: `/community/post/${options.postId}`,
      },
      channels: ['in_app', 'push'],
    })
  }
}
