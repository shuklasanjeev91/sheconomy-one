import type { Tables } from '~/lib/supabase'

import type {
  DELIVERY_STATUS_VALUES,
  EXPORT_FORMAT_VALUES,
  PAYMENT_MODE_VALUES,
  SALES_ANALYTICS_FETCH_SCOPE_VALUES,
  SALES_DATE_RANGE_VALUES,
  SALES_DATE_TYPE_VALUES,
  SALES_SORT_BY_VALUES,
  SALES_SORT_ORDER_VALUES,
  SALES_STATUS_VALUES,
} from '~/lib/sales-analytics/sales-analytics.constants'

export type SalesAnalyticsRecord = Tables<'sales_analytics'>
export type VendorSalesAnalyticsRow = Tables<'vendor_sales_analytics'>
export type VendorTopProductRow = Tables<'vendor_top_products'>
export type VendorRegionalSalesRow = Tables<'vendor_regional_sales'>

export type SalesDateRange = (typeof SALES_DATE_RANGE_VALUES)[number]
export type SalesStatus = (typeof SALES_STATUS_VALUES)[number]
export type PaymentMode = (typeof PAYMENT_MODE_VALUES)[number]
export type DeliveryStatus = (typeof DELIVERY_STATUS_VALUES)[number]
export type ExportFormat = (typeof EXPORT_FORMAT_VALUES)[number]
export type SalesDateType = (typeof SALES_DATE_TYPE_VALUES)[number]
export type SalesSortBy = (typeof SALES_SORT_BY_VALUES)[number]
export type SalesSortOrder = (typeof SALES_SORT_ORDER_VALUES)[number]
export type SalesAnalyticsFetchScope = (typeof SALES_ANALYTICS_FETCH_SCOPE_VALUES)[number]

export type SalesAnalyticsAccessContext = {
  userId?: string | null
  role?: string | null
}

export type SalesAnalyticsFilterInput = {
  dateRange?: SalesDateRange | null
  startDate?: string | null
  endDate?: string | null
  saleStatus?: SalesStatus | 'all' | null
  paymentMode?: PaymentMode | 'all' | null
  deliveryStatus?: DeliveryStatus | 'all' | null
  region?: string | null
  category?: string | null
  isReturned?: boolean | null
  isRefunded?: boolean | null
  searchTerm?: string | null
  dateType?: SalesDateType
  page?: number
  limit?: number
  sortBy?: SalesSortBy
  sortOrder?: SalesSortOrder
  forExport?: boolean
}

export type SalesAnalyticsQueryParams = {
  start_date?: string | null
  end_date?: string | null
  date_type: SalesDateType
  sale_status?: SalesStatus | null
  payment_mode?: PaymentMode | null
  delivery_status?: DeliveryStatus | null
  delivery_region?: string | null
  product_category?: string | null
  is_returned?: boolean | null
  is_refunded?: boolean | null
  search_term?: string | null
  page: number
  limit: number
  sort_by: SalesSortBy
  sort_order: SalesSortOrder
}

export type SalesAnalyticsPagination = {
  page: number
  limit: number
  totalRecords: number
  hasMore: boolean
}

export type SalesAnalyticsSorting = {
  sortBy: SalesSortBy
  sortOrder: SalesSortOrder
}

export type SalesSummaryMetrics = {
  totalOrders: number
  totalUnits: number
  totalRevenue: number
  totalItemRevenue: number
  totalShipping: number
  totalTax: number
  totalDiscounts: number
  totalRefunds: number
  totalReturns: number
  totalRefunded: number
  codOrders: number
  averageOrderValue: number
  returnRate: number
  refundRate: number
  codPercentage: number
}

export type SalesExportConfig = {
  format: ExportFormat
  dateRange?: SalesDateRange | 'CUSTOM_RANGE' | null
  startDate?: string | null
  endDate?: string | null
  includeDetails?: boolean
  includeReturns?: boolean
  includeRefunds?: boolean
  saleStatus?: SalesStatus | 'all' | null
  paymentMode?: PaymentMode | 'all' | null
  region?: string | null
}

export type SalesExportPreparedData = {
  headers: string[]
  rows: (string | number)[][]
  filename: string
  format: ExportFormat
  content?: string
}

export type SalesExportHistoryItem = {
  id: string
  shopId: string
  format: ExportFormat
  filename: string
  filters: SalesAnalyticsFilterInput
  timestamp: string
  status: 'completed' | 'failed' | 'processing'
}

export type SalesAnalyticsServiceMetadata = {
  timestamp: string
  totalRecords?: number | null
  page?: number
  limit?: number
  hasMore?: boolean
  recordsAnalyzed?: number
  appliedFilters?: Record<string, unknown>
  shop_id?: string
  format?: ExportFormat
  recordCount?: number
}

export type SalesAnalyticsServiceResponse<T> = {
  success: boolean
  data: T | null
  error: string | null
  message?: string | null
  metadata?: SalesAnalyticsServiceMetadata
}

export type SalesAnalyticsFetchResult<T> = {
  rows: T[]
  totalRecords: number
  page: number
  limit: number
  hasMore: boolean
}

export type SalesAnalyticsCreateInput = {
  order_item_id: string
}

export type SalesAnalyticsReturnStatusInput = {
  order_item_id: string
  is_returned: boolean
  return_reason?: string | null
}

export type SalesAnalyticsRefundStatus =
  | 'requested'
  | 'processing'
  | 'approved'
  | 'completed'
  | 'rejected'
  | 'cancelled'

export type SalesAnalyticsRefundStatusInput = {
  order_item_id: string
  refund_amount: number
  refund_status: SalesAnalyticsRefundStatus
}

export type SalesAnalyticsUpdateInput = Partial<
  Pick<
    SalesAnalyticsRecord,
    | 'sale_status'
    | 'is_returned'
    | 'return_reason'
    | 'returned_at'
    | 'is_refunded'
    | 'refund_amount'
    | 'refund_status'
    | 'refunded_at'
    | 'delivery_status'
    | 'payment_status'
  >
>

export type SalesAnalyticsValidationResult = {
  isValid: boolean
  errors: Record<string, string>
  fieldErrors: string[]
}

export type FormattedVendorSalesAnalytics = VendorSalesAnalyticsRow & {
  formattedTotalRevenue?: string
  formattedItemRevenue?: string
  formattedShippingRevenue?: string
  formattedTaxCollected?: string
  formattedDiscountsGiven?: string
  formattedAverageOrderValue?: string
  formattedRefundAmount?: string
  formattedReturnRate?: string
  formattedRefundRate?: string
  formattedCodPercentage?: string
}

export type SalesAnalyticsGroupedPeriod = {
  period: string
  totalOrders: number
  totalRevenue: number
  totalUnits: number
  returns: number
  refunds: number
}

export type SalesAnalyticsShopDataCheck = {
  vendor_sales_analytics: { count: number; error: string | null }
  sales_analytics: { count: number; error: string | null }
  vendor_top_products: { count: number; error: string | null }
  vendor_regional_sales: { count: number; error: string | null }
}

export type TopProductsOptions = {
  limit?: number
  timeframe?: string
}

export type RegionalSalesOptions = {
  limit?: number
}
