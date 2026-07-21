/**
 * Redux slice for shop review management (public reads, vendor moderation, buyer actions).
 *
 * Ported from legacy Zustand `shopReviewsStore.js` (data layer only — no UI modals/toasts).
 */

import { createAsyncThunk, createSlice, current, type PayloadAction } from '@reduxjs/toolkit'

import type { AppDispatch, RootState } from '~/lib/store'

import * as shopReviewService from './shop-review.service'
import { buildDefaultShopReviewFilters, buildDefaultShopReviewPagination } from './shop-review.validation'
import type {
  ShopReviewAccessContext,
  ShopReviewBulkModerationInput,
  ShopReviewCreateInput,
  ShopReviewFetchResult,
  ShopReviewFetchScope,
  ShopReviewFilterInput,
  ShopReviewHelpfulnessInput,
  ShopReviewModerationInput,
  ShopReviewQueryInput,
  ShopReviewReportInput,
  ShopReviewResponseCreateInput,
  ShopReviewStats,
  ShopReviewUpdateInput,
  ShopReviewWithRelations,
} from './shop-review.type'
import {
  applyShopReviewUpdate,
  buildOptimisticShopReview,
  indexShopReviewsById,
  mergeShopReviewsById,
  removeShopReviewById,
  reviewMatchesShopReviewFilters,
  shouldUseShopReviewCache,
  upsertShopReview,
} from './shop-review.utils'

type ShopReviewsState = {
  shopId: string | null
  reviews: ShopReviewWithRelations[]
  userReviews: ShopReviewWithRelations[]
  ownerReviews: ShopReviewWithRelations[]
  reviewsById: Record<string, ShopReviewWithRelations>
  currentReviewId: string | null
  filters: ShopReviewFilterInput
  pagination: ReturnType<typeof buildDefaultShopReviewPagination>
  fetchScope: ShopReviewFetchScope
  reviewStats: ShopReviewStats | null
  userReviewByShopId: Record<string, ShopReviewWithRelations | null>
  reportedReviewIds: Record<string, boolean>
  lastFetch: number | null
  statsFetchTimes: Record<string, number>
  isLoading: boolean
  isSaving: boolean
  isDeleting: boolean
  isVoting: boolean
  isReporting: boolean
  isResponding: boolean
  isModerating: boolean
  error: string | null
}

const initialState: ShopReviewsState = {
  shopId: null,
  reviews: [],
  userReviews: [],
  ownerReviews: [],
  reviewsById: {},
  currentReviewId: null,
  filters: buildDefaultShopReviewFilters(),
  pagination: buildDefaultShopReviewPagination(),
  fetchScope: 'public',
  reviewStats: null,
  userReviewByShopId: {},
  reportedReviewIds: {},
  lastFetch: null,
  statsFetchTimes: {},
  isLoading: false,
  isSaving: false,
  isDeleting: false,
  isVoting: false,
  isReporting: false,
  isResponding: false,
  isModerating: false,
  error: null,
}

type ThunkConfig = { state: RootState; dispatch: AppDispatch; rejectValue: string }

type ReviewsSnapshot = {
  reviews: ShopReviewWithRelations[]
  userReviews: ShopReviewWithRelations[]
  ownerReviews: ShopReviewWithRelations[]
  reviewsById: Record<string, ShopReviewWithRelations>
  currentReviewId: string | null
  pagination: ShopReviewsState['pagination']
  reviewStats: ShopReviewStats | null
  userReviewByShopId: Record<string, ShopReviewWithRelations | null>
  reportedReviewIds: Record<string, boolean>
  lastFetch: number | null
}

const rollbackRegistry = new Map<string, ReviewsSnapshot>()

function stashRollback(requestId: string, snapshot: ReviewsSnapshot): void {
  rollbackRegistry.set(requestId, snapshot)
}

function takeRollback(requestId: string): ReviewsSnapshot | undefined {
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

function snapshotReviews(state: ShopReviewsState): ReviewsSnapshot {
  return {
    reviews: current(state.reviews),
    userReviews: current(state.userReviews),
    ownerReviews: current(state.ownerReviews),
    reviewsById: current(state.reviewsById),
    currentReviewId: state.currentReviewId,
    pagination: { ...state.pagination },
    reviewStats: state.reviewStats,
    userReviewByShopId: current(state.userReviewByShopId),
    reportedReviewIds: current(state.reportedReviewIds),
    lastFetch: state.lastFetch,
  }
}

function restoreReviews(state: ShopReviewsState, snapshot?: ReviewsSnapshot): void {
  if (!snapshot) return
  state.reviews = snapshot.reviews
  state.userReviews = snapshot.userReviews
  state.ownerReviews = snapshot.ownerReviews
  state.reviewsById = snapshot.reviewsById
  state.currentReviewId = snapshot.currentReviewId
  state.pagination = snapshot.pagination
  state.reviewStats = snapshot.reviewStats
  state.userReviewByShopId = snapshot.userReviewByShopId
  state.reportedReviewIds = snapshot.reportedReviewIds
  state.lastFetch = snapshot.lastFetch
}

export const loadShopReviews = createAsyncThunk<
  ShopReviewFetchResult & { reset: boolean },
  {
    query: ShopReviewQueryInput
    reset?: boolean
    scope?: ShopReviewFetchScope
    accessContext?: ShopReviewAccessContext
    forceRefresh?: boolean
  },
  ThunkConfig
>('shopReview/load', async (arg, { getState, rejectWithValue }) => {
  const state = getState().shopReview
  const reset = arg.reset ?? false

  if (
    !reset &&
    state.shopId === arg.query.shop_id &&
    shouldUseShopReviewCache(state.lastFetch, arg.forceRefresh)
  ) {
    return {
      reviews: state.reviews,
      pagination: state.pagination,
      reset: false,
    }
  }

  const query = {
    ...state.filters,
    ...arg.query,
    page: reset ? 1 : arg.query.page ?? state.pagination.page,
  }

  const result = await resolveResponse(
    shopReviewService.fetchShopReviews(query, {
      scope: arg.scope ?? state.fetchScope,
      accessContext: arg.accessContext,
    }),
    rejectWithValue,
  )

  return { ...result, reset }
})

export const loadMoreShopReviews = createAsyncThunk<
  ShopReviewFetchResult,
  { accessContext?: ShopReviewAccessContext } | void,
  ThunkConfig
>('shopReview/loadMore', async (arg, { getState, rejectWithValue }) => {
  const state = getState().shopReview
  if (!state.shopId || !state.pagination.has_more || state.isLoading) {
    return rejectWithValue('No more reviews to load.') as never
  }

  return resolveResponse(
    shopReviewService.fetchShopReviews(
      {
        shop_id: state.shopId,
        ...state.filters,
        page: state.pagination.page + 1,
        limit: state.pagination.limit,
      },
      { scope: state.fetchScope, accessContext: arg?.accessContext },
    ),
    rejectWithValue,
  )
})

export const loadUserShopReviews = createAsyncThunk<
  ShopReviewFetchResult,
  { page?: number; limit?: number; status?: ShopReviewFilterInput['status']; accessContext?: ShopReviewAccessContext },
  ThunkConfig
>('shopReview/loadUserReviews', async (arg, { rejectWithValue }) =>
  resolveResponse(shopReviewService.fetchUserShopReviews(arg), rejectWithValue),
)

export const loadShopOwnerReviews = createAsyncThunk<
  ShopReviewFetchResult,
  {
    shopId?: string | null
    page?: number
    limit?: number
    status?: ShopReviewFilterInput['status']
    accessContext?: ShopReviewAccessContext
  },
  ThunkConfig
>('shopReview/loadOwnerReviews', async (arg, { rejectWithValue }) =>
  resolveResponse(shopReviewService.fetchShopOwnerReviews(arg), rejectWithValue),
)

export const createShopReview = createAsyncThunk<
  ShopReviewWithRelations,
  { input: ShopReviewCreateInput; accessContext?: ShopReviewAccessContext },
  ThunkConfig
>('shopReview/create', async (arg, { rejectWithValue }) =>
  resolveResponse(shopReviewService.createShopReview(arg.input, arg.accessContext), rejectWithValue),
)

export const updateShopReview = createAsyncThunk<
  ShopReviewWithRelations,
  { reviewId: string; input: ShopReviewUpdateInput; accessContext?: ShopReviewAccessContext },
  ThunkConfig
>('shopReview/update', async (arg, { rejectWithValue }) =>
  resolveResponse(
    shopReviewService.updateShopReview(arg.reviewId, arg.input, arg.accessContext),
    rejectWithValue,
  ),
)

export const deleteShopReview = createAsyncThunk<
  { review_id: string; shop_id: string },
  { reviewId: string; accessContext?: ShopReviewAccessContext },
  ThunkConfig
>('shopReview/delete', async (arg, { rejectWithValue }) =>
  resolveResponse(shopReviewService.deleteShopReview(arg.reviewId, arg.accessContext), rejectWithValue),
)

export const moderateShopReviews = createAsyncThunk<
  ShopReviewWithRelations[],
  { reviewIds: string[]; updates: ShopReviewModerationInput; accessContext?: ShopReviewAccessContext },
  ThunkConfig
>('shopReview/moderate', async (arg, { rejectWithValue }) =>
  resolveResponse(
    shopReviewService.moderateShopReviews(arg.reviewIds, arg.updates, arg.accessContext),
    rejectWithValue,
  ),
)

export const bulkModerateShopReviews = createAsyncThunk<
  ShopReviewWithRelations[],
  { input: ShopReviewBulkModerationInput; accessContext?: ShopReviewAccessContext },
  ThunkConfig
>('shopReview/bulkModerate', async (arg, { rejectWithValue }) =>
  resolveResponse(
    shopReviewService.bulkModerateShopReviews(arg.input, arg.accessContext),
    rejectWithValue,
  ),
)

export const loadShopReviewById = createAsyncThunk<
  ShopReviewWithRelations,
  { reviewId: string; scope?: ShopReviewFetchScope; accessContext?: ShopReviewAccessContext },
  ThunkConfig
>('shopReview/loadById', async (arg, { rejectWithValue }) =>
  resolveResponse(
    shopReviewService.fetchShopReviewById(arg.reviewId, {
      scope: arg.scope,
      accessContext: arg.accessContext,
    }),
    rejectWithValue,
  ),
)

export const loadShopReviewStats = createAsyncThunk<
  ShopReviewStats,
  { shopId: string; forceRefresh?: boolean; accessContext?: ShopReviewAccessContext },
  ThunkConfig
>('shopReview/loadStats', async (arg, { getState, rejectWithValue }) => {
  const state = getState().shopReview
  const fetchedAt = state.statsFetchTimes[arg.shopId]

  if (!arg.forceRefresh && fetchedAt && shouldUseShopReviewCache(fetchedAt)) {
    return state.reviewStats ?? (await resolveResponse(
      shopReviewService.fetchShopReviewStats({ shop_id: arg.shopId }),
      rejectWithValue,
    ))
  }

  return resolveResponse(
    shopReviewService.fetchShopReviewStats({ shop_id: arg.shopId }),
    rejectWithValue,
  )
})

export const createShopReviewResponse = createAsyncThunk<
  ShopReviewWithRelations,
  { input: ShopReviewResponseCreateInput; accessContext?: ShopReviewAccessContext },
  ThunkConfig
>('shopReview/createResponse', async (arg, { rejectWithValue }) => {
  await resolveResponse(
    shopReviewService.createShopReviewResponse(arg.input, arg.accessContext),
    rejectWithValue,
  )

  return resolveResponse(
    shopReviewService.fetchShopReviewById(arg.input.review_id, {
      scope: 'management',
      accessContext: arg.accessContext,
    }),
    rejectWithValue,
  )
})

export const voteShopReviewHelpfulness = createAsyncThunk<
  ShopReviewWithRelations,
  { input: ShopReviewHelpfulnessInput; accessContext?: ShopReviewAccessContext },
  ThunkConfig
>('shopReview/vote', async (arg, { rejectWithValue }) =>
  resolveResponse(
    shopReviewService.voteShopReviewHelpfulness(arg.input, arg.accessContext),
    rejectWithValue,
  ),
)

export const removeShopReviewHelpfulnessVote = createAsyncThunk<
  ShopReviewWithRelations,
  { reviewId: string; accessContext?: ShopReviewAccessContext },
  ThunkConfig
>('shopReview/removeVote', async (arg, { rejectWithValue }) =>
  resolveResponse(
    shopReviewService.removeShopReviewHelpfulnessVote(arg.reviewId, arg.accessContext),
    rejectWithValue,
  ),
)

export const reportShopReview = createAsyncThunk<
  { report_id: string; review_id: string },
  { input: ShopReviewReportInput; accessContext?: ShopReviewAccessContext },
  ThunkConfig
>('shopReview/report', async (arg, { rejectWithValue }) => {
  const result = await resolveResponse(
    shopReviewService.reportShopReview(arg.input, arg.accessContext),
    rejectWithValue,
  )
  return { ...result, review_id: arg.input.review_id }
})

export const checkShopReviewEligibility = createAsyncThunk<
  { shop_id: string; can_review: boolean; reason: string | null },
  { shopId: string; accessContext?: ShopReviewAccessContext },
  ThunkConfig
>('shopReview/checkEligibility', async (arg, { rejectWithValue }) => {
  const result = await resolveResponse(
    shopReviewService.checkShopReviewEligibility(arg.shopId, arg.accessContext),
    rejectWithValue,
  )
  return { shop_id: arg.shopId, ...result }
})

export const loadUserShopReview = createAsyncThunk<
  { shopId: string; review: ShopReviewWithRelations | null },
  { shopId: string; accessContext?: ShopReviewAccessContext },
  ThunkConfig
>('shopReview/loadUserReview', async (arg, { rejectWithValue }) => {
  const review = await resolveResponse(
    shopReviewService.fetchUserShopReview(arg.shopId, arg.accessContext),
    rejectWithValue,
  )
  return { shopId: arg.shopId, review }
})

const shopReviewSlice = createSlice({
  name: 'shopReview',
  initialState,
  reducers: {
    setShopReviewShopId: (state, action: PayloadAction<string | null>) => {
      if (state.shopId !== action.payload) {
        state.shopId = action.payload
        state.reviews = []
        state.reviewsById = {}
        state.pagination = buildDefaultShopReviewPagination()
        state.lastFetch = null
      }
    },
    setShopReviewFilters: (state, action: PayloadAction<Partial<ShopReviewFilterInput>>) => {
      state.filters = { ...state.filters, ...action.payload }
    },
    resetShopReviewFilters: (state) => {
      state.filters = {
        ...buildDefaultShopReviewFilters(),
      }
    },
    setShopReviewFetchScope: (state, action: PayloadAction<ShopReviewFetchScope>) => {
      if (state.fetchScope !== action.payload) {
        state.fetchScope = action.payload
        state.reviews = []
        state.ownerReviews = []
        state.reviewsById = {}
        state.pagination = buildDefaultShopReviewPagination()
        state.lastFetch = null
      }
    },
    setCurrentShopReviewId: (state, action: PayloadAction<string | null>) => {
      state.currentReviewId = action.payload
    },
    setShopReviewError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload
    },
    clearShopReviewError: (state) => {
      state.error = null
    },
    resetShopReviewState: () => initialState,
  },
  extraReducers: (builder) => {
    builder
      .addCase(loadShopReviews.pending, (state, action) => {
        state.isLoading = true
        state.error = null
        if (action.meta.arg.query.shop_id) state.shopId = action.meta.arg.query.shop_id
        if (action.meta.arg.scope) state.fetchScope = action.meta.arg.scope
        if (action.meta.arg.query) {
          state.filters = { ...state.filters, ...action.meta.arg.query }
        }
      })
      .addCase(loadShopReviews.fulfilled, (state, action) => {
        const { reviews, pagination, reset } = action.payload
        if (reset || pagination.page === 1) {
          state.reviews = reviews
          state.reviewsById = indexShopReviewsById(reviews)
        } else {
          state.reviews = [...state.reviews, ...reviews]
          state.reviewsById = mergeShopReviewsById(state.reviewsById, reviews)
        }
        state.pagination = pagination
        state.isLoading = false
        state.lastFetch = Date.now()
      })
      .addCase(loadShopReviews.rejected, (state, action) => {
        state.isLoading = false
        state.error = action.payload ?? 'Failed to load shop reviews.'
      })

      .addCase(loadMoreShopReviews.pending, (state) => {
        state.isLoading = true
        state.error = null
      })
      .addCase(loadMoreShopReviews.fulfilled, (state, action) => {
        state.reviews = [...state.reviews, ...action.payload.reviews]
        state.reviewsById = mergeShopReviewsById(state.reviewsById, action.payload.reviews)
        state.pagination = action.payload.pagination
        state.isLoading = false
        state.lastFetch = Date.now()
      })
      .addCase(loadMoreShopReviews.rejected, (state, action) => {
        state.isLoading = false
        state.error = action.payload ?? 'Failed to load more reviews.'
      })

      .addCase(loadUserShopReviews.fulfilled, (state, action) => {
        state.userReviews = action.payload.reviews
        state.reviewsById = mergeShopReviewsById(state.reviewsById, action.payload.reviews)
      })

      .addCase(loadShopOwnerReviews.fulfilled, (state, action) => {
        state.ownerReviews = action.payload.reviews
        state.reviewsById = mergeShopReviewsById(state.reviewsById, action.payload.reviews)
      })

      .addCase(createShopReview.pending, (state, action) => {
        state.isSaving = true
        state.error = null
        stashRollback(action.meta.requestId, snapshotReviews(state))

        const userId = action.meta.arg.accessContext?.userId ?? 'pending-user'
        const optimistic = buildOptimisticShopReview(
          action.meta.requestId,
          userId,
          action.meta.arg.input,
        )

        if (reviewMatchesShopReviewFilters(optimistic, state.filters)) {
          state.reviews = upsertShopReview(state.reviews, optimistic)
          state.reviewsById[optimistic.id] = optimistic
          state.pagination.total += 1
        }

        state.userReviews = upsertShopReview(state.userReviews, optimistic)
        state.userReviewByShopId[action.meta.arg.input.shop_id] = optimistic
        state.currentReviewId = optimistic.id
      })
      .addCase(createShopReview.fulfilled, (state, action) => {
        rollbackRegistry.delete(action.meta.requestId)
        const tempId = optimisticId(action.meta.requestId)

        state.reviews = upsertShopReview(removeShopReviewById(state.reviews, tempId), action.payload)
        state.userReviews = upsertShopReview(
          removeShopReviewById(state.userReviews, tempId),
          action.payload,
        )
        delete state.reviewsById[tempId]
        state.reviewsById[action.payload.id] = action.payload
        state.userReviewByShopId[action.payload.shop_id] = action.payload
        state.currentReviewId = action.payload.id
        state.isSaving = false
        state.lastFetch = Date.now()
      })
      .addCase(createShopReview.rejected, (state, action) => {
        restoreReviews(state, takeRollback(action.meta.requestId))
        state.error = action.payload ?? 'Failed to create review.'
        state.isSaving = false
      })

      .addCase(updateShopReview.pending, (state, action) => {
        state.isSaving = true
        state.error = null
        stashRollback(action.meta.requestId, snapshotReviews(state))

        const { reviewId, input } = action.meta.arg
        const existing = state.reviewsById[reviewId]
        if (!existing) return

        const optimistic = applyShopReviewUpdate(existing, input as Partial<ShopReviewWithRelations>)
        state.reviews = state.reviews.map((review) => (review.id === reviewId ? optimistic : review))
        state.userReviews = state.userReviews.map((review) =>
          review.id === reviewId ? optimistic : review,
        )
        state.reviewsById[reviewId] = optimistic
        state.userReviewByShopId[optimistic.shop_id] = optimistic
      })
      .addCase(updateShopReview.fulfilled, (state, action) => {
        rollbackRegistry.delete(action.meta.requestId)
        state.reviews = upsertShopReview(state.reviews, action.payload)
        state.userReviews = upsertShopReview(state.userReviews, action.payload)
        state.reviewsById[action.payload.id] = action.payload
        state.userReviewByShopId[action.payload.shop_id] = action.payload
        state.isSaving = false
        state.lastFetch = Date.now()
      })
      .addCase(updateShopReview.rejected, (state, action) => {
        restoreReviews(state, takeRollback(action.meta.requestId))
        state.error = action.payload ?? 'Failed to update review.'
        state.isSaving = false
      })

      .addCase(deleteShopReview.pending, (state, action) => {
        state.isDeleting = true
        state.error = null
        stashRollback(action.meta.requestId, snapshotReviews(state))

        const reviewId = action.meta.arg.reviewId
        const existing = state.reviewsById[reviewId]
        state.reviews = removeShopReviewById(state.reviews, reviewId)
        state.userReviews = removeShopReviewById(state.userReviews, reviewId)
        state.ownerReviews = removeShopReviewById(state.ownerReviews, reviewId)
        delete state.reviewsById[reviewId]
        if (existing) {
          state.userReviewByShopId[existing.shop_id] = null
          state.pagination.total = Math.max(0, state.pagination.total - 1)
        }
        if (state.currentReviewId === reviewId) state.currentReviewId = null
      })
      .addCase(deleteShopReview.fulfilled, (state, action) => {
        rollbackRegistry.delete(action.meta.requestId)
        state.isDeleting = false
        state.userReviewByShopId[action.payload.shop_id] = null
        state.lastFetch = Date.now()
      })
      .addCase(deleteShopReview.rejected, (state, action) => {
        restoreReviews(state, takeRollback(action.meta.requestId))
        state.error = action.payload ?? 'Failed to delete review.'
        state.isDeleting = false
      })

      .addCase(moderateShopReviews.pending, (state, action) => {
        state.isModerating = true
        state.error = null
        stashRollback(action.meta.requestId, snapshotReviews(state))

        for (const reviewId of action.meta.arg.reviewIds) {
          const existing = state.reviewsById[reviewId]
          if (!existing) continue
          const optimistic = applyShopReviewUpdate(existing, {
            review_status: action.meta.arg.updates.review_status,
            moderation_reason: action.meta.arg.updates.moderation_reason ?? existing.moderation_reason,
            moderated_at: new Date().toISOString(),
          })
          state.reviews = state.reviews.map((review) => (review.id === reviewId ? optimistic : review))
          state.ownerReviews = state.ownerReviews.map((review) =>
            review.id === reviewId ? optimistic : review,
          )
          state.reviewsById[reviewId] = optimistic
        }
      })
      .addCase(moderateShopReviews.fulfilled, (state, action) => {
        rollbackRegistry.delete(action.meta.requestId)
        for (const review of action.payload) {
          if (reviewMatchesShopReviewFilters(review, state.filters)) {
            state.reviews = upsertShopReview(state.reviews, review)
          } else {
            state.reviews = removeShopReviewById(state.reviews, review.id)
          }
          state.ownerReviews = upsertShopReview(state.ownerReviews, review)
          state.reviewsById[review.id] = review
        }
        state.isModerating = false
        state.lastFetch = Date.now()
      })
      .addCase(moderateShopReviews.rejected, (state, action) => {
        restoreReviews(state, takeRollback(action.meta.requestId))
        state.error = action.payload ?? 'Failed to moderate reviews.'
        state.isModerating = false
      })

      .addCase(bulkModerateShopReviews.pending, (state, action) => {
        state.isModerating = true
        state.error = null
        stashRollback(action.meta.requestId, snapshotReviews(state))
      })
      .addCase(bulkModerateShopReviews.fulfilled, (state, action) => {
        rollbackRegistry.delete(action.meta.requestId)
        for (const review of action.payload) {
          if (reviewMatchesShopReviewFilters(review, state.filters)) {
            state.reviews = upsertShopReview(state.reviews, review)
          } else {
            state.reviews = removeShopReviewById(state.reviews, review.id)
          }
          state.ownerReviews = upsertShopReview(state.ownerReviews, review)
          state.reviewsById[review.id] = review
        }
        state.isModerating = false
        state.lastFetch = Date.now()
      })
      .addCase(bulkModerateShopReviews.rejected, (state, action) => {
        restoreReviews(state, takeRollback(action.meta.requestId))
        state.error = action.payload ?? 'Failed to moderate reviews.'
        state.isModerating = false
      })

      .addCase(loadShopReviewById.fulfilled, (state, action) => {
        state.reviewsById[action.payload.id] = action.payload
        state.currentReviewId = action.payload.id
      })

      .addCase(loadShopReviewStats.fulfilled, (state, action) => {
        state.reviewStats = action.payload
        if (state.shopId) state.statsFetchTimes[state.shopId] = Date.now()
      })

      .addCase(createShopReviewResponse.pending, (state, action) => {
        state.isResponding = true
        state.error = null
        stashRollback(action.meta.requestId, snapshotReviews(state))
      })
      .addCase(createShopReviewResponse.fulfilled, (state, action) => {
        rollbackRegistry.delete(action.meta.requestId)
        state.reviews = upsertShopReview(state.reviews, action.payload)
        state.ownerReviews = upsertShopReview(state.ownerReviews, action.payload)
        state.reviewsById[action.payload.id] = action.payload
        state.isResponding = false
      })
      .addCase(createShopReviewResponse.rejected, (state, action) => {
        restoreReviews(state, takeRollback(action.meta.requestId))
        state.error = action.payload ?? 'Failed to post response.'
        state.isResponding = false
      })

      .addCase(voteShopReviewHelpfulness.pending, (state, action) => {
        state.isVoting = true
        state.error = null
        stashRollback(action.meta.requestId, snapshotReviews(state))

        const { review_id, is_helpful } = action.meta.arg.input
        const existing = state.reviewsById[review_id]
        if (!existing) return

        const optimistic = applyShopReviewUpdate(existing, {
          helpful_count: is_helpful
            ? (existing.helpful_count ?? 0) + 1
            : Math.max(0, (existing.helpful_count ?? 0) - 1),
          not_helpful_count: is_helpful
            ? existing.not_helpful_count
            : (existing.not_helpful_count ?? 0) + 1,
        })
        state.reviews = state.reviews.map((review) => (review.id === review_id ? optimistic : review))
        state.reviewsById[review_id] = optimistic
      })
      .addCase(voteShopReviewHelpfulness.fulfilled, (state, action) => {
        rollbackRegistry.delete(action.meta.requestId)
        state.reviews = upsertShopReview(state.reviews, action.payload)
        state.reviewsById[action.payload.id] = action.payload
        state.isVoting = false
      })
      .addCase(voteShopReviewHelpfulness.rejected, (state, action) => {
        restoreReviews(state, takeRollback(action.meta.requestId))
        state.error = action.payload ?? 'Failed to record vote.'
        state.isVoting = false
      })

      .addCase(removeShopReviewHelpfulnessVote.pending, (state, action) => {
        state.isVoting = true
        state.error = null
        stashRollback(action.meta.requestId, snapshotReviews(state))
      })
      .addCase(removeShopReviewHelpfulnessVote.fulfilled, (state, action) => {
        rollbackRegistry.delete(action.meta.requestId)
        state.reviews = upsertShopReview(state.reviews, action.payload)
        state.reviewsById[action.payload.id] = action.payload
        state.isVoting = false
      })
      .addCase(removeShopReviewHelpfulnessVote.rejected, (state, action) => {
        restoreReviews(state, takeRollback(action.meta.requestId))
        state.error = action.payload ?? 'Failed to remove vote.'
        state.isVoting = false
      })

      .addCase(reportShopReview.pending, (state, action) => {
        state.isReporting = true
        state.error = null
        stashRollback(action.meta.requestId, snapshotReviews(state))
        state.reportedReviewIds[action.meta.arg.input.review_id] = true
      })
      .addCase(reportShopReview.fulfilled, (state) => {
        state.isReporting = false
      })
      .addCase(reportShopReview.rejected, (state, action) => {
        restoreReviews(state, takeRollback(action.meta.requestId))
        state.error = action.payload ?? 'Failed to report review.'
        state.isReporting = false
      })

      .addCase(loadUserShopReview.fulfilled, (state, action) => {
        state.userReviewByShopId[action.payload.shopId] = action.payload.review
      })
  },
})

export const {
  setShopReviewShopId,
  setShopReviewFilters,
  resetShopReviewFilters,
  setShopReviewFetchScope,
  setCurrentShopReviewId,
  setShopReviewError,
  clearShopReviewError,
  resetShopReviewState,
} = shopReviewSlice.actions

export const shopReviewReducer = shopReviewSlice.reducer

export const selectShopReviews = (state: RootState) => state.shopReview.reviews
export const selectUserShopReviews = (state: RootState) => state.shopReview.userReviews
export const selectShopOwnerReviews = (state: RootState) => state.shopReview.ownerReviews
export const selectShopReviewsById = (state: RootState) => state.shopReview.reviewsById
export const selectShopReviewFilters = (state: RootState) => state.shopReview.filters
export const selectShopReviewPagination = (state: RootState) => state.shopReview.pagination
export const selectShopReviewStats = (state: RootState) => state.shopReview.reviewStats
export const selectShopReviewError = (state: RootState) => state.shopReview.error

export const selectShopReviewById =
  (reviewId: string | null | undefined) => (state: RootState) =>
    reviewId ? state.shopReview.reviewsById[reviewId] ?? null : null

export const selectUserShopReviewByShopId =
  (shopId: string | null | undefined) => (state: RootState) =>
    shopId ? state.shopReview.userReviewByShopId[shopId] ?? null : null
