import { formatCurrency } from '~/lib/format'

import {
  DEFAULT_SALES_ANALYTICS_FILTERS,
  DEFAULT_SALES_ANALYTICS_PAGINATION,
  DEFAULT_SALES_ANALYTICS_SORTING,
  EXPORT_FORMATS,
  SALES_ANALYTICS_CACHE_MS,
  SALES_ANALYTICS_EXPORT_HEADERS,
  SALES_ANALYTICS_VALIDATION,
  SALES_DATE_RANGES,
  SALES_DATE_TYPE,
  SALES_SORT_BY,
} from '~/lib/sales-analytics/sales-analytics.constants'
import type {
  ExportFormat,
  FormattedVendorSalesAnalytics,
  SalesAnalyticsCreateInput,
  SalesAnalyticsFilterInput,
  SalesAnalyticsGroupedPeriod,
  SalesAnalyticsQueryParams,
  SalesAnalyticsRecord,
  SalesAnalyticsUpdateInput,
  SalesExportConfig,
  SalesExportPreparedData,
  SalesSummaryMetrics,
  VendorSalesAnalyticsRow,
} from '~/lib/sales-analytics/sales-analytics.type'

// ============= DEFAULTS =============

/** Empty summary when a shop has no sales data in the selected range. */
export function buildDefaultSalesSummary(): SalesSummaryMetrics {
  return {
    totalOrders: 0,
    totalUnits: 0,
    totalRevenue: 0,
    totalItemRevenue: 0,
    totalShipping: 0,
    totalTax: 0,
    totalDiscounts: 0,
    totalRefunds: 0,
    totalReturns: 0,
    totalRefunded: 0,
    codOrders: 0,
    averageOrderValue: 0,
    returnRate: 0,
    refundRate: 0,
    codPercentage: 0,
  }
}

// ============= DATE RANGE =============

export function getDateRangeFromPreset(range: SalesAnalyticsFilterInput['dateRange']): {
  startDate: string
  endDate: string
} {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const endOfToday = new Date(today.getTime() + 24 * 60 * 60 * 1000 - 1)

  switch (range) {
    case SALES_DATE_RANGES.TODAY:
      return { startDate: today.toISOString(), endDate: endOfToday.toISOString() }

    case SALES_DATE_RANGES.YESTERDAY: {
      const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000)
      return {
        startDate: yesterday.toISOString(),
        endDate: new Date(yesterday.getTime() + 24 * 60 * 60 * 1000 - 1).toISOString(),
      }
    }

    case SALES_DATE_RANGES.LAST_7_DAYS:
      return {
        startDate: new Date(today.getTime() - 6 * 24 * 60 * 60 * 1000).toISOString(),
        endDate: endOfToday.toISOString(),
      }

    case SALES_DATE_RANGES.LAST_30_DAYS:
      return {
        startDate: new Date(today.getTime() - 29 * 24 * 60 * 60 * 1000).toISOString(),
        endDate: endOfToday.toISOString(),
      }

    case SALES_DATE_RANGES.LAST_90_DAYS:
      return {
        startDate: new Date(today.getTime() - 89 * 24 * 60 * 60 * 1000).toISOString(),
        endDate: endOfToday.toISOString(),
      }

    case SALES_DATE_RANGES.THIS_MONTH: {
      const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1)
      return {
        startDate: thisMonthStart.toISOString(),
        endDate: new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString(),
      }
    }

    case SALES_DATE_RANGES.LAST_MONTH: {
      const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59)
      return { startDate: lastMonthStart.toISOString(), endDate: lastMonthEnd.toISOString() }
    }

    case SALES_DATE_RANGES.THIS_QUARTER: {
      const quarterStart = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1)
      const quarterEnd = new Date(
        now.getFullYear(),
        Math.floor(now.getMonth() / 3) * 3 + 3,
        0,
        23,
        59,
        59,
      )
      return { startDate: quarterStart.toISOString(), endDate: quarterEnd.toISOString() }
    }

    case SALES_DATE_RANGES.LAST_QUARTER: {
      const currentQuarterStart = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1)
      const lastQuarterEnd = new Date(currentQuarterStart.getTime() - 1)
      const lastQuarterStart = new Date(
        lastQuarterEnd.getFullYear(),
        Math.floor(lastQuarterEnd.getMonth() / 3) * 3,
        1,
      )
      return { startDate: lastQuarterStart.toISOString(), endDate: lastQuarterEnd.toISOString() }
    }

    case SALES_DATE_RANGES.THIS_YEAR: {
      const yearStart = new Date(now.getFullYear(), 0, 1)
      const yearEnd = new Date(now.getFullYear(), 11, 31, 23, 59, 59)
      return { startDate: yearStart.toISOString(), endDate: yearEnd.toISOString() }
    }

    case SALES_DATE_RANGES.LAST_YEAR: {
      const yearStart = new Date(now.getFullYear() - 1, 0, 1)
      const yearEnd = new Date(now.getFullYear() - 1, 11, 31, 23, 59, 59)
      return { startDate: yearStart.toISOString(), endDate: yearEnd.toISOString() }
    }

    default:
      return {
        startDate: new Date(today.getTime() - 29 * 24 * 60 * 60 * 1000).toISOString(),
        endDate: endOfToday.toISOString(),
      }
  }
}

// ============= QUERY BUILDING =============

export function buildSalesQuery(filters: SalesAnalyticsFilterInput = {}): SalesAnalyticsQueryParams {
  const merged = {
    ...DEFAULT_SALES_ANALYTICS_FILTERS,
    ...DEFAULT_SALES_ANALYTICS_PAGINATION,
    ...DEFAULT_SALES_ANALYTICS_SORTING,
    ...filters,
  }

  const query: SalesAnalyticsQueryParams = {
    date_type: merged.dateType ?? SALES_DATE_TYPE.DELIVERED_AT,
    page: merged.page ?? DEFAULT_SALES_ANALYTICS_PAGINATION.page,
    limit: merged.limit ?? DEFAULT_SALES_ANALYTICS_PAGINATION.limit,
    sort_by: merged.sortBy ?? DEFAULT_SALES_ANALYTICS_SORTING.sortBy,
    sort_order: merged.sortOrder ?? DEFAULT_SALES_ANALYTICS_SORTING.sortOrder,
  }

  if (merged.dateRange && merged.dateRange !== SALES_DATE_RANGES.CUSTOM) {
    const { startDate, endDate } = getDateRangeFromPreset(merged.dateRange)
    query.start_date = startDate
    query.end_date = endDate
  } else if (merged.startDate && merged.endDate) {
    query.start_date = merged.startDate
    query.end_date = merged.endDate
  }

  if (merged.saleStatus && merged.saleStatus !== 'all') query.sale_status = merged.saleStatus
  if (merged.paymentMode && merged.paymentMode !== 'all') query.payment_mode = merged.paymentMode
  if (merged.deliveryStatus && merged.deliveryStatus !== 'all') {
    query.delivery_status = merged.deliveryStatus
  }
  if (merged.region?.trim()) query.delivery_region = merged.region.trim()
  if (merged.category) query.product_category = merged.category
  if (merged.isReturned !== undefined && merged.isReturned !== null) {
    query.is_returned = merged.isReturned
  }
  if (merged.isRefunded !== undefined && merged.isRefunded !== null) {
    query.is_refunded = merged.isRefunded
  }
  if (merged.searchTerm?.trim()) query.search_term = merged.searchTerm.trim()

  return query
}

export function buildExportFilters(config: SalesExportConfig): SalesAnalyticsFilterInput {
  return {
    ...config,
    dateRange: config.dateRange === 'CUSTOM_RANGE' ? SALES_DATE_RANGES.CUSTOM : config.dateRange,
    startDate: config.startDate || null,
    endDate: config.endDate || null,
    saleStatus: config.saleStatus === 'all' ? null : config.saleStatus,
    paymentMode: config.paymentMode === 'all' ? null : config.paymentMode,
    region: config.region?.trim() || null,
  }
}

export function resolveSalesSortColumn(
  sortBy: SalesAnalyticsFilterInput['sortBy'],
  dateType: SalesAnalyticsFilterInput['dateType'] = SALES_DATE_TYPE.DELIVERED_AT,
): string {
  if (sortBy) return sortBy
  return dateType === SALES_DATE_TYPE.ORDERED_AT ? SALES_SORT_BY.ORDERED_AT : SALES_SORT_BY.DELIVERED_AT
}

export function isValidQueryValue(value: unknown): boolean {
  return value !== null && value !== undefined && value !== '' && value !== 'null'
}

export function normalizeDateForQuery(value: string | null | undefined): string | null {
  if (!isValidQueryValue(value) || typeof value !== 'string') return null
  return value.split('T')[0] ?? value
}

// ============= SUMMARY / AGGREGATION =============

export function calculateSalesSummary(records: SalesAnalyticsRecord[]): SalesSummaryMetrics {
  const summary = records.reduce(
    (acc, record) => {
      acc.totalOrders += 1
      acc.totalUnits += Number(record.quantity ?? 0)
      acc.totalRevenue += Number(record.total_revenue ?? 0)
      acc.totalItemRevenue += Number(record.total_item_price ?? 0)
      acc.totalShipping += Number(record.order_shipping_amount ?? 0)
      acc.totalTax += Number(record.order_tax_amount ?? 0)
      acc.totalDiscounts += Number(record.item_discount_amount ?? 0)
      acc.totalRefunds += Number(record.refund_amount ?? 0)

      if (record.is_returned) acc.totalReturns += 1
      if (record.is_refunded) acc.totalRefunded += 1
      if (record.payment_mode === 'cod') acc.codOrders += 1

      return acc
    },
    buildDefaultSalesSummary(),
  )

  summary.averageOrderValue =
    summary.totalOrders > 0 ? summary.totalRevenue / summary.totalOrders : 0
  summary.returnRate =
    summary.totalOrders > 0 ? (summary.totalReturns / summary.totalOrders) * 100 : 0
  summary.refundRate =
    summary.totalOrders > 0 ? (summary.totalRefunded / summary.totalOrders) * 100 : 0
  summary.codPercentage =
    summary.totalOrders > 0 ? (summary.codOrders / summary.totalOrders) * 100 : 0

  return summary
}

export function calculateGrowthPercentage(current: number, previous: number): number {
  if (!previous || previous === 0) return current > 0 ? 100 : 0
  return ((current - previous) / previous) * 100
}

export function groupSalesByPeriod(
  salesData: SalesAnalyticsRecord[] = [],
  groupBy: 'day' | 'week' | 'month' | 'year' = 'day',
): Record<string, SalesAnalyticsGroupedPeriod> {
  return salesData.reduce<Record<string, SalesAnalyticsGroupedPeriod>>((acc, record) => {
    const dateValue = record.delivered_at ?? record.ordered_at
    if (!dateValue) return acc

    const date = new Date(dateValue)
    let key: string

    switch (groupBy) {
      case 'week': {
        const weekStart = new Date(date)
        weekStart.setDate(date.getDate() - date.getDay())
        key = weekStart.toISOString().split('T')[0] ?? dateValue
        break
      }
      case 'month':
        key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
        break
      case 'year':
        key = String(date.getFullYear())
        break
      case 'day':
      default:
        key = date.toISOString().split('T')[0] ?? dateValue
    }

    if (!acc[key]) {
      acc[key] = {
        period: key,
        totalOrders: 0,
        totalRevenue: 0,
        totalUnits: 0,
        returns: 0,
        refunds: 0,
      }
    }

    acc[key].totalOrders += 1
    acc[key].totalRevenue += Number(record.total_revenue ?? 0)
    acc[key].totalUnits += Number(record.quantity ?? 0)
    if (record.is_returned) acc[key].returns += 1
    if (record.is_refunded) acc[key].refunds += 1

    return acc
  }, {})
}

// ============= FORMATTING =============

export function getCurrencySymbol(currencyCode = 'INR'): string {
  const symbols: Record<string, string> = {
    INR: '₹',
    USD: '$',
    EUR: '€',
    GBP: '£',
    AUD: 'A$',
    CAD: 'C$',
    SGD: 'S$',
    AED: 'د.إ',
  }
  return symbols[currencyCode] ?? '₹'
}

export function formatPercentage(value: number | null | undefined): string {
  if (typeof value !== 'number' || Number.isNaN(value)) return '0%'
  return `${value.toFixed(2)}%`
}

export function formatSalesData(
  salesData: VendorSalesAnalyticsRow | null | undefined,
  currency = 'INR',
): FormattedVendorSalesAnalytics | null {
  if (!salesData) return null

  const formatAmount = (amount: number | null | undefined) =>
    formatCurrency(Number(amount ?? 0), currency)

  return {
    ...salesData,
    formattedTotalRevenue: formatAmount(salesData.total_revenue),
    formattedItemRevenue: formatAmount(salesData.total_item_revenue),
    formattedShippingRevenue: formatAmount(salesData.total_shipping_revenue),
    formattedTaxCollected: formatAmount(salesData.total_tax_collected),
    formattedDiscountsGiven: formatAmount(salesData.total_discounts_given),
    formattedAverageOrderValue: formatAmount(salesData.average_order_value),
    formattedRefundAmount: formatAmount(salesData.total_refund_amount),
    formattedReturnRate: formatPercentage(salesData.return_rate_percentage),
    formattedRefundRate: formatPercentage(salesData.refund_rate_percentage),
    formattedCodPercentage: formatPercentage(salesData.cod_percentage),
  }
}

function formatDateForExport(date: string | Date | null | undefined): string {
  if (!date) return ''
  try {
    return new Date(date).toLocaleDateString('en-IN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return ''
  }
}

// ============= EXPORT =============

export function prepareExportData(
  salesData: SalesAnalyticsRecord[] = [],
  format: ExportFormat = EXPORT_FORMATS.CSV,
): SalesExportPreparedData {
  if (!Array.isArray(salesData) || salesData.length === 0) {
    return {
      headers: [],
      rows: [],
      filename: `sales_export_${Date.now()}.${format}`,
      format,
    }
  }

  const rows = salesData.map((record) => [
    record.order_number ?? '',
    record.product_title ?? '',
    record.product_category ?? '',
    record.quantity ?? 0,
    record.unit_price ?? 0,
    record.total_revenue ?? 0,
    record.payment_mode ?? '',
    record.delivery_status ?? '',
    record.delivery_region ?? '',
    record.customer_id ?? '',
    formatDateForExport(record.ordered_at),
    formatDateForExport(record.delivered_at),
    record.sale_status ?? '',
    record.is_returned ? 'Yes' : 'No',
    record.is_refunded ? 'Yes' : 'No',
  ])

  const timestamp = new Date().toISOString().split('T')[0] ?? 'export'

  return {
    headers: [...SALES_ANALYTICS_EXPORT_HEADERS],
    rows,
    filename: `sales_analytics_${timestamp}.${format}`,
    format,
  }
}

export function createCsvContent(exportData: SalesExportPreparedData): string {
  if (!exportData.headers?.length || !exportData.rows) {
    throw new Error('Invalid export data structure')
  }

  const escapeCsvValue = (value: string | number | null | undefined): string => {
    if (value === null || value === undefined) return ''
    const stringValue = String(value)

    if (
      stringValue.includes(',') ||
      stringValue.includes('\n') ||
      stringValue.includes('"')
    ) {
      return `"${stringValue.replace(/"/g, '""')}"`
    }

    return stringValue
  }

  const csvRows = [
    exportData.headers.map(escapeCsvValue).join(','),
    ...exportData.rows.map((row) => row.map(escapeCsvValue).join(',')),
  ]

  return csvRows.join('\n')
}

export function getExportHelpText(format: ExportFormat): string {
  switch (format) {
    case EXPORT_FORMATS.PDF:
      return 'PDF exports may take longer to process.'
    case EXPORT_FORMATS.EXCEL:
      return 'Excel exports include additional formatting and charts.'
    case EXPORT_FORMATS.CSV:
    default:
      return 'Export will be available for download immediately.'
  }
}

// ============= OPTIMISTIC HELPERS =============

export function buildOptimisticSalesAnalyticsRecord(
  input: SalesAnalyticsCreateInput,
  requestId: string,
  shopId: string,
): SalesAnalyticsRecord {
  const now = new Date().toISOString()
  return {
    id: `temp-${requestId}`,
    shop_id: shopId,
    order_item_id: input.order_item_id,
    listing_id: '',
    order_number: '',
    product_title: 'Pending analytics record',
    product_sku: null,
    product_category: null,
    variation_details: null,
    quantity: 0,
    unit_price: 0,
    order_subtotal_amount: 0,
    order_shipping_amount: null,
    order_tax_amount: null,
    order_discount_amount: null,
    order_total_amount: 0,
    total_item_price: 0,
    item_discount_amount: null,
    total_revenue: 0,
    payment_mode: 'online',
    payment_status: 'pending',
    currency: 'INR',
    delivery_status: 'pending',
    delivery_region: null,
    delivery_country: null,
    delivery_mode: null,
    is_returned: false,
    return_reason: null,
    returned_at: null,
    is_refunded: false,
    refund_amount: null,
    refund_status: null,
    refunded_at: null,
    sale_status: 'completed',
    ordered_at: now,
    delivered_at: now,
    customer_id: null,
    order_id: null,
    created_at: now,
    updated_at: now,
  }
}

export function applySalesAnalyticsUpdate(
  record: SalesAnalyticsRecord,
  updates: SalesAnalyticsUpdateInput,
): SalesAnalyticsRecord {
  return {
    ...record,
    ...updates,
    updated_at: new Date().toISOString(),
  }
}

export function applyReturnStatusUpdate(
  record: SalesAnalyticsRecord,
  isReturned: boolean,
  returnReason?: string | null,
): SalesAnalyticsRecord {
  return applySalesAnalyticsUpdate(record, {
    is_returned: isReturned,
    return_reason: returnReason ?? record.return_reason,
    returned_at: isReturned ? new Date().toISOString() : null,
    sale_status: isReturned ? 'returned' : record.sale_status,
  })
}

export function applyRefundStatusUpdate(
  record: SalesAnalyticsRecord,
  refundAmount: number,
  refundStatus: SalesAnalyticsRecord['refund_status'],
): SalesAnalyticsRecord {
  return applySalesAnalyticsUpdate(record, {
    is_refunded: true,
    refund_amount: refundAmount,
    refund_status: refundStatus,
    refunded_at: new Date().toISOString(),
    sale_status: 'refunded',
  })
}

export function removeSalesAnalyticsRecordById(
  records: SalesAnalyticsRecord[],
  recordId: string,
): SalesAnalyticsRecord[] {
  return records.filter((record) => record.id !== recordId)
}

export function upsertSalesAnalyticsRecord(
  records: SalesAnalyticsRecord[],
  record: SalesAnalyticsRecord,
): SalesAnalyticsRecord[] {
  const index = records.findIndex((row) => row.id === record.id)
  if (index === -1) return [record, ...records]
  const next = [...records]
  next[index] = record
  return next
}

export function replaceTempSalesAnalyticsRecord(
  records: SalesAnalyticsRecord[],
  tempId: string,
  record: SalesAnalyticsRecord,
): SalesAnalyticsRecord[] {
  return upsertSalesAnalyticsRecord(
    removeSalesAnalyticsRecordById(records, tempId),
    record,
  )
}

export function indexSalesAnalyticsById(
  records: SalesAnalyticsRecord[],
): Record<string, SalesAnalyticsRecord> {
  return records.reduce<Record<string, SalesAnalyticsRecord>>((acc, record) => {
    acc[record.id] = record
    return acc
  }, {})
}

export function shouldUseSalesAnalyticsCache(
  lastFetch: number | null,
  forceRefresh?: boolean,
): boolean {
  if (forceRefresh || lastFetch == null) return false
  return Date.now() - lastFetch < SALES_ANALYTICS_CACHE_MS
}

export function trimExportHistory<T>(history: T[], max = SALES_ANALYTICS_VALIDATION.EXPORT_HISTORY_MAX): T[] {
  return history.slice(0, max)
}

export function shouldShowCustomDateRange(dateRange: SalesAnalyticsFilterInput['dateRange'] | 'CUSTOM_RANGE'): boolean {
  return dateRange === 'CUSTOM_RANGE' || dateRange === SALES_DATE_RANGES.CUSTOM
}
