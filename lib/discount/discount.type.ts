/**
 * Discount feature types — shared models, service shapes, and access context.
 *
 * Typed against generated Supabase schema where possible.
 */

import type { Json, Tables, TablesInsert, TablesUpdate } from '~/lib/supabase'

import type {
  APPLIES_TO_VALUES,
  BOGO_GET_DISCOUNT_TYPE_VALUES,
  DEFAULT_DISCOUNT_FILTERS,
  DEFAULT_DISCOUNT_PAGINATION,
  DISCOUNT_FETCH_SCOPE_VALUES,
  DISCOUNT_SORT_BY_VALUES,
  DISCOUNT_SORT_ORDER_VALUES,
  DISCOUNT_SOURCE_VALUES,
  DISCOUNT_TYPE_VALUES,
  DISCOUNT_USER_TYPE_VALUES,
} from '~/lib/discount/discount.constants'

// ============= SERVICE RESPONSE =============

export type DiscountServiceMetadata = {
  timestamp: string
  total?: number
}

export type DiscountServiceResponse<T> = {
  data: T | null
  error: string | null
  success: boolean
  message?: string | null
  metadata?: DiscountServiceMetadata
}

export type DiscountPagination = {
  page: number
  limit: number
  total: number
  total_pages: number
  has_more: boolean
}

// ============= TABLE ROW TYPES =============

export type DiscountProfileRow = Tables<'discount_profiles'>
export type DiscountProfileInsert = TablesInsert<'discount_profiles'>
export type DiscountProfileUpdate = TablesUpdate<'discount_profiles'>

export type BogoRuleRow = Tables<'bogo_rules'>
export type BogoRuleInsert = TablesInsert<'bogo_rules'>
export type BogoRuleUpdate = TablesUpdate<'bogo_rules'>

export type ListingDiscountRow = Tables<'listing_discounts'>
export type OrderDiscountRow = Tables<'order_discounts'>

// ============= DOMAIN SHAPES =============

export type DiscountType = (typeof DISCOUNT_TYPE_VALUES)[number]
export type AppliesTo = (typeof APPLIES_TO_VALUES)[number]
export type DiscountUserType = (typeof DISCOUNT_USER_TYPE_VALUES)[number]
export type BogoGetDiscountType = (typeof BOGO_GET_DISCOUNT_TYPE_VALUES)[number]
export type DiscountSource = (typeof DISCOUNT_SOURCE_VALUES)[number]
export type DiscountSortBy = (typeof DISCOUNT_SORT_BY_VALUES)[number]
export type DiscountSortOrder = (typeof DISCOUNT_SORT_ORDER_VALUES)[number]
export type DiscountFetchScope = (typeof DISCOUNT_FETCH_SCOPE_VALUES)[number]

export type DiscountPosterMetadata = {
  id: string
  name: string
  slug: string
  file_path: string
  url: string
  width: number
  height: number
  size: number
  uploaded_at: string
  updated_at?: string
}

export type SaleEventRef = {
  id: string
  event_name: string
  event_slug: string | null
  start_date: string
  end_date: string
  status: string
  description?: string | null
  banner_image?: string | null
}

export type EventOfferRef = {
  id: string
  offer_name: string
  event_id: string
  sale_events: SaleEventRef | null
}

export type BogoRule = Pick<
  BogoRuleRow,
  | 'id'
  | 'buy_listing_ids'
  | 'buy_categories'
  | 'buy_quantity'
  | 'get_listing_ids'
  | 'get_categories'
  | 'get_quantity'
  | 'get_discount_type'
  | 'get_discount_value'
>

export type DiscountProfile = DiscountProfileRow & {
  bogo_rule?: BogoRule | null
  bogo_rules?: BogoRule[] | BogoRule | null
  event_offers?: EventOfferRef | null
  discount_poster?: DiscountPosterMetadata[] | Json | null
  _optimistic?: boolean
}

export type DiscountListResult = {
  discounts: DiscountProfile[]
  pagination: DiscountPagination
}

export type DiscountFilterInput = {
  active_only?: boolean
  include_expired?: boolean
  discount_type?: DiscountType | null
  applies_to?: AppliesTo | null
  search?: string | null
  sort_by?: DiscountSortBy
  sort_order?: DiscountSortOrder
  source?: DiscountSource | null
  page?: number
  limit?: number
}

export type DiscountAccessContext = {
  userId?: string | null
  role?: string | null
  shopOwnerId?: string | null
}

export type DiscountCreateInput = {
  shop_id: string
  discount_name: string
  description?: string | null
  discount_code?: string | null
  discount_type: DiscountType
  discount_value: number
  max_discount_amount?: number | null
  applies_to: AppliesTo
  eligible_categories?: string[] | null
  eligible_listings?: string[] | null
  min_order_amount?: number | null
  max_uses_total?: number | null
  max_uses_per_customer?: number | null
  eligible_user_types?: DiscountUserType[]
  valid_from?: string
  valid_until?: string | null
  is_active?: boolean
  discount_currency?: string
}

export type DiscountUpdateInput = Partial<
  Omit<DiscountCreateInput, 'shop_id' | 'discount_type'>
> & {
  eligible_categories?: string[] | null
  eligible_listings?: string[] | null
}

export type BogoRuleInput = {
  buy_listing_ids?: string[]
  buy_categories?: string[]
  buy_quantity?: number
  get_listing_ids?: string[]
  get_categories?: string[]
  get_quantity?: number
  get_discount_type?: BogoGetDiscountType
  get_discount_value?: number
  template_id?: string
}

export type DiscountValidationContext = {
  user_id?: string
  order_total?: number
  shipping_amount?: number
  listing_ids?: string[]
  categories?: string[]
  user_type?: DiscountUserType
  shop_id?: string
}

export type DiscountCartItem = {
  listing_id: string
  price: number
  quantity: number
  category?: string | null
  category_id?: string | null
}

export type DiscountItemBreakdown = {
  listing_id: string
  item_total: number
  discount_amount: number
  final_price: number
  is_eligible: boolean
  is_bogo_get_item?: boolean
  discounted_quantity?: number
}

export type DiscountCartBreakdown = {
  total_discount: number
  item_breakdown: DiscountItemBreakdown[]
  is_bogo_eligible?: boolean
  bogo_trigger_count?: number
}

export type DiscountPreviewResult = {
  discount: DiscountProfile
  breakdown: DiscountCartBreakdown
}

export type DiscountApplicationInput = {
  order_item_id: string
  discount_profile_id: string
  listing_discount_id?: string | null
  discount_name: string
  discount_type: DiscountType
  discount_amount: number
  applied_by_code?: boolean
  metadata?: Record<string, unknown>
}

export type DiscountAnalyticsFilters = {
  date_from?: string
  date_to?: string
}

export type DiscountAnalytics = {
  total_discounts_applied: number
  total_discount_amount: number
  by_discount: Record<string, number>
  by_type: Record<string, number>
  unique_customers: number
  orders_with_discounts: number
}

export type DiscountUsageHistoryItem = OrderDiscountRow & {
  order_item?: { order_id?: string | null } | null
}

export type DiscountUsageHistoryResult = {
  items: DiscountUsageHistoryItem[]
  pagination: DiscountPagination
}

export type CustomerDiscountUsage = {
  discount_profile_id: string
  usage_count: number
}

export type DiscountStats = {
  total: number
  active: number
  inactive: number
  expired: number
  byType: Record<DiscountType, number>
}

export type DiscountValidationResult<T> = {
  isValid: boolean
  errors: string[]
  data: T | null
}

export type DiscountFormInput = {
  discount_name: string
  discount_code?: string
  description?: string
  discount_type: DiscountType
  discount_value: number | string
  max_discount_amount?: number | string
  applies_to: AppliesTo
  min_order_amount?: number | string
  max_uses_total?: number | string
  max_uses_per_customer?: number | string
  eligible_user_types?: DiscountUserType[]
  is_active?: boolean
  valid_from?: string
  valid_until?: string
  bogo_rule?: BogoRuleInput
}

export type DiscountListQueryOptions = DiscountFilterInput

export type DefaultDiscountFilters = typeof DEFAULT_DISCOUNT_FILTERS
export type DefaultDiscountPagination = typeof DEFAULT_DISCOUNT_PAGINATION

export type DiscountPosterUploadFile = File | Blob

export type BulkDiscountStatusInput = {
  discountIds: string[]
  isActive: boolean
  shopId?: string
  accessContext?: DiscountAccessContext
}

export type BulkDiscountDeleteInput = {
  discountIds: string[]
  shopId?: string
  accessContext?: DiscountAccessContext
}

export type LinkDiscountListingsInput = {
  discountId: string
  listingIds: string[]
  shopId?: string
  accessContext?: DiscountAccessContext
}

export type OptimisticDiscountSnapshot = {
  discounts: DiscountProfile[]
  currentDiscountId: string | null
  pagination: DiscountPagination
}
