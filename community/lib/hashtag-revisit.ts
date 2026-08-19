import { fetchHashtagFeedPage } from '~/community/lib/community'
import { communityRoutes } from '~/lib/routes'
import { supabase } from '~/lib/supabase/client'

export type HashtagRevisitCard = {
  key: string
  hashtag: string
  postId: string
  title: string
  subtitle: string | null
  imageUrl: string | null
  href: string
}

function postTitle(content: string, max = 88) {
  return content.replace(/\s+/g, ' ').trim().slice(0, max) || 'Tagged post'
}

export async function fetchFollowedHashtags(userId: string): Promise<string[]> {
  const { data } = await supabase
    .from('hashtag_follows')
    .select('hashtag')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(12)

  return [...new Set((data ?? []).map((row) => row.hashtag).filter(Boolean))]
}

export async function fetchHashtagRevisitCards(
  userId: string,
  limit = 8,
): Promise<{ cards: HashtagRevisitCard[]; error: string | null }> {
  try {
    const tags = await fetchFollowedHashtags(userId)
    if (!tags.length) return { cards: [], error: null }

    const cards: HashtagRevisitCard[] = []
    const seen = new Set<string>()

    for (const hashtag of tags) {
      if (cards.length >= limit) break
      const page = await fetchHashtagFeedPage(hashtag, 0, 4)
      if (page.error) continue
      for (const post of page.items) {
        if (seen.has(post.id)) continue
        seen.add(post.id)
        cards.push({
          key: `${hashtag}-${post.id}`,
          hashtag,
          postId: post.id,
          title: postTitle(post.content),
          subtitle: post.author?.full_name || post.author?.username || `#${hashtag}`,
          imageUrl: post.image_url,
          href: communityRoutes.hashtag(hashtag),
        })
        if (cards.length >= limit) break
      }
    }

    return { cards, error: null }
  } catch (error) {
    return {
      cards: [],
      error: error instanceof Error ? error.message : 'Failed to load hashtag posts',
    }
  }
}
