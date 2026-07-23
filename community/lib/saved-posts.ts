import { INVALIDATION_TOPICS, invalidateCache } from '~/lib/cache/invalidation'
import { supabase } from '~/lib/supabase/client'
import type { CommunityPost } from '~/community/lib/community'
import { fetchPostById } from '~/community/lib/community'

export type SavedPostRow = {
  id: string
  post_id: string
  user_id: string
  collection_name: string | null
  notes: string | null
  created_at: string | null
}

/** Check whether the current user has saved a post. */
export async function isPostSaved(
  userId: string,
  postId: string,
): Promise<boolean> {
  const { data } = await supabase
    .from('saved_posts')
    .select('id')
    .eq('user_id', userId)
    .eq('post_id', postId)
    .limit(1)
    .maybeSingle()

  return !!data
}

/** Save a post (professional bookmark). */
export async function saveCommunityPost(
  userId: string,
  postId: string,
): Promise<{ error: string | null }> {
  const { data: existing } = await supabase
    .from('saved_posts')
    .select('id')
    .eq('user_id', userId)
    .eq('post_id', postId)
    .limit(1)
    .maybeSingle()

  if (existing) return { error: null }

  const { error } = await supabase.from('saved_posts').insert({
    user_id: userId,
    post_id: postId,
    collection_name: 'Saved',
  })

  if (!error) invalidateCache(INVALIDATION_TOPICS.savedPosts)

  return { error: error?.message ?? null }
}

/** Remove a saved post. */
export async function unsaveCommunityPost(
  userId: string,
  postId: string,
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('saved_posts')
    .delete()
    .eq('user_id', userId)
    .eq('post_id', postId)

  if (!error) invalidateCache(INVALIDATION_TOPICS.savedPosts)

  return { error: error?.message ?? null }
}

/** List saved posts with post content for the Saved items screen. */
export async function fetchSavedCommunityPosts(
  userId: string,
): Promise<{ items: CommunityPost[]; error: string | null }> {
  const { data, error } = await supabase
    .from('saved_posts')
    .select('post_id, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) return { items: [], error: error.message }

  const posts: CommunityPost[] = []
  for (const row of data ?? []) {
    const result = await fetchPostById(row.post_id)
    if (result.data) posts.push(result.data)
  }

  return { items: posts, error: null }
}
