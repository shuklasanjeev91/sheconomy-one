/**
 * Redux Toolkit slice for order fulfillment / logistics.
 *
 * Replaces the legacy Zustand `fulfillmentStore`. Async work wraps
 * `fulfillment.service`; status changes apply **optimistically** and roll back
 * on failure via the snapshot registry below. Serves vendor and admin surfaces
 * (the admin thunk loads platform-wide fulfillments).
 */

import { createAsyncThunk, createSlice, current, type PayloadAction } from '@reduxjs/toolkit'

import type { AppDispatch, RootState } from '~/lib/store'

import {
  FINAL_FULFILLMENT_STATUSES,
  FULFILLMENT_STATUS,
  PENDING_FULFILLMENT_STATUSES,
  type FulfillmentStatus,
} from './order.constants'
import * as fulfillmentService from './fulfillment.service'
import type {
  CarrierService,
  CarrierServiceFilters,
  CreateFulfillmentEventInput,
  CreateFulfillmentInput,
  EnrichedFulfillment,
  Fulfillment,
  FulfillmentAnalytics,
  FulfillmentAnalyticsFilters,
  FulfillmentEvent,
  FulfillmentFilters,
  FulfillmentQueryOptions,
  FulfillmentStats,
  PaginatedFulfillments,
  PaginationMeta,
  UpdateFulfillmentStatusMetadata,
} from './fulfillment.type'

// ============= STATE =============

type FulfillmentLoadingState = {
  list: boolean
  creating: boolean
  updating: boolean
  details: boolean
  events: boolean
  carriers: boolean
  analytics: boolean
  tracking: boolean
  admin: boolean
}

type FulfillmentState = {
  fulfillments: EnrichedFulfillment[]
  currentFulfillment: EnrichedFulfillment | null
  fulfillmentEvents: FulfillmentEvent[]
  carrierServices: CarrierService[]
  analytics: FulfillmentAnalytics | null
  adminFulfillments: EnrichedFulfillment[]

  fulfillmentFilters: FulfillmentFilters
  fulfillmentsPagination: PaginationMeta
  adminPagination: PaginationMeta

  loading: FulfillmentLoadingState
  error: string | null
}

const emptyPagination = (): PaginationMeta => ({ page: 1, limit: 20, total: 0, total_pages: 0 })

const initialState: FulfillmentState = {
  fulfillments: [],
  currentFulfillment: null,
  fulfillmentEvents: [],
  carrierServices: [],
  analytics: null,
  adminFulfillments: [],
  fulfillmentFilters: {},
  fulfillmentsPagination: emptyPagination(),
  adminPagination: emptyPagination(),
  loading: {
    list: false,
    creating: false,
    updating: false,
    details: false,
    events: false,
    carriers: false,
    analytics: false,
    tracking: false,
    admin: false,
  },
  error: null,
}

type ThunkConfig = { state: RootState; dispatch: AppDispatch; rejectValue: string }

type Snapshot = { fulfillments: EnrichedFulfillment[]; currentFulfillment: EnrichedFulfillment | null }
const rollbackRegistry = new Map<string, Snapshot>()

// ============= THUNKS =============

export const fetchVendorFulfillments = createAsyncThunk<
  PaginatedFulfillments,
  { vendorId: string; options?: FulfillmentQueryOptions; userId?: string },
  ThunkConfig
>('fulfillment/fetchVendor', async ({ vendorId, options, userId }, { rejectWithValue }) => {
  const response = await fulfillmentService.getVendorFulfillments(vendorId, options, userId)
  if (!response.success || !response.data) {
    return rejectWithValue(response.error ?? 'Failed to fetch fulfillments.')
  }
  return response.data
})

export const fetchFulfillmentDetails = createAsyncThunk<
  EnrichedFulfillment,
  { fulfillmentId: string; userId?: string },
  ThunkConfig
>('fulfillment/fetchDetails', async ({ fulfillmentId, userId }, { rejectWithValue }) => {
  const response = await fulfillmentService.getFulfillmentDetails(fulfillmentId, userId)
  if (!response.success || !response.data) {
    return rejectWithValue(response.error ?? 'Failed to fetch fulfillment.')
  }
  return response.data
})

export const createFulfillment = createAsyncThunk<
  Fulfillment,
  { input: CreateFulfillmentInput; userId?: string },
  ThunkConfig
>('fulfillment/create', async ({ input, userId }, { rejectWithValue }) => {
  const response = await fulfillmentService.createFulfillment(input, userId)
  if (!response.success || !response.data) {
    return rejectWithValue(response.error ?? 'Failed to create fulfillment.')
  }
  return response.data
})

export const updateFulfillmentStatus = createAsyncThunk<
  Fulfillment,
  { fulfillmentId: string; status: FulfillmentStatus; metadata?: UpdateFulfillmentStatusMetadata; userId?: string },
  ThunkConfig
>('fulfillment/updateStatus', async ({ fulfillmentId, status, metadata, userId }, { rejectWithValue }) => {
  const response = await fulfillmentService.updateFulfillmentStatus(fulfillmentId, status, metadata, userId)
  if (!response.success || !response.data) {
    return rejectWithValue(response.error ?? 'Failed to update fulfillment status.')
  }
  return response.data
})

export const createFulfillmentEvent = createAsyncThunk<
  FulfillmentEvent,
  { fulfillmentId: string; eventData: CreateFulfillmentEventInput },
  ThunkConfig
>('fulfillment/createEvent', async ({ fulfillmentId, eventData }, { rejectWithValue }) => {
  const response = await fulfillmentService.createFulfillmentEvent(fulfillmentId, eventData)
  if (!response.success || !response.data) {
    return rejectWithValue(response.error ?? 'Failed to create fulfillment event.')
  }
  return response.data
})

export const trackFulfillment = createAsyncThunk<
  EnrichedFulfillment,
  { trackingNumber: string; userId?: string },
  ThunkConfig
>('fulfillment/track', async ({ trackingNumber, userId }, { rejectWithValue }) => {
  const response = await fulfillmentService.trackFulfillment(trackingNumber, userId)
  if (!response.success || !response.data) {
    return rejectWithValue(response.error ?? 'Tracking number not found.')
  }
  return response.data
})

export const fetchCarrierServices = createAsyncThunk<
  CarrierService[],
  { filters?: CarrierServiceFilters; userId?: string } | undefined,
  ThunkConfig
>('fulfillment/carriers', async (arg, { rejectWithValue }) => {
  const response = await fulfillmentService.getCarrierServices(arg?.filters, arg?.userId)
  if (!response.success || !response.data) {
    return rejectWithValue(response.error ?? 'Failed to fetch carrier services.')
  }
  return response.data
})

export const fetchFulfillmentAnalytics = createAsyncThunk<
  FulfillmentAnalytics,
  { filters?: FulfillmentAnalyticsFilters; userId?: string } | undefined,
  ThunkConfig
>('fulfillment/analytics', async (arg, { rejectWithValue }) => {
  const response = await fulfillmentService.getFulfillmentAnalytics(arg?.filters, arg?.userId)
  if (!response.success || !response.data) {
    return rejectWithValue(response.error ?? 'Failed to fetch fulfillment analytics.')
  }
  return response.data
})

export const fetchAllFulfillments = createAsyncThunk<
  PaginatedFulfillments,
  { options?: FulfillmentQueryOptions; userId?: string } | undefined,
  ThunkConfig
>('fulfillment/fetchAll', async (arg, { rejectWithValue }) => {
  const response = await fulfillmentService.getAllFulfillmentsForAdmin(arg?.options, arg?.userId)
  if (!response.success || !response.data) {
    return rejectWithValue(response.error ?? 'Failed to fetch fulfillments.')
  }
  return response.data
})

// ============= HELPERS =============

function mergeFulfillment(list: EnrichedFulfillment[], updated: Fulfillment): EnrichedFulfillment[] {
  return list.map((f) => (f.id === updated.id ? { ...f, ...updated } : f))
}

// ============= SLICE =============

const fulfillmentSlice = createSlice({
  name: 'fulfillment',
  initialState,
  reducers: {
    setFulfillmentFilters(state, action: PayloadAction<FulfillmentFilters>) {
      state.fulfillmentFilters = { ...state.fulfillmentFilters, ...action.payload }
    },
    setCurrentFulfillment(state, action: PayloadAction<EnrichedFulfillment | null>) {
      state.currentFulfillment = action.payload
    },
    clearError(state) {
      state.error = null
    },
    resetFulfillments() {
      return initialState
    },
  },
  extraReducers: (builder) => {
    builder
      // ---- vendor list ----
      .addCase(fetchVendorFulfillments.pending, (state) => {
        state.loading.list = true
        state.error = null
      })
      .addCase(fetchVendorFulfillments.fulfilled, (state, action) => {
        state.loading.list = false
        state.fulfillments = action.payload.fulfillments
        state.fulfillmentsPagination = action.payload.pagination
      })
      .addCase(fetchVendorFulfillments.rejected, (state, action) => {
        state.loading.list = false
        state.error = action.payload ?? 'Failed to fetch fulfillments.'
      })

      // ---- details ----
      .addCase(fetchFulfillmentDetails.pending, (state) => {
        state.loading.details = true
        state.error = null
      })
      .addCase(fetchFulfillmentDetails.fulfilled, (state, action) => {
        state.loading.details = false
        state.currentFulfillment = action.payload
        state.fulfillmentEvents = action.payload.fulfillment_events ?? []
      })
      .addCase(fetchFulfillmentDetails.rejected, (state, action) => {
        state.loading.details = false
        state.error = action.payload ?? 'Failed to fetch fulfillment.'
      })

      // ---- create (prepend on success) ----
      .addCase(createFulfillment.pending, (state) => {
        state.loading.creating = true
        state.error = null
      })
      .addCase(createFulfillment.fulfilled, (state, action) => {
        state.loading.creating = false
        state.fulfillments = [action.payload as EnrichedFulfillment, ...state.fulfillments]
      })
      .addCase(createFulfillment.rejected, (state, action) => {
        state.loading.creating = false
        state.error = action.payload ?? 'Failed to create fulfillment.'
      })

      // ---- optimistic status update ----
      .addCase(updateFulfillmentStatus.pending, (state, action) => {
        state.loading.updating = true
        state.error = null
        rollbackRegistry.set(action.meta.requestId, {
          fulfillments: current(state).fulfillments,
          currentFulfillment: current(state).currentFulfillment,
        })
        const { fulfillmentId, status } = action.meta.arg
        state.fulfillments = state.fulfillments.map((f) =>
          f.id === fulfillmentId ? { ...f, fulfillment_status: status } : f,
        )
        if (state.currentFulfillment?.id === fulfillmentId) {
          state.currentFulfillment = { ...state.currentFulfillment, fulfillment_status: status }
        }
      })
      .addCase(updateFulfillmentStatus.fulfilled, (state, action) => {
        state.loading.updating = false
        rollbackRegistry.delete(action.meta.requestId)
        state.fulfillments = mergeFulfillment(state.fulfillments, action.payload)
        if (state.currentFulfillment?.id === action.payload.id) {
          state.currentFulfillment = { ...state.currentFulfillment, ...action.payload }
        }
      })
      .addCase(updateFulfillmentStatus.rejected, (state, action) => {
        state.loading.updating = false
        const snapshot = rollbackRegistry.get(action.meta.requestId)
        if (snapshot) {
          state.fulfillments = snapshot.fulfillments
          state.currentFulfillment = snapshot.currentFulfillment
          rollbackRegistry.delete(action.meta.requestId)
        }
        state.error = action.payload ?? 'Failed to update fulfillment status.'
      })

      // ---- events ----
      .addCase(createFulfillmentEvent.pending, (state) => {
        state.loading.events = true
        state.error = null
      })
      .addCase(createFulfillmentEvent.fulfilled, (state, action) => {
        state.loading.events = false
        state.fulfillmentEvents = [action.payload, ...state.fulfillmentEvents]
      })
      .addCase(createFulfillmentEvent.rejected, (state, action) => {
        state.loading.events = false
        state.error = action.payload ?? 'Failed to create fulfillment event.'
      })

      // ---- tracking ----
      .addCase(trackFulfillment.pending, (state) => {
        state.loading.tracking = true
        state.error = null
      })
      .addCase(trackFulfillment.fulfilled, (state, action) => {
        state.loading.tracking = false
        state.currentFulfillment = action.payload
        state.fulfillmentEvents = action.payload.fulfillment_events ?? []
      })
      .addCase(trackFulfillment.rejected, (state, action) => {
        state.loading.tracking = false
        state.error = action.payload ?? 'Tracking number not found.'
      })

      // ---- carrier services ----
      .addCase(fetchCarrierServices.pending, (state) => {
        state.loading.carriers = true
      })
      .addCase(fetchCarrierServices.fulfilled, (state, action) => {
        state.loading.carriers = false
        state.carrierServices = action.payload
      })
      .addCase(fetchCarrierServices.rejected, (state, action) => {
        state.loading.carriers = false
        state.error = action.payload ?? 'Failed to fetch carrier services.'
      })

      // ---- analytics ----
      .addCase(fetchFulfillmentAnalytics.pending, (state) => {
        state.loading.analytics = true
      })
      .addCase(fetchFulfillmentAnalytics.fulfilled, (state, action) => {
        state.loading.analytics = false
        state.analytics = action.payload
      })
      .addCase(fetchFulfillmentAnalytics.rejected, (state, action) => {
        state.loading.analytics = false
        state.error = action.payload ?? 'Failed to fetch fulfillment analytics.'
      })

      // ---- admin ----
      .addCase(fetchAllFulfillments.pending, (state) => {
        state.loading.admin = true
        state.error = null
      })
      .addCase(fetchAllFulfillments.fulfilled, (state, action) => {
        state.loading.admin = false
        state.adminFulfillments = action.payload.fulfillments
        state.adminPagination = action.payload.pagination
      })
      .addCase(fetchAllFulfillments.rejected, (state, action) => {
        state.loading.admin = false
        state.error = action.payload ?? 'Failed to fetch fulfillments.'
      })
  },
})

export const { setFulfillmentFilters, setCurrentFulfillment, clearError, resetFulfillments } =
  fulfillmentSlice.actions

export const fulfillmentReducer = fulfillmentSlice.reducer

// ============= SELECTORS =============

export const selectFulfillments = (state: RootState) => state.fulfillment.fulfillments
export const selectCurrentFulfillment = (state: RootState) => state.fulfillment.currentFulfillment
export const selectFulfillmentEvents = (state: RootState) => state.fulfillment.fulfillmentEvents
export const selectCarrierServices = (state: RootState) => state.fulfillment.carrierServices
export const selectFulfillmentLoading = (state: RootState) => state.fulfillment.loading
export const selectFulfillmentError = (state: RootState) => state.fulfillment.error
export const selectFulfillmentsPagination = (state: RootState) => state.fulfillment.fulfillmentsPagination
export const selectFulfillmentAnalytics = (state: RootState) => state.fulfillment.analytics
export const selectAdminFulfillments = (state: RootState) => state.fulfillment.adminFulfillments

export const selectFulfillmentsByStatus = (status: FulfillmentStatus) => (state: RootState) =>
  state.fulfillment.fulfillments.filter((f) => f.fulfillment_status === status)

export const selectFulfillmentsByPriority = (priority: number) => (state: RootState) =>
  state.fulfillment.fulfillments.filter((f) => f.priority_level === priority)

export const selectPendingFulfillments = (state: RootState) =>
  state.fulfillment.fulfillments.filter((f) =>
    PENDING_FULFILLMENT_STATUSES.includes(f.fulfillment_status as FulfillmentStatus),
  )

/** Fulfillments past their estimated ship date that aren't yet in a terminal state. */
export const selectOverdueFulfillments = (state: RootState) => {
  const now = Date.now()
  return state.fulfillment.fulfillments.filter(
    (f) =>
      f.estimated_ship_date != null &&
      new Date(f.estimated_ship_date).getTime() < now &&
      !FINAL_FULFILLMENT_STATUSES.includes(f.fulfillment_status as FulfillmentStatus),
  )
}

/** Client-side counts over the loaded fulfillments. */
export const selectFulfillmentStats = (state: RootState): FulfillmentStats => {
  const { fulfillments } = state.fulfillment
  const now = Date.now()
  const stats: FulfillmentStats = {
    total: fulfillments.length,
    pending: 0,
    shipped: 0,
    delivered: 0,
    cancelled: 0,
    overdue: 0,
  }

  for (const f of fulfillments) {
    const status = f.fulfillment_status as FulfillmentStatus
    if (PENDING_FULFILLMENT_STATUSES.includes(status)) stats.pending += 1
    if (status === FULFILLMENT_STATUS.SHIPPED) stats.shipped += 1
    if (status === FULFILLMENT_STATUS.DELIVERED) stats.delivered += 1
    if (status === FULFILLMENT_STATUS.CANCELLED) stats.cancelled += 1
    if (
      f.estimated_ship_date != null &&
      new Date(f.estimated_ship_date).getTime() < now &&
      !FINAL_FULFILLMENT_STATUSES.includes(status)
    ) {
      stats.overdue += 1
    }
  }

  return stats
}
