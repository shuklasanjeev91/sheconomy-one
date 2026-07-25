/**
 * Redux slice for listing review management (public reads, vendor moderation, buyer actions).
 *
 * Ported from legacy Zustand `listingReviewsStore.js` (data layer only — no UI modals/toasts).
 * Supports vendor, admin, buyer, and shared flows via optional `accessContext` on thunks.
 */

import { createAsyncThunk, createSlice, current, type PayloadAction } from '@reduxjs/toolkit'

import type { AppDispatch, RootState } from '~/lib/store'

import * as listingReviewService from '~/lib/listing-reviews/listing-reviews.service'
import { buildDefaultListingReviewFilters } from '~/lib/listing-reviews/listing-reviews.validation'
import type {
  ListingReviewAccessContext,
  ListingReviewAnalyticsParams,
  ListingReviewBatchModerationInput,
  ListingReviewCreateInput,
  ListingReviewFilterInput,
  ListingReviewHelpfulnessInput,
  ListingReviewReplyCreateInput,
  ListingReviewReplyUpdateInput,
  ListingReviewReportInput,
  ListingReviewFetchScope,
  ListingReviewSummary,
  ListingReviewUpdateInput,
  ListingReviewVendorDashboard,
  ListingReviewWithRelations,
} from '~/lib/listing-reviews/listing-reviews.type'
import {
  applyListingReviewUpdate,
  buildOptimisticListingReview,
  indexListingReviewsById,
  mergeListingReviewsById,
  removeListingReviewById,
  reviewMatchesCurrentFilters,
  shouldUseListingReviewCache,
  upsertListingReview,
} from '~/lib/listing-reviews/listing-reviews.utils'

// ============= STATE =============

type ListingReviewsState = {
  reviews: ListingReviewWithRelations[]
  reviewsById: Record<string, ListingReviewWithRelations>
  currentReviewId: string | null
  filters: ListingReviewFilterInput
  fetchScope: ListingReviewFetchScope
  pagination: { total: number; hasMore: boolean }
  summariesByListingId: Record<string, ListingReviewSummary>
  userReviewByListingId: Record<string, ListingReviewWithRelations | null>
  analytics: unknown | null
  vendorDashboard: ListingReviewVendorDashboard | null
  lastFetch: number | null
  summaryFetchTimes: Record<string, number>
  isLoading: boolean
  isSaving: boolean
  isDeleting: boolean
  isVoting: boolean
  isReporting: boolean
  isReplying: boolean
  isModerating: boolean
  error: string | null
}

const initialState: ListingReviewsState = {
  reviews: [],
  reviewsById: {},
  currentReviewId: null,
  filters: buildDefaultListingReviewFilters(),
  fetchScope: 'public',
  pagination: { total: 0, hasMore: false },
  summariesByListingId: {},
  userReviewByListingId: {},
  analytics: null,
  vendorDashboard: null,
  lastFetch: null,
  summaryFetchTimes: {},
  isLoading: false,
  isSaving: false,
  isDeleting: false,
  isVoting: false,
  isReporting: false,
  isReplying: false,
  isModerating: false,
  error: null,
}

type ThunkConfig = { state: RootState; dispatch: AppDispatch; rejectValue: string }

type ReviewsSnapshot = {
  reviews: ListingReviewWithRelations[]
  reviewsById: Record<string, ListingReviewWithRelations>
  currentReviewId: string | null
  pagination: ListingReviewsState['pagination']
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

function snapshotReviews(state: ListingReviewsState): ReviewsSnapshot {
  return {
    reviews: current(state.reviews),
    reviewsById: current(state.reviewsById),
    currentReviewId: state.currentReviewId,
    pagination: { ...state.pagination },
    lastFetch: state.lastFetch,
  }
}

function restoreReviews(state: ListingReviewsState, snapshot?: ReviewsSnapshot): void {
  if (!snapshot) return
  state.reviews = snapshot.reviews
  state.reviewsById = snapshot.reviewsById
  state.currentReviewId = snapshot.currentReviewId
  state.pagination = snapshot.pagination
  state.lastFetch = snapshot.lastFetch
}

// ============= THUNKS =============

export const loadListingReviews = createAsyncThunk<
  { reviews: ListingReviewWithRelations[]; total: number; hasMore: boolean; reset: boolean },
  {
    filters?: Partial<ListingReviewFilterInput>
    reset?: boolean
    scope?: ListingReviewFetchScope
    accessContext?: ListingReviewAccessContext
    forceRefresh?: boolean
  } | void,
  ThunkConfig
>('listingReviews/load', async (arg, { getState, rejectWithValue }) => {
  const state = getState().listingReviews
  const reset = arg?.reset ?? false
  const scope = arg?.scope ?? state.fetchScope

  if (!reset && shouldUseListingReviewCache(state.lastFetch, arg?.forceRefresh)) {
    return {
      reviews: state.reviews,
      total: state.pagination.total,
      hasMore: state.pagination.hasMore,
      reset: false,
    }
  }

  const filters = {
    ...state.filters,
    ...(arg?.filters ?? {}),
    offset: reset ? 0 : (arg?.filters?.offset ?? state.filters.offset ?? 0),
  }

  const result = await resolveResponse(
    listingReviewService.fetchListingReviews(filters, {
      scope,
      accessContext: arg?.accessContext,
      forceRefresh: arg?.forceRefresh,
    }),
    rejectWithValue,
  )

  return {
    reviews: result.reviews ?? [],
    total: result.total ?? 0,
    hasMore: result.hasMore ?? false,
    reset,
  }
})

export const loadMoreListingReviews = createAsyncThunk<
  { reviews: ListingReviewWithRelations[]; total: number; hasMore: boolean },
  { accessContext?: ListingReviewAccessContext } | void,
  ThunkConfig
>('listingReviews/loadMore', async (arg, { getState, rejectWithValue }) => {
  const state = getState().listingReviews
  if (!state.pagination.hasMore || state.isLoading) {
    return rejectWithValue('No more reviews to load.') as never
  }

  const filters = {
    ...state.filters,
    offset: (state.filters.offset ?? 0) + (state.filters.limit ?? 20),
  }

  return resolveResponse(
    listingReviewService.fetchListingReviews(filters, {
      scope: state.fetchScope,
      accessContext: arg?.accessContext,
    }),
    rejectWithValue,
  )
})

export const createListingReview = createAsyncThunk<
  ListingReviewWithRelations,
  { input: ListingReviewCreateInput; accessContext?: ListingReviewAccessContext },
  ThunkConfig
>('listingReviews/create', async (arg, { rejectWithValue }) =>
  resolveResponse(
    listingReviewService.createListingReview(arg.input, arg.accessContext),
    rejectWithValue,
  ),
)

export const updateListingReview = createAsyncThunk<
  ListingReviewWithRelations,
  { reviewId: string; input: ListingReviewUpdateInput; accessContext?: ListingReviewAccessContext },
  ThunkConfig
>('listingReviews/update', async (arg, { rejectWithValue }) =>
  resolveResponse(
    listingReviewService.updateListingReview(arg.reviewId, arg.input, arg.accessContext),
    rejectWithValue,
  ),
)

export const deleteListingReview = createAsyncThunk<
  { reviewId: string; listingId: string },
  { reviewId: string; accessContext?: ListingReviewAccessContext },
  ThunkConfig
>('listingReviews/delete', async (arg, { rejectWithValue }) =>
  resolveResponse(
    listingReviewService.deleteListingReview(arg.reviewId, arg.accessContext),
    rejectWithValue,
  ),
)

export const moderateListingReviews = createAsyncThunk<
  ListingReviewWithRelations[],
  { input: ListingReviewBatchModerationInput; accessContext?: ListingReviewAccessContext },
  ThunkConfig
>('listingReviews/moderate', async (arg, { rejectWithValue }) =>
  resolveResponse(
    listingReviewService.moderateListingReviews(arg.input, arg.accessContext),
    rejectWithValue,
  ),
)

export const loadListingReviewById = createAsyncThunk<
  ListingReviewWithRelations,
  { reviewId: string; scope?: ListingReviewFetchScope; accessContext?: ListingReviewAccessContext },
  ThunkConfig
>('listingReviews/loadById', async (arg, { rejectWithValue }) =>
  resolveResponse(
    listingReviewService.fetchListingReviewById(arg.reviewId, {
      scope: arg.scope,
      accessContext: arg.accessContext,
    }),
    rejectWithValue,
  ),
)

export const loadListingReviewSummaries = createAsyncThunk<
  ListingReviewSummary[],
  { listingIds: string[]; forceRefresh?: boolean },
  ThunkConfig
>('listingReviews/loadSummaries', async (arg, { getState, rejectWithValue }) => {
  const listingIds = arg.listingIds ?? []
  const { forceRefresh } = arg
  const state = getState().listingReviews

  if (!listingIds.length) return []

  const missing = forceRefresh
    ? listingIds
    : listingIds.filter((listingId) => {
        const fetchedAt = state.summaryFetchTimes[listingId]
        return !fetchedAt || !shouldUseListingReviewCache(fetchedAt, forceRefresh)
      })

  if (!missing.length) {
    return listingIds.map((listingId) => state.summariesByListingId[listingId]).filter(Boolean) as ListingReviewSummary[]
  }

  return resolveResponse(listingReviewService.fetchListingReviewSummaries(missing), rejectWithValue)
})

export const createListingReviewReply = createAsyncThunk<
  ListingReviewWithRelations,
  { input: ListingReviewReplyCreateInput; accessContext?: ListingReviewAccessContext },
  ThunkConfig
>('listingReviews/createReply', async (arg, { rejectWithValue }) => {
  const reply = await resolveResponse(
    listingReviewService.createListingReviewReply(arg.input, arg.accessContext),
    rejectWithValue,
  )

  const review = await resolveResponse(
    listingReviewService.fetchListingReviewById(arg.input.review_id, {
      scope: 'management',
      accessContext: arg.accessContext,
    }),
    rejectWithValue,
  )

  return {
    ...review,
    replies: [...(review.replies ?? []), reply],
    reply_count: (review.reply_count ?? 0) + 1,
  }
})

export const updateListingReviewReply = createAsyncThunk<
  ListingReviewWithRelations,
  {
    replyId: string
    reviewId: string
    input: ListingReviewReplyUpdateInput
    accessContext?: ListingReviewAccessContext
  },
  ThunkConfig
>('listingReviews/updateReply', async (arg, { rejectWithValue }) => {
  await resolveResponse(
    listingReviewService.updateListingReviewReply(arg.replyId, arg.input, arg.accessContext),
    rejectWithValue,
  )

  return resolveResponse(
    listingReviewService.fetchListingReviewById(arg.reviewId, {
      scope: 'management',
      accessContext: arg.accessContext,
    }),
    rejectWithValue,
  )
})

export const deleteListingReviewReply = createAsyncThunk<
  ListingReviewWithRelations,
  { replyId: string; reviewId: string; accessContext?: ListingReviewAccessContext },
  ThunkConfig
>('listingReviews/deleteReply', async (arg, { rejectWithValue }) => {
  await resolveResponse(
    listingReviewService.deleteListingReviewReply(arg.replyId, arg.accessContext),
    rejectWithValue,
  )

  return resolveResponse(
    listingReviewService.fetchListingReviewById(arg.reviewId, {
      scope: 'management',
      accessContext: arg.accessContext,
    }),
    rejectWithValue,
  )
})

export const voteListingReviewHelpfulness = createAsyncThunk<
  ListingReviewWithRelations,
  { input: ListingReviewHelpfulnessInput; accessContext?: ListingReviewAccessContext },
  ThunkConfig
>('listingReviews/vote', async (arg, { rejectWithValue }) =>
  resolveResponse(
    listingReviewService.voteListingReviewHelpfulness(arg.input, arg.accessContext),
    rejectWithValue,
  ),
)

export const removeListingReviewHelpfulnessVote = createAsyncThunk<
  ListingReviewWithRelations,
  { reviewId: string; accessContext?: ListingReviewAccessContext },
  ThunkConfig
>('listingReviews/removeVote', async (arg, { rejectWithValue }) =>
  resolveResponse(
    listingReviewService.removeListingReviewHelpfulnessVote(arg.reviewId, arg.accessContext),
    rejectWithValue,
  ),
)

export const reportListingReview = createAsyncThunk<
  { reportId: string },
  { input: ListingReviewReportInput; accessContext?: ListingReviewAccessContext },
  ThunkConfig
>('listingReviews/report', async (arg, { rejectWithValue }) =>
  resolveResponse(
    listingReviewService.reportListingReview(arg.input, arg.accessContext),
    rejectWithValue,
  ),
)

export const loadListingReviewAnalytics = createAsyncThunk<
  unknown,
  { params: ListingReviewAnalyticsParams; accessContext?: ListingReviewAccessContext },
  ThunkConfig
>('listingReviews/loadAnalytics', async (arg, { rejectWithValue }) =>
  resolveResponse(
    listingReviewService.fetchListingReviewAnalytics(arg.params, arg.accessContext),
    rejectWithValue,
  ),
)

export const loadVendorListingReviewDashboard = createAsyncThunk<
  ListingReviewVendorDashboard,
  {
    shopId: string
    timeframe?: { date_from?: string | null; date_to?: string | null }
    accessContext?: ListingReviewAccessContext
  },
  ThunkConfig
>('listingReviews/loadVendorDashboard', async (arg, { rejectWithValue }) =>
  resolveResponse(
    listingReviewService.fetchVendorListingReviewDashboard(
      arg.shopId,
      arg.timeframe ?? {},
      arg.accessContext,
    ),
    rejectWithValue,
  ),
)

export const checkListingReviewEligibility = createAsyncThunk<
  { listingId: string; canReview: boolean; reason: string | null },
  { listingId: string; accessContext?: ListingReviewAccessContext },
  ThunkConfig
>('listingReviews/checkEligibility', async (arg, { rejectWithValue }) => {
  const result = await resolveResponse(
    listingReviewService.checkListingReviewEligibility(arg.listingId, arg.accessContext),
    rejectWithValue,
  )
  return { listingId: arg.listingId, ...result }
})

export const loadUserListingReview = createAsyncThunk<
  { listingId: string; review: ListingReviewWithRelations | null },
  { listingId: string; accessContext?: ListingReviewAccessContext },
  ThunkConfig
>('listingReviews/loadUserReview', async (arg, { rejectWithValue }) => {
  const review = await resolveResponse(
    listingReviewService.fetchUserListingReview(arg.listingId, arg.accessContext),
    rejectWithValue,
  )
  return { listingId: arg.listingId, review }
})

// ============= SLICE =============

const listingReviewsSlice = createSlice({
  name: 'listingReviews',
  initialState,
  reducers: {
    setListingReviewFilters: (state, action: PayloadAction<Partial<ListingReviewFilterInput>>) => {
      state.filters = { ...state.filters, ...action.payload }
    },
    resetListingReviewFilters: (state) => {
      state.filters = {
        ...buildDefaultListingReviewFilters(),
        limit: state.filters.limit ?? buildDefaultListingReviewFilters().limit,
      }
    },
    setListingReviewFetchScope: (state, action: PayloadAction<ListingReviewFetchScope>) => {
      if (state.fetchScope !== action.payload) {
        state.fetchScope = action.payload
        state.reviews = []
        state.reviewsById = {}
        state.pagination = { total: 0, hasMore: false }
        state.lastFetch = null
      }
    },
    setCurrentListingReviewId: (state, action: PayloadAction<string | null>) => {
      state.currentReviewId = action.payload
    },
    setListingReviewError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload
    },
    clearListingReviewError: (state) => {
      state.error = null
    },
    resetListingReviewsState: () => initialState,
  },
  extraReducers: (builder) => {
    builder
      // ---- load ----
      .addCase(loadListingReviews.pending, (state, action) => {
        state.isLoading = true
        state.error = null
        if (action.meta.arg?.scope) state.fetchScope = action.meta.arg.scope
        if (action.meta.arg?.filters) {
          state.filters = { ...state.filters, ...action.meta.arg.filters }
        }
      })
      .addCase(loadListingReviews.fulfilled, (state, action) => {
        const { reviews, total, hasMore, reset } = action.payload
        const safeReviews = reviews ?? []
        if (reset || (state.filters.offset ?? 0) === 0) {
          state.reviews = safeReviews
          state.reviewsById = indexListingReviewsById(safeReviews)
        } else {
          state.reviews = [...state.reviews, ...safeReviews]
          state.reviewsById = mergeListingReviewsById(state.reviewsById, safeReviews)
        }
        state.pagination = { total, hasMore }
        state.isLoading = false
        state.lastFetch = Date.now()
      })
      .addCase(loadListingReviews.rejected, (state, action) => {
        state.isLoading = false
        state.error = action.payload ?? 'Failed to load reviews.'
      })

      // ---- load more ----
      .addCase(loadMoreListingReviews.pending, (state) => {
        state.isLoading = true
        state.error = null
        state.filters.offset = (state.filters.offset ?? 0) + (state.filters.limit ?? 20)
      })
      .addCase(loadMoreListingReviews.fulfilled, (state, action) => {
        const { reviews, total, hasMore } = action.payload
        const safeReviews = reviews ?? []
        state.reviews = [...state.reviews, ...safeReviews]
        state.reviewsById = mergeListingReviewsById(state.reviewsById, safeReviews)
        state.pagination = { total, hasMore }
        state.isLoading = false
        state.lastFetch = Date.now()
      })
      .addCase(loadMoreListingReviews.rejected, (state, action) => {
        state.isLoading = false
        state.filters.offset = Math.max(0, (state.filters.offset ?? 0) - (state.filters.limit ?? 20))
        state.error = action.payload ?? 'Failed to load more reviews.'
      })

      // ---- create (optimistic) ----
      .addCase(createListingReview.pending, (state, action) => {
        state.isSaving = true
        state.error = null
        stashRollback(action.meta.requestId, snapshotReviews(state))

        const userId = action.meta.arg.accessContext?.userId ?? 'pending-user'
        const optimistic = buildOptimisticListingReview(
          action.meta.requestId,
          userId,
          action.meta.arg.input,
        )

        if (reviewMatchesCurrentFilters(optimistic, state.filters)) {
          state.reviews = upsertListingReview(state.reviews, optimistic)
          state.reviewsById[optimistic.id] = optimistic
          state.pagination.total += 1
        }

        state.userReviewByListingId[action.meta.arg.input.listing_id] = optimistic
        state.currentReviewId = optimistic.id
      })
      .addCase(createListingReview.fulfilled, (state, action) => {
        rollbackRegistry.delete(action.meta.requestId)
        const tempId = optimisticId(action.meta.requestId)
        state.reviews = upsertListingReview(
          removeListingReviewById(state.reviews, tempId),
          action.payload,
        )
        delete state.reviewsById[tempId]
        state.reviewsById[action.payload.id] = action.payload
        state.userReviewByListingId[action.payload.listing_id] = action.payload
        state.currentReviewId = action.payload.id
        state.isSaving = false
        state.lastFetch = Date.now()
      })
      .addCase(createListingReview.rejected, (state, action) => {
        restoreReviews(state, takeRollback(action.meta.requestId))
        state.error = action.payload ?? 'Failed to create review.'
        state.isSaving = false
      })

      // ---- update (optimistic) ----
      .addCase(updateListingReview.pending, (state, action) => {
        state.isSaving = true
        state.error = null
        stashRollback(action.meta.requestId, snapshotReviews(state))

        const { reviewId, input } = action.meta.arg
        const existing = state.reviewsById[reviewId]
        if (!existing) return

        const optimistic = applyListingReviewUpdate(existing, input as Partial<ListingReviewWithRelations>)
        state.reviews = state.reviews.map((review) => (review.id === reviewId ? optimistic : review))
        state.reviewsById[reviewId] = optimistic
        state.userReviewByListingId[optimistic.listing_id] = optimistic
      })
      .addCase(updateListingReview.fulfilled, (state, action) => {
        rollbackRegistry.delete(action.meta.requestId)
        state.reviews = upsertListingReview(state.reviews, action.payload)
        state.reviewsById[action.payload.id] = action.payload
        state.userReviewByListingId[action.payload.listing_id] = action.payload
        state.isSaving = false
        state.lastFetch = Date.now()
      })
      .addCase(updateListingReview.rejected, (state, action) => {
        restoreReviews(state, takeRollback(action.meta.requestId))
        state.error = action.payload ?? 'Failed to update review.'
        state.isSaving = false
      })

      // ---- delete (optimistic) ----
      .addCase(deleteListingReview.pending, (state, action) => {
        state.isDeleting = true
        state.error = null
        stashRollback(action.meta.requestId, snapshotReviews(state))

        const reviewId = action.meta.arg.reviewId
        const existing = state.reviewsById[reviewId]
        state.reviews = removeListingReviewById(state.reviews, reviewId)
        delete state.reviewsById[reviewId]
        if (existing) {
          state.userReviewByListingId[existing.listing_id] = null
          state.pagination.total = Math.max(0, state.pagination.total - 1)
        }
        if (state.currentReviewId === reviewId) state.currentReviewId = null
      })
      .addCase(deleteListingReview.fulfilled, (state, action) => {
        rollbackRegistry.delete(action.meta.requestId)
        state.isDeleting = false
        state.lastFetch = Date.now()
        state.userReviewByListingId[action.payload.listingId] = null
      })
      .addCase(deleteListingReview.rejected, (state, action) => {
        restoreReviews(state, takeRollback(action.meta.requestId))
        state.error = action.payload ?? 'Failed to delete review.'
        state.isDeleting = false
      })

      // ---- moderate (optimistic) ----
      .addCase(moderateListingReviews.pending, (state, action) => {
        state.isModerating = true
        state.error = null
        stashRollback(action.meta.requestId, snapshotReviews(state))

        const { review_ids, updates } = action.meta.arg.input
        for (const reviewId of review_ids) {
          const existing = state.reviewsById[reviewId]
          if (!existing) continue
          const optimistic = applyListingReviewUpdate(existing, {
            review_status: updates.review_status ?? existing.review_status,
            moderation_reason:
              updates.moderation_reason === undefined
                ? existing.moderation_reason
                : updates.moderation_reason,
            moderated_at: new Date().toISOString(),
          })
          state.reviews = state.reviews.map((review) => (review.id === reviewId ? optimistic : review))
          state.reviewsById[reviewId] = optimistic
        }
      })
      .addCase(moderateListingReviews.fulfilled, (state, action) => {
        rollbackRegistry.delete(action.meta.requestId)
        for (const review of action.payload) {
          if (reviewMatchesCurrentFilters(review, state.filters)) {
            state.reviews = upsertListingReview(state.reviews, review)
          } else {
            state.reviews = removeListingReviewById(state.reviews, review.id)
          }
          state.reviewsById[review.id] = review
        }
        state.isModerating = false
        state.lastFetch = Date.now()
      })
      .addCase(moderateListingReviews.rejected, (state, action) => {
        restoreReviews(state, takeRollback(action.meta.requestId))
        state.error = action.payload ?? 'Failed to moderate reviews.'
        state.isModerating = false
      })

      // ---- load by id ----
      .addCase(loadListingReviewById.fulfilled, (state, action) => {
        state.reviewsById[action.payload.id] = action.payload
        state.currentReviewId = action.payload.id
      })

      // ---- summaries ----
      .addCase(loadListingReviewSummaries.fulfilled, (state, action) => {
        const now = Date.now()
        for (const summary of action.payload) {
          state.summariesByListingId[summary.listing_id] = summary
          state.summaryFetchTimes[summary.listing_id] = now
        }
      })

      // ---- replies ----
      .addCase(createListingReviewReply.pending, (state, action) => {
        state.isReplying = true
        state.error = null
        stashRollback(action.meta.requestId, snapshotReviews(state))
      })
      .addCase(createListingReviewReply.fulfilled, (state, action) => {
        rollbackRegistry.delete(action.meta.requestId)
        state.reviews = upsertListingReview(state.reviews, action.payload)
        state.reviewsById[action.payload.id] = action.payload
        state.isReplying = false
      })
      .addCase(createListingReviewReply.rejected, (state, action) => {
        restoreReviews(state, takeRollback(action.meta.requestId))
        state.error = action.payload ?? 'Failed to post reply.'
        state.isReplying = false
      })

      .addCase(updateListingReviewReply.pending, (state) => {
        state.isReplying = true
        state.error = null
      })
      .addCase(updateListingReviewReply.fulfilled, (state, action) => {
        state.reviews = upsertListingReview(state.reviews, action.payload)
        state.reviewsById[action.payload.id] = action.payload
        state.isReplying = false
      })
      .addCase(updateListingReviewReply.rejected, (state, action) => {
        state.error = action.payload ?? 'Failed to update reply.'
        state.isReplying = false
      })

      .addCase(deleteListingReviewReply.pending, (state, action) => {
        state.isReplying = true
        state.error = null
        stashRollback(action.meta.requestId, snapshotReviews(state))
      })
      .addCase(deleteListingReviewReply.fulfilled, (state, action) => {
        rollbackRegistry.delete(action.meta.requestId)
        state.reviews = upsertListingReview(state.reviews, action.payload)
        state.reviewsById[action.payload.id] = action.payload
        state.isReplying = false
      })
      .addCase(deleteListingReviewReply.rejected, (state, action) => {
        restoreReviews(state, takeRollback(action.meta.requestId))
        state.error = action.payload ?? 'Failed to delete reply.'
        state.isReplying = false
      })

      // ---- helpfulness vote (optimistic) ----
      .addCase(voteListingReviewHelpfulness.pending, (state, action) => {
        state.isVoting = true
        state.error = null
        stashRollback(action.meta.requestId, snapshotReviews(state))

        const { review_id, is_helpful } = action.meta.arg.input
        const existing = state.reviewsById[review_id]
        if (!existing) return

        const optimistic = applyListingReviewUpdate(existing, {
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
      .addCase(voteListingReviewHelpfulness.fulfilled, (state, action) => {
        rollbackRegistry.delete(action.meta.requestId)
        state.reviews = upsertListingReview(state.reviews, action.payload)
        state.reviewsById[action.payload.id] = action.payload
        state.isVoting = false
      })
      .addCase(voteListingReviewHelpfulness.rejected, (state, action) => {
        restoreReviews(state, takeRollback(action.meta.requestId))
        state.error = action.payload ?? 'Failed to record vote.'
        state.isVoting = false
      })

      .addCase(removeListingReviewHelpfulnessVote.pending, (state, action) => {
        state.isVoting = true
        state.error = null
        stashRollback(action.meta.requestId, snapshotReviews(state))
      })
      .addCase(removeListingReviewHelpfulnessVote.fulfilled, (state, action) => {
        rollbackRegistry.delete(action.meta.requestId)
        state.reviews = upsertListingReview(state.reviews, action.payload)
        state.reviewsById[action.payload.id] = action.payload
        state.isVoting = false
      })
      .addCase(removeListingReviewHelpfulnessVote.rejected, (state, action) => {
        restoreReviews(state, takeRollback(action.meta.requestId))
        state.error = action.payload ?? 'Failed to remove vote.'
        state.isVoting = false
      })

      // ---- report ----
      .addCase(reportListingReview.pending, (state) => {
        state.isReporting = true
        state.error = null
      })
      .addCase(reportListingReview.fulfilled, (state) => {
        state.isReporting = false
      })
      .addCase(reportListingReview.rejected, (state, action) => {
        state.error = action.payload ?? 'Failed to report review.'
        state.isReporting = false
      })

      // ---- analytics / dashboard ----
      .addCase(loadListingReviewAnalytics.fulfilled, (state, action) => {
        state.analytics = action.payload
      })
      .addCase(loadListingReviewAnalytics.rejected, (state, action) => {
        state.error = action.payload ?? 'Failed to load review analytics.'
      })

      .addCase(loadVendorListingReviewDashboard.pending, (state) => {
        state.isLoading = true
        state.error = null
      })
      .addCase(loadVendorListingReviewDashboard.fulfilled, (state, action) => {
        state.vendorDashboard = action.payload
        state.isLoading = false
      })
      .addCase(loadVendorListingReviewDashboard.rejected, (state, action) => {
        state.isLoading = false
        state.error = action.payload ?? 'Failed to load vendor review dashboard.'
      })

      // ---- eligibility / user review ----
      .addCase(loadUserListingReview.fulfilled, (state, action) => {
        state.userReviewByListingId[action.payload.listingId] = action.payload.review
      })
  },
})

export const {
  setListingReviewFilters,
  resetListingReviewFilters,
  setListingReviewFetchScope,
  setCurrentListingReviewId,
  setListingReviewError,
  clearListingReviewError,
  resetListingReviewsState,
} = listingReviewsSlice.actions

export const listingReviewsReducer = listingReviewsSlice.reducer

// ============= SELECTORS =============

export const selectListingReviews = (state: RootState) => state.listingReviews.reviews ?? []
export const selectListingReviewsById = (state: RootState) => state.listingReviews.reviewsById
export const selectListingReviewFilters = (state: RootState) => state.listingReviews.filters
export const selectListingReviewPagination = (state: RootState) => state.listingReviews.pagination
export const selectListingReviewSummaries = (state: RootState) => state.listingReviews.summariesByListingId
export const selectListingReviewAnalytics = (state: RootState) => state.listingReviews.analytics
export const selectVendorListingReviewDashboard = (state: RootState) => state.listingReviews.vendorDashboard
export const selectListingReviewError = (state: RootState) => state.listingReviews.error

export const selectListingReviewById =
  (reviewId: string | null | undefined) => (state: RootState) =>
    reviewId ? state.listingReviews.reviewsById[reviewId] ?? null : null

export const selectListingReviewSummaryByListingId =
  (listingId: string | null | undefined) => (state: RootState) =>
    listingId ? state.listingReviews.summariesByListingId[listingId] ?? null : null

export const selectUserListingReviewByListingId =
  (listingId: string | null | undefined) => (state: RootState) =>
    listingId ? state.listingReviews.userReviewByListingId[listingId] ?? null : null
