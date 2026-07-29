import type { Tables, TablesInsert, TablesUpdate } from '~/lib/supabase'

import type {
  SHOP_REVIEW_BULK_ACTION_VALUES,
  SHOP_REVIEW_REPORT_REASON_VALUES,
  SHOP_REVIEW_SORT_BY_VALUES,
  SHOP_REVIEW_SORT_ORDER_VALUES,
  SHOP_REVIEW_STATUS_VALUES,
} from '~/lib/shop-review/shop-review.constants'

export type ShopReview = Tables<'shop_reviews'>
export type ShopReviewInsert = TablesInsert<'shop_reviews'>
export type ShopReviewUpdate = TablesUpdate<'shop_reviews'>
export type ShopReviewResponse = Tables<'shop_review_responses'>
export type ShopReviewHelpfulness = Tables<'shop_review_helpfulness'>
export type ShopReviewReport = Tables<'shop_review_reports'>

export type ShopReviewStatus = (typeof SHOP_REVIEW_STATUS_VALUES)[number]
export type ShopReviewReportReason = (typeof SHOP_REVIEW_REPORT_REASON_VALUES)[number]
export type ShopReviewSortBy = (typeof SHOP_REVIEW_SORT_BY_VALUES)[number]
export type ShopReviewSortOrder = (typeof SHOP_REVIEW_SORT_ORDER_VALUES)[number]
export type ShopReviewBulkAction = (typeof SHOP_REVIEW_BULK_ACTION_VALUES)[number]

export type ShopReviewImage = {
  url: string
  alt?: string | null
  caption?: string | null
}

export type ShopReviewProfile = {
  id?: string
  full_name: string | null
  username: string | null
  avatar_url: string | null
}

export type ShopReviewShopRef = {
  id: string
  shop_name: string | null
  user_id: string
}

export type ShopReviewWithRelations = ShopReview & {
  profiles?: ShopReviewProfile | null
  shops?: ShopReviewShopRef | null
  shop_review_responses?: ShopReviewResponse[] | null
  reviewer_name?: string | null
  reviewer_avatar?: string | null
  has_response?: boolean
  response?: ShopReviewResponse | null
}

export type ShopReviewCreateInput = {
  shop_id: string
  rating: number
  title?: string | null
  review_text?: string | null
  product_quality_rating?: number | null
  customer_service_rating?: number | null
  shipping_speed_rating?: number | null
  value_for_money_rating?: number | null
  is_verified_purchase?: boolean
  order_id?: string | null
  review_images?: ShopReviewImage[]
  review_metadata?: Record<string, unknown>
}

export type ShopReviewUpdateInput = {
  rating?: number
  title?: string | null
  review_text?: string | null
  product_quality_rating?: number | null
  customer_service_rating?: number | null
  shipping_speed_rating?: number | null
  value_for_money_rating?: number | null
  review_images?: ShopReviewImage[]
  review_metadata?: Record<string, unknown>
}

export type ShopReviewModerationInput = {
  review_status: ShopReviewStatus
  moderation_reason?: string | null
}

export type ShopReviewBulkModerationInput = {
  review_ids: string[]
  action: ShopReviewBulkAction
  reason?: string | null
}

export type ShopReviewFilterInput = {
  status?: ShopReviewStatus | null
  min_rating?: number | null
  max_rating?: number | null
  verified_only?: boolean
  date_from?: string | null
  date_to?: string | null
  search_term?: string | null
  sort_by?: ShopReviewSortBy
  sort_order?: ShopReviewSortOrder
  include_responses?: boolean
}

export type ShopReviewQueryInput = ShopReviewFilterInput & {
  shop_id: string
  page?: number
  limit?: number
}

export type ShopReviewResponseCreateInput = {
  review_id: string
  response_text: string
  is_public?: boolean
}

export type ShopReviewHelpfulnessInput = {
  review_id: string
  is_helpful: boolean
}

export type ShopReviewReportInput = {
  review_id: string
  report_reason: ShopReviewReportReason
  report_description?: string | null
}

export type ShopReviewStatsQueryInput = {
  shop_id: string
  date_from?: string | null
  date_to?: string | null
  include_category_ratings?: boolean
}

export type ShopReviewRatingDistribution = Record<1 | 2 | 3 | 4 | 5, number>

export type ShopReviewRatingDistributionDisplay = Record<
  string,
  { count: number; percentage: number }
>

export type ShopReviewStats = {
  total_reviews: number
  verified_reviews: number
  average_rating: number
  rating_distribution: ShopReviewRatingDistribution
  rating_percentages: Record<string, number>
  verification_rate: number
  categories?: {
    product_quality: number
    customer_service: number
    shipping_speed: number
    value_for_money: number
  }
}

export type ShopReviewSummary = {
  total: number
  average_rating: number
  distribution: ShopReviewRatingDistributionDisplay
  categories: {
    product_quality: number
    customer_service: number
    shipping_speed: number
    value_for_money: number
  }
  verified_purchases: number
  with_images: number
  with_responses: number
}

export type ShopReviewPagination = {
  page: number
  limit: number
  total: number
  has_more: boolean
  total_pages: number
}

export type ShopReviewFetchResult = {
  reviews: ShopReviewWithRelations[]
  pagination: ShopReviewPagination
}

export type ShopReviewEligibility = {
  can_review: boolean
  reason: string | null
}

export type ShopReviewRatingsRefreshResult = {
  shop_id: string
  average_rating: number
  total_reviews: number
}

export type ShopReviewValidationResult = {
  isValid: boolean
  errors: Record<string, string>
  fieldErrors: string[]
}

export type ShopReviewServiceResponse<T> = {
  success: boolean
  data: T | null
  error: string | null
  message?: string | null
}

/** Optional caller context for vendor, admin, or impersonation flows. */
export type ShopReviewAccessContext = {
  userId?: string | null
  role?: string | null
}

export type ShopReviewFetchScope = 'public' | 'management'

export type DeleteShopReviewResult = {
  review_id: string
  shop_id: string
}

export type ShopReviewPermissionCheck = {
  can_edit: boolean
  can_delete: boolean
  can_respond: boolean
  can_moderate: boolean
}
