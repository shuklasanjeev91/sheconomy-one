import { fail, ok, type ApiResult } from '~/lib/api'
import { logger } from '~/lib/api/logger'
import { getFeedExclusion } from '~/community/lib/moderation'
import { INVALIDATION_TOPICS, invalidateCache } from '~/lib/cache/invalidation'
import { supabase } from '~/lib/supabase/client'

import { extractHashtags, extractMentions } from '~/community/lib/post-text'
import { notifyHashtagFollowers } from '~/community/lib/hashtag-follows'
import { isVideoMediaUrl, normalizeUrlList } from '~/community/lib/post-media'
import { extractFirstUrl, parseVideoProvider } from '~/lib/link-preview'

export const COMMUNITY_PAGE_SIZE = 15

export type CommunityAuthor = {
  full_name: string | null
  username: string | null
  avatar_url: string | null
  headline: string | null
}

export type PostCompanyContext = {
  id: string
  name: string
  slug: string
  logo_url: string | null
}

export type PostGroupContext = {
  id: string
  name: string
  title: string
  avatar_url: string | null
}

export type FeedSort = 'top' | 'recent'

export type CommunityPollOption = {
  id: string
  text: string
  votes: number
  position: number
}

export type CommunityPoll = {
  id: string
  question: string
  options: CommunityPollOption[]
  totalVotes: number
  expiresAt: string
  isActive: boolean
  isClosed: boolean
  /** The option this viewer voted for, if any. */
  myOptionId: string | null
}

/** "Celebrate an occasion" post (new job, work anniversary, launch, etc.). */
export type PostCelebration = {
  occasion: string
  title: string
  subtitle?: string | null
  imageUrl?: string | null
}

/** A product/listing shared into the feed. */
export type PostProduct = {
  listingId: string | null
  title: string
  price: number | null
  currency: string | null
  imageUrl: string | null
  slug: string | null
  shopName: string | null
  shopId?: string | null
  shopSlug?: string | null
  shopOwnerUserId?: string | null
}

/** One or more listings attached to a normal feed post. */
export type PostProductAttachment = PostProduct

/** A shop promoted into the feed. */
export type PostShop = {
  shopId: string | null
  name: string
  logoUrl: string | null
  slug: string | null
  description: string | null
}

/** Open Graph preview for a URL shared in a post (professional unfurl). */
export type PostLinkPreview = {
  url: string
  title: string | null
  description: string | null
  image: string | null
  siteName: string | null
  video: string | null
  videoType: string | null
}

export type CommunityPost = {
  id: string
  content: string
  image_url: string | null
  image_urls: string[] | null
  media_url: string | null
  media_urls: string[] | null
  video_url: string | null
  video_urls: string[] | null
  created_at: string | null
  post_type: string | null
  user_id: string | null
  company_id: string | null
  group_id: string | null
  like_count: number | null
  comment_count: number | null
  engagement_score: number | null
  total_reactions: number | null
  author_verified: boolean | null
  author: CommunityAuthor | null
  company: PostCompanyContext | null
  group: PostGroupContext | null
  event_title: string | null
  event_description: string | null
  event_start_time: string | null
  event_end_time: string | null
  event_location: string | null
  event_rsvp_enabled: boolean | null
  /** Linked directory event id when feed event was synced to `events`. */
  community_event_id: string | null
  poll: CommunityPoll | null
  listing_id: string | null
  celebration: PostCelebration | null
  product: PostProduct | null
  products: PostProductAttachment[] | null
  shop: PostShop | null
  link: PostLinkPreview | null
  /** Present when post_type is article. */
  article_title: string | null
  article_tags: string[] | null
  original_post_id: string | null
  repost_comment: string | null
  originalPost: OriginalPostPreview | null
  is_pinned: boolean
}

export type OriginalPostPreview = {
  id: string
  content: string
  image_url: string | null
  image_urls: string[] | null
  media_url: string | null
  media_urls: string[] | null
  video_url: string | null
  video_urls: string[] | null
  authorName: string
  authorHeadline: string | null
  authorAvatar: string | null
  authorUsername: string | null
  createdAt: string | null
  product?: PostProduct | null
  products?: PostProduct[] | null
}

export type PaginatedPostsResult = {
  items: CommunityPost[]
  page: number
  pageSize: number
  hasMore: boolean
  error: string | null
}

export type CreatePostInput = {
  content: string
  imageUrl?: string | null
  imageUrls?: string[] | null
  mediaUrl?: string | null
  mediaUrls?: string[] | null
  videoUrl?: string | null
  videoUrls?: string[] | null
  visibility?: string
  companyId?: string | null
  groupId?: string | null
  postType?: string | null
  /** professional long-form article headline stored in post_data. */
  articleTitle?: string | null
  articleTags?: string[] | null
  /** Directory `events.id` when this feed post is linked to a calendar event. */
  communityEventId?: string | null
  eventTitle?: string | null
  eventDescription?: string | null
  eventStartTime?: string | null
  eventEndTime?: string | null
  eventLocation?: string | null
  eventRsvpEnabled?: boolean
  eventMeetingUrl?: string | null
  eventIsOnline?: boolean
  poll?: {
    question: string
    options: string[]
    durationDays: number
  } | null
  celebration?: PostCelebration | null
  product?: {
    listingId: string
    title: string
    price?: number | null
    currency?: string | null
    imageUrl?: string | null
    slug?: string | null
    shopName?: string | null
  } | null
  products?: Array<{
    listingId: string
    title: string
    price?: number | null
    currency?: string | null
    imageUrl?: string | null
    slug?: string | null
    shopName?: string | null
  }> | null
  shop?: {
    shopId: string
    name: string
    logoUrl?: string | null
    slug?: string | null
    description?: string | null
  } | null
  linkPreview?: PostLinkPreview | null
}

/** Columns available on `posts_with_stats` (includes image_urls / video_urls from posts). */
const POST_STATS_SELECT =
  'id, content, image_url, image_urls, media_urls, video_url, video_urls, created_at, post_type, user_id, like_count, total_comments, engagement_score, total_reactions, author_verified, author_name, author_headline, author_avatar, event_title, event_description, event_start_time, event_end_time, event_location, event_rsvp_enabled, original_post_id, repost_comment, is_pinned'

type PostRow = {
  id: string
  content: string | null
  image_url: string | null
  image_urls?: string[] | null
  media_urls: string[] | null
  video_url?: string | null
  video_urls?: string[] | null
  created_at: string | null
  post_type: string | null
  user_id: string | null
  like_count: number | null
  total_comments: number | null
  engagement_score: number | null
  total_reactions: number | null
  author_verified: boolean | null
  author_name: string | null
  author_headline: string | null
  author_avatar: string | null
  event_title: string | null
  event_description: string | null
  event_start_time: string | null
  event_end_time: string | null
  event_location: string | null
  event_rsvp_enabled: boolean | null
  original_post_id?: string | null
  repost_comment?: string | null
  is_pinned?: boolean | null
}

function mapPost(row: PostRow, username?: string | null): CommunityPost {
  return {
    id: row.id,
    content: row.content ?? '',
    image_url: row.image_url,
    image_urls: normalizeUrlList(row.image_urls).length ? normalizeUrlList(row.image_urls) : null,
    media_url: null,
    media_urls: row.media_urls,
    video_url: row.video_url ?? null,
    video_urls: normalizeUrlList(row.video_urls).length ? normalizeUrlList(row.video_urls) : null,
    created_at: row.created_at,
    post_type: row.post_type,
    user_id: row.user_id,
    company_id: null,
    group_id: null,
    like_count: row.total_reactions ?? row.like_count,
    comment_count: row.total_comments,
    engagement_score: row.engagement_score,
    total_reactions: row.total_reactions,
    author_verified: row.author_verified,
    author: {
      full_name: row.author_name,
      username: username ?? null,
      avatar_url: row.author_avatar,
      headline: row.author_headline,
    },
    company: null,
    group: null,
    event_title: row.event_title,
    event_description: row.event_description,
    event_start_time: row.event_start_time,
    event_end_time: row.event_end_time,
    event_location: row.event_location,
    event_rsvp_enabled: row.event_rsvp_enabled,
    community_event_id: null,
    poll: null,
    listing_id: null,
    celebration: null,
    product: null,
    products: null,
    shop: null,
    link: null,
    article_title: null,
    article_tags: null,
    original_post_id: row.original_post_id ?? null,
    repost_comment: row.repost_comment ?? null,
    originalPost: null,
    is_pinned: !!row.is_pinned,
  }
}

async function enrichPostsWithUsernames(posts: CommunityPost[]): Promise<CommunityPost[]> {
  const userIds = [...new Set(posts.map((post) => post.user_id).filter(Boolean))] as string[]
  if (!userIds.length) return posts

  const { data } = await supabase.from('profiles').select('id, username').in('id', userIds)
  const usernameById = new Map((data ?? []).map((profile) => [profile.id, profile.username]))

  return posts.map((post) => ({
    ...post,
    author: post.author
      ? { ...post.author, username: post.user_id ? usernameById.get(post.user_id) ?? null : null }
      : null,
  }))
}

function toRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

function mapCelebration(value: unknown): PostCelebration | null {
  const data = toRecord(value)
  if (!data) return null
  const occasion = typeof data.occasion === 'string' ? data.occasion : ''
  const title = typeof data.title === 'string' ? data.title : ''
  if (!occasion && !title) return null
  return {
    occasion,
    title,
    subtitle: typeof data.subtitle === 'string' ? data.subtitle : null,
    imageUrl: typeof data.imageUrl === 'string' ? data.imageUrl : null,
  }
}

function mapProduct(value: unknown, listingId: string | null): PostProduct | null {
  const data = toRecord(value)
  if (!data && !listingId) return null
  return {
    listingId: (typeof data?.listingId === 'string' ? data.listingId : null) ?? listingId,
    title: typeof data?.title === 'string' ? data.title : '',
    price: typeof data?.price === 'number' ? data.price : null,
    currency: typeof data?.currency === 'string' ? data.currency : null,
    imageUrl: typeof data?.imageUrl === 'string' ? data.imageUrl : null,
    slug: typeof data?.slug === 'string' ? data.slug : null,
    shopName: typeof data?.shopName === 'string' ? data.shopName : null,
    shopId: typeof data?.shopId === 'string' ? data.shopId : null,
    shopSlug: typeof data?.shopSlug === 'string' ? data.shopSlug : null,
    shopOwnerUserId:
      typeof data?.shopOwnerUserId === 'string' ? data.shopOwnerUserId : null,
  }
}

function mapProducts(value: unknown): PostProductAttachment[] | null {
  if (!Array.isArray(value)) return null
  const items = value
    .map((entry) => mapProduct(entry, null))
    .filter((item): item is PostProductAttachment => !!item?.listingId && !!item.title)
  return items.length ? items : null
}

function mapLinkPreview(value: unknown): PostLinkPreview | null {
  const data = toRecord(value)
  if (!data) return null
  const url = typeof data.url === 'string' ? data.url : ''
  if (!url) return null
  const provider = parseVideoProvider(url)
  const title = typeof data.title === 'string' ? data.title : null
  const description = typeof data.description === 'string' ? data.description : null
  // Prefer API fields; fall back to provider thumbnail/embed for video-only unfurls.
  const image =
    (typeof data.image === 'string' ? data.image : null) ?? provider?.thumbnail ?? null
  const video =
    (typeof data.video === 'string' ? data.video : null) ?? provider?.embed ?? null
  if (!title && !description && !image && !video) return null
  return {
    url,
    title,
    description,
    image,
    siteName:
      (typeof data.siteName === 'string' ? data.siteName : null) ?? provider?.siteName ?? null,
    video,
    videoType:
      (typeof data.videoType === 'string' ? data.videoType : null) ??
      (provider ? 'text/html' : null),
  }
}

function mapShop(value: unknown): PostShop | null {
  const data = toRecord(value)
  if (!data) return null
  const name = typeof data.name === 'string' ? data.name : ''
  if (!name) return null
  return {
    shopId: typeof data.shopId === 'string' ? data.shopId : null,
    name,
    logoUrl: typeof data.logoUrl === 'string' ? data.logoUrl : null,
    slug: typeof data.slug === 'string' ? data.slug : null,
    description: typeof data.description === 'string' ? data.description : null,
  }
}

/** Hydrate media columns (+ post_data.media_url) from `posts` for any CommunityPost list. */
export async function hydrateCommunityPostMedia(
  posts: CommunityPost[],
): Promise<CommunityPost[]> {
  const ids = posts.map((post) => post.id).filter(Boolean)
  if (!ids.length) return posts

  const { data } = await supabase
    .from('posts')
    .select('id, image_url, image_urls, media_urls, video_url, video_urls, post_data')
    .in('id', ids)
  const metaById = new Map((data ?? []).map((row) => [row.id, row]))

  return posts.map((post) => {
    const meta = metaById.get(post.id)
    if (!meta) return post
    const postData = toRecord(meta.post_data)
    return {
      ...post,
      image_url: meta.image_url ?? post.image_url,
      image_urls: normalizeUrlList(meta.image_urls).length
        ? normalizeUrlList(meta.image_urls)
        : post.image_urls,
      media_url:
        (typeof postData?.media_url === 'string' ? postData.media_url : null) ?? post.media_url,
      media_urls: normalizeUrlList(meta.media_urls).length
        ? normalizeUrlList(meta.media_urls)
        : post.media_urls,
      video_url: meta.video_url ?? post.video_url,
      video_urls: normalizeUrlList(meta.video_urls).length
        ? normalizeUrlList(meta.video_urls)
        : post.video_urls,
    }
  })
}

async function enrichPostsWithPostMeta(posts: CommunityPost[]): Promise<CommunityPost[]> {
  const ids = posts.map((post) => post.id).filter(Boolean)
  if (!ids.length) return posts

  const { data } = await supabase
    .from('posts')
    .select(
      'id, company_id, group_id, listing_id, celebration_data, product_data, service_data, link_preview_data, post_data, image_url, image_urls, media_urls, video_url, video_urls',
    )
    .in('id', ids)
  const metaById = new Map((data ?? []).map((row) => [row.id, row]))

  return posts.map((post) => {
    const meta = metaById.get(post.id)
    const listingId = meta?.listing_id ?? null
    const postData = toRecord(meta?.post_data)
    const articleTitle =
      typeof postData?.article_title === 'string' ? postData.article_title : null
    const communityEventId =
      typeof postData?.community_event_id === 'string' ? postData.community_event_id : null
    const articleTags = Array.isArray(postData?.article_tags)
      ? (postData.article_tags as unknown[]).filter((tag): tag is string => typeof tag === 'string')
      : null
    const attachedProducts = mapProducts(postData?.attached_products)
    return {
      ...post,
      company_id: meta?.company_id ?? null,
      group_id: meta?.group_id ?? null,
      listing_id: listingId,
      celebration: mapCelebration(meta?.celebration_data),
      product: mapProduct(meta?.product_data, listingId),
      products: attachedProducts,
      shop: mapShop(meta?.service_data),
      link: mapLinkPreview(meta?.link_preview_data),
      article_title: articleTitle,
      article_tags: articleTags?.length ? articleTags : null,
      community_event_id: communityEventId,
      image_url: meta?.image_url ?? post.image_url,
      image_urls: normalizeUrlList(meta?.image_urls).length
        ? normalizeUrlList(meta?.image_urls)
        : post.image_urls,
      media_url:
        (typeof postData?.media_url === 'string' ? postData.media_url : null) ?? post.media_url,
      media_urls: normalizeUrlList(meta?.media_urls).length
        ? normalizeUrlList(meta?.media_urls)
        : post.media_urls,
      video_url: meta?.video_url ?? post.video_url,
      video_urls: normalizeUrlList(meta?.video_urls).length
        ? normalizeUrlList(meta?.video_urls)
        : post.video_urls,
    }
  })
}

async function enrichPostsWithContext(posts: CommunityPost[]): Promise<CommunityPost[]> {
  const companyIds = [...new Set(posts.map((p) => p.company_id).filter(Boolean))] as string[]
  const groupIds = [...new Set(posts.map((p) => p.group_id).filter(Boolean))] as string[]

  const [companiesRes, groupsRes] = await Promise.all([
    companyIds.length
      ? supabase
          .from('companypages')
          .select('id, name, page_slug, logo_url')
          .in('id', companyIds)
      : Promise.resolve({ data: [] }),
    groupIds.length
      ? supabase.from('groups').select('id, name, title, avatar_url').in('id', groupIds)
      : Promise.resolve({ data: [] }),
  ])

  const companyById = new Map(
    (companiesRes.data ?? []).map((c) => [
      c.id,
      { id: c.id, name: c.name, slug: c.page_slug, logo_url: c.logo_url },
    ]),
  )
  const groupById = new Map(
    (groupsRes.data ?? []).map((g) => [
      g.id,
      { id: g.id, name: g.name, title: g.title, avatar_url: g.avatar_url },
    ]),
  )

  return posts.map((post) => ({
    ...post,
    company: post.company_id ? companyById.get(post.company_id) ?? null : null,
    group: post.group_id ? groupById.get(post.group_id) ?? null : null,
  }))
}

/** Map UI day lengths to the `polls.duration` check constraint values. */
function toCommunityPollDuration(durationDays: number): {
  duration: '1day' | '3days' | '1week' | '2weeks'
  expiresAt: string
} {
  const days = durationDays > 0 ? durationDays : 1
  if (days <= 1) {
    return {
      duration: '1day',
      expiresAt: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000).toISOString(),
    }
  }
  if (days <= 3) {
    return {
      duration: '3days',
      expiresAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
    }
  }
  if (days <= 7) {
    return {
      duration: '1week',
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    }
  }
  return {
    duration: '2weeks',
    expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
  }
}

/** Attach normalized poll data (options, counts, this viewer's vote) to poll posts. */
export async function fetchPollsForPosts(
  postIds: string[],
): Promise<Map<string, CommunityPoll>> {
  const result = new Map<string, CommunityPoll>()
  if (!postIds.length) return result

  const { data: pollRows } = await supabase
    .from('polls')
    .select('id, post_id, question, expires_at, is_active, total_votes')
    .in('post_id', postIds)
  if (!pollRows?.length) return result

  const pollIds = pollRows.map((row) => row.id)
  const [optionsRes, userRes] = await Promise.all([
    supabase
      .from('poll_options')
      .select('id, poll_id, option_text, vote_count, position')
      .in('poll_id', pollIds)
      .order('position', { ascending: true }),
    supabase.auth.getUser(),
  ])

  const userId = userRes.data.user?.id ?? null
  const myVoteByPoll = new Map<string, string>()
  if (userId) {
    const { data: voteRows } = await supabase
      .from('poll_votes')
      .select('poll_id, option_id')
      .eq('user_id', userId)
      .in('poll_id', pollIds)
    for (const vote of voteRows ?? []) myVoteByPoll.set(vote.poll_id, vote.option_id)
  }

  const optionsByPoll = new Map<string, CommunityPollOption[]>()
  for (const opt of optionsRes.data ?? []) {
    const list = optionsByPoll.get(opt.poll_id) ?? []
    list.push({
      id: opt.id,
      text: opt.option_text,
      votes: opt.vote_count ?? 0,
      position: opt.position,
    })
    optionsByPoll.set(opt.poll_id, list)
  }

  for (const row of pollRows) {
    const expiresAt = row.expires_at as string
    result.set(row.post_id, {
      id: row.id,
      question: row.question,
      options: optionsByPoll.get(row.id) ?? [],
      totalVotes: row.total_votes ?? 0,
      expiresAt,
      isActive: row.is_active ?? true,
      isClosed: !!expiresAt && new Date(expiresAt).getTime() < Date.now(),
      myOptionId: myVoteByPoll.get(row.id) ?? null,
    })
  }

  return result
}

async function enrichPostsWithPolls(posts: CommunityPost[]): Promise<CommunityPost[]> {
  // Attach by polls.post_id for every loaded post so we still render if
  // post_type was wrong historically, as long as a polls row exists.
  const pollPostIds = posts.map((post) => post.id)
  if (!pollPostIds.length) return posts
  const pollByPost = await fetchPollsForPosts(pollPostIds)
  if (!pollByPost.size) return posts
  return posts.map((post) => ({ ...post, poll: pollByPost.get(post.id) ?? post.poll ?? null }))
}

async function enrichPostsWithOriginals(posts: CommunityPost[]): Promise<CommunityPost[]> {
  const originalIds = [
    ...new Set(posts.map((post) => post.original_post_id).filter(Boolean)),
  ] as string[]
  if (!originalIds.length) return posts

  const { data } = await supabase
    .from('posts_with_stats')
    .select(
      'id, content, image_url, image_urls, media_urls, video_url, video_urls, created_at, author_name, author_headline, author_avatar, user_id',
    )
    .in('id', originalIds)

  if (!data?.length) return posts

  const userIds = [...new Set(data.map((row) => row.user_id).filter(Boolean))] as string[]
  const { data: profiles } = userIds.length
    ? await supabase.from('profiles').select('id, username').in('id', userIds)
    : { data: [] as Array<{ id: string; username: string | null }> }
  const usernameById = new Map((profiles ?? []).map((p) => [p.id, p.username]))

  const originals = data.map((row) => ({
    id: row.id as string,
    content: row.content ?? '',
    image_url: row.image_url,
    image_urls: normalizeUrlList(row.image_urls).length ? normalizeUrlList(row.image_urls) : null,
    media_url: null as string | null,
    media_urls: row.media_urls,
    video_url: row.video_url,
    video_urls: normalizeUrlList(row.video_urls).length ? normalizeUrlList(row.video_urls) : null,
    authorName: row.author_name || 'Member',
    authorHeadline: row.author_headline,
    authorAvatar: row.author_avatar,
    authorUsername: row.user_id ? usernameById.get(row.user_id) ?? null : null,
    createdAt: row.created_at,
  })) satisfies OriginalPostPreview[]

  const originalMetaIds = originals.map((row) => row.id)
  const { data: mediaRows } = await supabase
    .from('posts')
    .select('id, image_url, image_urls, media_urls, video_url, video_urls, post_data')
    .in('id', originalMetaIds)
  const mediaById = new Map((mediaRows ?? []).map((row) => [row.id, row]))

  const byId = new Map(
    originals.map((row) => {
      const media = mediaById.get(row.id)
      const postData = toRecord(media?.post_data)
      return [
        row.id,
        {
          ...row,
          image_url: media?.image_url ?? row.image_url,
          image_urls: normalizeUrlList(media?.image_urls).length
            ? normalizeUrlList(media?.image_urls)
            : null,
          media_url:
            (typeof postData?.media_url === 'string' ? postData.media_url : null) ?? row.media_url,
          media_urls: normalizeUrlList(media?.media_urls).length
            ? normalizeUrlList(media?.media_urls)
            : row.media_urls,
          video_url: media?.video_url ?? row.video_url,
          video_urls: normalizeUrlList(media?.video_urls).length
            ? normalizeUrlList(media?.video_urls)
            : null,
          product: mapProduct(postData?.product_data, null),
          products: mapProducts(postData?.attached_products),
        } satisfies OriginalPostPreview,
      ]
    }),
  )

  return posts.map((post) => ({
    ...post,
    originalPost: post.original_post_id ? byId.get(post.original_post_id) ?? null : null,
  }))
}

async function enrichPosts(posts: CommunityPost[]): Promise<CommunityPost[]> {
  if (!posts.length) return posts

  const [withMeta, withUsernames] = await Promise.all([
    enrichPostsWithPostMeta(posts),
    enrichPostsWithUsernames(posts),
  ])
  const merged = posts.map((post, index) => ({
    ...withMeta[index],
    author: withUsernames[index].author ?? withMeta[index].author,
  }))

  const [withContext, withPolls] = await Promise.all([
    enrichPostsWithContext(merged),
    enrichPostsWithPolls(merged),
  ])
  const withContextPolls = merged.map((post, index) => ({
    ...withContext[index],
    poll: withPolls[index].poll ?? null,
  }))

  return enrichPostsWithOriginals(withContextPolls)
}

/** Feed content filter used by the "Post type" pill on the main feed. */
export type FeedContentFilter =
  | 'photos'
  | 'polls'
  | 'events'
  | 'text'
  | 'articles'
  | 'celebrations'
  | 'shoppable'

type PostFilter = {
  companyId?: string
  groupId?: string
  feed?: FeedContentFilter
}

async function applyFeedExclusions(posts: CommunityPost[]): Promise<CommunityPost[]> {
  const {
    data: { session },
  } = await supabase.auth.getSession()
  const userId = session?.user?.id
  if (!userId || posts.length === 0) return posts

  const { hiddenPostIds, blockedUserIds } = await getFeedExclusion(userId)
  if (!hiddenPostIds.length && !blockedUserIds.length) return posts

  const hidden = new Set(hiddenPostIds)
  const blocked = new Set(blockedUserIds)
  return posts.filter((post) => !hidden.has(post.id) && !blocked.has(post.user_id))
}

async function fetchPostsPage(
  page: number,
  pageSize: number,
  sort: FeedSort,
  filter?: PostFilter,
): Promise<PaginatedPostsResult> {
  if (filter?.companyId || filter?.groupId) {
    return fetchFilteredPostsPage(page, pageSize, sort, filter)
  }

  const from = page * pageSize
  const to = from + pageSize - 1

  let query = supabase
    .from('posts_with_stats')
    .select(POST_STATS_SELECT)
    .eq('is_deleted', false)

  if (filter?.feed === 'photos') {
    // Media posts are identified by presence of media columns on the view.
    query = query.or(
      'image_url.not.is.null,image_urls.not.is.null,media_urls.not.is.null,video_url.not.is.null,video_urls.not.is.null',
    )
  } else if (filter?.feed === 'polls') {
    query = query.eq('post_type', 'poll')
  } else if (filter?.feed === 'events') {
    query = query.eq('post_type', 'event')
  } else if (filter?.feed === 'articles') {
    query = query.eq('post_type', 'article')
  } else if (filter?.feed === 'celebrations') {
    query = query.eq('post_type', 'celebration')
  } else if (filter?.feed === 'text') {
    query = query
      .is('image_url', null)
      .is('image_urls', null)
      .is('media_urls', null)
      .is('video_url', null)
      .is('video_urls', null)
      .not('post_type', 'in', '(poll,event,article,celebration)')
  }

  query =
    sort === 'top'
      ? query.order('engagement_score', { ascending: false, nullsFirst: false })
      : query.order('created_at', { ascending: false })

  const { data, error } = await query.range(from, to)

  if (error) {
    return { items: [], page, pageSize, hasMore: false, error: error.message }
  }

  const mapped = ((data ?? []) as PostRow[]).map((row) => mapPost(row))
  const enriched = await enrichPosts(mapped)
  let items = await applyFeedExclusions(enriched)

  if (filter?.feed === 'shoppable') {
    items = items.filter((post) => (post.products?.length ?? 0) > 0)
  }

  return {
    items,
    page,
    pageSize,
    hasMore: (data?.length ?? 0) === pageSize,
    error: null,
  }
}

async function fetchFilteredPostsPage(
  page: number,
  pageSize: number,
  sort: FeedSort,
  filter: PostFilter,
): Promise<PaginatedPostsResult> {
  const from = page * pageSize
  const to = from + pageSize - 1

  let idQuery = supabase.from('posts').select('id').eq('is_deleted', false)

  if (filter.companyId) idQuery = idQuery.eq('company_id', filter.companyId)
  if (filter.groupId) idQuery = idQuery.eq('group_id', filter.groupId)

  idQuery =
    sort === 'top'
      ? idQuery.order('engagement_score', { ascending: false, nullsFirst: false })
      : idQuery.order('created_at', { ascending: false })

  const { data: idRows, error: idError } = await idQuery.range(from, to)

  if (idError) {
    return { items: [], page, pageSize, hasMore: false, error: idError.message }
  }

  const ids = (idRows ?? []).map((row) => row.id)
  if (!ids.length) {
    return { items: [], page, pageSize, hasMore: false, error: null }
  }

  const { data, error } = await supabase
    .from('posts_with_stats')
    .select(POST_STATS_SELECT)
    .in('id', ids)
    .eq('is_deleted', false)
    .order('created_at', { ascending: false })

  if (error) {
    return { items: [], page, pageSize, hasMore: false, error: error.message }
  }

  const mapped = ((data ?? []) as PostRow[]).map((row) => mapPost(row))
  const items = await enrichPosts(mapped)

  return {
    items,
    page,
    pageSize,
    hasMore: ids.length === pageSize,
    error: null,
  }
}

export async function fetchCommunityFeedPage(
  page: number,
  pageSize = COMMUNITY_PAGE_SIZE,
  sort: FeedSort = 'recent',
  feed?: FeedContentFilter,
): Promise<PaginatedPostsResult> {
  return fetchPostsPage(page, pageSize, sort, feed ? { feed } : undefined)
}

/** Lightweight content search for omnibox + `/search`. */
export async function searchPosts(
  query: string,
  limit = 12,
): Promise<Array<{
  id: string
  content: string
  image_url: string | null
  author_name: string | null
  author_avatar: string | null
  created_at: string | null
}>> {
  const term = query.trim().replace(/[%*,]/g, '')
  if (term.length < 2) return []

  const { data, error } = await supabase
    .from('posts_with_stats')
    .select('id, content, image_url, author_name, author_avatar, created_at')
    .ilike('content', `%${term}%`)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) {
    logger.warn('searchPosts failed', { message: error.message })
    return []
  }

  return (data ?? []).map((row) => ({
    id: row.id as string,
    content: (row.content as string | null) ?? '',
    image_url: (row.image_url as string | null) ?? null,
    author_name: (row.author_name as string | null) ?? null,
    author_avatar: (row.author_avatar as string | null) ?? null,
    created_at: (row.created_at as string | null) ?? null,
  }))
}

export async function fetchPostById(id: string): Promise<ApiResult<CommunityPost>> {
  const { data, error } = await supabase
    .from('posts_with_stats')
    .select(POST_STATS_SELECT)
    .eq('id', id)
    .eq('is_deleted', false)
    .maybeSingle()

  if (error) {
    logger.apiError('fetchPostById', error.message, { id })
    return fail(error.message)
  }

  if (!data) return fail('Post not found.')

  const mapped = mapPost(data as PostRow)
  const [post] = await enrichPosts([mapped])
  return ok(post)
}

export async function fetchCompanyPostsPage(
  companyId: string,
  page: number,
  pageSize = COMMUNITY_PAGE_SIZE,
): Promise<PaginatedPostsResult> {
  return fetchPostsPage(page, pageSize, 'recent', { companyId })
}

export async function fetchGroupPostsPage(
  groupId: string,
  page: number,
  pageSize = COMMUNITY_PAGE_SIZE,
): Promise<PaginatedPostsResult> {
  return fetchPostsPage(page, pageSize, 'recent', { groupId })
}

export async function fetchHashtagFeedPage(
  tag: string,
  page: number,
  pageSize = COMMUNITY_PAGE_SIZE,
  options?: { shoppableOnly?: boolean },
): Promise<PaginatedPostsResult> {
  const normalized = tag.toLowerCase().replace(/^#/, '')
  const from = page * pageSize
  const to = from + pageSize - 1

  const { data: idRows, error: idError } = await supabase
    .from('posts')
    .select('id')
    .contains('tags', [normalized])
    .eq('is_deleted', false)
    .order('created_at', { ascending: false })
    .range(from, to)

  if (idError) {
    return { items: [], page, pageSize, hasMore: false, error: idError.message }
  }

  const ids = (idRows ?? []).map((row) => row.id)
  if (!ids.length) {
    return { items: [], page, pageSize, hasMore: false, error: null }
  }

  const { data, error } = await supabase
    .from('posts_with_stats')
    .select(POST_STATS_SELECT)
    .in('id', ids)
    .eq('is_deleted', false)
    .order('created_at', { ascending: false })

  if (error) {
    return { items: [], page, pageSize, hasMore: false, error: error.message }
  }

  const mapped = ((data ?? []) as PostRow[]).map((row) => mapPost(row))
  let items = await enrichPosts(mapped)

  if (options?.shoppableOnly) {
    items = items.filter((post) => (post.products?.length ?? 0) > 0 || Boolean(post.product))
  }

  return {
    items,
    page,
    pageSize,
    hasMore: ids.length === pageSize,
    error: null,
  }
}

export async function createCommunityPost(
  userId: string,
  input: CreatePostInput,
): Promise<{ id: string | null; error: string | null }> {
  const content = input.content.trim()
  const mediaUrls = normalizeUrlList(input.mediaUrls)
  const imageUrlsInput = normalizeUrlList(input.imageUrls)
  const videoUrlsInput = normalizeUrlList(input.videoUrls)
  const imageUrl = input.imageUrl?.trim() || null
  const mediaUrl = input.mediaUrl?.trim() || null
  const videoUrl = input.videoUrl?.trim() || null

  const classifiedFromMedia = mediaUrls.reduce(
    (acc, url) => {
      if (isVideoMediaUrl(url)) acc.videos.push(url)
      else acc.images.push(url)
      return acc
    },
    { images: [] as string[], videos: [] as string[] },
  )
  const imageUrls = [
    ...new Set([
      ...imageUrlsInput,
      ...classifiedFromMedia.images,
      ...(imageUrl && !isVideoMediaUrl(imageUrl) ? [imageUrl] : []),
    ]),
  ]
  const videoUrls = [
    ...new Set([
      ...videoUrlsInput,
      ...classifiedFromMedia.videos,
      ...(videoUrl ? [videoUrl] : []),
      ...(imageUrl && isVideoMediaUrl(imageUrl) ? [imageUrl] : []),
    ]),
  ]
  const coverImage = imageUrl && !isVideoMediaUrl(imageUrl) ? imageUrl : imageUrls[0] ?? null
  const coverVideo = videoUrl || videoUrls[0] || null
  const allMediaUrls = [...new Set([...mediaUrls, ...imageUrls, ...videoUrls, mediaUrl].filter(Boolean))] as string[]

  const isEvent = !!input.eventTitle?.trim()
  const pollOptions = (input.poll?.options ?? []).map((option) => option.trim()).filter(Boolean)
  const pollQuestion = input.poll?.question?.trim() ?? ''
  const hasPoll = !!input.poll && pollOptions.length >= 2
  const hasImage = !!coverImage || !!coverVideo || allMediaUrls.length > 0
  const celebration =
    input.celebration && (input.celebration.occasion || input.celebration.title)
      ? input.celebration
      : null
  const product = input.product?.listingId ? input.product : null
  const products =
    (input.products ?? [])
      .map((item) => ({
        listingId: item.listingId,
        title: item.title.trim(),
        price: typeof item.price === 'number' ? item.price : null,
        currency: item.currency?.trim() || null,
        imageUrl: item.imageUrl?.trim() || null,
        slug: item.slug?.trim() || null,
        shopName: item.shopName?.trim() || null,
        shopId: item.shopId?.trim() || null,
        shopSlug: item.shopSlug?.trim() || null,
        shopOwnerUserId: item.shopOwnerUserId?.trim() || null,
      }))
      .filter((item) => item.listingId && item.title)
      .slice(0, 3) || []
  const shop = input.shop?.shopId ? input.shop : null
  const rawLink = input.linkPreview?.url
    ? input.linkPreview
    : (() => {
        const url = extractFirstUrl(content)
        const provider = url ? parseVideoProvider(url) : null
        if (!url || !provider) return null
        return {
          url,
          title: null,
          description: null,
          image: provider.thumbnail,
          siteName: provider.siteName,
          video: provider.embed,
          videoType: 'text/html',
        } satisfies PostLinkPreview
      })()
  const providerFromLink = rawLink?.url ? parseVideoProvider(rawLink.url) : null
  const linkPreview =
    rawLink &&
    (rawLink.title ||
      rawLink.description ||
      rawLink.image ||
      rawLink.video ||
      providerFromLink)
      ? {
          ...rawLink,
          title: rawLink.title ?? null,
          description: rawLink.description ?? null,
          image: rawLink.image ?? providerFromLink?.thumbnail ?? null,
          siteName: rawLink.siteName ?? providerFromLink?.siteName ?? null,
          video: rawLink.video ?? providerFromLink?.embed ?? null,
          videoType: rawLink.videoType ?? (providerFromLink ? 'text/html' : null),
        }
      : null
  if (
    !content &&
    !hasImage &&
    !isEvent &&
    !hasPoll &&
    !celebration &&
    !product &&
    !products.length &&
    !shop &&
    !linkPreview
  ) {
    return { id: null, error: 'Write something or add media before posting.' }
  }

  const tags = extractHashtags(content)
  const mentions = extractMentions(content)

  // NOTE: post_type includes professional variants (article, celebration, …).
  // Media posts are surfaced via media_urls/image_url presence, not a dedicated type.
  const postType =
    input.postType ??
    (celebration
      ? 'celebration'
      : product
        ? 'product'
        : shop
          ? 'service'
          : hasPoll
            ? 'poll'
            : isEvent
              ? 'event'
              : 'post')

  const postData =
    postType === 'article'
      ? {
          ...(input.articleTitle?.trim()
            ? { article_title: input.articleTitle.trim() }
            : {}),
          ...(input.articleTags?.length
            ? { article_tags: input.articleTags.map((tag) => tag.trim()).filter(Boolean) }
            : {}),
          ...(mediaUrl ? { media_url: mediaUrl } : {}),
        }
      : input.communityEventId
        ? {
            community_event_id: input.communityEventId,
            ...(mediaUrl ? { media_url: mediaUrl } : {}),
          }
        : mediaUrl
          ? { media_url: mediaUrl }
          : {}
  const postDataWithProducts = products.length
    ? {
        ...postData,
        attached_products: products.map((item) => ({
          listingId: item.listingId,
          title: item.title,
          price: item.price ?? null,
          currency: item.currency ?? null,
          imageUrl: item.imageUrl ?? null,
          slug: item.slug ?? null,
          shopName: item.shopName ?? null,
        })),
      }
    : postData

  const { data, error } = await supabase
    .from('posts')
    .insert({
      user_id: userId,
      content,
      post_data: postDataWithProducts,
      visibility: input.visibility ?? 'public',
      post_type: postType,
      image_url: coverImage,
      image_urls: imageUrls.length ? imageUrls : null,
      media_urls: allMediaUrls.length ? allMediaUrls : null,
      video_url: coverVideo,
      video_urls: videoUrls.length ? videoUrls : null,
      company_id: input.companyId ?? null,
      group_id: input.groupId ?? null,
      listing_id: product?.listingId ?? null,
      celebration_data: celebration
        ? {
            occasion: celebration.occasion,
            title: celebration.title,
            subtitle: celebration.subtitle ?? null,
            imageUrl: celebration.imageUrl ?? null,
          }
        : null,
      product_data: product
        ? {
            listingId: product.listingId,
            title: product.title,
            price: product.price ?? null,
            currency: product.currency ?? null,
            imageUrl: product.imageUrl ?? null,
            slug: product.slug ?? null,
            shopName: product.shopName ?? null,
          }
        : null,
      service_data: shop
        ? {
            shopId: shop.shopId,
            name: shop.name,
            logoUrl: shop.logoUrl ?? null,
            slug: shop.slug ?? null,
            description: shop.description ?? null,
          }
        : null,
      link_preview_data: linkPreview
        ? {
            url: linkPreview.url,
            title: linkPreview.title ?? null,
            description: linkPreview.description ?? null,
            image: linkPreview.image ?? null,
            siteName: linkPreview.siteName ?? null,
            video: linkPreview.video ?? null,
            videoType: linkPreview.videoType ?? null,
          }
        : null,
      published_at: new Date().toISOString(),
      allow_comments: true,
      allow_reactions: true,
      tags: tags.length ? tags : null,
      mentions: mentions.length ? mentions : null,
      event_title: input.eventTitle ?? null,
      event_description: input.eventDescription ?? null,
      event_start_time: input.eventStartTime ?? null,
      event_end_time: input.eventEndTime ?? null,
      event_location: input.eventLocation ?? null,
      event_rsvp_enabled: input.eventRsvpEnabled ?? false,
    })
    .select('id')
    .maybeSingle()

  const postId = data?.id ?? null

  if (postId && tags.length) {
    const { data: author } = await supabase
      .from('profiles')
      .select('full_name, username')
      .eq('id', userId)
      .maybeSingle()
    void notifyHashtagFollowers({
      authorId: userId,
      authorName: author?.full_name || author?.username || 'Someone',
      postId,
      tags,
    })
  }

  if (postId && hasPoll && input.poll) {
    const { duration, expiresAt } = toCommunityPollDuration(input.poll.durationDays)
    const { data: pollRow, error: pollError } = await supabase
      .from('polls')
      .insert({
        post_id: postId,
        question: pollQuestion || content || 'Poll',
        duration,
        expires_at: expiresAt,
        is_active: true,
        total_votes: 0,
      })
      .select('id')
      .maybeSingle()

    if (pollError || !pollRow) {
      await supabase.from('posts').delete().eq('id', postId)
      return {
        id: null,
        error: pollError?.message ?? 'Could not create poll. Try again.',
      }
    }

    const { error: optionsError } = await supabase.from('poll_options').insert(
      pollOptions.slice(0, 4).map((text, index) => ({
        poll_id: pollRow.id,
        option_text: text,
        position: index,
        vote_count: 0,
      })),
    )

    if (optionsError) {
      await supabase.from('posts').delete().eq('id', postId)
      return { id: null, error: optionsError.message }
    }
  }

  if (postId) invalidateCommunityPostCaches()

  return { id: postId, error: error?.message ?? null }
}

/** Every feed/list showing posts revalidates without a manual route reload. */
function invalidateCommunityPostCaches() {
  invalidateCache(
    'feed:community',
    INVALIDATION_TOPICS.communityPosts,
    INVALIDATION_TOPICS.userActivity,
    INVALIDATION_TOPICS.savedPosts,
  )
}

const NON_EDITABLE_POST_TYPES = new Set(['poll', 'event', 'celebration', 'product', 'service'])

export type UpdatePostInput = {
  content: string
}

/** Update text content on the author's own post (LinkedIn-style edit). */
export async function updateCommunityPost(
  userId: string,
  postId: string,
  input: UpdatePostInput,
): Promise<{ error: string | null }> {
  const content = input.content.trim()
  if (!content) return { error: 'Post cannot be empty.' }

  const { data: existing, error: fetchError } = await supabase
    .from('posts')
    .select('post_type, user_id, is_deleted')
    .eq('id', postId)
    .maybeSingle()

  if (fetchError) return { error: fetchError.message }
  if (!existing || existing.user_id !== userId) {
    return { error: 'You can only edit your own posts.' }
  }
  if (existing.is_deleted) return { error: 'This post was deleted.' }
  if (existing.post_type && NON_EDITABLE_POST_TYPES.has(existing.post_type)) {
    return { error: 'This type of post cannot be edited.' }
  }

  const tags = extractHashtags(content)
  const mentions = extractMentions(content)

  const { error } = await supabase
    .from('posts')
    .update({
      content,
      tags: tags.length ? tags : null,
      mentions: mentions.length ? mentions : null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', postId)
    .eq('user_id', userId)

  if (!error) invalidateCommunityPostCaches()

  return { error: error?.message ?? null }
}

/** Soft-delete the author's own post. */
export async function deleteCommunityPost(
  userId: string,
  postId: string,
): Promise<{ error: string | null }> {
  const { data: existing, error: fetchError } = await supabase
    .from('posts')
    .select('user_id, is_deleted')
    .eq('id', postId)
    .maybeSingle()

  if (fetchError) return { error: fetchError.message }
  if (!existing || existing.user_id !== userId) {
    return { error: 'You can only delete your own posts.' }
  }
  if (existing.is_deleted) return { error: null }

  const { error } = await supabase
    .from('posts')
    .update({ is_deleted: true, updated_at: new Date().toISOString() })
    .eq('id', postId)
    .eq('user_id', userId)

  if (!error) invalidateCommunityPostCaches()

  return { error: error?.message ?? null }
}
