/**
 * Redux Toolkit slice for vendor orders.
 *
 * Replaces the legacy Zustand `vendorOrderStore`. Async work wraps
 * `vendor-orders.service`; status mutations apply **optimistically** and roll
 * back on failure via the snapshot registry below. The same slice serves the
 * vendor dashboard and the admin dashboard (admin thunks load platform-wide
 * data through the admin-gated service functions).
 */

import { createAsyncThunk, createSlice, current, type PayloadAction } from '@reduxjs/toolkit'

import type { AppDispatch, RootState } from '~/lib/store'

import type { OrderStatus } from './order.constants'
import * as vendorOrderService from './vendor-orders.service'
import {
  computeVendorOrderStats,
  getPendingVendorOrders,
  getRecentVendorOrders,
  getVendorTotalRevenue,
} from './vendor-orders.utils'
import type {
  PaginatedVendorOrders,
  PaginationMeta,
  VendorOrderAnalytics,
  VendorOrderFilters,
  VendorOrderItem,
  VendorOrderPagination,
  VendorOrderSearchParams,
  VendorOrderSummary,
} from './vendor-orders.type'

// ============= STATE =============

type LoadingState = {
  orders: boolean
  item: boolean
  updatingStatus: boolean
  bulkUpdating: boolean
  analytics: boolean
  summary: boolean
  searching: boolean
  updating: boolean
  admin: boolean
}

type VendorOrdersState = {
  vendorOrders: VendorOrderItem[]
  currentVendorOrderItem: VendorOrderItem | null
  vendorOrderSummary: VendorOrderSummary | null
  vendorAnalytics: VendorOrderAnalytics | null
  searchResults: VendorOrderItem[]

  adminOrders: VendorOrderItem[]
  platformAnalytics: VendorOrderAnalytics | null

  vendorFilters: VendorOrderFilters
  vendorPagination: PaginationMeta
  searchPagination: PaginationMeta
  adminPagination: PaginationMeta

  loading: LoadingState
  error: string | null
}

const emptyPagination = (): PaginationMeta => ({ page: 1, limit: 20, total: 0, total_pages: 0 })

const initialState: VendorOrdersState = {
  vendorOrders: [],
  currentVendorOrderItem: null,
  vendorOrderSummary: null,
  vendorAnalytics: null,
  searchResults: [],
  adminOrders: [],
  platformAnalytics: null,
  vendorFilters: {},
  vendorPagination: emptyPagination(),
  searchPagination: emptyPagination(),
  adminPagination: emptyPagination(),
  loading: {
    orders: false,
    item: false,
    updatingStatus: false,
    bulkUpdating: false,
    analytics: false,
    summary: false,
    searching: false,
    updating: false,
    admin: false,
  },
  error: null,
}

type ThunkConfig = { state: RootState; dispatch: AppDispatch; rejectValue: string }

// Snapshots for optimistic rollback, keyed by thunk requestId.
type Snapshot = { vendorOrders: VendorOrderItem[]; currentItem: VendorOrderItem | null }
const rollbackRegistry = new Map<string, Snapshot>()

// ============= THUNKS =============

export const loadVendorOrders = createAsyncThunk<
  PaginatedVendorOrders,
  { vendorId: string; filters?: VendorOrderFilters; pagination?: VendorOrderPagination; userId?: string },
  ThunkConfig
>('vendorOrders/load', async ({ vendorId, filters, pagination, userId }, { rejectWithValue }) => {
  const response = await vendorOrderService.getVendorOrders(vendorId, filters, pagination, userId)
  if (!response.success || !response.data) {
    return rejectWithValue(response.error ?? 'Failed to load orders.')
  }
  return response.data
})

export const loadVendorOrderItem = createAsyncThunk<VendorOrderItem, { orderItemId: string; userId?: string }, ThunkConfig>(
  'vendorOrders/loadItem',
  async ({ orderItemId, userId }, { rejectWithValue }) => {
    const response = await vendorOrderService.getVendorOrderItem(orderItemId, userId)
    if (!response.success || !response.data) {
      return rejectWithValue(response.error ?? 'Failed to load order item.')
    }
    return response.data
  },
)

export const updateOrderItemStatus = createAsyncThunk<
  VendorOrderItem,
  { orderItemId: string; newStatus: OrderStatus; note?: string | null; userId?: string },
  ThunkConfig
>('vendorOrders/updateStatus', async ({ orderItemId, newStatus, note, userId }, { rejectWithValue }) => {
  const response = await vendorOrderService.updateOrderItemStatus(orderItemId, newStatus, note, userId)
  if (!response.success || !response.data) {
    return rejectWithValue(response.error ?? 'Failed to update status.')
  }
  return response.data
})

export const bulkUpdateOrderItemStatus = createAsyncThunk<
  VendorOrderItem[],
  { orderItemIds: string[]; newStatus: OrderStatus; note?: string | null; userId?: string },
  ThunkConfig
>('vendorOrders/bulkUpdateStatus', async ({ orderItemIds, newStatus, note, userId }, { rejectWithValue }) => {
  const response = await vendorOrderService.bulkUpdateOrderItemStatus(orderItemIds, newStatus, note, userId)
  if (!response.success || !response.data) {
    return rejectWithValue(response.error ?? 'Failed to update statuses.')
  }
  return response.data
})

export const updateVendorOrderItem = createAsyncThunk<
  VendorOrderItem,
  { orderItemId: string; updates: Record<string, unknown>; userId?: string },
  ThunkConfig
>('vendorOrders/updateItem', async ({ orderItemId, updates, userId }, { rejectWithValue }) => {
  const response = await vendorOrderService.updateVendorOrderItem(orderItemId, updates, userId)
  if (!response.success || !response.data) {
    return rejectWithValue(response.error ?? 'Failed to update order item.')
  }
  return response.data
})

export const loadVendorAnalytics = createAsyncThunk<
  VendorOrderAnalytics,
  { vendorId: string; filters?: { date_from?: string; date_to?: string }; userId?: string },
  ThunkConfig
>('vendorOrders/analytics', async ({ vendorId, filters, userId }, { rejectWithValue }) => {
  const response = await vendorOrderService.getVendorOrderAnalytics(vendorId, filters, userId)
  if (!response.success || !response.data) {
    return rejectWithValue(response.error ?? 'Failed to load analytics.')
  }
  return response.data
})

export const loadVendorSummary = createAsyncThunk<
  VendorOrderSummary,
  { vendorId: string; options?: { date_from?: string; date_to?: string }; userId?: string },
  ThunkConfig
>('vendorOrders/summary', async ({ vendorId, options, userId }, { rejectWithValue }) => {
  const response = await vendorOrderService.getVendorOrderSummary(vendorId, options, userId)
  if (!response.success || !response.data) {
    return rejectWithValue(response.error ?? 'Failed to load summary.')
  }
  return response.data
})

export const searchVendorOrders = createAsyncThunk<
  PaginatedVendorOrders,
  { vendorId: string; params?: VendorOrderSearchParams; userId?: string },
  ThunkConfig
>('vendorOrders/search', async ({ vendorId, params, userId }, { rejectWithValue }) => {
  const response = await vendorOrderService.searchVendorOrders(vendorId, params, userId)
  if (!response.success || !response.data) {
    return rejectWithValue(response.error ?? 'Search failed.')
  }
  return response.data
})

export const loadAdminOrders = createAsyncThunk<
  PaginatedVendorOrders,
  { params?: VendorOrderSearchParams; userId?: string } | undefined,
  ThunkConfig
>('vendorOrders/adminLoad', async (arg, { rejectWithValue }) => {
  const response = await vendorOrderService.getAllOrderItemsForAdmin(arg?.params, arg?.userId)
  if (!response.success || !response.data) {
    return rejectWithValue(response.error ?? 'Failed to load platform orders.')
  }
  return response.data
})

export const loadPlatformAnalytics = createAsyncThunk<
  VendorOrderAnalytics,
  { filters?: { date_from?: string; date_to?: string }; userId?: string } | undefined,
  ThunkConfig
>('vendorOrders/platformAnalytics', async (arg, { rejectWithValue }) => {
  const response = await vendorOrderService.getPlatformOrderAnalytics(arg?.filters, arg?.userId)
  if (!response.success || !response.data) {
    return rejectWithValue(response.error ?? 'Failed to load platform analytics.')
  }
  return response.data
})

// ============= HELPERS =============

function applyStatusToItem(item: VendorOrderItem, newStatus: OrderStatus): VendorOrderItem {
  return {
    ...item,
    item_status: newStatus,
    updated_at: new Date().toISOString(),
  }
}

function mergeItem(list: VendorOrderItem[], updated: VendorOrderItem): VendorOrderItem[] {
  return list.map((item) => (item.id === updated.id ? { ...item, ...updated } : item))
}

// ============= SLICE =============

const vendorOrdersSlice = createSlice({
  name: 'vendorOrders',
  initialState,
  reducers: {
    setVendorFilters(state, action: PayloadAction<VendorOrderFilters>) {
      state.vendorFilters = { ...state.vendorFilters, ...action.payload }
    },
    clearError(state) {
      state.error = null
    },
    clearSearchResults(state) {
      state.searchResults = []
      state.searchPagination = emptyPagination()
    },
    clearVendorData() {
      return initialState
    },
  },
  extraReducers: (builder) => {
    builder
      // ---- load list ----
      .addCase(loadVendorOrders.pending, (state) => {
        state.loading.orders = true
        state.error = null
      })
      .addCase(loadVendorOrders.fulfilled, (state, action) => {
        state.loading.orders = false
        state.vendorOrders = action.payload.items
        state.vendorPagination = action.payload.pagination
      })
      .addCase(loadVendorOrders.rejected, (state, action) => {
        state.loading.orders = false
        state.error = action.payload ?? 'Failed to load orders.'
      })

      // ---- load item ----
      .addCase(loadVendorOrderItem.pending, (state) => {
        state.loading.item = true
        state.error = null
      })
      .addCase(loadVendorOrderItem.fulfilled, (state, action) => {
        state.loading.item = false
        state.currentVendorOrderItem = action.payload
      })
      .addCase(loadVendorOrderItem.rejected, (state, action) => {
        state.loading.item = false
        state.error = action.payload ?? 'Failed to load order item.'
      })

      // ---- optimistic single status update ----
      .addCase(updateOrderItemStatus.pending, (state, action) => {
        state.loading.updatingStatus = true
        state.error = null
        rollbackRegistry.set(action.meta.requestId, {
          vendorOrders: current(state).vendorOrders,
          currentItem: current(state).currentVendorOrderItem,
        })
        const { orderItemId, newStatus } = action.meta.arg
        state.vendorOrders = state.vendorOrders.map((item) =>
          item.id === orderItemId ? applyStatusToItem(item, newStatus) : item,
        )
        if (state.currentVendorOrderItem?.id === orderItemId) {
          state.currentVendorOrderItem = applyStatusToItem(state.currentVendorOrderItem, newStatus)
        }
      })
      .addCase(updateOrderItemStatus.fulfilled, (state, action) => {
        state.loading.updatingStatus = false
        rollbackRegistry.delete(action.meta.requestId)
        state.vendorOrders = mergeItem(state.vendorOrders, action.payload)
        if (state.currentVendorOrderItem?.id === action.payload.id) {
          state.currentVendorOrderItem = { ...state.currentVendorOrderItem, ...action.payload }
        }
      })
      .addCase(updateOrderItemStatus.rejected, (state, action) => {
        state.loading.updatingStatus = false
        const snapshot = rollbackRegistry.get(action.meta.requestId)
        if (snapshot) {
          state.vendorOrders = snapshot.vendorOrders
          state.currentVendorOrderItem = snapshot.currentItem
          rollbackRegistry.delete(action.meta.requestId)
        }
        state.error = action.payload ?? 'Failed to update status.'
      })

      // ---- optimistic bulk status update ----
      .addCase(bulkUpdateOrderItemStatus.pending, (state, action) => {
        state.loading.bulkUpdating = true
        state.error = null
        rollbackRegistry.set(action.meta.requestId, {
          vendorOrders: current(state).vendorOrders,
          currentItem: current(state).currentVendorOrderItem,
        })
        const { orderItemIds, newStatus } = action.meta.arg
        const ids = new Set(orderItemIds)
        state.vendorOrders = state.vendorOrders.map((item) =>
          ids.has(item.id) ? applyStatusToItem(item, newStatus) : item,
        )
      })
      .addCase(bulkUpdateOrderItemStatus.fulfilled, (state, action) => {
        state.loading.bulkUpdating = false
        rollbackRegistry.delete(action.meta.requestId)
        for (const updated of action.payload) {
          state.vendorOrders = mergeItem(state.vendorOrders, updated)
        }
      })
      .addCase(bulkUpdateOrderItemStatus.rejected, (state, action) => {
        state.loading.bulkUpdating = false
        const snapshot = rollbackRegistry.get(action.meta.requestId)
        if (snapshot) {
          state.vendorOrders = snapshot.vendorOrders
          state.currentVendorOrderItem = snapshot.currentItem
          rollbackRegistry.delete(action.meta.requestId)
        }
        state.error = action.payload ?? 'Failed to update statuses.'
      })

      // ---- optimistic item fields update ----
      .addCase(updateVendorOrderItem.pending, (state, action) => {
        state.loading.updating = true
        state.error = null
        rollbackRegistry.set(action.meta.requestId, {
          vendorOrders: current(state).vendorOrders,
          currentItem: current(state).currentVendorOrderItem,
        })
        const { orderItemId, updates } = action.meta.arg
        state.vendorOrders = state.vendorOrders.map((item) =>
          item.id === orderItemId ? { ...item, ...updates } : item,
        )
        if (state.currentVendorOrderItem?.id === orderItemId) {
          state.currentVendorOrderItem = { ...state.currentVendorOrderItem, ...updates }
        }
      })
      .addCase(updateVendorOrderItem.fulfilled, (state, action) => {
        state.loading.updating = false
        rollbackRegistry.delete(action.meta.requestId)
        state.vendorOrders = mergeItem(state.vendorOrders, action.payload)
        if (state.currentVendorOrderItem?.id === action.payload.id) {
          state.currentVendorOrderItem = { ...state.currentVendorOrderItem, ...action.payload }
        }
      })
      .addCase(updateVendorOrderItem.rejected, (state, action) => {
        state.loading.updating = false
        const snapshot = rollbackRegistry.get(action.meta.requestId)
        if (snapshot) {
          state.vendorOrders = snapshot.vendorOrders
          state.currentVendorOrderItem = snapshot.currentItem
          rollbackRegistry.delete(action.meta.requestId)
        }
        state.error = action.payload ?? 'Failed to update order item.'
      })

      // ---- analytics / summary ----
      .addCase(loadVendorAnalytics.pending, (state) => {
        state.loading.analytics = true
      })
      .addCase(loadVendorAnalytics.fulfilled, (state, action) => {
        state.loading.analytics = false
        state.vendorAnalytics = action.payload
      })
      .addCase(loadVendorAnalytics.rejected, (state, action) => {
        state.loading.analytics = false
        state.error = action.payload ?? 'Failed to load analytics.'
      })
      .addCase(loadVendorSummary.pending, (state) => {
        state.loading.summary = true
      })
      .addCase(loadVendorSummary.fulfilled, (state, action) => {
        state.loading.summary = false
        state.vendorOrderSummary = action.payload
      })
      .addCase(loadVendorSummary.rejected, (state, action) => {
        state.loading.summary = false
        state.error = action.payload ?? 'Failed to load summary.'
      })

      // ---- search ----
      .addCase(searchVendorOrders.pending, (state) => {
        state.loading.searching = true
        state.error = null
      })
      .addCase(searchVendorOrders.fulfilled, (state, action) => {
        state.loading.searching = false
        state.searchResults = action.payload.items
        state.searchPagination = action.payload.pagination
      })
      .addCase(searchVendorOrders.rejected, (state, action) => {
        state.loading.searching = false
        state.error = action.payload ?? 'Search failed.'
      })

      // ---- admin ----
      .addCase(loadAdminOrders.pending, (state) => {
        state.loading.admin = true
        state.error = null
      })
      .addCase(loadAdminOrders.fulfilled, (state, action) => {
        state.loading.admin = false
        state.adminOrders = action.payload.items
        state.adminPagination = action.payload.pagination
      })
      .addCase(loadAdminOrders.rejected, (state, action) => {
        state.loading.admin = false
        state.error = action.payload ?? 'Failed to load platform orders.'
      })
      .addCase(loadPlatformAnalytics.fulfilled, (state, action) => {
        state.platformAnalytics = action.payload
      })
      .addCase(loadPlatformAnalytics.rejected, (state, action) => {
        state.error = action.payload ?? 'Failed to load platform analytics.'
      })
  },
})

export const { setVendorFilters, clearError, clearSearchResults, clearVendorData } =
  vendorOrdersSlice.actions

export const vendorOrdersReducer = vendorOrdersSlice.reducer

// ============= SELECTORS =============

export const selectVendorOrders = (state: RootState) => state.vendorOrders.vendorOrders
export const selectCurrentVendorOrderItem = (state: RootState) =>
  state.vendorOrders.currentVendorOrderItem
export const selectVendorOrdersLoading = (state: RootState) => state.vendorOrders.loading
export const selectVendorOrdersError = (state: RootState) => state.vendorOrders.error
export const selectVendorPagination = (state: RootState) => state.vendorOrders.vendorPagination
export const selectVendorAnalytics = (state: RootState) => state.vendorOrders.vendorAnalytics
export const selectVendorSummary = (state: RootState) => state.vendorOrders.vendorOrderSummary
export const selectAdminOrders = (state: RootState) => state.vendorOrders.adminOrders

/** Client-side counts over the loaded vendor orders. */
export const selectVendorOrderStats = (state: RootState) =>
  computeVendorOrderStats(state.vendorOrders.vendorOrders)

export const selectPendingVendorOrders = (state: RootState) =>
  getPendingVendorOrders(state.vendorOrders.vendorOrders)

export const selectRecentVendorOrders = (state: RootState) =>
  getRecentVendorOrders(state.vendorOrders.vendorOrders)

export const selectVendorLoadedRevenue = (state: RootState) =>
  getVendorTotalRevenue(state.vendorOrders.vendorOrders)
