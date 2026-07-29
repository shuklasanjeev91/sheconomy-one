/**
 * Redux Toolkit slice for order payments.
 *
 * Replaces the legacy Zustand `paymentStore`. Async work wraps
 * `payment.service`; status changes and COD collection apply **optimistically**
 * and roll back on failure via the snapshot registry below. Suitable for
 * vendor, admin and checkout surfaces alike.
 */

import { createAsyncThunk, createSlice, current, type PayloadAction } from '@reduxjs/toolkit'

import type { AppDispatch, RootState } from '~/lib/store'

import { PAYMENT_MODE, PAYMENT_STATUS, type PaymentStatus } from '~/lib/orders/order.constants'
import * as paymentService from '~/lib/orders/payment.service'
import type {
  CODCollectionInput,
  OrderPayment,
  PaymentAnalytics,
  PaymentAnalyticsFilters,
  ProcessPaymentInput,
  UpdatePaymentStatusMetadata,
} from '~/lib/orders/payment.type'

// ============= STATE =============

type PaymentLoadingState = {
  processing: boolean
  updatingStatus: boolean
  loadingPayments: boolean
  collectingCOD: boolean
  loadingAnalytics: boolean
}

type PaymentState = {
  currentPayment: OrderPayment | null
  orderPayments: OrderPayment[]
  paymentAnalytics: PaymentAnalytics | null
  loading: PaymentLoadingState
  error: string | null
}

const initialState: PaymentState = {
  currentPayment: null,
  orderPayments: [],
  paymentAnalytics: null,
  loading: {
    processing: false,
    updatingStatus: false,
    loadingPayments: false,
    collectingCOD: false,
    loadingAnalytics: false,
  },
  error: null,
}

type ThunkConfig = { state: RootState; dispatch: AppDispatch; rejectValue: string }

type Snapshot = { orderPayments: OrderPayment[]; currentPayment: OrderPayment | null }
const rollbackRegistry = new Map<string, Snapshot>()

// ============= THUNKS =============

export const processPayment = createAsyncThunk<
  OrderPayment,
  { input: ProcessPaymentInput; userId?: string },
  ThunkConfig
>('payment/process', async ({ input, userId }, { rejectWithValue }) => {
  const response = await paymentService.processPayment(input, userId)
  if (!response.success || !response.data) {
    return rejectWithValue(response.error ?? 'Failed to process payment.')
  }
  return response.data
})

export const updatePaymentStatus = createAsyncThunk<
  OrderPayment,
  { paymentId: string; status: PaymentStatus; metadata?: UpdatePaymentStatusMetadata; userId?: string },
  ThunkConfig
>('payment/updateStatus', async ({ paymentId, status, metadata, userId }, { rejectWithValue }) => {
  const response = await paymentService.updatePaymentStatus(paymentId, status, metadata, userId)
  if (!response.success || !response.data) {
    return rejectWithValue(response.error ?? 'Failed to update payment status.')
  }
  return response.data
})

export const getOrderPayments = createAsyncThunk<
  OrderPayment[],
  { orderId: string; userId?: string },
  ThunkConfig
>('payment/getForOrder', async ({ orderId, userId }, { rejectWithValue }) => {
  const response = await paymentService.getOrderPayments(orderId, userId)
  if (!response.success || !response.data) {
    return rejectWithValue(response.error ?? 'Failed to fetch payments.')
  }
  return response.data
})

export const collectCODPayment = createAsyncThunk<
  OrderPayment,
  { orderId: string; collection?: CODCollectionInput; userId?: string },
  ThunkConfig
>('payment/collectCOD', async ({ orderId, collection, userId }, { rejectWithValue }) => {
  const response = await paymentService.collectCODPayment(orderId, collection, userId)
  if (!response.success || !response.data) {
    return rejectWithValue(response.error ?? 'Failed to collect COD payment.')
  }
  return response.data
})

export const getPaymentAnalytics = createAsyncThunk<
  PaymentAnalytics,
  { filters?: PaymentAnalyticsFilters; userId?: string } | undefined,
  ThunkConfig
>('payment/analytics', async (arg, { rejectWithValue }) => {
  const response = await paymentService.getPaymentAnalytics(arg?.filters, arg?.userId)
  if (!response.success || !response.data) {
    return rejectWithValue(response.error ?? 'Failed to fetch payment analytics.')
  }
  return response.data
})

// ============= HELPERS =============

function mergePayment(list: OrderPayment[], updated: OrderPayment): OrderPayment[] {
  return list.map((payment) => (payment.id === updated.id ? { ...payment, ...updated } : payment))
}

// ============= SLICE =============

const paymentSlice = createSlice({
  name: 'payment',
  initialState,
  reducers: {
    clearError(state) {
      state.error = null
    },
    resetPaymentStore() {
      return initialState
    },
  },
  extraReducers: (builder) => {
    builder
      // ---- process ----
      .addCase(processPayment.pending, (state) => {
        state.loading.processing = true
        state.error = null
      })
      .addCase(processPayment.fulfilled, (state, action) => {
        state.loading.processing = false
        state.currentPayment = action.payload
        state.orderPayments = mergePayment(state.orderPayments, action.payload)
      })
      .addCase(processPayment.rejected, (state, action) => {
        state.loading.processing = false
        state.error = action.payload ?? 'Failed to process payment.'
      })

      // ---- optimistic status update ----
      .addCase(updatePaymentStatus.pending, (state, action) => {
        state.loading.updatingStatus = true
        state.error = null
        rollbackRegistry.set(action.meta.requestId, {
          orderPayments: current(state).orderPayments,
          currentPayment: current(state).currentPayment,
        })
        const { paymentId, status } = action.meta.arg
        state.orderPayments = state.orderPayments.map((payment) =>
          payment.id === paymentId ? { ...payment, payment_status: status } : payment,
        )
        if (state.currentPayment?.id === paymentId) {
          state.currentPayment = { ...state.currentPayment, payment_status: status }
        }
      })
      .addCase(updatePaymentStatus.fulfilled, (state, action) => {
        state.loading.updatingStatus = false
        rollbackRegistry.delete(action.meta.requestId)
        state.orderPayments = mergePayment(state.orderPayments, action.payload)
        if (state.currentPayment?.id === action.payload.id) {
          state.currentPayment = { ...state.currentPayment, ...action.payload }
        }
      })
      .addCase(updatePaymentStatus.rejected, (state, action) => {
        state.loading.updatingStatus = false
        const snapshot = rollbackRegistry.get(action.meta.requestId)
        if (snapshot) {
          state.orderPayments = snapshot.orderPayments
          state.currentPayment = snapshot.currentPayment
          rollbackRegistry.delete(action.meta.requestId)
        }
        state.error = action.payload ?? 'Failed to update payment status.'
      })

      // ---- load for order ----
      .addCase(getOrderPayments.pending, (state) => {
        state.loading.loadingPayments = true
        state.error = null
      })
      .addCase(getOrderPayments.fulfilled, (state, action) => {
        state.loading.loadingPayments = false
        state.orderPayments = action.payload
      })
      .addCase(getOrderPayments.rejected, (state, action) => {
        state.loading.loadingPayments = false
        state.error = action.payload ?? 'Failed to fetch payments.'
      })

      // ---- optimistic COD collection ----
      .addCase(collectCODPayment.pending, (state, action) => {
        state.loading.collectingCOD = true
        state.error = null
        rollbackRegistry.set(action.meta.requestId, {
          orderPayments: current(state).orderPayments,
          currentPayment: current(state).currentPayment,
        })
        const { orderId } = action.meta.arg
        state.orderPayments = state.orderPayments.map((payment) =>
          payment.order_id === orderId && payment.payment_mode === PAYMENT_MODE.COD
            ? { ...payment, payment_status: PAYMENT_STATUS.COMPLETED }
            : payment,
        )
      })
      .addCase(collectCODPayment.fulfilled, (state, action) => {
        state.loading.collectingCOD = false
        rollbackRegistry.delete(action.meta.requestId)
        state.orderPayments = mergePayment(state.orderPayments, action.payload)
      })
      .addCase(collectCODPayment.rejected, (state, action) => {
        state.loading.collectingCOD = false
        const snapshot = rollbackRegistry.get(action.meta.requestId)
        if (snapshot) {
          state.orderPayments = snapshot.orderPayments
          state.currentPayment = snapshot.currentPayment
          rollbackRegistry.delete(action.meta.requestId)
        }
        state.error = action.payload ?? 'Failed to collect COD payment.'
      })

      // ---- analytics ----
      .addCase(getPaymentAnalytics.pending, (state) => {
        state.loading.loadingAnalytics = true
      })
      .addCase(getPaymentAnalytics.fulfilled, (state, action) => {
        state.loading.loadingAnalytics = false
        state.paymentAnalytics = action.payload
      })
      .addCase(getPaymentAnalytics.rejected, (state, action) => {
        state.loading.loadingAnalytics = false
        state.error = action.payload ?? 'Failed to fetch payment analytics.'
      })
  },
})

export const { clearError, resetPaymentStore } = paymentSlice.actions

export const paymentReducer = paymentSlice.reducer

// ============= SELECTORS =============

export const selectCurrentPayment = (state: RootState) => state.payment.currentPayment
export const selectOrderPayments = (state: RootState) => state.payment.orderPayments
export const selectPaymentAnalytics = (state: RootState) => state.payment.paymentAnalytics
export const selectPaymentLoading = (state: RootState) => state.payment.loading
export const selectPaymentError = (state: RootState) => state.payment.error
