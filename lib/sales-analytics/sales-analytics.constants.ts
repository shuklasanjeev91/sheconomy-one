/**
 * Sales analytics constants — enums, defaults, limits, and labels.
 *
 * Ported from legacy `sales-analytics-utils.js` (non-UI portions).
 */

export const SALES_DATE_RANGES = {
  TODAY: 'today',
  YESTERDAY: 'yesterday',
  LAST_7_DAYS: 'last_7_days',
  LAST_30_DAYS: 'last_30_days',
  LAST_90_DAYS: 'last_90_days',
  THIS_MONTH: 'this_month',
  LAST_MONTH: 'last_month',
  THIS_QUARTER: 'this_quarter',
  LAST_QUARTER: 'last_quarter',
  THIS_YEAR: 'this_year',
  LAST_YEAR: 'last_year',
  CUSTOM: 'custom',
} as const

export const SALES_DATE_RANGE_VALUES = [
  SALES_DATE_RANGES.TODAY,
  SALES_DATE_RANGES.YESTERDAY,
  SALES_DATE_RANGES.LAST_7_DAYS,
  SALES_DATE_RANGES.LAST_30_DAYS,
  SALES_DATE_RANGES.LAST_90_DAYS,
  SALES_DATE_RANGES.THIS_MONTH,
  SALES_DATE_RANGES.LAST_MONTH,
  SALES_DATE_RANGES.THIS_QUARTER,
  SALES_DATE_RANGES.LAST_QUARTER,
  SALES_DATE_RANGES.THIS_YEAR,
  SALES_DATE_RANGES.LAST_YEAR,
  SALES_DATE_RANGES.CUSTOM,
] as const

export const SALES_STATUS = {
  COMPLETED: 'completed',
  RETURNED: 'returned',
  REFUNDED: 'refunded',
  DISPUTED: 'disputed',
} as const

export const SALES_STATUS_VALUES = [
  SALES_STATUS.COMPLETED,
  SALES_STATUS.RETURNED,
  SALES_STATUS.REFUNDED,
  SALES_STATUS.DISPUTED,
] as const

export const PAYMENT_MODES = {
  COD: 'cod',
  ONLINE: 'online',
  UPI: 'upi',
  CARD: 'card',
  WALLET: 'wallet',
  NET_BANKING: 'net_banking',
  BANK_TRANSFER: 'bank_transfer',
  EMI: 'emi',
  PAY_LATER: 'pay_later',
} as const

export const PAYMENT_MODE_VALUES = [
  PAYMENT_MODES.COD,
  PAYMENT_MODES.ONLINE,
  PAYMENT_MODES.UPI,
  PAYMENT_MODES.CARD,
  PAYMENT_MODES.WALLET,
  PAYMENT_MODES.NET_BANKING,
  PAYMENT_MODES.BANK_TRANSFER,
  PAYMENT_MODES.EMI,
  PAYMENT_MODES.PAY_LATER,
] as const

export const DELIVERY_STATUS = {
  DELIVERED: 'delivered',
  PENDING: 'pending',
  SHIPPED: 'shipped',
  OUT_FOR_DELIVERY: 'out_for_delivery',
  CANCELLED: 'cancelled',
  RETURNED_TO_SENDER: 'returned_to_sender',
} as const

export const DELIVERY_STATUS_VALUES = [
  DELIVERY_STATUS.DELIVERED,
  DELIVERY_STATUS.PENDING,
  DELIVERY_STATUS.SHIPPED,
  DELIVERY_STATUS.OUT_FOR_DELIVERY,
  DELIVERY_STATUS.CANCELLED,
  DELIVERY_STATUS.RETURNED_TO_SENDER,
] as const

export const EXPORT_FORMATS = {
  CSV: 'csv',
  EXCEL: 'excel',
  PDF: 'pdf',
} as const

export const EXPORT_FORMAT_VALUES = [
  EXPORT_FORMATS.CSV,
  EXPORT_FORMATS.EXCEL,
  EXPORT_FORMATS.PDF,
] as const

export const SALES_DATE_TYPE = {
  ORDERED_AT: 'ordered_at',
  DELIVERED_AT: 'delivered_at',
} as const

export const SALES_DATE_TYPE_VALUES = [
  SALES_DATE_TYPE.ORDERED_AT,
  SALES_DATE_TYPE.DELIVERED_AT,
] as const

export const SALES_SORT_BY = {
  DELIVERED_AT: 'delivered_at',
  ORDERED_AT: 'ordered_at',
  SALE_DATE: 'sale_date',
  TOTAL_REVENUE: 'total_revenue',
  QUANTITY: 'quantity',
} as const

export const SALES_SORT_BY_VALUES = [
  SALES_SORT_BY.DELIVERED_AT,
  SALES_SORT_BY.ORDERED_AT,
  SALES_SORT_BY.SALE_DATE,
  SALES_SORT_BY.TOTAL_REVENUE,
  SALES_SORT_BY.QUANTITY,
] as const

export const SALES_SORT_ORDER = {
  ASC: 'asc',
  DESC: 'desc',
} as const

export const SALES_SORT_ORDER_VALUES = [SALES_SORT_ORDER.ASC, SALES_SORT_ORDER.DESC] as const

export const SALES_ANALYTICS_VIEW_TYPE = {
  ANALYTICS: 'analytics',
  DETAILED: 'detailed',
  TOP_PRODUCTS: 'top-products',
  REGIONAL: 'regional',
  SUMMARY: 'summary',
} as const

export const SALES_ANALYTICS_FETCH_SCOPE = {
  VENDOR: 'vendor',
  ADMIN: 'admin',
} as const

export const SALES_ANALYTICS_FETCH_SCOPE_VALUES = [
  SALES_ANALYTICS_FETCH_SCOPE.VENDOR,
  SALES_ANALYTICS_FETCH_SCOPE.ADMIN,
] as const

export const SALES_ANALYTICS_VALIDATION = {
  PAGE: { MIN: 1 },
  LIMIT: { MIN: 1, MAX: 100, EXPORT_MAX: 10000 },
  SEARCH_TERM: { MAX_LENGTH: 200 },
  MAX_DATE_RANGE_MS: 2 * 365 * 24 * 60 * 60 * 1000,
  EXPORT_HISTORY_MAX: 10,
  TOP_PRODUCTS_DEFAULT_LIMIT: 10,
  REGIONAL_SALES_DEFAULT_LIMIT: 20,
} as const

export const DEFAULT_SALES_ANALYTICS_FILTERS = {
  dateRange: SALES_DATE_RANGES.LAST_30_DAYS,
  startDate: null,
  endDate: null,
  saleStatus: null,
  paymentMode: null,
  deliveryStatus: null,
  region: null,
  category: null,
  isReturned: null,
  isRefunded: null,
  searchTerm: '',
  dateType: SALES_DATE_TYPE.DELIVERED_AT,
} as const

export const DEFAULT_SALES_ANALYTICS_PAGINATION = {
  page: 1,
  limit: 20,
  totalRecords: 0,
  hasMore: false,
} as const

export const DEFAULT_SALES_ANALYTICS_SORTING = {
  sortBy: SALES_SORT_BY.DELIVERED_AT,
  sortOrder: SALES_SORT_ORDER.DESC,
} as const

export const DEFAULT_EXPORT_CONFIG = {
  format: EXPORT_FORMATS.CSV,
  dateRange: SALES_DATE_RANGES.LAST_30_DAYS,
  startDate: '',
  endDate: '',
  includeDetails: true,
  includeReturns: true,
  includeRefunds: true,
  saleStatus: 'all',
  paymentMode: 'all',
  region: '',
} as const

export const SALES_ANALYTICS_SUCCESS_MESSAGES = {
  EXPORT_COMPLETED: 'Sales export completed successfully.',
  DATA_REFRESHED: 'Sales analytics refreshed.',
  RETURN_STATUS_UPDATED: 'Return status updated.',
  REFUND_STATUS_UPDATED: 'Refund status updated.',
  RECORD_CREATED: 'Sales analytics record created.',
} as const

export const SALES_ANALYTICS_EXPORT_HEADERS = [
  'Order Number',
  'Product Title',
  'Category',
  'Quantity',
  'Unit Price',
  'Total Revenue',
  'Payment Mode',
  'Delivery Status',
  'Region',
  'Customer ID',
  'Ordered Date',
  'Delivered Date',
  'Sale Status',
  'Return Status',
  'Refund Status',
] as const

export const SALES_ANALYTICS_CACHE_MS = 30_000
