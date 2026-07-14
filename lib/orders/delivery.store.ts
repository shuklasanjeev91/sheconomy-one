/**
 * Redux Toolkit slice for order deliveries + tracking.
 *
 * Replaces the legacy Zustand `deliveryStore`. Async work wraps
 * `delivery.service`; delivery-status changes apply **optimistically** and roll
 * back on failure via the snapshot registry below. Suitable for vendor, admin
 * and customer-tracking surfaces alike.
 */

import { createAsyncThunk, createSlice, current } from '@reduxjs/toolkit'

import type { AppDispatch, RootState } from '~/lib/store'

import * as deliveryService from './delivery.service'
import type { DeliveryStatus } from './order.constants'
import type {
  CreateDeliveryInput,
  CreateTrackingInput,
  DeliveryAnalytics,
  DeliveryAnalyticsFilters,
  EnrichedDelivery,
  OrderDelivery,
  PaginationMeta,
  TrackableDeliveries,
  TrackableDeliveryOptions,
  UpdateDeliveryStatusMetadata,
  VendorDeliveryOptions,
} from './delivery.type'

// ============= STATE =============

type DeliveryLoadingState = {
  creating: boolean
  updatingStatus: boolean
  loadingDeliveries: boolean
  loadingVendorDeliveries: boolean
  tracking: boolean
  loadingTrackable: boolean
  loadingAnalytics: boolean
}

type DeliveryState = {
  currentDelivery: EnrichedDelivery | null
  orderDeliveries: EnrichedDelivery[]
  vendorDeliveries: EnrichedDelivery[]
  vendorDeliveriesPagination: PaginationMeta
  trackableDeliveries: OrderDelivery[]
  trackingInfo: EnrichedDelivery | null
  deliveryAnalytics: DeliveryAnalytics | null
  loading: DeliveryLoadingState
  error: string | null
}

const initialPagination: PaginationMeta = { page: 1, limit: 20, total: 0, total_pages: 0 }

const initialState: DeliveryState = {
  currentDelivery: null,
  orderDeliveries: [],
  vendorDeliveries: [],
  vendorDeliveriesPagination: initialPagination,
  trackableDeliveries: [],
  trackingInfo: null,
  deliveryAnalytics: null,
  loading: {
    creating: false,
    updatingStatus: false,
    loadingDeliveries: false,
    loadingVendorDeliveries: false,
    tracking: false,
    loadingTrackable: false,
    loadingAnalytics: false,
  },
  error: null,
}

type ThunkConfig = { state: RootState; dispatch: AppDispatch; rejectValue: string }

type Snapshot = {
  orderDeliveries: EnrichedDelivery[]
  vendorDeliveries: EnrichedDelivery[]
  currentDelivery: EnrichedDelivery | null
}
const rollbackRegistry = new Map<string, Snapshot>()

// ============= THUNKS =============

export const createDelivery = createAsyncThunk<
  OrderDelivery,
  { input: CreateDeliveryInput; userId?: string },
  ThunkConfig
>('delivery/create', async ({ input, userId }, { rejectWithValue }) => {
  const response = await deliveryService.createDelivery(input, userId)
  if (!response.success || !response.data) {
    return rejectWithValue(response.error ?? 'Failed to create delivery record.')
  }
  return response.data
})

export const createTracking = createAsyncThunk<
  OrderDelivery,
  { input: CreateTrackingInput; userId?: string },
  ThunkConfig
>('delivery/createTracking', async ({ input, userId }, { rejectWithValue }) => {
  const response = await deliveryService.createTracking(input, userId)
  if (!response.success || !response.data) {
    return rejectWithValue(response.error ?? 'Failed to add tracking information.')
  }
  return response.data
})

export const updateDeliveryStatus = createAsyncThunk<
  OrderDelivery,
  { deliveryId: string; status: DeliveryStatus; metadata?: UpdateDeliveryStatusMetadata; userId?: string },
  ThunkConfig
>('delivery/updateStatus', async ({ deliveryId, status, metadata, userId }, { rejectWithValue }) => {
  const response = await deliveryService.updateDeliveryStatus(deliveryId, status, metadata, userId)
  if (!response.success || !response.data) {
    return rejectWithValue(response.error ?? 'Failed to update delivery status.')
  }
  return response.data
})

export const loadOrderDeliveries = createAsyncThunk<
  EnrichedDelivery[],
  { orderItemId: string; userId?: string },
  ThunkConfig
>('delivery/loadForItem', async ({ orderItemId, userId }, { rejectWithValue }) => {
  const response = await deliveryService.getOrderDeliveries(orderItemId, userId)
  if (!response.success || !response.data) {
    return rejectWithValue(response.error ?? 'Failed to fetch deliveries.')
  }
  return response.data
})

export const trackDelivery = createAsyncThunk<
  EnrichedDelivery,
  { trackingNumber: string; userId?: string },
  ThunkConfig
>('delivery/track', async ({ trackingNumber, userId }, { rejectWithValue }) => {
  const response = await deliveryService.trackDelivery(trackingNumber, userId)
  if (!response.success || !response.data) {
    return rejectWithValue(response.error ?? 'Tracking number not found.')
  }
  return response.data
})

export const loadVendorDeliveries = createAsyncThunk<
  { deliveries: EnrichedDelivery[]; pagination: PaginationMeta },
  { vendorId: string; options?: VendorDeliveryOptions; userId?: string },
  ThunkConfig
>('delivery/loadForVendor', async ({ vendorId, options, userId }, { rejectWithValue }) => {
  const response = await deliveryService.getVendorDeliveries(vendorId, options, userId)
  if (!response.success || !response.data) {
    return rejectWithValue(response.error ?? 'Failed to fetch vendor deliveries.')
  }
  return response.data
})

export const loadTrackableDeliveries = createAsyncThunk<
  TrackableDeliveries,
  { options?: TrackableDeliveryOptions; userId?: string } | undefined,
  ThunkConfig
>('delivery/loadTrackable', async (arg, { rejectWithValue }) => {
  const response = await deliveryService.getTrackableDeliveries(arg?.options, arg?.userId)
  if (!response.success || !response.data) {
    return rejectWithValue(response.error ?? 'Failed to fetch trackable deliveries.')
  }
  return response.data
})

export const loadDeliveryAnalytics = createAsyncThunk<
  DeliveryAnalytics,
  { filters?: DeliveryAnalyticsFilters; userId?: string } | undefined,
  ThunkConfig
>('delivery/analytics', async (arg, { rejectWithValue }) => {
  const response = await deliveryService.getDeliveryAnalytics(arg?.filters, arg?.userId)
  if (!response.success || !response.data) {
    return rejectWithValue(response.error ?? 'Failed to fetch delivery analytics.')
  }
  return response.data
})

// ============= HELPERS =============

function mergeDelivery(list: EnrichedDelivery[], updated: OrderDelivery): EnrichedDelivery[] {
  return list.map((delivery) => (delivery.id === updated.id ? { ...delivery, ...updated } : delivery))
}

// ============= SLICE =============

const deliverySlice = createSlice({
  name: 'delivery',
  initialState,
  reducers: {
    clearError(state) {
      state.error = null
    },
    resetDeliveryStore() {
      return initialState
    },
  },
  extraReducers: (builder) => {
    builder
      // ---- create ----
      .addCase(createDelivery.pending, (state) => {
        state.loading.creating = true
        state.error = null
      })
      .addCase(createDelivery.fulfilled, (state, action) => {
        state.loading.creating = false
        state.currentDelivery = action.payload
        state.orderDeliveries = [action.payload, ...state.orderDeliveries]
      })
      .addCase(createDelivery.rejected, (state, action) => {
        state.loading.creating = false
        state.error = action.payload ?? 'Failed to create delivery record.'
      })

      // ---- create tracking (shares the creating flag) ----
      .addCase(createTracking.pending, (state) => {
        state.loading.creating = true
        state.error = null
      })
      .addCase(createTracking.fulfilled, (state, action) => {
        state.loading.creating = false
        state.currentDelivery = action.payload
        state.orderDeliveries = [action.payload, ...state.orderDeliveries]
      })
      .addCase(createTracking.rejected, (state, action) => {
        state.loading.creating = false
        state.error = action.payload ?? 'Failed to add tracking information.'
      })

      // ---- optimistic status update ----
      .addCase(updateDeliveryStatus.pending, (state, action) => {
        state.loading.updatingStatus = true
        state.error = null
        rollbackRegistry.set(action.meta.requestId, {
          orderDeliveries: current(state).orderDeliveries,
          vendorDeliveries: current(state).vendorDeliveries,
          currentDelivery: current(state).currentDelivery,
        })
        const { deliveryId, status } = action.meta.arg
        const apply = (list: EnrichedDelivery[]) =>
          list.map((delivery) =>
            delivery.id === deliveryId ? { ...delivery, delivery_status: status } : delivery,
          )
        state.orderDeliveries = apply(state.orderDeliveries)
        state.vendorDeliveries = apply(state.vendorDeliveries)
        if (state.currentDelivery?.id === deliveryId) {
          state.currentDelivery = { ...state.currentDelivery, delivery_status: status }
        }
      })
      .addCase(updateDeliveryStatus.fulfilled, (state, action) => {
        state.loading.updatingStatus = false
        rollbackRegistry.delete(action.meta.requestId)
        state.orderDeliveries = mergeDelivery(state.orderDeliveries, action.payload)
        state.vendorDeliveries = mergeDelivery(state.vendorDeliveries, action.payload)
        if (state.currentDelivery?.id === action.payload.id) {
          state.currentDelivery = { ...state.currentDelivery, ...action.payload }
        }
      })
      .addCase(updateDeliveryStatus.rejected, (state, action) => {
        state.loading.updatingStatus = false
        const snapshot = rollbackRegistry.get(action.meta.requestId)
        if (snapshot) {
          state.orderDeliveries = snapshot.orderDeliveries
          state.vendorDeliveries = snapshot.vendorDeliveries
          state.currentDelivery = snapshot.currentDelivery
          rollbackRegistry.delete(action.meta.requestId)
        }
        state.error = action.payload ?? 'Failed to update delivery status.'
      })

      // ---- load for item ----
      .addCase(loadOrderDeliveries.pending, (state) => {
        state.loading.loadingDeliveries = true
        state.error = null
      })
      .addCase(loadOrderDeliveries.fulfilled, (state, action) => {
        state.loading.loadingDeliveries = false
        state.orderDeliveries = action.payload
      })
      .addCase(loadOrderDeliveries.rejected, (state, action) => {
        state.loading.loadingDeliveries = false
        state.error = action.payload ?? 'Failed to fetch deliveries.'
      })

      // ---- track by number ----
      .addCase(trackDelivery.pending, (state) => {
        state.loading.tracking = true
        state.error = null
      })
      .addCase(trackDelivery.fulfilled, (state, action) => {
        state.loading.tracking = false
        state.trackingInfo = action.payload
      })
      .addCase(trackDelivery.rejected, (state, action) => {
        state.loading.tracking = false
        state.error = action.payload ?? 'Tracking number not found.'
      })

      // ---- vendor deliveries ----
      .addCase(loadVendorDeliveries.pending, (state) => {
        state.loading.loadingVendorDeliveries = true
        state.error = null
      })
      .addCase(loadVendorDeliveries.fulfilled, (state, action) => {
        state.loading.loadingVendorDeliveries = false
        state.vendorDeliveries = action.payload.deliveries
        state.vendorDeliveriesPagination = action.payload.pagination
      })
      .addCase(loadVendorDeliveries.rejected, (state, action) => {
        state.loading.loadingVendorDeliveries = false
        state.error = action.payload ?? 'Failed to fetch vendor deliveries.'
      })

      // ---- trackable (admin) ----
      .addCase(loadTrackableDeliveries.pending, (state) => {
        state.loading.loadingTrackable = true
      })
      .addCase(loadTrackableDeliveries.fulfilled, (state, action) => {
        state.loading.loadingTrackable = false
        state.trackableDeliveries = action.payload.deliveries
      })
      .addCase(loadTrackableDeliveries.rejected, (state, action) => {
        state.loading.loadingTrackable = false
        state.error = action.payload ?? 'Failed to fetch trackable deliveries.'
      })

      // ---- analytics ----
      .addCase(loadDeliveryAnalytics.pending, (state) => {
        state.loading.loadingAnalytics = true
      })
      .addCase(loadDeliveryAnalytics.fulfilled, (state, action) => {
        state.loading.loadingAnalytics = false
        state.deliveryAnalytics = action.payload
      })
      .addCase(loadDeliveryAnalytics.rejected, (state, action) => {
        state.loading.loadingAnalytics = false
        state.error = action.payload ?? 'Failed to fetch delivery analytics.'
      })
  },
})

export const { clearError, resetDeliveryStore } = deliverySlice.actions

export const deliveryReducer = deliverySlice.reducer

// ============= SELECTORS =============

export const selectCurrentDelivery = (state: RootState) => state.delivery.currentDelivery
export const selectOrderDeliveries = (state: RootState) => state.delivery.orderDeliveries
export const selectVendorDeliveries = (state: RootState) => state.delivery.vendorDeliveries
export const selectVendorDeliveriesPagination = (state: RootState) =>
  state.delivery.vendorDeliveriesPagination
export const selectTrackableDeliveries = (state: RootState) => state.delivery.trackableDeliveries
export const selectTrackingInfo = (state: RootState) => state.delivery.trackingInfo
export const selectDeliveryAnalytics = (state: RootState) => state.delivery.deliveryAnalytics
export const selectDeliveryLoading = (state: RootState) => state.delivery.loading
export const selectDeliveryError = (state: RootState) => state.delivery.error
