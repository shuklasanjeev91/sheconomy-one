import {
  DEFAULT_LISTING_REVIEW_FILTERS,
  LISTING_REVIEW_DISPLAY,
  LISTING_REVIEW_SORT_BY,
  LISTING_REVIEW_STATUS,
  LISTING_REVIEW_VALIDATION,
} from './listing-reviews.constants'
import type {
  ListingReview,
  ListingReviewCreateInput,
  ListingReviewFilterInput,
  ListingReviewRatingDistribution,
  ListingReviewStats,
  ListingReviewSummary,
  ListingReviewWithRelations,
} from './listing-reviews.type'

// ============= DEFAULTS =============

/** Empty summary row for listings without review data (legacy MV fill pattern). */
export function buildDefaultListingReviewSummary(listingId: string): ListingReviewSummary {
  return {
    listing_id: listingId,
    total_reviews: 0,
    average_rating: 0,
    rating_1_count: 0,
    rating_2_count: 0,
    rating_3_count: 0,
    rating_4_count: 0,
    rating_5_count: 0,
    verified_percentage: 0,
    latest_review_date: null,
    total_helpful_votes: 0,
  }
}

export function fillListingReviewSummaries(
  listingIds: string[],
  rows: ListingReviewSummary[] | null | undefined,
): ListingReviewSummary[] {
  const map = new Map((rows ?? []).map((row) => [row.listing_id, row]))
  return listingIds.map((listingId) => map.get(listingId) ?? buildDefaultListingReviewSummary(listingId))
}

// ============= SORT / FILTER =============

export function resolveListingReviewSortColumn(sortBy: ListingReviewFilterInput['sort_by']): string {
  switch (sortBy) {
    case LISTING_REVIEW_SORT_BY.HELPFULNESS:
      return 'helpful_count'
    case LISTING_REVIEW_SORT_BY.REPLIES:
      return 'reply_count'
    case LISTING_REVIEW_SORT_BY.RATING:
      return 'rating'
    case LISTING_REVIEW_SORT_BY.CREATED_AT:
    default:
      return 'created_at'
  }
}

export function sortListingReviews<T extends Pick<ListingReview, 'created_at' | 'rating' | 'helpful_count' | 'reply_count'>>(
  reviews: T[],
  sortBy: ListingReviewFilterInput['sort_by'] = DEFAULT_LISTING_REVIEW_FILTERS.sort_by,
  sortOrder: ListingReviewFilterInput['sort_order'] = DEFAULT_LISTING_REVIEW_FILTERS.sort_order,
): T[] {
  const column = resolveListingReviewSortColumn(sortBy)
  const direction = sortOrder === 'asc' ? 1 : -1

  return [...reviews].sort((a, b) => {
    const left = a[column as keyof T]
    const right = b[column as keyof T]

    if (left == null && right == null) return 0
    if (left == null) return 1
    if (right == null) return -1

    if (typeof left === 'string' && typeof right === 'string') {
      return (new Date(left).getTime() - new Date(right).getTime()) * direction
    }

    if (typeof left === 'number' && typeof right === 'number') {
      return (left - right) * direction
    }

    return 0
  })
}

export function shouldUseListingReviewCache(
  lastFetch: number | null | undefined,
  forceRefresh?: boolean,
): boolean {
  if (forceRefresh) return false
  if (!lastFetch) return false
  return Date.now() - lastFetch < LISTING_REVIEW_VALIDATION.CACHE_TTL_MS
}

// ============= MEDIA =============

export function parseListingReviewImages(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value
    .map((item) => {
      if (typeof item === 'string') return item
      if (item && typeof item === 'object' && 'url' in item && typeof item.url === 'string') {
        return item.url
      }
      return null
    })
    .filter((item): item is string => Boolean(item))
}

// ============= STATS =============

export function calculateAverageRating(
  reviews: Pick<ListingReview, 'rating'>[] | null | undefined,
): number {
  if (!reviews?.length) return 0

  const validRatings = reviews
    .map((review) => review.rating)
    .filter((rating) => typeof rating === 'number' && rating >= 1 && rating <= 5)

  if (!validRatings.length) return 0

  const sum = validRatings.reduce((total, rating) => total + rating, 0)
  return Math.round((sum / validRatings.length) * 10) / 10
}

export function calculateRatingDistribution(
  reviews: Pick<ListingReview, 'rating'>[] | null | undefined,
): ListingReviewRatingDistribution {
  const distribution: ListingReviewRatingDistribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
  if (!reviews?.length) return distribution

  for (const review of reviews) {
    const rating = review.rating
    if (typeof rating === 'number' && rating >= 1 && rating <= 5) {
      const bucket = Math.min(5, Math.max(1, Math.round(rating))) as 1 | 2 | 3 | 4 | 5
      distribution[bucket] += 1
    }
  }

  return distribution
}

export function calculateListingReviewStats(
  reviews: ListingReviewWithRelations[] | null | undefined,
): ListingReviewStats {
  if (!reviews?.length) {
    return {
      total: 0,
      averageRating: 0,
      distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
      verifiedPercentage: 0,
      withImagesPercentage: 0,
      averageLength: 0,
      averageHelpfulness: 0,
    }
  }

  const total = reviews.length
  const verifiedCount = reviews.filter((review) => review.is_verified_purchase).length
  const withImagesCount = reviews.filter((review) => parseListingReviewImages(review.review_images).length > 0).length
  const totalLength = reviews.reduce((sum, review) => sum + (review.review_text?.length ?? 0), 0)

  const totalHelpfulness = reviews.reduce((sum, review) => {
    const helpfulVotes = review.helpful_count ?? 0
    const totalVotes = helpfulVotes + (review.not_helpful_count ?? 0)
    return sum + (totalVotes > 0 ? helpfulVotes / totalVotes : 0)
  }, 0)

  return {
    total,
    averageRating: calculateAverageRating(reviews),
    distribution: calculateRatingDistribution(reviews),
    verifiedPercentage: total > 0 ? Math.round((verifiedCount / total) * 100) : 0,
    withImagesPercentage: total > 0 ? Math.round((withImagesCount / total) * 100) : 0,
    averageLength: total > 0 ? Math.round(totalLength / total) : 0,
    averageHelpfulness: total > 0 ? Math.round((totalHelpfulness / total) * 100) : 0,
  }
}

// ============= FORMAT =============

export function formatListingReviewRating(
  rating: number | null | undefined,
  showNumber = true,
): { stars: string; text: string; ariaLabel: string; value: number } {
  if (!rating || rating < 1 || rating > 5) {
    return {
      stars: '☆☆☆☆☆',
      text: showNumber ? LISTING_REVIEW_DISPLAY.UNRATED : '',
      ariaLabel: 'No rating',
      value: 0,
    }
  }

  const fullStars = '★'.repeat(Math.floor(rating))
  const halfStar = rating % 1 >= 0.5 ? '½' : ''
  const emptyStars = '☆'.repeat(5 - Math.ceil(rating))

  return {
    stars: fullStars + halfStar + emptyStars,
    text: showNumber ? `(${rating})` : '',
    ariaLabel: `${rating} out of 5 stars`,
    value: rating,
  }
}

export function formatListingReviewDate(date: string | Date | null | undefined): string {
  if (!date) return ''

  const reviewDate = new Date(date)
  const now = new Date()
  const diffTime = Math.abs(now.getTime() - reviewDate.getTime())
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))

  if (diffDays === 0) {
    const diffHours = Math.floor(diffTime / (1000 * 60 * 60))
    if (diffHours === 0) {
      const diffMinutes = Math.floor(diffTime / (1000 * 60))
      return diffMinutes < 1 ? LISTING_REVIEW_DISPLAY.JUST_NOW : `${diffMinutes}m ago`
    }
    return `${diffHours}h ago`
  }

  if (diffDays === 1) return LISTING_REVIEW_DISPLAY.YESTERDAY
  if (diffDays < 7) return `${diffDays} days ago`
  if (diffDays < 30) {
    const weeks = Math.floor(diffDays / 7)
    return `${weeks} week${weeks > 1 ? 's' : ''} ago`
  }
  if (diffDays < 365) {
    const months = Math.floor(diffDays / 30)
    return `${months} month${months > 1 ? 's' : ''} ago`
  }

  return reviewDate.toLocaleDateString()
}

export function formatListingReviewStatus(status: string | null | undefined): {
  value: string
  label: string
} {
  const value = status ?? LISTING_REVIEW_STATUS.PENDING
  return {
    value,
    label:
      LISTING_REVIEW_DISPLAY.STATUS_LABELS[value as keyof typeof LISTING_REVIEW_DISPLAY.STATUS_LABELS] ??
      value,
  }
}

export function formatHelpfulnessRatio(helpful = 0, notHelpful = 0): string {
  const total = helpful + notHelpful
  if (total === 0) return '0%'
  return `${Math.round((helpful / total) * 100)}%`
}

export function truncateListingReviewText(
  text: string | null | undefined,
  maxLength = 150,
  preserveWords = true,
): string {
  if (!text || text.length <= maxLength) return text ?? ''

  if (preserveWords) {
    const truncated = text.substring(0, maxLength)
    const lastSpaceIndex = truncated.lastIndexOf(' ')
    return lastSpaceIndex > 0 ? `${truncated.substring(0, lastSpaceIndex)}...` : `${truncated}...`
  }

  return `${text.substring(0, maxLength)}...`
}

// ============= STATE HELPERS =============

export function upsertListingReview(
  reviews: ListingReviewWithRelations[],
  review: ListingReviewWithRelations,
): ListingReviewWithRelations[] {
  if (reviews.some((row) => row.id === review.id)) {
    return reviews.map((row) => (row.id === review.id ? { ...row, ...review } : row))
  }
  return [review, ...reviews]
}

export function removeListingReviewById(
  reviews: ListingReviewWithRelations[],
  reviewId: string,
): ListingReviewWithRelations[] {
  return reviews.filter((review) => review.id !== reviewId)
}

export function indexListingReviewsById(
  reviews: ListingReviewWithRelations[],
): Record<string, ListingReviewWithRelations> {
  return Object.fromEntries(reviews.map((review) => [review.id, review]))
}

export function mergeListingReviewsById(
  current: Record<string, ListingReviewWithRelations>,
  reviews: ListingReviewWithRelations[],
): Record<string, ListingReviewWithRelations> {
  const next = { ...current }
  for (const review of reviews) {
    next[review.id] = review
  }
  return next
}

export function buildOptimisticListingReview(
  requestId: string,
  reviewerId: string,
  input: ListingReviewCreateInput,
): ListingReviewWithRelations {
  const now = new Date().toISOString()
  return {
    id: `temp-${requestId}`,
    listing_id: input.listing_id,
    reviewer_id: reviewerId,
    rating: input.rating,
    title: input.title?.trim() || null,
    review_text: input.review_text.trim(),
    quality_rating: input.quality_rating ?? null,
    value_rating: input.value_rating ?? null,
    shipping_rating: input.shipping_rating ?? null,
    service_rating: input.service_rating ?? null,
    variation_id: input.variation_id ?? null,
    review_type: input.review_type ?? 'listing',
    review_images: input.review_images ?? [],
    review_videos: input.review_videos ?? [],
    order_id: input.order_id ?? null,
    review_status: LISTING_REVIEW_STATUS.PENDING,
    is_verified_purchase: Boolean(input.order_id),
    helpful_count: 0,
    not_helpful_count: 0,
    reply_count: 0,
    auto_sentiment: null,
    analytics_data: {},
    review_metadata: {},
    moderated_at: null,
    moderated_by: null,
    moderation_reason: null,
    published_at: null,
    purchase_verified_at: null,
    created_at: now,
    updated_at: now,
  }
}

export function applyListingReviewUpdate(
  review: ListingReviewWithRelations,
  input: Partial<ListingReviewWithRelations>,
): ListingReviewWithRelations {
  return {
    ...review,
    ...input,
    title: input.title === undefined ? review.title : input.title?.trim() || null,
    review_text: input.review_text === undefined ? review.review_text : input.review_text.trim(),
    updated_at: new Date().toISOString(),
  }
}

export function reviewMatchesCurrentFilters(
  review: ListingReviewWithRelations,
  filters: ListingReviewFilterInput,
): boolean {
  if (filters.listing_ids?.length && !filters.listing_ids.includes(review.listing_id)) {
    return false
  }

  if (filters.status?.length && !filters.status.includes(review.review_status)) {
    return false
  }

  if (filters.rating?.length && !filters.rating.includes(review.rating)) {
    return false
  }

  if (filters.verified_only && !review.is_verified_purchase) {
    return false
  }

  if (filters.sentiment?.length && review.auto_sentiment && !filters.sentiment.includes(review.auto_sentiment)) {
    return false
  }

  if (filters.has_images && parseListingReviewImages(review.review_images).length === 0) {
    return false
  }

  if (filters.has_replies && (review.reply_count ?? 0) === 0) {
    return false
  }

  if (filters.min_helpfulness != null && (review.helpful_count ?? 0) < filters.min_helpfulness) {
    return false
  }

  if (filters.search_term) {
    const needle = filters.search_term.toLowerCase()
    const haystack = `${review.title ?? ''} ${review.review_text}`.toLowerCase()
    if (!haystack.includes(needle)) return false
  }

  return true
}

export function computeListingReviewPagination(
  fetchedCount: number,
  total: number,
  limit: number,
): { total: number; hasMore: boolean } {
  return {
    total,
    hasMore: fetchedCount === limit && total > limit,
  }
}
