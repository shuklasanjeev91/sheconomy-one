/**
 * Redux slice for sales analytics (vendor dashboards, admin oversight, export flows).
 *
 * Ported from legacy Zustand `salesAnalyticsStore.js` (data layer only — no UI).
 */

import { createAsyncThunk, createSlice, current, type PayloadAction } from '@reduxjs/toolkit'

import type { AppDispatch, RootState } from '~/lib/store'

import {
  DEFAULT_SALES_ANALYTICS_PAGINATION,
  DEFAULT_SALES_ANALYTICS_SORTING,
  EXPORT_FORMATS,
  SALES_ANALYTICS_FETCH_SCOPE,
} from '~/lib/sales-analytics/sales-analytics.constants'
import * as salesAnalyticsService from '~/lib/sales-analytics/sales-analytics.service'
import type {
  ExportFormat,
  SalesAnalyticsAccessContext,
  SalesAnalyticsCreateInput,
  SalesAnalyticsFetchScope,
  SalesAnalyticsFilterInput,
  SalesAnalyticsPagination,
  SalesAnalyticsRecord,
  SalesAnalyticsRefundStatusInput,
  SalesAnalyticsReturnStatusInput,
  SalesAnalyticsSorting,
  SalesExportHistoryItem,
  SalesExportPreparedData,
  SalesSummaryMetrics,
  VendorRegionalSalesRow,
  VendorSalesAnalyticsRow,
  VendorTopProductRow,
} from '~/lib/sales-analytics/sales-analytics.type'
import { buildDefaultSalesAnalyticsFilters } from '~/lib/sales-analytics/sales-analytics.validation'
import {
  applyRefundStatusUpdate,
  applyReturnStatusUpdate,
  buildOptimisticSalesAnalyticsRecord,
  indexSalesAnalyticsById,
  removeSalesAnalyticsRecordById,
  replaceTempSalesAnalyticsRecord,
  shouldUseSalesAnalyticsCache,
  trimExportHistory,
  upsertSalesAnalyticsRecord,
} from '~/lib/sales-analytics/sales-analytics.utils'

// ============= STATE =============

type LoadingFlags = {
  analytics: boolean
  detailedRecords: boolean
  topProducts: boolean
  regionalSales: boolean
  summary: boolean
  exporting: boolean
  creating: boolean
  updating: boolean
  deleting: boolean
}

type SalesAnalyticsState = {
  shopId: string | null
  fetchScope: SalesAnalyticsFetchScope
  salesAnalytics: VendorSalesAnalyticsRow[]
  detailedSalesRecords: SalesAnalyticsRecord[]
  detailedRecordsById: Record<string, SalesAnalyticsRecord>
  topProducts: VendorTopProductRow[]
  regionalSales: VendorRegionalSalesRow[]
  salesSummary: SalesSummaryMetrics | null
  filters: SalesAnalyticsFilterInput
  pagination: SalesAnalyticsPagination
  sorting: SalesAnalyticsSorting
  exportHistory: SalesExportHistoryItem[]
  lastFetch: number | null
  lastSummaryFetch: number | null
  loading: LoadingFlags
  error: string | null
}

const initialLoading: LoadingFlags = {
  analytics: false,
  detailedRecords: false,
  topProducts: false,
  regionalSales: false,
  summary: false,
  exporting: false,
  creating: false,
  updating: false,
  deleting: false,
}

const initialState: SalesAnalyticsState = {
  shopId: null,
  fetchScope: SALES_ANALYTICS_FETCH_SCOPE.VENDOR,
  salesAnalytics: [],
  detailedSalesRecords: [],
  detailedRecordsById: {},
  topProducts: [],
  regionalSales: [],
  salesSummary: null,
  filters: buildDefaultSalesAnalyticsFilters(),
  pagination: { ...DEFAULT_SALES_ANALYTICS_PAGINATION },
  sorting: { ...DEFAULT_SALES_ANALYTICS_SORTING },
  exportHistory: [],
  lastFetch: null,
  lastSummaryFetch: null,
  loading: { ...initialLoading },
  error: null,
}

type ThunkConfig = { state: RootState; dispatch: AppDispatch; rejectValue: string }

type DetailedRecordsSnapshot = {
  detailedSalesRecords: SalesAnalyticsRecord[]
  detailedRecordsById: Record<string, SalesAnalyticsRecord>
  pagination: SalesAnalyticsPagination
}

const rollbackRegistry = new Map<string, DetailedRecordsSnapshot>()

function stashRollback(requestId: string, snapshot: DetailedRecordsSnapshot): void {
  rollbackRegistry.set(requestId, snapshot)
}

function takeRollback(requestId: string): DetailedRecordsSnapshot | undefined {
  const snapshot = rollbackRegistry.get(requestId)
  rollbackRegistry.delete(requestId)
  return snapshot
}

function optimisticId(requestId: string): string {
  return `temp-${requestId}`
}

async function resolveResponse<T>(
  promise: Promise<{ data: T | null; error: string | null; success: boolean }>,
  rejectWithValue: (value: string) => unknown,
): Promise<T> {
  const response = await promise
  if (!response.success) {
    return rejectWithValue(response.error ?? 'Request failed.') as never
  }
  return response.data as T
}

function snapshotDetailedRecords(state: SalesAnalyticsState): DetailedRecordsSnapshot {
  return {
    detailedSalesRecords: current(state.detailedSalesRecords),
    detailedRecordsById: current(state.detailedRecordsById),
    pagination: { ...state.pagination },
  }
}

function restoreDetailedRecords(state: SalesAnalyticsState, snapshot?: DetailedRecordsSnapshot): void {
  if (!snapshot) return
  state.detailedSalesRecords = snapshot.detailedSalesRecords
  state.detailedRecordsById = snapshot.detailedRecordsById
  state.pagination = snapshot.pagination
}

function mergeFilters(
  state: SalesAnalyticsState,
  customFilters?: Partial<SalesAnalyticsFilterInput>,
): SalesAnalyticsFilterInput {
  return {
    ...state.filters,
    ...customFilters,
    page: state.pagination.page,
    limit: state.pagination.limit,
    sortBy: state.sorting.sortBy,
    sortOrder: state.sorting.sortOrder,
  }
}

// ============= READ THUNKS =============

export const loadSalesAnalytics = createAsyncThunk<
  { rows: VendorSalesAnalyticsRow[]; pagination: SalesAnalyticsPagination },
  {
    shopId: string
    filters?: Partial<SalesAnalyticsFilterInput>
    accessContext?: SalesAnalyticsAccessContext
    scope?: SalesAnalyticsFetchScope
    forceRefresh?: boolean
  },
  ThunkConfig
>('salesAnalytics/loadAnalytics', async (arg, { getState, rejectWithValue }) => {
  const state = getState().salesAnalytics

  if (
    state.shopId === arg.shopId &&
    shouldUseSalesAnalyticsCache(state.lastFetch, arg.forceRefresh)
  ) {
    return { rows: state.salesAnalytics, pagination: state.pagination }
  }

  const filters = mergeFilters(state, arg.filters)

  const result = await resolveResponse(
    salesAnalyticsService.fetchVendorSalesAnalytics(arg.shopId, filters, {
      accessContext: arg.accessContext,
      scope: arg.scope ?? state.fetchScope,
    }),
    rejectWithValue,
  )

  return {
    rows: result.rows,
    pagination: {
      page: result.page,
      limit: result.limit,
      totalRecords: result.totalRecords,
      hasMore: result.hasMore,
    },
  }
})

export const loadDetailedSalesRecords = createAsyncThunk<
  { rows: SalesAnalyticsRecord[]; pagination: SalesAnalyticsPagination },
  {
    shopId: string
    filters?: Partial<SalesAnalyticsFilterInput>
    accessContext?: SalesAnalyticsAccessContext
    scope?: SalesAnalyticsFetchScope
    reset?: boolean
  },
  ThunkConfig
>('salesAnalytics/loadDetailedRecords', async (arg, { getState, rejectWithValue }) => {
  const state = getState().salesAnalytics
  const filters = mergeFilters(state, {
    ...arg.filters,
    page: arg.reset ? 1 : state.pagination.page,
  })

  const result = await resolveResponse(
    salesAnalyticsService.fetchDetailedSalesRecords(arg.shopId, filters, {
      accessContext: arg.accessContext,
      scope: arg.scope ?? state.fetchScope,
    }),
    rejectWithValue,
  )

  return {
    rows: result.rows,
    pagination: {
      page: result.page,
      limit: result.limit,
      totalRecords: result.totalRecords,
      hasMore: result.hasMore,
    },
  }
})

export const loadTopProducts = createAsyncThunk<
  VendorTopProductRow[],
  {
    shopId: string
    limit?: number
    accessContext?: SalesAnalyticsAccessContext
    scope?: SalesAnalyticsFetchScope
  },
  ThunkConfig
>('salesAnalytics/loadTopProducts', async (arg, { getState, rejectWithValue }) => {
  const state = getState().salesAnalytics

  return resolveResponse(
    salesAnalyticsService.fetchTopProducts(arg.shopId, {
      limit: arg.limit,
      accessContext: arg.accessContext,
      scope: arg.scope ?? state.fetchScope,
    }),
    rejectWithValue,
  )
})

export const loadRegionalSales = createAsyncThunk<
  VendorRegionalSalesRow[],
  {
    shopId: string
    limit?: number
    accessContext?: SalesAnalyticsAccessContext
    scope?: SalesAnalyticsFetchScope
  },
  ThunkConfig
>('salesAnalytics/loadRegionalSales', async (arg, { getState, rejectWithValue }) => {
  const state = getState().salesAnalytics

  return resolveResponse(
    salesAnalyticsService.fetchRegionalSales(arg.shopId, {
      limit: arg.limit,
      accessContext: arg.accessContext,
      scope: arg.scope ?? state.fetchScope,
    }),
    rejectWithValue,
  )
})

export const loadSalesSummary = createAsyncThunk<
  SalesSummaryMetrics,
  {
    shopId: string
    filters?: Partial<SalesAnalyticsFilterInput>
    accessContext?: SalesAnalyticsAccessContext
    scope?: SalesAnalyticsFetchScope
    forceRefresh?: boolean
  },
  ThunkConfig
>('salesAnalytics/loadSummary', async (arg, { getState, rejectWithValue }) => {
  const state = getState().salesAnalytics

  if (
    state.shopId === arg.shopId &&
    shouldUseSalesAnalyticsCache(state.lastSummaryFetch, arg.forceRefresh)
  ) {
    return state.salesSummary as SalesSummaryMetrics
  }

  const filters = { ...state.filters, ...arg.filters }

  return resolveResponse(
    salesAnalyticsService.fetchSalesSummary(arg.shopId, filters, {
      accessContext: arg.accessContext,
      scope: arg.scope ?? state.fetchScope,
    }),
    rejectWithValue,
  )
})

export const loadMoreSalesAnalytics = createAsyncThunk<
  { rows: VendorSalesAnalyticsRow[]; pagination: SalesAnalyticsPagination },
  { shopId: string; accessContext?: SalesAnalyticsAccessContext; scope?: SalesAnalyticsFetchScope },
  ThunkConfig
>('salesAnalytics/loadMoreAnalytics', async (arg, { getState, rejectWithValue }) => {
  const state = getState().salesAnalytics
  if (state.loading.analytics || !state.pagination.hasMore) {
    return { rows: state.salesAnalytics, pagination: state.pagination }
  }

  const nextPage = state.pagination.page + 1
  const filters = mergeFilters(state, { page: nextPage })

  const result = await resolveResponse(
    salesAnalyticsService.fetchVendorSalesAnalytics(arg.shopId, filters, {
      accessContext: arg.accessContext,
      scope: arg.scope ?? state.fetchScope,
    }),
    rejectWithValue,
  )

  return {
    rows: result.rows,
    pagination: {
      page: result.page,
      limit: result.limit,
      totalRecords: result.totalRecords,
      hasMore: result.hasMore,
    },
  }
})

export const loadMoreDetailedSalesRecords = createAsyncThunk<
  { rows: SalesAnalyticsRecord[]; pagination: SalesAnalyticsPagination },
  { shopId: string; accessContext?: SalesAnalyticsAccessContext; scope?: SalesAnalyticsFetchScope },
  ThunkConfig
>('salesAnalytics/loadMoreDetailedRecords', async (arg, { getState, rejectWithValue }) => {
  const state = getState().salesAnalytics
  if (state.loading.detailedRecords || !state.pagination.hasMore) {
    return { rows: [], pagination: state.pagination }
  }

  const nextPage = state.pagination.page + 1
  const filters = mergeFilters(state, { page: nextPage })

  const result = await resolveResponse(
    salesAnalyticsService.fetchDetailedSalesRecords(arg.shopId, filters, {
      accessContext: arg.accessContext,
      scope: arg.scope ?? state.fetchScope,
    }),
    rejectWithValue,
  )

  return {
    rows: result.rows,
    pagination: {
      page: result.page,
      limit: result.limit,
      totalRecords: result.totalRecords,
      hasMore: result.hasMore,
    },
  }
})

export const refreshAllSalesData = createAsyncThunk<
  { success: boolean; errors: string[] | null },
  {
    shopId: string
    accessContext?: SalesAnalyticsAccessContext
    scope?: SalesAnalyticsFetchScope
  },
  ThunkConfig
>('salesAnalytics/refreshAll', async (arg, { dispatch, rejectWithValue }) => {
  const common = {
    shopId: arg.shopId,
    accessContext: arg.accessContext,
    scope: arg.scope,
    forceRefresh: true,
  }

  const results = await Promise.allSettled([
    dispatch(loadSalesAnalytics({ ...common })).unwrap(),
    dispatch(loadSalesSummary({ ...common })).unwrap(),
    dispatch(loadTopProducts({ shopId: arg.shopId, accessContext: arg.accessContext, scope: arg.scope })).unwrap(),
    dispatch(loadRegionalSales({ shopId: arg.shopId, accessContext: arg.accessContext, scope: arg.scope })).unwrap(),
  ])

  const errors = results
    .filter((result): result is PromiseRejectedResult => result.status === 'rejected')
    .map((result) => String(result.reason))

  if (errors.length) return rejectWithValue(errors[0] ?? 'Some sales analytics requests failed.')

  return { success: true, errors: null }
})

export const exportSalesData = createAsyncThunk<
  SalesExportPreparedData,
  {
    shopId: string
    format?: ExportFormat
    filters?: Partial<SalesAnalyticsFilterInput>
    accessContext?: SalesAnalyticsAccessContext
    scope?: SalesAnalyticsFetchScope
  },
  ThunkConfig
>('salesAnalytics/export', async (arg, { getState, rejectWithValue }) => {
  const state = getState().salesAnalytics
  const format = arg.format ?? EXPORT_FORMATS.CSV
  const exportFilters = { ...state.filters, ...arg.filters }

  if (format === EXPORT_FORMATS.CSV) {
    const csvResult = await salesAnalyticsService.exportSalesToCsv(arg.shopId, exportFilters, {
      accessContext: arg.accessContext,
      scope: arg.scope ?? state.fetchScope,
    })

    if (!csvResult.success || !csvResult.data) {
      return rejectWithValue(csvResult.error ?? 'Export failed.')
    }

    return {
      headers: [],
      rows: [],
      filename: csvResult.data.filename,
      format,
      content: csvResult.data.content,
    } as SalesExportPreparedData & { content?: string }
  }

  return resolveResponse(
    salesAnalyticsService.prepareSalesExport(arg.shopId, exportFilters, format, {
      accessContext: arg.accessContext,
      scope: arg.scope ?? state.fetchScope,
    }),
    rejectWithValue,
  )
})

// ============= MUTATION THUNKS =============

export const createSalesAnalyticsRecord = createAsyncThunk<
  SalesAnalyticsRecord,
  {
    shopId: string
    input: SalesAnalyticsCreateInput
    accessContext?: SalesAnalyticsAccessContext
  },
  ThunkConfig
>('salesAnalytics/createRecord', async (arg, { rejectWithValue }) => {
  return resolveResponse(
    salesAnalyticsService.createSalesAnalyticsRecord(arg.input, {
      accessContext: arg.accessContext,
    }),
    rejectWithValue,
  )
})

export const updateSalesAnalyticsReturnStatus = createAsyncThunk<
  SalesAnalyticsRecord,
  {
    input: SalesAnalyticsReturnStatusInput
    accessContext?: SalesAnalyticsAccessContext
  },
  ThunkConfig
>('salesAnalytics/updateReturnStatus', async (arg, { rejectWithValue }) => {
  return resolveResponse(
    salesAnalyticsService.updateSalesAnalyticsReturnStatus(arg.input, {
      accessContext: arg.accessContext,
    }),
    rejectWithValue,
  )
})

export const updateSalesAnalyticsRefundStatus = createAsyncThunk<
  SalesAnalyticsRecord,
  {
    input: SalesAnalyticsRefundStatusInput
    accessContext?: SalesAnalyticsAccessContext
  },
  ThunkConfig
>('salesAnalytics/updateRefundStatus', async (arg, { rejectWithValue }) => {
  return resolveResponse(
    salesAnalyticsService.updateSalesAnalyticsRefundStatus(arg.input, {
      accessContext: arg.accessContext,
    }),
    rejectWithValue,
  )
})

export const deleteSalesAnalyticsRecord = createAsyncThunk<
  { id: string },
  {
    shopId: string
    recordId: string
    accessContext?: SalesAnalyticsAccessContext
    scope?: SalesAnalyticsFetchScope
  },
  ThunkConfig
>('salesAnalytics/deleteRecord', async (arg, { rejectWithValue }) => {
  return resolveResponse(
    salesAnalyticsService.deleteSalesAnalyticsRecord(arg.recordId, arg.shopId, {
      accessContext: arg.accessContext,
      scope: arg.scope,
    }),
    rejectWithValue,
  )
})

// ============= SLICE =============

const salesAnalyticsSlice = createSlice({
  name: 'salesAnalytics',
  initialState,
  reducers: {
    setSalesAnalyticsShopId(state, action: PayloadAction<string | null>) {
      state.shopId = action.payload
    },
    setSalesAnalyticsFetchScope(state, action: PayloadAction<SalesAnalyticsFetchScope>) {
      state.fetchScope = action.payload
    },
    setSalesAnalyticsFilters(state, action: PayloadAction<Partial<SalesAnalyticsFilterInput>>) {
      state.filters = { ...state.filters, ...action.payload }
      state.pagination.page = 1
    },
    resetSalesAnalyticsFilters(state) {
      state.filters = buildDefaultSalesAnalyticsFilters()
      state.pagination = { ...DEFAULT_SALES_ANALYTICS_PAGINATION }
    },
    setSalesAnalyticsPagination(state, action: PayloadAction<Partial<SalesAnalyticsPagination>>) {
      state.pagination = { ...state.pagination, ...action.payload }
    },
    setSalesAnalyticsSorting(state, action: PayloadAction<Partial<SalesAnalyticsSorting>>) {
      state.sorting = { ...state.sorting, ...action.payload }
      state.pagination.page = 1
    },
    setSalesAnalyticsError(state, action: PayloadAction<string | null>) {
      state.error = action.payload
    },
    clearSalesAnalyticsError(state) {
      state.error = null
    },
    clearSalesAnalyticsData(state) {
      state.salesAnalytics = []
      state.detailedSalesRecords = []
      state.detailedRecordsById = {}
      state.topProducts = []
      state.regionalSales = []
      state.salesSummary = null
      state.pagination = { ...DEFAULT_SALES_ANALYTICS_PAGINATION }
      state.lastFetch = null
      state.lastSummaryFetch = null
      state.error = null
    },
    clearSalesExportHistory(state) {
      state.exportHistory = []
    },
    resetSalesAnalytics(state) {
      Object.assign(state, initialState)
      state.filters = buildDefaultSalesAnalyticsFilters()
      state.loading = { ...initialLoading }
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(loadSalesAnalytics.pending, (state, action) => {
        state.loading.analytics = true
        state.error = null
        state.shopId = action.meta.arg.shopId
      })
      .addCase(loadSalesAnalytics.fulfilled, (state, action) => {
        state.loading.analytics = false
        state.salesAnalytics = action.payload.rows
        state.pagination = action.payload.pagination
        state.lastFetch = Date.now()
      })
      .addCase(loadSalesAnalytics.rejected, (state, action) => {
        state.loading.analytics = false
        state.error = action.payload ?? 'Failed to fetch sales analytics.'
      })

      .addCase(loadMoreSalesAnalytics.pending, (state) => {
        state.loading.analytics = true
        state.error = null
      })
      .addCase(loadMoreSalesAnalytics.fulfilled, (state, action) => {
        state.loading.analytics = false
        state.salesAnalytics = [...state.salesAnalytics, ...action.payload.rows]
        state.pagination = action.payload.pagination
        state.lastFetch = Date.now()
      })
      .addCase(loadMoreSalesAnalytics.rejected, (state, action) => {
        state.loading.analytics = false
        state.error = action.payload ?? 'Failed to load more sales analytics.'
      })

      .addCase(loadMoreDetailedSalesRecords.pending, (state) => {
        state.loading.detailedRecords = true
        state.error = null
      })
      .addCase(loadMoreDetailedSalesRecords.fulfilled, (state, action) => {
        state.loading.detailedRecords = false
        state.detailedSalesRecords = [...state.detailedSalesRecords, ...action.payload.rows]
        state.detailedRecordsById = indexSalesAnalyticsById(state.detailedSalesRecords)
        state.pagination = action.payload.pagination
      })
      .addCase(loadMoreDetailedSalesRecords.rejected, (state, action) => {
        state.loading.detailedRecords = false
        state.error = action.payload ?? 'Failed to load more sales records.'
      })

      .addCase(loadDetailedSalesRecords.pending, (state, action) => {
        state.loading.detailedRecords = true
        state.error = null
        state.shopId = action.meta.arg.shopId
      })
      .addCase(loadDetailedSalesRecords.fulfilled, (state, action) => {
        state.loading.detailedRecords = false
        const reset = action.meta.arg.reset ?? false
        state.detailedSalesRecords = reset
          ? action.payload.rows
          : [...state.detailedSalesRecords, ...action.payload.rows]
        state.detailedRecordsById = indexSalesAnalyticsById(state.detailedSalesRecords)
        state.pagination = action.payload.pagination
      })
      .addCase(loadDetailedSalesRecords.rejected, (state, action) => {
        state.loading.detailedRecords = false
        state.error = action.payload ?? 'Failed to fetch detailed sales records.'
      })

      .addCase(loadTopProducts.pending, (state) => {
        state.loading.topProducts = true
        state.error = null
      })
      .addCase(loadTopProducts.fulfilled, (state, action) => {
        state.loading.topProducts = false
        state.topProducts = action.payload
      })
      .addCase(loadTopProducts.rejected, (state, action) => {
        state.loading.topProducts = false
        state.error = action.payload ?? 'Failed to fetch top products.'
      })

      .addCase(loadRegionalSales.pending, (state) => {
        state.loading.regionalSales = true
        state.error = null
      })
      .addCase(loadRegionalSales.fulfilled, (state, action) => {
        state.loading.regionalSales = false
        state.regionalSales = action.payload
      })
      .addCase(loadRegionalSales.rejected, (state, action) => {
        state.loading.regionalSales = false
        state.error = action.payload ?? 'Failed to fetch regional sales.'
      })

      .addCase(loadSalesSummary.pending, (state, action) => {
        state.loading.summary = true
        state.error = null
        state.shopId = action.meta.arg.shopId
      })
      .addCase(loadSalesSummary.fulfilled, (state, action) => {
        state.loading.summary = false
        state.salesSummary = action.payload
        state.lastSummaryFetch = Date.now()
      })
      .addCase(loadSalesSummary.rejected, (state, action) => {
        state.loading.summary = false
        state.error = action.payload ?? 'Failed to fetch sales summary.'
      })

      .addCase(exportSalesData.pending, (state) => {
        state.loading.exporting = true
        state.error = null
      })
      .addCase(exportSalesData.fulfilled, (state, action) => {
        state.loading.exporting = false
        const exportRecord: SalesExportHistoryItem = {
          id: `${Date.now()}`,
          shopId: state.shopId ?? '',
          format: action.payload.format,
          filename: action.payload.filename,
          filters: state.filters,
          timestamp: new Date().toISOString(),
          status: 'completed',
        }
        state.exportHistory = trimExportHistory([exportRecord, ...state.exportHistory])
      })
      .addCase(exportSalesData.rejected, (state, action) => {
        state.loading.exporting = false
        state.error = action.payload ?? 'Failed to export sales data.'
      })

      .addCase(createSalesAnalyticsRecord.pending, (state, action) => {
        state.loading.creating = true
        state.error = null
        const tempRecord = buildOptimisticSalesAnalyticsRecord(
          action.meta.arg.input,
          action.meta.requestId,
          action.meta.arg.shopId,
        )
        stashRollback(action.meta.requestId, snapshotDetailedRecords(state))
        state.detailedSalesRecords = upsertSalesAnalyticsRecord(state.detailedSalesRecords, tempRecord)
        state.detailedRecordsById[tempRecord.id] = tempRecord
      })
      .addCase(createSalesAnalyticsRecord.fulfilled, (state, action) => {
        state.loading.creating = false
        const tempId = optimisticId(action.meta.requestId)
        state.detailedSalesRecords = replaceTempSalesAnalyticsRecord(
          state.detailedSalesRecords,
          tempId,
          action.payload,
        )
        state.detailedRecordsById = indexSalesAnalyticsById(state.detailedSalesRecords)
        rollbackRegistry.delete(action.meta.requestId)
      })
      .addCase(createSalesAnalyticsRecord.rejected, (state, action) => {
        state.loading.creating = false
        restoreDetailedRecords(state, takeRollback(action.meta.requestId))
        state.error = action.payload ?? 'Failed to create sales analytics record.'
      })

      .addCase(updateSalesAnalyticsReturnStatus.pending, (state, action) => {
        state.loading.updating = true
        state.error = null
        stashRollback(action.meta.requestId, snapshotDetailedRecords(state))

        const existing = state.detailedRecordsById[
          state.detailedSalesRecords.find((row) => row.order_item_id === action.meta.arg.input.order_item_id)?.id ?? ''
        ]

        if (existing) {
          const optimistic = applyReturnStatusUpdate(
            existing,
            action.meta.arg.input.is_returned,
            action.meta.arg.input.return_reason,
          )
          state.detailedSalesRecords = upsertSalesAnalyticsRecord(state.detailedSalesRecords, optimistic)
          state.detailedRecordsById[optimistic.id] = optimistic
        }
      })
      .addCase(updateSalesAnalyticsReturnStatus.fulfilled, (state, action) => {
        state.loading.updating = false
        state.detailedSalesRecords = upsertSalesAnalyticsRecord(state.detailedSalesRecords, action.payload)
        state.detailedRecordsById = indexSalesAnalyticsById(state.detailedSalesRecords)
        rollbackRegistry.delete(action.meta.requestId)
      })
      .addCase(updateSalesAnalyticsReturnStatus.rejected, (state, action) => {
        state.loading.updating = false
        restoreDetailedRecords(state, takeRollback(action.meta.requestId))
        state.error = action.payload ?? 'Failed to update return status.'
      })

      .addCase(updateSalesAnalyticsRefundStatus.pending, (state, action) => {
        state.loading.updating = true
        state.error = null
        stashRollback(action.meta.requestId, snapshotDetailedRecords(state))

        const existing = state.detailedRecordsById[
          state.detailedSalesRecords.find((row) => row.order_item_id === action.meta.arg.input.order_item_id)?.id ?? ''
        ]

        if (existing) {
          const optimistic = applyRefundStatusUpdate(
            existing,
            action.meta.arg.input.refund_amount,
            action.meta.arg.input.refund_status,
          )
          state.detailedSalesRecords = upsertSalesAnalyticsRecord(state.detailedSalesRecords, optimistic)
          state.detailedRecordsById[optimistic.id] = optimistic
        }
      })
      .addCase(updateSalesAnalyticsRefundStatus.fulfilled, (state, action) => {
        state.loading.updating = false
        state.detailedSalesRecords = upsertSalesAnalyticsRecord(state.detailedSalesRecords, action.payload)
        state.detailedRecordsById = indexSalesAnalyticsById(state.detailedSalesRecords)
        rollbackRegistry.delete(action.meta.requestId)
      })
      .addCase(updateSalesAnalyticsRefundStatus.rejected, (state, action) => {
        state.loading.updating = false
        restoreDetailedRecords(state, takeRollback(action.meta.requestId))
        state.error = action.payload ?? 'Failed to update refund status.'
      })

      .addCase(deleteSalesAnalyticsRecord.pending, (state, action) => {
        state.loading.deleting = true
        state.error = null
        stashRollback(action.meta.requestId, snapshotDetailedRecords(state))
        state.detailedSalesRecords = removeSalesAnalyticsRecordById(
          state.detailedSalesRecords,
          action.meta.arg.recordId,
        )
        delete state.detailedRecordsById[action.meta.arg.recordId]
      })
      .addCase(deleteSalesAnalyticsRecord.fulfilled, (state, action) => {
        state.loading.deleting = false
        rollbackRegistry.delete(action.meta.requestId)
        state.detailedSalesRecords = removeSalesAnalyticsRecordById(
          state.detailedSalesRecords,
          action.payload.id,
        )
        delete state.detailedRecordsById[action.payload.id]
      })
      .addCase(deleteSalesAnalyticsRecord.rejected, (state, action) => {
        state.loading.deleting = false
        restoreDetailedRecords(state, takeRollback(action.meta.requestId))
        state.error = action.payload ?? 'Failed to delete sales analytics record.'
      })
  },
})

export const {
  setSalesAnalyticsShopId,
  setSalesAnalyticsFetchScope,
  setSalesAnalyticsFilters,
  resetSalesAnalyticsFilters,
  setSalesAnalyticsPagination,
  setSalesAnalyticsSorting,
  setSalesAnalyticsError,
  clearSalesAnalyticsError,
  clearSalesAnalyticsData,
  clearSalesExportHistory,
  resetSalesAnalytics,
} = salesAnalyticsSlice.actions

export const salesAnalyticsReducer = salesAnalyticsSlice.reducer

// ============= SELECTORS =============

export const selectSalesAnalytics = (state: RootState) => state.salesAnalytics.salesAnalytics
export const selectDetailedSalesRecords = (state: RootState) => state.salesAnalytics.detailedSalesRecords
export const selectTopProducts = (state: RootState) => state.salesAnalytics.topProducts
export const selectRegionalSales = (state: RootState) => state.salesAnalytics.regionalSales
export const selectSalesSummary = (state: RootState) => state.salesAnalytics.salesSummary
export const selectSalesAnalyticsFilters = (state: RootState) => state.salesAnalytics.filters
export const selectSalesAnalyticsPagination = (state: RootState) => state.salesAnalytics.pagination
export const selectSalesAnalyticsLoading = (state: RootState) => state.salesAnalytics.loading
export const selectSalesAnalyticsError = (state: RootState) => state.salesAnalytics.error
export const selectSalesExportHistory = (state: RootState) => state.salesAnalytics.exportHistory
