/**
 * Redux Toolkit slice for order issues / disputes.
 *
 * Replaces the legacy Zustand `orderIssueStore`. Async work wraps
 * `order-issue.service`; status changes apply **optimistically** and roll back
 * on failure via the snapshot registry below. Serves customer, vendor and admin
 * surfaces (the admin thunk loads platform-wide issues).
 */

import { createAsyncThunk, createSlice, current, type PayloadAction } from '@reduxjs/toolkit'

import type { AppDispatch, RootState } from '~/lib/store'

import {
  CLOSED_ISSUE_STATUSES,
  HIGH_ISSUE_PRIORITIES,
  ISSUE_STATUS,
  OPEN_ISSUE_STATUSES,
  type IssuePriority,
  type IssueStatus,
  type OrderIssueType,
} from '~/lib/orders/order.constants'
import * as orderIssueService from '~/lib/orders/order-issue.service'
import type {
  CreateOrderIssueInput,
  EnrichedOrderIssue,
  OrderIssue,
  OrderIssueAnalytics,
  OrderIssueAnalyticsFilters,
  OrderIssueFilters,
  OrderIssueQueryOptions,
  OrderIssueStats,
  PaginatedOrderIssues,
  PaginationMeta,
  UpdateIssueStatusMetadata,
} from '~/lib/orders/order-issue.type'

// ============= STATE =============

type IssueLoadingState = {
  issues: boolean
  creating: boolean
  updating: boolean
  details: boolean
  analytics: boolean
  admin: boolean
}

type OrderIssueState = {
  issues: EnrichedOrderIssue[]
  currentIssue: EnrichedOrderIssue | null
  issueAnalytics: OrderIssueAnalytics | null
  adminIssues: EnrichedOrderIssue[]

  issueFilters: OrderIssueFilters
  issuesPagination: PaginationMeta
  adminPagination: PaginationMeta

  loading: IssueLoadingState
  error: string | null
}

const emptyPagination = (): PaginationMeta => ({ page: 1, limit: 20, total: 0, total_pages: 0 })

const initialState: OrderIssueState = {
  issues: [],
  currentIssue: null,
  issueAnalytics: null,
  adminIssues: [],
  issueFilters: {},
  issuesPagination: emptyPagination(),
  adminPagination: emptyPagination(),
  loading: {
    issues: false,
    creating: false,
    updating: false,
    details: false,
    analytics: false,
    admin: false,
  },
  error: null,
}

type ThunkConfig = { state: RootState; dispatch: AppDispatch; rejectValue: string }

type Snapshot = { issues: EnrichedOrderIssue[]; currentIssue: EnrichedOrderIssue | null }
const rollbackRegistry = new Map<string, Snapshot>()

// ============= THUNKS =============

export const fetchUserIssues = createAsyncThunk<
  PaginatedOrderIssues,
  { targetUserId?: string; options?: OrderIssueQueryOptions; userId?: string } | undefined,
  ThunkConfig
>('orderIssues/fetchUser', async (arg, { rejectWithValue }) => {
  const response = await orderIssueService.getUserIssues(arg?.targetUserId, arg?.options, arg?.userId)
  if (!response.success || !response.data) {
    return rejectWithValue(response.error ?? 'Failed to fetch issues.')
  }
  return response.data
})

export const fetchVendorIssues = createAsyncThunk<
  PaginatedOrderIssues,
  { vendorId: string; options?: OrderIssueQueryOptions; userId?: string },
  ThunkConfig
>('orderIssues/fetchVendor', async ({ vendorId, options, userId }, { rejectWithValue }) => {
  const response = await orderIssueService.getVendorIssues(vendorId, options, userId)
  if (!response.success || !response.data) {
    return rejectWithValue(response.error ?? 'Failed to fetch vendor issues.')
  }
  return response.data
})

export const fetchIssueDetails = createAsyncThunk<
  EnrichedOrderIssue,
  { issueId: string; userId?: string },
  ThunkConfig
>('orderIssues/fetchDetails', async ({ issueId, userId }, { rejectWithValue }) => {
  const response = await orderIssueService.getIssueDetails(issueId, userId)
  if (!response.success || !response.data) {
    return rejectWithValue(response.error ?? 'Failed to fetch issue.')
  }
  return response.data
})

export const createOrderIssue = createAsyncThunk<
  OrderIssue,
  { input: CreateOrderIssueInput; userId?: string },
  ThunkConfig
>('orderIssues/create', async ({ input, userId }, { rejectWithValue }) => {
  const response = await orderIssueService.createOrderIssue(input, userId)
  if (!response.success || !response.data) {
    return rejectWithValue(response.error ?? 'Failed to create issue.')
  }
  return response.data
})

export const updateIssueStatus = createAsyncThunk<
  OrderIssue,
  { issueId: string; status: IssueStatus; metadata?: UpdateIssueStatusMetadata; userId?: string },
  ThunkConfig
>('orderIssues/updateStatus', async ({ issueId, status, metadata, userId }, { rejectWithValue }) => {
  const response = await orderIssueService.updateIssueStatus(issueId, status, metadata, userId)
  if (!response.success || !response.data) {
    return rejectWithValue(response.error ?? 'Failed to update issue status.')
  }
  return response.data
})

export const fetchIssueAnalytics = createAsyncThunk<
  OrderIssueAnalytics,
  { filters?: OrderIssueAnalyticsFilters; userId?: string } | undefined,
  ThunkConfig
>('orderIssues/analytics', async (arg, { rejectWithValue }) => {
  const response = await orderIssueService.getIssueAnalytics(arg?.filters, arg?.userId)
  if (!response.success || !response.data) {
    return rejectWithValue(response.error ?? 'Failed to fetch issue analytics.')
  }
  return response.data
})

export const fetchAllIssues = createAsyncThunk<
  PaginatedOrderIssues,
  { options?: OrderIssueQueryOptions; userId?: string } | undefined,
  ThunkConfig
>('orderIssues/fetchAll', async (arg, { rejectWithValue }) => {
  const response = await orderIssueService.getAllIssuesForAdmin(arg?.options, arg?.userId)
  if (!response.success || !response.data) {
    return rejectWithValue(response.error ?? 'Failed to fetch issues.')
  }
  return response.data
})

// ============= HELPERS =============

function mergeIssue<T extends OrderIssue>(list: EnrichedOrderIssue[], updated: T): EnrichedOrderIssue[] {
  return list.map((issue) => (issue.id === updated.id ? { ...issue, ...updated } : issue))
}

// ============= SLICE =============

const orderIssueSlice = createSlice({
  name: 'orderIssues',
  initialState,
  reducers: {
    setIssueFilters(state, action: PayloadAction<OrderIssueFilters>) {
      state.issueFilters = { ...state.issueFilters, ...action.payload }
    },
    setCurrentIssue(state, action: PayloadAction<EnrichedOrderIssue | null>) {
      state.currentIssue = action.payload
    },
    clearError(state) {
      state.error = null
    },
    resetIssues() {
      return initialState
    },
  },
  extraReducers: (builder) => {
    builder
      // ---- fetch user issues ----
      .addCase(fetchUserIssues.pending, (state) => {
        state.loading.issues = true
        state.error = null
      })
      .addCase(fetchUserIssues.fulfilled, (state, action) => {
        state.loading.issues = false
        state.issues = action.payload.issues
        state.issuesPagination = action.payload.pagination
      })
      .addCase(fetchUserIssues.rejected, (state, action) => {
        state.loading.issues = false
        state.error = action.payload ?? 'Failed to fetch issues.'
      })

      // ---- fetch vendor issues ----
      .addCase(fetchVendorIssues.pending, (state) => {
        state.loading.issues = true
        state.error = null
      })
      .addCase(fetchVendorIssues.fulfilled, (state, action) => {
        state.loading.issues = false
        state.issues = action.payload.issues
        state.issuesPagination = action.payload.pagination
      })
      .addCase(fetchVendorIssues.rejected, (state, action) => {
        state.loading.issues = false
        state.error = action.payload ?? 'Failed to fetch vendor issues.'
      })

      // ---- details ----
      .addCase(fetchIssueDetails.pending, (state) => {
        state.loading.details = true
        state.error = null
      })
      .addCase(fetchIssueDetails.fulfilled, (state, action) => {
        state.loading.details = false
        state.currentIssue = action.payload
      })
      .addCase(fetchIssueDetails.rejected, (state, action) => {
        state.loading.details = false
        state.error = action.payload ?? 'Failed to fetch issue.'
      })

      // ---- create (prepend on success) ----
      .addCase(createOrderIssue.pending, (state) => {
        state.loading.creating = true
        state.error = null
      })
      .addCase(createOrderIssue.fulfilled, (state, action) => {
        state.loading.creating = false
        state.issues = [action.payload as EnrichedOrderIssue, ...state.issues]
      })
      .addCase(createOrderIssue.rejected, (state, action) => {
        state.loading.creating = false
        state.error = action.payload ?? 'Failed to create issue.'
      })

      // ---- optimistic status update ----
      .addCase(updateIssueStatus.pending, (state, action) => {
        state.loading.updating = true
        state.error = null
        rollbackRegistry.set(action.meta.requestId, {
          issues: current(state).issues,
          currentIssue: current(state).currentIssue,
        })
        const { issueId, status } = action.meta.arg
        state.issues = state.issues.map((issue) =>
          issue.id === issueId ? { ...issue, status } : issue,
        )
        if (state.currentIssue?.id === issueId) {
          state.currentIssue = { ...state.currentIssue, status }
        }
      })
      .addCase(updateIssueStatus.fulfilled, (state, action) => {
        state.loading.updating = false
        rollbackRegistry.delete(action.meta.requestId)
        state.issues = mergeIssue(state.issues, action.payload)
        if (state.currentIssue?.id === action.payload.id) {
          state.currentIssue = { ...state.currentIssue, ...action.payload }
        }
      })
      .addCase(updateIssueStatus.rejected, (state, action) => {
        state.loading.updating = false
        const snapshot = rollbackRegistry.get(action.meta.requestId)
        if (snapshot) {
          state.issues = snapshot.issues
          state.currentIssue = snapshot.currentIssue
          rollbackRegistry.delete(action.meta.requestId)
        }
        state.error = action.payload ?? 'Failed to update issue status.'
      })

      // ---- analytics ----
      .addCase(fetchIssueAnalytics.pending, (state) => {
        state.loading.analytics = true
      })
      .addCase(fetchIssueAnalytics.fulfilled, (state, action) => {
        state.loading.analytics = false
        state.issueAnalytics = action.payload
      })
      .addCase(fetchIssueAnalytics.rejected, (state, action) => {
        state.loading.analytics = false
        state.error = action.payload ?? 'Failed to fetch issue analytics.'
      })

      // ---- admin ----
      .addCase(fetchAllIssues.pending, (state) => {
        state.loading.admin = true
        state.error = null
      })
      .addCase(fetchAllIssues.fulfilled, (state, action) => {
        state.loading.admin = false
        state.adminIssues = action.payload.issues
        state.adminPagination = action.payload.pagination
      })
      .addCase(fetchAllIssues.rejected, (state, action) => {
        state.loading.admin = false
        state.error = action.payload ?? 'Failed to fetch issues.'
      })
  },
})

export const { setIssueFilters, setCurrentIssue, clearError, resetIssues } = orderIssueSlice.actions

export const orderIssuesReducer = orderIssueSlice.reducer

// ============= SELECTORS =============

export const selectOrderIssues = (state: RootState) => state.orderIssues.issues
export const selectCurrentIssue = (state: RootState) => state.orderIssues.currentIssue
export const selectOrderIssuesLoading = (state: RootState) => state.orderIssues.loading
export const selectOrderIssuesError = (state: RootState) => state.orderIssues.error
export const selectOrderIssuesPagination = (state: RootState) => state.orderIssues.issuesPagination
export const selectIssueAnalytics = (state: RootState) => state.orderIssues.issueAnalytics
export const selectAdminIssues = (state: RootState) => state.orderIssues.adminIssues

export const selectIssuesByStatus = (status: IssueStatus) => (state: RootState) =>
  state.orderIssues.issues.filter((issue) => issue.status === status)

export const selectIssuesByPriority = (priority: IssuePriority) => (state: RootState) =>
  state.orderIssues.issues.filter((issue) => issue.issue_priority === priority)

export const selectIssuesByType = (type: OrderIssueType) => (state: RootState) =>
  state.orderIssues.issues.filter((issue) => issue.issue_type === type)

export const selectOpenIssues = (state: RootState) =>
  state.orderIssues.issues.filter(
    (issue) => issue.status && OPEN_ISSUE_STATUSES.includes(issue.status as IssueStatus),
  )

export const selectHighPriorityIssues = (state: RootState) =>
  state.orderIssues.issues.filter(
    (issue) => issue.issue_priority && HIGH_ISSUE_PRIORITIES.includes(issue.issue_priority as IssuePriority),
  )

export const selectIssuesForOrder = (orderId: string) => (state: RootState) =>
  state.orderIssues.issues.filter((issue) => issue.order_id === orderId)

/** Client-side counts over the loaded issues. */
export const selectIssueStats = (state: RootState): OrderIssueStats => {
  const { issues } = state.orderIssues
  const stats: OrderIssueStats = {
    total: issues.length,
    open: 0,
    in_progress: 0,
    resolved: 0,
    closed: 0,
    high_priority: 0,
  }

  for (const issue of issues) {
    if (issue.status === ISSUE_STATUS.OPEN) stats.open += 1
    if (issue.status === ISSUE_STATUS.IN_PROGRESS) stats.in_progress += 1
    if (issue.status === ISSUE_STATUS.RESOLVED) stats.resolved += 1
    if (issue.status && CLOSED_ISSUE_STATUSES.includes(issue.status as IssueStatus)) {
      if (issue.status === ISSUE_STATUS.CLOSED) stats.closed += 1
    }
    if (issue.issue_priority && HIGH_ISSUE_PRIORITIES.includes(issue.issue_priority as IssuePriority)) {
      stats.high_priority += 1
    }
  }

  return stats
}
