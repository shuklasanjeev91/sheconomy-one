import { supabase } from '~/lib/supabase/client'

import { BRAND_NAME } from '~/config/brand'

export type PublicReview = {
  id: string
  rating: number
  title: string | null
  reviewText: string
  createdAt: string
  isVerifiedPurchase: boolean
  helpfulCount: number
  reviewImages: string[]
  reviewerName: string
  reviewerAvatarUrl: string | null
}

export type ReviewSummary = {
  averageRating: number | null
  totalReviews: number
  distribution: Record<1 | 2 | 3 | 4 | 5, number>
}

const EMPTY_DISTRIBUTION: ReviewSummary['distribution'] = {
  1: 0,
  2: 0,
  3: 0,
  4: 0,
  5: 0,
}

function parseReviewImages(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value
    .map((item) => (typeof item === 'string' ? item : null))
    .filter((item): item is string => !!item)
}

function reviewerDisplayName(profile: {
  full_name?: string | null
  username?: string | null
} | null): string {
  return profile?.full_name?.trim() || profile?.username?.trim() || `${BRAND_NAME} buyer`
}

export function computeReviewSummary(reviews: Pick<PublicReview, 'rating'>[]): ReviewSummary {
  if (!reviews.length) {
    return { averageRating: null, totalReviews: 0, distribution: { ...EMPTY_DISTRIBUTION } }
  }

  const distribution = { ...EMPTY_DISTRIBUTION }
  let total = 0

  for (const review of reviews) {
    const bucket = Math.min(5, Math.max(1, Math.round(review.rating))) as 1 | 2 | 3 | 4 | 5
    distribution[bucket] += 1
    total += review.rating
  }

  return {
    averageRating: total / reviews.length,
    totalReviews: reviews.length,
    distribution,
  }
}

export function mergeReviewSummary(
  stored: { averageRating: number | string | null | undefined; totalReviews: number | string | null | undefined },
  computed: ReviewSummary,
): ReviewSummary {
  const averageRating =
    stored.averageRating != null && stored.averageRating !== ''
      ? Number(stored.averageRating)
      : null
  const totalReviews =
    stored.totalReviews != null && stored.totalReviews !== ''
      ? Number(stored.totalReviews)
      : 0

  const hasStored =
    averageRating != null &&
    Number.isFinite(averageRating) &&
    averageRating > 0 &&
    Number.isFinite(totalReviews) &&
    totalReviews > 0

  if (hasStored) {
    return {
      averageRating,
      totalReviews,
      distribution: computed.distribution,
    }
  }

  return computed
}

type ReviewerProfile = {
  full_name: string | null
  username: string | null
  avatar_url: string | null
}

async function fetchReviewerProfiles(reviewerIds: string[]): Promise<Map<string, ReviewerProfile>> {
  const ids = [...new Set(reviewerIds.filter(Boolean))]
  if (!ids.length) return new Map()

  const { data } = await supabase
    .from('profiles')
    .select('id, full_name, username, avatar_url')
    .in('id', ids)

  return new Map((data ?? []).map((profile) => [profile.id, profile]))
}

type ListingReviewRow = {
  id: string
  rating: number
  title: string | null
  review_text: string
  created_at: string
  published_at: string | null
  is_verified_purchase: boolean
  helpful_count: number
  review_images: unknown
  reviewer_id: string
  profiles: ReviewerProfile | null
}

function mapListingReviewRow(
  row: Omit<ListingReviewRow, 'profiles'> & { profiles?: ReviewerProfile | null },
): PublicReview {
  return {
    id: row.id,
    rating: row.rating,
    title: row.title,
    reviewText: row.review_text,
    createdAt: row.published_at ?? row.created_at,
    isVerifiedPurchase: row.is_verified_purchase,
    helpfulCount: row.helpful_count ?? 0,
    reviewImages: parseReviewImages(row.review_images),
    reviewerName: reviewerDisplayName(row.profiles ?? null),
    reviewerAvatarUrl: row.profiles?.avatar_url ?? null,
  }
}

export async function fetchListingReviews(
  listingId: string,
  limit = 12,
): Promise<{ reviews: PublicReview[]; summary: ReviewSummary; error: string | null }> {
  const { data, error } = await supabase
    .from('listing_reviews')
    .select(
      `
      id,
      rating,
      title,
      review_text,
      created_at,
      published_at,
      is_verified_purchase,
      helpful_count,
      review_images,
      reviewer_id
    `,
    )
    .eq('listing_id', listingId)
    .eq('review_status', 'approved')
    .order('published_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) {
    return {
      reviews: [],
      summary: { averageRating: null, totalReviews: 0, distribution: { ...EMPTY_DISTRIBUTION } },
      error: error.message,
    }
  }

  const rows = data ?? []
  const profilesById = await fetchReviewerProfiles(rows.map((row) => row.reviewer_id))
  const reviews = rows.map((row) =>
    mapListingReviewRow({
      ...row,
      profiles: profilesById.get(row.reviewer_id) ?? null,
    }),
  )
  const { count } = await supabase
    .from('listing_reviews')
    .select('id', { count: 'exact', head: true })
    .eq('listing_id', listingId)
    .eq('review_status', 'approved')

  const summary = computeReviewSummary(reviews)
  if (count != null && count > reviews.length) {
    summary.totalReviews = count
  }

  return { reviews, summary, error: null }
}

type ShopReviewPayload = {
  id?: string
  rating?: number
  title?: string | null
  review_text?: string | null
  created_at?: string
  is_verified_purchase?: boolean
  helpful_count?: number
  review_images?: unknown
  reviewer_name?: string | null
  reviewer_avatar_url?: string | null
  profiles?: {
    full_name?: string | null
    username?: string | null
    avatar_url?: string | null
  } | null
}

function mapShopReviewPayload(row: ShopReviewPayload, index: number): PublicReview {
  return {
    id: row.id ?? `shop-review-${index}`,
    rating: row.rating ?? 0,
    title: row.title ?? null,
    reviewText: row.review_text?.trim() || '',
    createdAt: row.created_at ?? new Date().toISOString(),
    isVerifiedPurchase: row.is_verified_purchase ?? false,
    helpfulCount: row.helpful_count ?? 0,
    reviewImages: parseReviewImages(row.review_images),
    reviewerName:
      row.reviewer_name?.trim() ||
      reviewerDisplayName(row.profiles ?? null),
    reviewerAvatarUrl: row.reviewer_avatar_url ?? row.profiles?.avatar_url ?? null,
  }
}

function parseShopReviewsPayload(payload: unknown): ShopReviewPayload[] {
  if (Array.isArray(payload)) return payload as ShopReviewPayload[]
  if (payload && typeof payload === 'object') {
    const record = payload as Record<string, unknown>
    if (Array.isArray(record.reviews)) return record.reviews as ShopReviewPayload[]
    if (Array.isArray(record.items)) return record.items as ShopReviewPayload[]
  }
  return []
}

export async function fetchShopReviews(
  shopId: string,
  limit = 12,
): Promise<{ reviews: PublicReview[]; summary: ReviewSummary; error: string | null }> {
  const { data, error } = await supabase.rpc('get_shop_reviews_public', {
    p_shop_id: shopId,
    p_limit: limit,
    p_page: 0,
  })

  if (!error && data) {
    const reviews = parseShopReviewsPayload(data).map(mapShopReviewPayload)
    const summary = computeReviewSummary(reviews)
    const record = data as Record<string, unknown>
    const total =
      typeof record.total_count === 'number'
        ? record.total_count
        : typeof record.total_reviews === 'number'
          ? record.total_reviews
          : reviews.length
    const average =
      typeof record.average_rating === 'number'
        ? record.average_rating
        : summary.averageRating

    return {
      reviews,
      summary: {
        averageRating: average,
        totalReviews: total,
        distribution: summary.distribution,
      },
      error: null,
    }
  }

  const fallback = await supabase
    .from('shop_reviews')
    .select(
      `
      id,
      rating,
      title,
      review_text,
      created_at,
      is_verified_purchase,
      helpful_count,
      review_images,
      reviewer_id
    `,
    )
    .eq('shop_id', shopId)
    .eq('review_status', 'approved')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (fallback.error) {
    return {
      reviews: [],
      summary: { averageRating: null, totalReviews: 0, distribution: { ...EMPTY_DISTRIBUTION } },
      error: fallback.error.message,
    }
  }

  const shopRows = fallback.data ?? []
  const shopProfilesById = await fetchReviewerProfiles(shopRows.map((row) => row.reviewer_id))
  const reviews = shopRows.map((row, index) =>
    mapShopReviewPayload(
      {
        ...row,
        profiles: shopProfilesById.get(row.reviewer_id) ?? null,
      },
      index,
    ),
  )

  const { count } = await supabase
    .from('shop_reviews')
    .select('id', { count: 'exact', head: true })
    .eq('shop_id', shopId)
    .eq('review_status', 'approved')

  const summary = computeReviewSummary(reviews)
  if (count != null) summary.totalReviews = count

  return { reviews, summary, error: null }
}

export function hasVisibleReviews(summary: ReviewSummary) {
  const averageRating =
    summary.averageRating != null ? Number(summary.averageRating) : null
  const totalReviews = Number(summary.totalReviews) || 0

  return (
    totalReviews > 0 &&
    averageRating != null &&
    Number.isFinite(averageRating) &&
    averageRating > 0
  )
}

/** Submit a verified-purchase review via the secure marketplace RPC. */
export async function createVerifiedPurchaseReview(input: {
  orderItemId: string
  rating: number
  title?: string | null
  reviewText: string
  reviewImages?: string[]
}): Promise<{ reviewId: string | null; error: string | null }> {
  const { submitVerifiedListingReview } = await import('~/commerce/lib/customer-order-trust')
  const result = await submitVerifiedListingReview(input)
  return {
    reviewId: result.data?.reviewId ?? null,
    error: result.error,
  }
}
