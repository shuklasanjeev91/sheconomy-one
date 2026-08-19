import { INVALIDATION_TOPICS, invalidateCache } from '~/lib/cache/invalidation'
import { supabase } from '~/lib/supabase/client'
import type { CommunityPost } from '~/community/lib/community'
import { fetchPostById } from '~/community/lib/community'
import { collectPostMedia } from '~/community/lib/post-media'
import { communityRoutes } from '~/lib/routes'

export type SavedPostRow = {
  id: string
  post_id: string
  user_id: string
  collection_name: string | null
  notes: string | null
  created_at: string | null
}

export type SavedCommunityPostEntry = {
  postId: string
  collectionName: string
  notes: string | null
  createdAt: string | null
  post: CommunityPost
}

export type SavedCommunityPostSection = {
  key: 'creator_picks' | 'shop_now' | 'read_later' | 'events' | 'more_saved'
  title: string
  subtitle: string
  items: SavedCommunityPostEntry[]
}

export type PickUpAgainLane = 'shop_now' | 'creator_picks' | 'read_later' | 'events'

export type PickUpAgainCard = {
  postId: string
  lane: PickUpAgainLane
  laneLabel: string
  title: string
  subtitle: string | null
  imageUrl: string | null
  collectionName: string
  listingId: string | null
  listingSlug: string | null
}

const PICK_UP_AGAIN_LANE_ORDER: PickUpAgainLane[] = ['shop_now', 'creator_picks', 'read_later', 'events']

const PICK_UP_AGAIN_LANE_LABELS: Record<PickUpAgainLane, string> = {
  shop_now: 'Shop now',
  creator_picks: 'Creator pick',
  read_later: 'Read later',
  events: 'Event',
}

function normalizeCollectionName(value: string | null | undefined) {
  const trimmed = value?.trim()
  return trimmed?.length ? trimmed : 'Saved'
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

export async function getSavedCommunityPost(
  userId: string,
  postId: string,
): Promise<{ item: SavedPostRow | null; error: string | null }> {
  const { data, error } = await supabase
    .from('saved_posts')
    .select('id, post_id, user_id, collection_name, notes, created_at')
    .eq('user_id', userId)
    .eq('post_id', postId)
    .limit(1)
    .maybeSingle()

  if (error) return { item: null, error: error.message }
  return { item: (data as SavedPostRow | null) ?? null, error: null }
}

/** Save a post (professional bookmark). */
export async function saveCommunityPost(
  userId: string,
  postId: string,
  input?: { collectionName?: string | null; notes?: string | null },
): Promise<{ error: string | null }> {
  const { data: existing } = await supabase
    .from('saved_posts')
    .select('id, collection_name, notes')
    .eq('user_id', userId)
    .eq('post_id', postId)
    .limit(1)
    .maybeSingle()

  if (existing) {
    if (input?.collectionName || input?.notes) {
      return updateSavedCommunityPost(userId, postId, input)
    }
    return { error: null }
  }

  const { error } = await supabase.from('saved_posts').insert({
    user_id: userId,
    post_id: postId,
    collection_name: normalizeCollectionName(input?.collectionName),
    notes: input?.notes?.trim() || null,
  })

  if (!error) invalidateCache(INVALIDATION_TOPICS.savedPosts)

  return { error: error?.message ?? null }
}

export async function updateSavedCommunityPost(
  userId: string,
  postId: string,
  input: { collectionName?: string | null; notes?: string | null },
): Promise<{ error: string | null }> {
  const payload: Record<string, unknown> = {}
  if (input.collectionName !== undefined) payload.collection_name = normalizeCollectionName(input.collectionName)
  if (input.notes !== undefined) payload.notes = input.notes?.trim() || null
  const { error } = await supabase
    .from('saved_posts')
    .update(payload)
    .eq('user_id', userId)
    .eq('post_id', postId)

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
): Promise<{ items: SavedCommunityPostEntry[]; error: string | null }> {
  const { data, error } = await supabase
    .from('saved_posts')
    .select('post_id, created_at, collection_name, notes')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) return { items: [], error: error.message }

  const posts: SavedCommunityPostEntry[] = []
  for (const row of data ?? []) {
    const result = await fetchPostById(row.post_id)
    if (result.data) {
      posts.push({
        postId: row.post_id,
        collectionName: normalizeCollectionName((row as SavedPostRow).collection_name),
        notes: (row as SavedPostRow).notes ?? null,
        createdAt: (row as SavedPostRow).created_at,
        post: result.data,
      })
    }
  }

  return { items: posts, error: null }
}

export function buildSavedPostSections(items: SavedCommunityPostEntry[]): SavedCommunityPostSection[] {
  const shopNow = items.filter((entry) => Boolean(entry.post.products?.length || entry.post.product))
  const creatorPicks = items.filter(
    (entry) =>
      !shopNow.some((candidate) => candidate.postId === entry.postId) &&
      Boolean(entry.post.shop || entry.post.author_verified || entry.post.originalPost),
  )
  const readLater = items.filter((entry) => entry.post.post_type === 'article' || Boolean(entry.post.article_title))
  const events = items.filter((entry) => entry.post.post_type === 'event' || Boolean(entry.post.event_title))
  const claimedIds = new Set([
    ...shopNow.map((entry) => entry.postId),
    ...creatorPicks.map((entry) => entry.postId),
    ...readLater.map((entry) => entry.postId),
    ...events.map((entry) => entry.postId),
  ])
  const moreSaved = items.filter((entry) => !claimedIds.has(entry.postId))

  return [
    shopNow.length
      ? {
          key: 'shop_now',
          title: 'Shop now',
          subtitle: `${shopNow.length} product-rich post${shopNow.length === 1 ? '' : 's'} worth revisiting`,
          items: shopNow.slice(0, 6),
        }
      : null,
    creatorPicks.length
      ? {
          key: 'creator_picks',
          title: 'Creator picks',
          subtitle: `${creatorPicks.length} creator-led post${creatorPicks.length === 1 ? '' : 's'} saved for inspiration`,
          items: creatorPicks.slice(0, 6),
        }
      : null,
    readLater.length
      ? {
          key: 'read_later',
          title: 'Read later',
          subtitle: `${readLater.length} article${readLater.length === 1 ? '' : 's'} saved for a deeper read`,
          items: readLater.slice(0, 6),
        }
      : null,
    events.length
      ? {
          key: 'events',
          title: 'Events to revisit',
          subtitle: `${events.length} saved event post${events.length === 1 ? '' : 's'}`,
          items: events.slice(0, 6),
        }
      : null,
    moreSaved.length
      ? {
          key: 'more_saved',
          title: 'More saved posts',
          subtitle: `${moreSaved.length} additional post${moreSaved.length === 1 ? '' : 's'}`,
          items: moreSaved,
        }
      : null,
  ].filter((section): section is SavedCommunityPostSection => section !== null)
}

function savedPostCardTitle(entry: SavedCommunityPostEntry) {
  const post = entry.post
  if (post.article_title?.trim()) return post.article_title.trim()
  if (post.event_title?.trim()) return post.event_title.trim()
  const productTitle = post.products?.[0]?.title ?? post.product?.title
  if (productTitle?.trim()) return productTitle.trim()
  const plain = post.content.replace(/\s+/g, ' ').trim()
  return plain.slice(0, 88) || 'Saved post'
}

function savedPostCardImage(entry: SavedCommunityPostEntry) {
  const post = entry.post
  const productImage = post.products?.[0]?.imageUrl ?? post.product?.imageUrl
  if (productImage?.trim()) return productImage.trim()
  return collectPostMedia(post).find((item) => item.kind === 'image')?.url ?? null
}

function savedPostCardSubtitle(entry: SavedCommunityPostEntry) {
  const author = entry.post.author?.full_name || entry.post.author?.username
  if (author && entry.notes?.trim()) return `${author} · ${entry.notes.trim()}`
  if (entry.notes?.trim()) return entry.notes.trim()
  if (author) return author
  return entry.collectionName !== 'Saved' ? entry.collectionName : null
}

/** Flatten revisit lanes into feed-ready cards, prioritizing commerce-rich saves first. */
export function buildPickUpAgainCards(
  items: SavedCommunityPostEntry[],
  limit = 8,
): PickUpAgainCard[] {
  const sections = buildSavedPostSections(items)
  const cards: PickUpAgainCard[] = []
  const seen = new Set<string>()

  for (const lane of PICK_UP_AGAIN_LANE_ORDER) {
    const section = sections.find((candidate) => candidate.key === lane)
    if (!section) continue
    for (const entry of section.items) {
      if (seen.has(entry.postId)) continue
      seen.add(entry.postId)
      cards.push({
        postId: entry.postId,
        lane,
        laneLabel: PICK_UP_AGAIN_LANE_LABELS[lane],
        title: savedPostCardTitle(entry),
        subtitle: savedPostCardSubtitle(entry),
        imageUrl: savedPostCardImage(entry),
        collectionName: entry.collectionName,
        listingId: entry.post.products?.[0]?.listingId ?? entry.post.product?.listingId ?? null,
        listingSlug: entry.post.products?.[0]?.slug ?? entry.post.product?.slug ?? null,
      })
      if (cards.length >= limit) return cards
    }
  }

  return cards
}

export type ReadLaterRevisitCard = {
  postId: string
  title: string
  subtitle: string | null
  imageUrl: string | null
  href: string
}

/** Article-style saved posts for a dedicated read-later revisit strip. */
export function buildReadLaterRevisitCards(
  items: SavedCommunityPostEntry[],
  limit = 6,
): ReadLaterRevisitCard[] {
  const readLater =
    buildSavedPostSections(items).find((section) => section.key === 'read_later')?.items ?? []

  return readLater.slice(0, limit).map((entry) => ({
    postId: entry.postId,
    title: savedPostCardTitle(entry),
    subtitle: savedPostCardSubtitle(entry),
    imageUrl: savedPostCardImage(entry),
    href: String(communityRoutes.article(entry.postId)),
  }))
}
