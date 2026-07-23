/**
 * Sales analytics service — typed data-access for vendor, admin, and shared flows.
 *
 * Ported from legacy `sales-analytics-service.js` and `sales-export-service.js`
 * (non-UI portions). Components should dispatch thunks from `sales-analytics.store`.
 */

import { canManageShop, isAdminRole } from '~/lib/shop/shop.utils'
import { supabase } from '~/lib/supabase'

import {
  EXPORT_FORMATS,
  SALES_ANALYTICS_VALIDATION,
  SALES_DATE_TYPE,
  SALES_SORT_BY,
} from './sales-analytics.constants'
import {
  SalesAnalyticsError,
  SALES_ANALYTICS_ERROR_CODES,
  toFriendlySalesAnalyticsError,
} from './sales-analytics.errors'
import type {
  ExportFormat,
  RegionalSalesOptions,
  SalesAnalyticsAccessContext,
  SalesAnalyticsCreateInput,
  SalesAnalyticsFetchResult,
  SalesAnalyticsFetchScope,
  SalesAnalyticsFilterInput,
  SalesAnalyticsRecord,
  SalesAnalyticsRefundStatusInput,
  SalesAnalyticsReturnStatusInput,
  SalesAnalyticsServiceMetadata,
  SalesAnalyticsServiceResponse,
  SalesAnalyticsShopDataCheck,
  SalesExportPreparedData,
  SalesSummaryMetrics,
  TopProductsOptions,
  VendorRegionalSalesRow,
  VendorSalesAnalyticsRow,
  VendorTopProductRow,
} from './sales-analytics.type'
import {
  buildSalesQuery,
  calculateSalesSummary,
  createCsvContent,
  isValidQueryValue,
  normalizeDateForQuery,
  prepareExportData,
  resolveSalesSortColumn,
} from './sales-analytics.utils'
import {
  parseSalesAnalyticsCreate,
  parseSalesAnalyticsFilter,
  parseSalesAnalyticsRefundStatus,
  parseSalesAnalyticsReturnStatus,
  validateSalesAnalyticsExportParams,
} from './sales-analytics.validation'

// ============= RESPONSE HELPERS =============

function ok<T>(
  data: T,
  metadata?: SalesAnalyticsServiceMetadata,
  message?: string | null,
): SalesAnalyticsServiceResponse<T> {
  return {
    success: true,
    data,
    error: null,
    message: message ?? null,
    metadata: metadata ?? { timestamp: new Date().toISOString() },
  }
}

function fail<T>(error: unknown, fallback?: string): SalesAnalyticsServiceResponse<T> {
  return {
    success: false,
    data: null,
    error: toFriendlySalesAnalyticsError(error, fallback),
    metadata: { timestamp: new Date().toISOString() },
  }
}

async function resolveUserId(userId?: string | null): Promise<string> {
  if (userId) return userId

  const { data, error } = await supabase.auth.getUser()
  if (error || !data.user?.id) {
    throw new SalesAnalyticsError(SALES_ANALYTICS_ERROR_CODES.NOT_AUTHENTICATED)
  }
  return data.user.id
}

async function assertShopAnalyticsAccess(
  shopId: string,
  context?: SalesAnalyticsAccessContext,
  scope: SalesAnalyticsFetchScope = 'vendor',
): Promise<{ shopId: string; userId: string }> {
  const userId = await resolveUserId(context?.userId)

  if (scope === 'admin' && isAdminRole(context?.role)) {
    return { shopId, userId }
  }

  const { data: shop, error } = await supabase
    .from('shops')
    .select('id, user_id')
    .eq('id', shopId)
    .maybeSingle()

  if (error || !shop) {
    throw new SalesAnalyticsError(SALES_ANALYTICS_ERROR_CODES.SHOP_NOT_FOUND)
  }

  if (!canManageShop(shop, userId, context?.role)) {
    throw new SalesAnalyticsError(SALES_ANALYTICS_ERROR_CODES.ACCESS_DENIED)
  }

  return { shopId: shop.id, userId }
}

const VENDOR_ANALYTICS_SELECT = `
  shop_id,
  shop_name,
  sale_date,
  sale_week,
  sale_month,
  sale_year,
  total_orders,
  total_units_sold,
  total_revenue,
  total_item_revenue,
  total_shipping_revenue,
  total_tax_collected,
  total_discounts_given,
  average_order_value,
  total_returns,
  total_refunds,
  total_refund_amount,
  return_rate_percentage,
  refund_rate_percentage,
  top_selling_category,
  top_selling_listing_id,
  unique_customers,
  top_selling_region,
  regions_served,
  cod_orders,
  online_payment_orders,
  cod_percentage,
  express_deliveries,
  standard_deliveries
`

const DETAILED_RECORDS_SELECT = `
  id,
  order_number,
  product_title,
  product_sku,
  product_category,
  variation_details,
  quantity,
  unit_price,
  order_subtotal_amount,
  order_shipping_amount,
  order_tax_amount,
  order_discount_amount,
  order_total_amount,
  total_item_price,
  item_discount_amount,
  total_revenue,
  payment_mode,
  payment_status,
  currency,
  delivery_status,
  delivery_region,
  delivery_country,
  delivery_mode,
  is_returned,
  return_reason,
  returned_at,
  is_refunded,
  refund_amount,
  refund_status,
  refunded_at,
  sale_status,
  ordered_at,
  delivered_at,
  customer_id,
  shop_id,
  order_item_id,
  listing_id,
  order_id,
  created_at,
  updated_at
`

type FilterableQuery = {
  gte(column: string, value: string): FilterableQuery
  lte(column: string, value: string): FilterableQuery
  eq(column: string, value: unknown): FilterableQuery
  or(filters: string): FilterableQuery
}

function applyDateRangeFilters(
  query: FilterableQuery,
  queryParams: ReturnType<typeof buildSalesQuery>,
  column: string,
): FilterableQuery {
  let next = query

  if (isValidQueryValue(queryParams.start_date)) {
    const startValue =
      column === 'sale_date'
        ? normalizeDateForQuery(queryParams.start_date)
        : queryParams.start_date
    if (startValue) next = next.gte(column, startValue)
  }

  if (isValidQueryValue(queryParams.end_date)) {
    const endValue =
      column === 'sale_date'
        ? normalizeDateForQuery(queryParams.end_date)
        : queryParams.end_date
    if (endValue) next = next.lte(column, endValue)
  }

  return next
}

function applyDetailedRecordFilters(
  query: FilterableQuery,
  queryParams: ReturnType<typeof buildSalesQuery>,
): FilterableQuery {
  const dateColumn =
    queryParams.date_type === SALES_DATE_TYPE.ORDERED_AT ? 'ordered_at' : 'delivered_at'

  let next = applyDateRangeFilters(query, queryParams, dateColumn)

  if (isValidQueryValue(queryParams.sale_status)) {
    next = next.eq('sale_status', queryParams.sale_status)
  }
  if (isValidQueryValue(queryParams.payment_mode)) {
    next = next.eq('payment_mode', queryParams.payment_mode)
  }
  if (isValidQueryValue(queryParams.delivery_status)) {
    next = next.eq('delivery_status', queryParams.delivery_status)
  }
  if (isValidQueryValue(queryParams.delivery_region)) {
    next = next.eq('delivery_region', queryParams.delivery_region)
  }
  if (isValidQueryValue(queryParams.product_category)) {
    next = next.eq('product_category', queryParams.product_category)
  }
  if (typeof queryParams.is_returned === 'boolean') {
    next = next.eq('is_returned', queryParams.is_returned)
  }
  if (typeof queryParams.is_refunded === 'boolean') {
    next = next.eq('is_refunded', queryParams.is_refunded)
  }
  if (isValidQueryValue(queryParams.search_term)) {
    next = next.or(
      `product_title.ilike.%${queryParams.search_term}%,order_number.ilike.%${queryParams.search_term}%,product_sku.ilike.%${queryParams.search_term}%`,
    )
  }

  return next
}

// ============= READ =============

export async function fetchVendorSalesAnalytics(
  shopId: string,
  filters: SalesAnalyticsFilterInput = {},
  options: {
    accessContext?: SalesAnalyticsAccessContext
    scope?: SalesAnalyticsFetchScope
  } = {},
): Promise<SalesAnalyticsServiceResponse<SalesAnalyticsFetchResult<VendorSalesAnalyticsRow>>> {
  try {
    const scope = options.scope ?? 'vendor'
    await assertShopAnalyticsAccess(shopId, options.accessContext, scope)

    const parsedFilters = parseSalesAnalyticsFilter(filters)
    const queryParams = buildSalesQuery(parsedFilters)

    let query = supabase
      .from('vendor_sales_analytics')
      .select(VENDOR_ANALYTICS_SELECT, { count: 'exact' })
      .eq('shop_id', shopId)

    query = applyDateRangeFilters(query as unknown as FilterableQuery, queryParams, 'sale_date') as typeof query

    query = query.order(SALES_SORT_BY.SALE_DATE, {
      ascending: queryParams.sort_order === 'asc',
    })

    const from = (queryParams.page - 1) * queryParams.limit
    const to = from + queryParams.limit - 1
    query = query.range(from, to)

    const { data, error, count } = await query

    if (error) throw error

    const rows = (data ?? []) as VendorSalesAnalyticsRow[]

    return ok(
      {
        rows,
        totalRecords: count ?? rows.length,
        page: queryParams.page,
        limit: queryParams.limit,
        hasMore: rows.length === queryParams.limit,
      },
      {
        timestamp: new Date().toISOString(),
        totalRecords: count,
        page: queryParams.page,
        limit: queryParams.limit,
        hasMore: rows.length === queryParams.limit,
        appliedFilters: {
          start_date: queryParams.start_date,
          end_date: queryParams.end_date,
          shop_id: shopId,
        },
        shop_id: shopId,
      },
    )
  } catch (error) {
    return fail(error, 'Failed to fetch sales analytics.')
  }
}

export async function fetchDetailedSalesRecords(
  shopId: string,
  filters: SalesAnalyticsFilterInput = {},
  options: {
    accessContext?: SalesAnalyticsAccessContext
    scope?: SalesAnalyticsFetchScope
  } = {},
): Promise<SalesAnalyticsServiceResponse<SalesAnalyticsFetchResult<SalesAnalyticsRecord>>> {
  try {
    const scope = options.scope ?? 'vendor'
    await assertShopAnalyticsAccess(shopId, options.accessContext, scope)

    const parsedFilters = parseSalesAnalyticsFilter(filters)
    const queryParams = buildSalesQuery(parsedFilters)

    let query = supabase
      .from('sales_analytics')
      .select(DETAILED_RECORDS_SELECT, { count: 'exact' })
      .eq('shop_id', shopId)

    query = applyDetailedRecordFilters(query as unknown as FilterableQuery, queryParams) as typeof query

    const sortColumn = resolveSalesSortColumn(queryParams.sort_by, queryParams.date_type)
    query = query.order(sortColumn, { ascending: queryParams.sort_order === 'asc' })

    if (!parsedFilters.forExport) {
      const from = (queryParams.page - 1) * queryParams.limit
      const to = from + queryParams.limit - 1
      query = query.range(from, to)
    }

    const { data, error, count } = await query
    if (error) throw error

    const rows = (data ?? []) as SalesAnalyticsRecord[]

    return ok(
      {
        rows,
        totalRecords: count ?? rows.length,
        page: queryParams.page,
        limit: queryParams.limit,
        hasMore: rows.length === queryParams.limit && !parsedFilters.forExport,
      },
      {
        timestamp: new Date().toISOString(),
        totalRecords: count,
        page: queryParams.page,
        limit: queryParams.limit,
        hasMore: rows.length === queryParams.limit && !parsedFilters.forExport,
        appliedFilters: queryParams as unknown as Record<string, unknown>,
        shop_id: shopId,
      },
    )
  } catch (error) {
    return fail(error, 'Failed to fetch detailed sales records.')
  }
}

export async function fetchTopProducts(
  shopId: string,
  options: TopProductsOptions & {
    accessContext?: SalesAnalyticsAccessContext
    scope?: SalesAnalyticsFetchScope
  } = {},
): Promise<SalesAnalyticsServiceResponse<VendorTopProductRow[]>> {
  try {
    const scope = options.scope ?? 'vendor'
    await assertShopAnalyticsAccess(shopId, options.accessContext, scope)

    const limit = options.limit ?? SALES_ANALYTICS_VALIDATION.TOP_PRODUCTS_DEFAULT_LIMIT

    const { data, error } = await supabase
      .from('vendor_top_products')
      .select(
        `
        shop_id,
        listing_id,
        product_title,
        product_category,
        total_orders,
        total_units_sold,
        total_revenue,
        average_order_value,
        total_returns,
        total_refunds,
        return_rate_percentage
      `,
      )
      .eq('shop_id', shopId)
      .order('total_revenue', { ascending: false })
      .limit(limit)

    if (error) throw error

    return ok((data ?? []) as VendorTopProductRow[], {
      timestamp: new Date().toISOString(),
      limit,
      shop_id: shopId,
    })
  } catch (error) {
    return fail(error, 'Failed to fetch top products.')
  }
}

export async function fetchRegionalSales(
  shopId: string,
  options: RegionalSalesOptions & {
    accessContext?: SalesAnalyticsAccessContext
    scope?: SalesAnalyticsFetchScope
  } = {},
): Promise<SalesAnalyticsServiceResponse<VendorRegionalSalesRow[]>> {
  try {
    const scope = options.scope ?? 'vendor'
    await assertShopAnalyticsAccess(shopId, options.accessContext, scope)

    const limit = options.limit ?? SALES_ANALYTICS_VALIDATION.REGIONAL_SALES_DEFAULT_LIMIT

    const { data, error } = await supabase
      .from('vendor_regional_sales')
      .select(
        `
        shop_id,
        delivery_region,
        delivery_country,
        total_orders,
        total_units_sold,
        total_revenue,
        average_order_value,
        unique_customers,
        cod_orders,
        cod_percentage
      `,
      )
      .eq('shop_id', shopId)
      .order('total_revenue', { ascending: false })
      .limit(limit)

    if (error) throw error

    return ok((data ?? []) as VendorRegionalSalesRow[], {
      timestamp: new Date().toISOString(),
      limit,
      shop_id: shopId,
    })
  } catch (error) {
    return fail(error, 'Failed to fetch regional sales.')
  }
}

export async function fetchSalesSummary(
  shopId: string,
  filters: SalesAnalyticsFilterInput = {},
  options: {
    accessContext?: SalesAnalyticsAccessContext
    scope?: SalesAnalyticsFetchScope
  } = {},
): Promise<SalesAnalyticsServiceResponse<SalesSummaryMetrics>> {
  try {
    const scope = options.scope ?? 'vendor'
    await assertShopAnalyticsAccess(shopId, options.accessContext, scope)

    const parsedFilters = parseSalesAnalyticsFilter(filters)
    const queryParams = buildSalesQuery(parsedFilters)

    let query = supabase
      .from('sales_analytics')
      .select(
        `
        quantity,
        total_revenue,
        total_item_price,
        order_shipping_amount,
        order_tax_amount,
        item_discount_amount,
        refund_amount,
        is_returned,
        is_refunded,
        payment_mode
      `,
      )
      .eq('shop_id', shopId)

    query = applyDateRangeFilters(
      query as unknown as FilterableQuery,
      queryParams,
      'delivered_at',
    ) as typeof query

    if (queryParams.sale_status) {
      query = query.eq('sale_status', queryParams.sale_status)
    }

    const { data, error } = await query
    if (error) throw error

    const summary = calculateSalesSummary((data ?? []) as SalesAnalyticsRecord[])

    return ok(summary, {
      timestamp: new Date().toISOString(),
      recordsAnalyzed: data?.length ?? 0,
      appliedFilters: {
        start_date: queryParams.start_date,
        end_date: queryParams.end_date,
        shop_id: shopId,
      },
      shop_id: shopId,
    })
  } catch (error) {
    return fail(error, 'Failed to fetch sales summary.')
  }
}

export async function prepareSalesExport(
  shopId: string,
  filters: SalesAnalyticsFilterInput = {},
  format: ExportFormat = EXPORT_FORMATS.CSV,
  options: {
    accessContext?: SalesAnalyticsAccessContext
    scope?: SalesAnalyticsFetchScope
  } = {},
): Promise<SalesAnalyticsServiceResponse<SalesExportPreparedData>> {
  try {
    const result = await fetchDetailedSalesRecords(
      shopId,
      {
        ...filters,
        forExport: true,
        limit: SALES_ANALYTICS_VALIDATION.LIMIT.EXPORT_MAX,
      },
      options,
    )

    if (!result.success || !result.data) {
      return fail(result.error ?? 'Failed to prepare export.', 'Failed to prepare export.')
    }

    const exportData = prepareExportData(result.data.rows, format)

    return ok(exportData, {
      timestamp: new Date().toISOString(),
      format,
      recordCount: result.data.rows.length,
      appliedFilters: filters as Record<string, unknown>,
      shop_id: shopId,
    })
  } catch (error) {
    return fail(error, 'Failed to prepare export.')
  }
}

export async function exportSalesToCsv(
  shopId: string,
  filters: SalesAnalyticsFilterInput = {},
  options: {
    accessContext?: SalesAnalyticsAccessContext
    scope?: SalesAnalyticsFetchScope
  } = {},
): Promise<SalesAnalyticsServiceResponse<{ filename: string; content: string }>> {
  try {
    const validation = validateSalesAnalyticsExportParams(shopId, EXPORT_FORMATS.CSV, filters)
    if (!validation.isValid) {
      throw new SalesAnalyticsError(
        SALES_ANALYTICS_ERROR_CODES.INVALID_FILTERS,
        validation.fieldErrors[0],
      )
    }

    const result = await prepareSalesExport(shopId, filters, EXPORT_FORMATS.CSV, options)
    if (!result.success || !result.data) {
      return fail(result.error ?? 'Failed to export CSV.', 'Failed to export CSV.')
    }

    const content = createCsvContent(result.data)

    return ok(
      { filename: result.data.filename, content },
      result.metadata,
      'CSV export prepared successfully.',
    )
  } catch (error) {
    return fail(error, 'Failed to export CSV.')
  }
}

// ============= MUTATIONS =============

export async function createSalesAnalyticsRecord(
  input: SalesAnalyticsCreateInput,
  options: { accessContext?: SalesAnalyticsAccessContext } = {},
): Promise<SalesAnalyticsServiceResponse<SalesAnalyticsRecord>> {
  try {
    await resolveUserId(options.accessContext?.userId)
    const parsed = parseSalesAnalyticsCreate(input)

    const { error } = await supabase.rpc('create_sales_analytics_record', {
      p_order_item_id: parsed.order_item_id,
    })

    if (error) throw error

    const { data, error: fetchError } = await supabase
      .from('sales_analytics')
      .select(DETAILED_RECORDS_SELECT)
      .eq('order_item_id', parsed.order_item_id)
      .maybeSingle()

    if (fetchError) throw fetchError
    if (!data) {
      throw new SalesAnalyticsError(SALES_ANALYTICS_ERROR_CODES.RECORD_NOT_FOUND)
    }

    return ok(data as SalesAnalyticsRecord, { timestamp: new Date().toISOString() })
  } catch (error) {
    return fail(error, 'Failed to create sales analytics record.')
  }
}

export async function updateSalesAnalyticsReturnStatus(
  input: SalesAnalyticsReturnStatusInput,
  options: { accessContext?: SalesAnalyticsAccessContext } = {},
): Promise<SalesAnalyticsServiceResponse<SalesAnalyticsRecord>> {
  try {
    await resolveUserId(options.accessContext?.userId)
    const parsed = parseSalesAnalyticsReturnStatus(input)

    const { error } = await supabase.rpc('update_sales_analytics_return_status', {
      p_order_item_id: parsed.order_item_id,
      p_is_returned: parsed.is_returned,
      p_return_reason: parsed.return_reason ?? undefined,
    })

    if (error) throw error

    const { data, error: fetchError } = await supabase
      .from('sales_analytics')
      .select(DETAILED_RECORDS_SELECT)
      .eq('order_item_id', parsed.order_item_id)
      .maybeSingle()

    if (fetchError) throw fetchError
    if (!data) {
      throw new SalesAnalyticsError(SALES_ANALYTICS_ERROR_CODES.RECORD_NOT_FOUND)
    }

    return ok(data as SalesAnalyticsRecord, { timestamp: new Date().toISOString() })
  } catch (error) {
    return fail(error, 'Failed to update return status.')
  }
}

export async function updateSalesAnalyticsRefundStatus(
  input: SalesAnalyticsRefundStatusInput,
  options: { accessContext?: SalesAnalyticsAccessContext } = {},
): Promise<SalesAnalyticsServiceResponse<SalesAnalyticsRecord>> {
  try {
    await resolveUserId(options.accessContext?.userId)
    const parsed = parseSalesAnalyticsRefundStatus(input)

    const { error } = await supabase.rpc('update_sales_analytics_refund_status', {
      p_order_item_id: parsed.order_item_id,
      p_refund_amount: parsed.refund_amount,
      p_refund_status: parsed.refund_status,
    })

    if (error) throw error

    const { data, error: fetchError } = await supabase
      .from('sales_analytics')
      .select(DETAILED_RECORDS_SELECT)
      .eq('order_item_id', parsed.order_item_id)
      .maybeSingle()

    if (fetchError) throw fetchError
    if (!data) {
      throw new SalesAnalyticsError(SALES_ANALYTICS_ERROR_CODES.RECORD_NOT_FOUND)
    }

    return ok(data as SalesAnalyticsRecord, { timestamp: new Date().toISOString() })
  } catch (error) {
    return fail(error, 'Failed to update refund status.')
  }
}

export async function deleteSalesAnalyticsRecord(
  recordId: string,
  shopId: string,
  options: {
    accessContext?: SalesAnalyticsAccessContext
    scope?: SalesAnalyticsFetchScope
  } = {},
): Promise<SalesAnalyticsServiceResponse<{ id: string }>> {
  try {
    const scope = options.scope ?? 'vendor'
    await assertShopAnalyticsAccess(shopId, options.accessContext, scope)

    const { data: existing, error: fetchError } = await supabase
      .from('sales_analytics')
      .select('id, shop_id')
      .eq('id', recordId)
      .maybeSingle()

    if (fetchError) throw fetchError
    if (!existing || existing.shop_id !== shopId) {
      throw new SalesAnalyticsError(SALES_ANALYTICS_ERROR_CODES.RECORD_NOT_FOUND)
    }

    // Sales analytics rows are system-managed; direct deletes are admin-only and rare.
    if (!isAdminRole(options.accessContext?.role)) {
      throw new SalesAnalyticsError(SALES_ANALYTICS_ERROR_CODES.ACCESS_DENIED)
    }

    const { error } = await supabase.from('sales_analytics').delete().eq('id', recordId)
    if (error) throw error

    return ok({ id: recordId }, { timestamp: new Date().toISOString() })
  } catch (error) {
    return fail(error, 'Failed to delete sales analytics record.')
  }
}

export async function testShopSalesData(
  shopId: string,
  options: {
    accessContext?: SalesAnalyticsAccessContext
    scope?: SalesAnalyticsFetchScope
  } = {},
): Promise<SalesAnalyticsServiceResponse<SalesAnalyticsShopDataCheck>> {
  try {
    const scope = options.scope ?? 'vendor'
    await assertShopAnalyticsAccess(shopId, options.accessContext, scope)

    const [analyticsRes, salesRes, productsRes, regionalRes] = await Promise.all([
      supabase.from('vendor_sales_analytics').select('shop_id', { count: 'exact', head: true }).eq('shop_id', shopId),
      supabase.from('sales_analytics').select('id', { count: 'exact', head: true }).eq('shop_id', shopId),
      supabase.from('vendor_top_products').select('listing_id', { count: 'exact', head: true }).eq('shop_id', shopId),
      supabase.from('vendor_regional_sales').select('delivery_region', { count: 'exact', head: true }).eq('shop_id', shopId),
    ])

    const payload: SalesAnalyticsShopDataCheck = {
      vendor_sales_analytics: {
        count: analyticsRes.count ?? 0,
        error: analyticsRes.error?.message ?? null,
      },
      sales_analytics: {
        count: salesRes.count ?? 0,
        error: salesRes.error?.message ?? null,
      },
      vendor_top_products: {
        count: productsRes.count ?? 0,
        error: productsRes.error?.message ?? null,
      },
      vendor_regional_sales: {
        count: regionalRes.count ?? 0,
        error: regionalRes.error?.message ?? null,
      },
    }

    return ok(payload, { timestamp: new Date().toISOString(), shop_id: shopId })
  } catch (error) {
    return fail(error, 'Failed to inspect shop sales data.')
  }
}
