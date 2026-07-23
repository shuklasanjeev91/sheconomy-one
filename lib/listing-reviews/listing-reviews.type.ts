import type { Tables, TablesInsert, TablesUpdate } from '~/lib/supabase'

import type {
  LISTING_REVIEW_ANALYTICS_GROUP_BY_VALUES,
  LISTING_REVIEW_REPORT_REASON_VALUES,
  LISTING_REVIEW_SENTIMENT_VALUES,
  LISTING_REVIEW_SORT_BY_VALUES,
  LISTING_REVIEW_SORT_ORDER_VALUES,
  LISTING_REVIEW_STATUS_VALUES,
  LISTING_REVIEW_TYPE_VALUES,
} from './listing-reviews.constants'

export type ListingReview = Tables<'listing_reviews'>
export type ListingReviewInsert = TablesInsert<'listing_reviews'>
export type ListingReviewUpdate = TablesUpdate<'listing_reviews'>
export type ListingReviewReply = Tables<'listing_review_replies'>
export type ListingReviewHelpfulness = Tables<'listing_review_helpfulness'>
export type ListingReviewReport = Tables<'listing_review_reports'>

export type ListingReviewStatus = (typeof LISTING_REVIEW_STATUS_VALUES)[number]
export type ListingReviewType = (typeof LISTING_REVIEW_TYPE_VALUES)[number]
export type ListingReviewSentiment = (typeof LISTING_REVIEW_SENTIMENT_VALUES)[number]
export type ListingReviewReportReason = (typeof LISTING_REVIEW_REPORT_REASON_VALUES)[number]
export type ListingReviewSortBy = (typeof LISTING_REVIEW_SORT_BY_VALUES)[number]
export type ListingReviewSortOrder = (typeof LISTING_REVIEW_SORT_ORDER_VALUES)[number]
export type ListingReviewAnalyticsGroupBy = (typeof LISTING_REVIEW_ANALYTICS_GROUP_BY_VALUES)[number]

export type ListingReviewImage = {
  url: string
  alt_text?: string | null
  width?: number | null
  height?: number | null
  file_size?: number | null
}

export type ListingReviewVideo = {
  url: string
  thumbnail_url?: string | null
  duration?: number | null
  file_size?: number | null
}

export type ListingReviewProfile = {
  id: string
  username: string | null
  full_name?: string | null
  avatar_url: string | null
}

export type ListingReviewListingRef = {
  id: string
  title: string | null
  listing_type: string | null
  slug?: string | null
  price?: number | null
  shop_id?: string | null
  shop?: {
    id: string
    shop_name: string | null
    logo_url: string | null
    verified?: boolean | null
    user_id: string
  } | null
}

export type ListingReviewReplyWithProfile = ListingReviewReply & {
  replier?: ListingReviewProfile | null
  parent_reply?: Pick<ListingReviewReply, 'id' | 'reply_text'> & {
    replier?: Pick<ListingReviewProfile, 'username'> | null
  } | null
}

/** Review row with optional joined relations for detail/admin views. */
export type ListingReviewWithRelations = ListingReview & {
  listing?: ListingReviewListingRef | null
  reviewer?: ListingReviewProfile | null
  variation?: { id: string; variation_name: string | null; variation_value: string | null } | null
  replies?: ListingReviewReplyWithProfile[] | null
  helpfulness_votes?: Pick<ListingReviewHelpfulness, 'id' | 'is_helpful' | 'user_id'>[] | null
}

export type ListingReviewCreateInput = {
  listing_id: string
  rating: number
  title?: string | null
  review_text: string
  quality_rating?: number | null
  value_rating?: number | null
  shipping_rating?: number | null
  service_rating?: number | null
  variation_id?: string | null
  review_type?: ListingReviewType
  review_images?: ListingReviewImage[]
  review_videos?: ListingReviewVideo[]
  order_id?: string | null
}

export type ListingReviewUpdateInput = {
  rating?: number
  title?: string | null
  review_text?: string
  quality_rating?: number | null
  value_rating?: number | null
  shipping_rating?: number | null
  service_rating?: number | null
  variation_id?: string | null
  review_images?: ListingReviewImage[]
  review_videos?: ListingReviewVideo[]
  order_id?: string | null
}

export type ListingReviewModerationInput = {
  review_status?: ListingReviewStatus
  moderation_reason?: string | null
}

export type ListingReviewFilterInput = {
  listing_ids?: string[] | null
  shop_id?: string | null
  rating?: number[] | null
  status?: ListingReviewStatus[] | null
  verified_only?: boolean
  sentiment?: ListingReviewSentiment[] | null
  date_from?: string | null
  date_to?: string | null
  search_term?: string | null
  has_images?: boolean
  has_replies?: boolean
  min_helpfulness?: number | null
  sort_by?: ListingReviewSortBy
  sort_order?: ListingReviewSortOrder
  limit?: number
  offset?: number
}

export type ListingReviewReplyCreateInput = {
  review_id: string
  reply_text: string
  parent_reply_id?: string | null
  is_public?: boolean
  is_pinned?: boolean
}

export type ListingReviewReplyUpdateInput = {
  reply_text?: string
  is_public?: boolean
  is_pinned?: boolean
}

export type ListingReviewHelpfulnessInput = {
  review_id: string
  is_helpful: boolean
}

export type ListingReviewReportInput = {
  review_id: string
  report_reason: ListingReviewReportReason
  report_description?: string | null
  evidence_urls?: string[]
}

export type ListingReviewAnalyticsParams = {
  listing_ids?: string[] | null
  shop_id?: string | null
  date_from?: string | null
  date_to?: string | null
  rating_filter?: number[] | null
  status_filter?: ListingReviewStatus[] | null
  verified_only?: boolean
  sentiment_filter?: ListingReviewSentiment[] | null
  group_by?: ListingReviewAnalyticsGroupBy
  include_trends?: boolean
}

export type ListingReviewBatchModerationInput = {
  review_ids: string[]
  updates: ListingReviewModerationInput
}

export type ListingReviewSummary = {
  listing_id: string
  total_reviews: number
  average_rating: number
  rating_1_count: number
  rating_2_count: number
  rating_3_count: number
  rating_4_count: number
  rating_5_count: number
  verified_percentage: number
  latest_review_date: string | null
  total_helpful_votes: number
}

export type ListingReviewRatingDistribution = Record<1 | 2 | 3 | 4 | 5, number>

export type ListingReviewStats = {
  total: number
  averageRating: number
  distribution: ListingReviewRatingDistribution
  verifiedPercentage: number
  withImagesPercentage: number
  averageLength: number
  averageHelpfulness: number
}

export type ListingReviewFetchResult = {
  reviews: ListingReviewWithRelations[]
  total: number
  hasMore: boolean
}

export type ListingReviewEligibility = {
  canReview: boolean
  reason: string | null
}

export type ListingReviewVendorDashboard = {
  analytics: unknown
  pending_reviews_count: number
  recent_reviews: ListingReviewWithRelations[]
  timeframe: {
    from: string | null | undefined
    to: string | null | undefined
  }
}

export type ListingReviewValidationResult = {
  isValid: boolean
  errors: Record<string, string>
  fieldErrors: string[]
}

export type ListingReviewServiceResponse<T> = {
  success: boolean
  data: T | null
  error: string | null
  message?: string | null
}

/** Optional caller context for vendor, admin, or impersonation flows. */
export type ListingReviewAccessContext = {
  userId?: string | null
  role?: string | null
}

export type ListingReviewFetchScope = 'public' | 'management'

export type DeleteListingReviewResult = {
  reviewId: string
  listingId: string
}
