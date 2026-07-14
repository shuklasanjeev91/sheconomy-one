import { fail, ok, type ApiResult } from '~/lib/api'
import { logger } from '~/lib/api/logger'
import { supabase } from '~/lib/supabase/client'

import { extractHashtags, extractMentions } from './post-text'

export const COMMUNITY_PAGE_SIZE = 10

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
}

/** A shop promoted into the feed. */
export type PostShop = {
  shopId: string | null
  name: string
  logoUrl: string | null
  slug: string | null
  description: string | null
}

/** Open Graph preview for a URL shared in a post (LinkedIn-style unfurl). */
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
  media_urls: string[] | null
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
  poll: CommunityPoll | null
  listing_id: string | null
  celebration: PostCelebration | null
  product: PostProduct | null
  shop: PostShop | null
  link: PostLinkPreview | null
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
  mediaUrls?: string[] | null
  visibility?: string
  companyId?: string | null
  groupId?: string | null
  postType?: string | null
  eventTitle?: string | null
  eventDescription?: string | null
  eventStartTime?: string | null
  eventEndTime?: string | null
  eventLocation?: string | null
  eventRsvpEnabled?: boolean
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
  shop?: {
    shopId: string
    name: string
    logoUrl?: string | null
    slug?: string | null
    description?: string | null
  } | null
  linkPreview?: PostLinkPreview | null
}

const POST_STATS_SELECT =
  'id, content, image_url, media_urls, created_at, post_type, user_id, like_count, total_comments, engagement_score, total_reactions, author_verified, author_name, author_headline, author_avatar, event_title, event_description, event_start_time, event_end_time, event_location, event_rsvp_enabled'

type PostRow = {
  id: string
  content: string | null
  image_url: string | null
  media_urls: string[] | null
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
}

function mapPost(row: PostRow, username?: string | null): CommunityPost {
  return {
    id: row.id,
    content: row.content ?? '',
    image_url: row.image_url,
    media_urls: row.media_urls,
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
    poll: null,
    listing_id: null,
    celebration: null,
    product: null,
    shop: null,
    link: null,
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
  }
}

function mapLinkPreview(value: unknown): PostLinkPreview | null {
  const data = toRecord(value)
  if (!data) return null
  const url = typeof data.url === 'string' ? data.url : ''
  if (!url) return null
  const title = typeof data.title === 'string' ? data.title : null
  const description = typeof data.description === 'string' ? data.description : null
  const image = typeof data.image === 'string' ? data.image : null
  const video = typeof data.video === 'string' ? data.video : null
  if (!title && !description && !image && !video) return null
  return {
    url,
    title,
    description,
    image,
    siteName: typeof data.siteName === 'string' ? data.siteName : null,
    video,
    videoType: typeof data.videoType === 'string' ? data.videoType : null,
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

async function enrichPostsWithPostMeta(posts: CommunityPost[]): Promise<CommunityPost[]> {
  const ids = posts.map((post) => post.id).filter(Boolean)
  if (!ids.length) return posts

  const { data } = await supabase
    .from('posts')
    .select(
      'id, company_id, group_id, listing_id, celebration_data, product_data, service_data, link_preview_data',
    )
    .in('id', ids)
  const metaById = new Map((data ?? []).map((row) => [row.id, row]))

  return posts.map((post) => {
    const meta = metaById.get(post.id)
    const listingId = meta?.listing_id ?? null
    return {
      ...post,
      company_id: meta?.company_id ?? null,
      group_id: meta?.group_id ?? null,
      listing_id: listingId,
      celebration: mapCelebration(meta?.celebration_data),
      product: mapProduct(meta?.product_data, listingId),
      shop: mapShop(meta?.service_data),
      link: mapLinkPreview(meta?.link_preview_data),
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
  const pollPostIds = posts.filter((post) => post.post_type === 'poll').map((post) => post.id)
  if (!pollPostIds.length) return posts
  const pollByPost = await fetchPollsForPosts(pollPostIds)
  if (!pollByPost.size) return posts
  return posts.map((post) => ({ ...post, poll: pollByPost.get(post.id) ?? null }))
}

async function enrichPosts(posts: CommunityPost[]): Promise<CommunityPost[]> {
  const withMeta = await enrichPostsWithPostMeta(posts)
  const withUsernames = await enrichPostsWithUsernames(withMeta)
  const withContext = await enrichPostsWithContext(withUsernames)
  return enrichPostsWithPolls(withContext)
}

/** Feed content filter used by the "Post type" pill on the main feed. */
export type FeedContentFilter = 'photos' | 'polls' | 'events' | 'text'

type PostFilter = {
  companyId?: string
  groupId?: string
  feed?: FeedContentFilter
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
    .select(POST_STATS_SELECT, { count: 'exact' })
    .eq('is_deleted', false)

  if (filter?.feed === 'photos') {
    // Media posts are identified by presence of media, not a post_type value.
    query = query.or('image_url.not.is.null,media_urls.not.is.null')
  } else if (filter?.feed === 'polls') {
    query = query.eq('post_type', 'poll')
  } else if (filter?.feed === 'events') {
    query = query.eq('post_type', 'event')
  } else if (filter?.feed === 'text') {
    query = query
      .is('image_url', null)
      .is('media_urls', null)
      .not('post_type', 'in', '(poll,event)')
  }

  query =
    sort === 'top'
      ? query.order('engagement_score', { ascending: false, nullsFirst: false })
      : query.order('created_at', { ascending: false })

  const { data, error, count } = await query.range(from, to)

  if (error) {
    return { items: [], page, pageSize, hasMore: false, error: error.message }
  }

  const mapped = ((data ?? []) as PostRow[]).map((row) => mapPost(row))
  const items = await enrichPosts(mapped)
  const total = count ?? 0

  return {
    items,
    page,
    pageSize,
    hasMore: total ? to + 1 < total : items.length === pageSize,
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

  let idQuery = supabase.from('posts').select('id', { count: 'exact' }).eq('is_deleted', false)

  if (filter.companyId) idQuery = idQuery.eq('company_id', filter.companyId)
  if (filter.groupId) idQuery = idQuery.eq('group_id', filter.groupId)

  idQuery =
    sort === 'top'
      ? idQuery.order('engagement_score', { ascending: false, nullsFirst: false })
      : idQuery.order('created_at', { ascending: false })

  const { data: idRows, error: idError, count } = await idQuery.range(from, to)

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
  const total = count ?? 0

  return {
    items,
    page,
    pageSize,
    hasMore: total ? to + 1 < total : items.length === pageSize,
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
): Promise<PaginatedPostsResult> {
  const normalized = tag.toLowerCase().replace(/^#/, '')
  const from = page * pageSize
  const to = from + pageSize - 1

  const { data: idRows, error: idError, count } = await supabase
    .from('posts')
    .select('id', { count: 'exact' })
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
  const items = await enrichPosts(mapped)
  const total = count ?? 0

  return {
    items,
    page,
    pageSize,
    hasMore: total ? to + 1 < total : items.length === pageSize,
    error: null,
  }
}

export async function createCommunityPost(
  userId: string,
  input: CreatePostInput,
): Promise<{ id: string | null; error: string | null }> {
  const content = input.content.trim()
  const mediaUrls = (input.mediaUrls ?? []).map((url) => url.trim()).filter(Boolean)
  const imageUrl = input.imageUrl?.trim() || mediaUrls[0] || null
  const isEvent = !!input.eventTitle?.trim()
  const pollOptions = (input.poll?.options ?? []).map((option) => option.trim()).filter(Boolean)
  const pollQuestion = input.poll?.question?.trim() ?? ''
  const hasPoll = !!input.poll && pollOptions.length >= 2
  const hasImage = !!imageUrl || mediaUrls.length > 0
  const celebration =
    input.celebration && (input.celebration.occasion || input.celebration.title)
      ? input.celebration
      : null
  const product = input.product?.listingId ? input.product : null
  const shop = input.shop?.shopId ? input.shop : null
  const linkPreview =
    input.linkPreview?.url &&
    (input.linkPreview.title || input.linkPreview.description || input.linkPreview.image)
      ? input.linkPreview
      : null
  if (!content && !hasImage && !isEvent && !hasPoll && !celebration && !product && !shop) {
    return { id: null, error: 'Write something or add media before posting.' }
  }

  const tags = extractHashtags(content)
  const mentions = extractMentions(content)

  // NOTE: post_type is constrained by posts_post_type_check to a fixed set
  // (post, poll, event, celebration, product, service, text, thought,
  // group_post). Media posts are surfaced via media_urls/image_url presence,
  // not a dedicated type, so a generic 'post' is used for text/photo/GIF.
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

  const { data, error } = await supabase
    .from('posts')
    .insert({
      user_id: userId,
      content,
      post_data: {},
      visibility: input.visibility ?? 'public',
      post_type: postType,
      image_url: imageUrl,
      media_urls: mediaUrls.length ? mediaUrls : null,
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

  if (postId && hasPoll && input.poll) {
    const durationDays = input.poll.durationDays > 0 ? input.poll.durationDays : 1
    const expiresAt = new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000).toISOString()
    const { data: pollRow, error: pollError } = await supabase
      .from('polls')
      .insert({
        post_id: postId,
        question: pollQuestion || content || 'Poll',
        duration: `${durationDays}d`,
        expires_at: expiresAt,
        is_active: true,
        total_votes: 0,
      })
      .select('id')
      .maybeSingle()

    if (!pollError && pollRow) {
      await supabase.from('poll_options').insert(
        pollOptions.slice(0, 4).map((text, index) => ({
          poll_id: pollRow.id,
          option_text: text,
          position: index,
          vote_count: 0,
        })),
      )
    }
  }

  return { id: postId, error: error?.message ?? null }
}
