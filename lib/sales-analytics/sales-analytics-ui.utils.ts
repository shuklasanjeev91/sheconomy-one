import {
  DELIVERY_STATUS,
  PAYMENT_MODES,
  SALES_DATE_RANGES,
  SALES_STATUS,
} from '~/lib/sales-analytics/sales-analytics.constants'
import type {
  SalesAnalyticsFilterInput,
  SalesAnalyticsRecord,
  SalesSummaryMetrics,
  VendorRegionalSalesRow,
  VendorSalesAnalyticsRow,
  VendorTopProductRow,
} from '~/lib/sales-analytics/sales-analytics.type'
import { formatPercentage } from '~/lib/sales-analytics/sales-analytics.utils'

export type SalesAnalyticsHubTab = 'overview' | 'detailed' | 'products' | 'regional' | 'forecast'

export type SalesAnalyticsHubTabDef = {
  id: SalesAnalyticsHubTab
  label: string
  count?: number
}

export type SalesAnalyticsSummaryCard = {
  id: string
  label: string
  value: string
  hint: string
}

export type SalesAnalyticsTrendPoint = {
  label: string
  revenue: number
  orders: number
  returns: number
}

export type SalesAnalyticsCategoryPoint = {
  name: string
  revenue: number
  orders: number
}

export type SalesAnalyticsStatusBadge = {
  label: string
  tone: 'success' | 'warning' | 'danger' | 'muted'
}

export const SALES_DATE_RANGE_OPTIONS = [
  { value: SALES_DATE_RANGES.LAST_7_DAYS, label: 'Last 7 days' },
  { value: SALES_DATE_RANGES.LAST_30_DAYS, label: 'Last 30 days' },
  { value: SALES_DATE_RANGES.LAST_90_DAYS, label: 'Last 90 days' },
  { value: SALES_DATE_RANGES.THIS_MONTH, label: 'This month' },
  { value: SALES_DATE_RANGES.LAST_MONTH, label: 'Last month' },
  { value: SALES_DATE_RANGES.THIS_QUARTER, label: 'This quarter' },
  { value: SALES_DATE_RANGES.THIS_YEAR, label: 'This year' },
] as const

export const SALES_STATUS_OPTIONS = [
  { value: 'all', label: 'All statuses' },
  { value: SALES_STATUS.COMPLETED, label: 'Completed' },
  { value: SALES_STATUS.RETURNED, label: 'Returned' },
  { value: SALES_STATUS.REFUNDED, label: 'Refunded' },
  { value: SALES_STATUS.DISPUTED, label: 'Disputed' },
] as const

export const PAYMENT_MODE_OPTIONS = [
  { value: 'all', label: 'All modes' },
  { value: PAYMENT_MODES.COD, label: 'Cash on delivery' },
  { value: PAYMENT_MODES.ONLINE, label: 'Online payment' },
  { value: PAYMENT_MODES.UPI, label: 'UPI' },
  { value: PAYMENT_MODES.CARD, label: 'Card' },
  { value: PAYMENT_MODES.WALLET, label: 'Wallet' },
] as const

export const DELIVERY_STATUS_OPTIONS = [
  { value: 'all', label: 'All statuses' },
  { value: DELIVERY_STATUS.DELIVERED, label: 'Delivered' },
  { value: DELIVERY_STATUS.SHIPPED, label: 'Shipped' },
  { value: DELIVERY_STATUS.OUT_FOR_DELIVERY, label: 'Out for delivery' },
  { value: DELIVERY_STATUS.CANCELLED, label: 'Cancelled' },
] as const

export function getSalesAnalyticsHubTabs(recordCount?: number): SalesAnalyticsHubTabDef[] {
  return [
    { id: 'overview', label: 'Overview' },
    { id: 'detailed', label: 'Records', count: recordCount },
    { id: 'products', label: 'Products' },
    { id: 'regional', label: 'Regional' },
    { id: 'forecast', label: 'Forecast' },
  ]
}

export function buildSalesAnalyticsSummaryCards(
  summary: SalesSummaryMetrics | null,
  formatAmount: (value: number) => string,
): SalesAnalyticsSummaryCard[] {
  if (!summary) return []

  return [
    {
      id: 'revenue',
      label: 'Total revenue',
      value: formatAmount(summary.totalRevenue),
      hint: 'Gross sales in selected period',
    },
    {
      id: 'orders',
      label: 'Total orders',
      value: String(summary.totalOrders),
      hint: 'Completed line items',
    },
    {
      id: 'aov',
      label: 'Average order value',
      value: formatAmount(summary.averageOrderValue),
      hint: 'Revenue per order',
    },
    {
      id: 'units',
      label: 'Units sold',
      value: String(summary.totalUnits),
      hint: 'Total quantity sold',
    },
    {
      id: 'returns',
      label: 'Return rate',
      value: formatPercentage(summary.returnRate),
      hint: `${summary.totalReturns} returns`,
    },
    {
      id: 'refunds',
      label: 'Refund rate',
      value: formatPercentage(summary.refundRate),
      hint: formatAmount(summary.totalRefunds),
    },
    {
      id: 'tax',
      label: 'Tax collected',
      value: formatAmount(summary.totalTax),
      hint: 'Total tax on orders',
    },
    {
      id: 'cod',
      label: 'COD share',
      value: formatPercentage(summary.codPercentage),
      hint: `${summary.codOrders} COD orders`,
    },
  ]
}

export function buildSalesTrendPoints(rows: VendorSalesAnalyticsRow[]): SalesAnalyticsTrendPoint[] {
  return [...rows]
    .filter((row) => row.sale_date)
    .sort((a, b) => String(a.sale_date).localeCompare(String(b.sale_date)))
    .map((row) => ({
      label: new Date(String(row.sale_date)).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
      }),
      revenue: Number(row.total_revenue ?? 0),
      orders: Number(row.total_orders ?? 0),
      returns: Number(row.total_returns ?? 0),
    }))
}

export function buildSalesCategoryPoints(rows: VendorSalesAnalyticsRow[]): SalesAnalyticsCategoryPoint[] {
  const map = new Map<string, SalesAnalyticsCategoryPoint>()

  for (const row of rows) {
    const name = row.top_selling_category?.trim() || 'Uncategorized'
    const current = map.get(name) ?? { name, revenue: 0, orders: 0 }
    current.revenue += Number(row.total_revenue ?? 0)
    current.orders += Number(row.total_orders ?? 0)
    map.set(name, current)
  }

  return [...map.values()].sort((a, b) => b.revenue - a.revenue).slice(0, 6)
}

export function getSalesRecordStatusBadge(status: string | null | undefined): SalesAnalyticsStatusBadge {
  switch ((status ?? '').toLowerCase()) {
    case SALES_STATUS.COMPLETED:
      return { label: 'Completed', tone: 'success' }
    case SALES_STATUS.RETURNED:
      return { label: 'Returned', tone: 'warning' }
    case SALES_STATUS.REFUNDED:
      return { label: 'Refunded', tone: 'danger' }
    case SALES_STATUS.DISPUTED:
      return { label: 'Disputed', tone: 'danger' }
    default:
      return { label: status ?? 'Unknown', tone: 'muted' }
  }
}

export function formatSalesRecordDate(value: string | null | undefined): string {
  if (!value) return '—'
  return new Date(value).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

export function countActiveSalesFilters(filters: SalesAnalyticsFilterInput): number {
  let count = 0
  if (filters.saleStatus) count++
  if (filters.paymentMode) count++
  if (filters.deliveryStatus) count++
  if (filters.region?.trim()) count++
  if (filters.category?.trim()) count++
  if (filters.isReturned != null) count++
  if (filters.isRefunded != null) count++
  if (filters.searchTerm?.trim()) count++
  if (filters.startDate || filters.endDate) count++
  return count
}

export function summarizeTopProduct(row: VendorTopProductRow): string {
  return `${row.total_units_sold ?? 0} units · ${row.total_orders ?? 0} orders`
}

export function summarizeRegionalSale(row: VendorRegionalSalesRow): string {
  const region = row.delivery_region ?? 'Unknown region'
  const country = row.delivery_country ? ` · ${row.delivery_country}` : ''
  return `${region}${country}`
}

export function summarizeSalesRecord(row: SalesAnalyticsRecord): string {
  const parts = [
    row.order_number,
    row.payment_mode,
    row.delivery_region ?? undefined,
  ].filter(Boolean)
  return parts.join(' · ')
}
