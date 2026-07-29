/**
 * Redux slice for discount management (vendor dashboards, admin oversight, buyer validation).
 *
 * Ported from legacy Zustand `discountStore.js` (data layer only — no UI).
 */

import { createAsyncThunk, createSlice, current, type PayloadAction } from '@reduxjs/toolkit'

import type { AppDispatch, RootState } from '~/lib/store'
import type { Json } from '~/lib/supabase'

import {
  APPLIES_TO,
  DEFAULT_DISCOUNT_PAGINATION,
  DISCOUNT_FETCH_SCOPE,
  DISCOUNT_TYPES,
} from '~/lib/discount/discount.constants'
import * as discountService from '~/lib/discount/discount.service'
import type {
  BogoRuleInput,
  DiscountAccessContext,
  DiscountAnalytics,
  DiscountAnalyticsFilters,
  DiscountApplicationInput,
  DiscountCartItem,
  DiscountCreateInput,
  DiscountFetchScope,
  DiscountFilterInput,
  DiscountPagination,
  DiscountPosterMetadata,
  DiscountPreviewResult,
  DiscountProfile,
  DiscountUpdateInput,
  DiscountValidationContext,
  OrderDiscountRow,
} from '~/lib/discount/discount.type'
import { buildDefaultDiscountFilters } from '~/lib/discount/discount.validation'
import {
  buildOptimisticDiscount,
  computeDiscountStats,
  filterActiveDiscounts,
  indexDiscountsById,
  normalizeDiscountRow,
  removeDiscountById,
  replaceTempDiscount,
  shouldUseDiscountCache,
  upsertDiscount,
} from '~/lib/discount/discount.utils'

type DiscountUsageHistoryResult = {
  items: OrderDiscountRow[]
  pagination: DiscountPagination
}

type LoadingFlags = {
  discounts: boolean
  discount: boolean
  creating: boolean
  updating: boolean
  deleting: boolean
  validatingCode: boolean
  applying: boolean
  linking: boolean
  analytics: boolean
  usageHistory: boolean
  bulkUpdating: boolean
  uploadingPoster: boolean
  deletingPoster: boolean
  updatingPosterMeta: boolean
  eventDiscounts: boolean
  bogoCreating: boolean
  bogoUpdating: boolean
}

type DiscountState = {
  shopId: string | null
  fetchScope: DiscountFetchScope
  discounts: DiscountProfile[]
  discountsById: Record<string, DiscountProfile>
  currentDiscountId: string | null
  listingDiscounts: DiscountProfile[]
  appliedDiscounts: OrderDiscountRow[]
  validationResult: DiscountProfile | null
  previewResult: DiscountPreviewResult | null
  eventDiscounts: DiscountProfile[]
  analytics: DiscountAnalytics | null
  usageHistory: DiscountUsageHistoryResult | null
  customerUsage: Array<{ discount_profile_id: string; usage_count: number }> | null
  filters: DiscountFilterInput
  pagination: DiscountPagination
  lastFetch: number | null
  loading: LoadingFlags
  error: string | null
}

const initialLoading: LoadingFlags = {
  discounts: false,
  discount: false,
  creating: false,
  updating: false,
  deleting: false,
  validatingCode: false,
  applying: false,
  linking: false,
  analytics: false,
  usageHistory: false,
  bulkUpdating: false,
  uploadingPoster: false,
  deletingPoster: false,
  updatingPosterMeta: false,
  eventDiscounts: false,
  bogoCreating: false,
  bogoUpdating: false,
}

const initialState: DiscountState = {
  shopId: null,
  fetchScope: DISCOUNT_FETCH_SCOPE.VENDOR,
  discounts: [],
  discountsById: {},
  currentDiscountId: null,
  listingDiscounts: [],
  appliedDiscounts: [],
  validationResult: null,
  previewResult: null,
  eventDiscounts: [],
  analytics: null,
  usageHistory: null,
  customerUsage: null,
  filters: buildDefaultDiscountFilters(),
  pagination: { ...DEFAULT_DISCOUNT_PAGINATION },
  lastFetch: null,
  loading: { ...initialLoading },
  error: null,
}

type ThunkConfig = { state: RootState; dispatch: AppDispatch; rejectValue: string }

type DiscountSnapshot = {
  discounts: DiscountProfile[]
  discountsById: Record<string, DiscountProfile>
  currentDiscountId: string | null
  pagination: DiscountPagination
  lastFetch: number | null
}

const rollbackRegistry = new Map<string, DiscountSnapshot>()

function stashRollback(requestId: string, snapshot: DiscountSnapshot): void {
  rollbackRegistry.set(requestId, snapshot)
}

function takeRollback(requestId: string): DiscountSnapshot | undefined {
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

function snapshotDiscounts(state: DiscountState): DiscountSnapshot {
  return {
    discounts: current(state.discounts),
    discountsById: current(state.discountsById),
    currentDiscountId: state.currentDiscountId,
    pagination: { ...state.pagination },
    lastFetch: state.lastFetch,
  }
}

function restoreDiscounts(state: DiscountState, snapshot?: DiscountSnapshot): void {
  if (!snapshot) return
  state.discounts = snapshot.discounts
  state.discountsById = snapshot.discountsById
  state.currentDiscountId = snapshot.currentDiscountId
  state.pagination = snapshot.pagination
  state.lastFetch = snapshot.lastFetch
}

function mergeFilters(state: DiscountState, custom?: Partial<DiscountFilterInput>): DiscountFilterInput {
  return {
    ...state.filters,
    ...custom,
    page: custom?.page ?? state.pagination.page,
    limit: custom?.limit ?? state.pagination.limit,
  }
}

function syncDiscountCollections(state: DiscountState, discounts: DiscountProfile[]): void {
  state.discounts = discounts
  state.discountsById = indexDiscountsById(discounts)
}

function setCurrentDiscount(state: DiscountState, discount: DiscountProfile | null): void {
  state.currentDiscountId = discount?.id ?? null
  if (discount) state.discountsById[discount.id] = discount
}

export const loadShopDiscounts = createAsyncThunk<
  { discounts: DiscountProfile[]; pagination: DiscountPagination },
  {
    shopId: string
    filters?: Partial<DiscountFilterInput>
    accessContext?: DiscountAccessContext
    scope?: DiscountFetchScope
    forceRefresh?: boolean
  },
  ThunkConfig
>('discount/loadShopDiscounts', async (arg, { getState, rejectWithValue }) => {
  const state = getState().discount
  if (state.shopId === arg.shopId && shouldUseDiscountCache(state.lastFetch, arg.forceRefresh)) {
    return { discounts: state.discounts, pagination: state.pagination }
  }
  return resolveResponse(
    discountService.getShopDiscounts(arg.shopId, mergeFilters(state, arg.filters), {
      accessContext: arg.accessContext,
      scope: arg.scope ?? state.fetchScope,
    }),
    rejectWithValue,
  )
})

export const loadDiscountProfile = createAsyncThunk<DiscountProfile, { discountId: string }, ThunkConfig>(
  'discount/loadDiscountProfile',
  async (arg, { rejectWithValue }) =>
    resolveResponse(discountService.getDiscountProfile(arg.discountId), rejectWithValue),
)

export const loadListingDiscounts = createAsyncThunk<
  DiscountProfile[],
  { listingId: string; activeOnly?: boolean },
  ThunkConfig
>('discount/loadListingDiscounts', async (arg, { rejectWithValue }) =>
  resolveResponse(discountService.getListingDiscounts(arg.listingId, arg.activeOnly ?? true), rejectWithValue),
)

export const loadCartEligibleDiscounts = createAsyncThunk<
  DiscountProfile[],
  { shopId: string; listingIds?: string[]; context?: DiscountValidationContext },
  ThunkConfig
>('discount/loadCartEligibleDiscounts', async (arg, { rejectWithValue }) =>
  resolveResponse(
    discountService.getCartEligibleDiscounts(arg.shopId, arg.listingIds ?? [], arg.context ?? {}),
    rejectWithValue,
  ),
)

export const loadEventDiscountsForShop = createAsyncThunk<DiscountProfile[], { shopId: string }, ThunkConfig>(
  'discount/loadEventDiscounts',
  async (arg, { rejectWithValue }) =>
    resolveResponse(discountService.getEventDiscountsForShop(arg.shopId), rejectWithValue),
)

export const loadDiscountAnalytics = createAsyncThunk<
  DiscountAnalytics,
  {
    shopId: string
    filters?: DiscountAnalyticsFilters
    accessContext?: DiscountAccessContext
    scope?: DiscountFetchScope
  },
  ThunkConfig
>('discount/loadAnalytics', async (arg, { rejectWithValue }) =>
  resolveResponse(
    discountService.getDiscountAnalytics(arg.shopId, arg.filters ?? {}, {
      accessContext: arg.accessContext,
      scope: arg.scope,
    }),
    rejectWithValue,
  ),
)

export const loadDiscountUsageHistory = createAsyncThunk<
  DiscountUsageHistoryResult,
  { discountId: string; page?: number; limit?: number },
  ThunkConfig
>('discount/loadUsageHistory', async (arg, { rejectWithValue }) =>
  resolveResponse(
    discountService.getDiscountUsageHistory(arg.discountId, { page: arg.page, limit: arg.limit }),
    rejectWithValue,
  ),
)

export const loadCustomerDiscountUsage = createAsyncThunk<
  Array<{ discount_profile_id: string; usage_count: number }>,
  { userId: string; shopId?: string | null },
  ThunkConfig
>('discount/loadCustomerUsage', async (arg, { rejectWithValue }) =>
  resolveResponse(discountService.getCustomerDiscountUsage(arg.userId, arg.shopId), rejectWithValue),
)

export const validateDiscountCode = createAsyncThunk<
  DiscountProfile,
  { discountCode: string; context?: DiscountValidationContext },
  ThunkConfig
>('discount/validateCode', async (arg, { rejectWithValue }) =>
  resolveResponse(discountService.validateDiscountCode(arg.discountCode, arg.context ?? {}), rejectWithValue),
)

export const previewDiscountOnCart = createAsyncThunk<
  DiscountPreviewResult,
  { discountCode: string; cartItems: DiscountCartItem[] },
  ThunkConfig
>('discount/previewOnCart', async (arg, { rejectWithValue }) =>
  resolveResponse(discountService.previewDiscountOnCart(arg.discountCode, arg.cartItems), rejectWithValue),
)

export const createDiscountProfile = createAsyncThunk<
  DiscountProfile,
  { input: DiscountCreateInput; accessContext?: DiscountAccessContext; scope?: DiscountFetchScope },
  ThunkConfig
>('discount/createProfile', async (arg, { rejectWithValue }) =>
  resolveResponse(
    discountService.createDiscountProfile(arg.input, {
      accessContext: arg.accessContext,
      scope: arg.scope,
    }),
    rejectWithValue,
  ),
)

export const updateDiscountProfile = createAsyncThunk<
  DiscountProfile,
  {
    discountId: string
    updates: DiscountUpdateInput
    shopId?: string
    accessContext?: DiscountAccessContext
    scope?: DiscountFetchScope
  },
  ThunkConfig
>('discount/updateProfile', async (arg, { rejectWithValue }) =>
  resolveResponse(
    discountService.updateDiscountProfile(arg.discountId, arg.updates, {
      shopId: arg.shopId,
      accessContext: arg.accessContext,
      scope: arg.scope,
    }),
    rejectWithValue,
  ),
)

export const deleteDiscountProfile = createAsyncThunk<
  { id: string },
  { discountId: string; shopId?: string; accessContext?: DiscountAccessContext; scope?: DiscountFetchScope },
  ThunkConfig
>('discount/deleteProfile', async (arg, { rejectWithValue }) =>
  resolveResponse(
    discountService.deleteDiscountProfile(arg.discountId, {
      shopId: arg.shopId,
      accessContext: arg.accessContext,
      scope: arg.scope,
    }),
    rejectWithValue,
  ),
)

export const createBogoDiscount = createAsyncThunk<
  DiscountProfile,
  {
    discountData: DiscountCreateInput
    bogoRuleData: BogoRuleInput
    accessContext?: DiscountAccessContext
    scope?: DiscountFetchScope
  },
  ThunkConfig
>('discount/createBogo', async (arg, { rejectWithValue }) => {
  const profileResult = await discountService.createDiscountProfile(
    {
      ...arg.discountData,
      discount_type: DISCOUNT_TYPES.BOGO,
      discount_value: 0,
      applies_to: APPLIES_TO.ITEM,
    },
    { accessContext: arg.accessContext, scope: arg.scope },
  )
  if (!profileResult.success || !profileResult.data) {
    return rejectWithValue(profileResult.error ?? 'Failed to create BOGO discount.') as never
  }
  const bogoResult = await discountService.createBogoRule(profileResult.data.id, arg.bogoRuleData)
  if (!bogoResult.success || !bogoResult.data) {
    await discountService.deleteDiscountProfile(profileResult.data.id, {
      shopId: arg.discountData.shop_id,
      accessContext: arg.accessContext,
      scope: arg.scope,
    })
    return rejectWithValue(bogoResult.error ?? 'Failed to create BOGO rule.') as never
  }
  return { ...profileResult.data, bogo_rule: bogoResult.data }
})

export const updateBogoDiscount = createAsyncThunk<
  DiscountProfile,
  {
    discountId: string
    discountData: DiscountUpdateInput
    bogoRuleData: BogoRuleInput
    shopId?: string
    accessContext?: DiscountAccessContext
    scope?: DiscountFetchScope
  },
  ThunkConfig
>('discount/updateBogo', async (arg, { rejectWithValue }) => {
  const profileResult = await discountService.updateDiscountProfile(arg.discountId, arg.discountData, {
    shopId: arg.shopId,
    accessContext: arg.accessContext,
    scope: arg.scope,
  })
  if (!profileResult.success || !profileResult.data) {
    return rejectWithValue(profileResult.error ?? 'Failed to update discount.') as never
  }
  const bogoResult = await discountService.updateBogoRule(arg.discountId, arg.bogoRuleData)
  if (!bogoResult.success || !bogoResult.data) {
    return rejectWithValue(bogoResult.error ?? 'Failed to update BOGO rule.') as never
  }
  return { ...profileResult.data, bogo_rule: bogoResult.data }
})

export const linkDiscountToListings = createAsyncThunk<
  unknown[],
  {
    discountId: string
    listingIds: string[]
    shopId?: string
    accessContext?: DiscountAccessContext
    scope?: DiscountFetchScope
  },
  ThunkConfig
>('discount/linkListings', async (arg, { rejectWithValue }) =>
  resolveResponse(
    discountService.linkDiscountToListings(arg.discountId, arg.listingIds, {
      shopId: arg.shopId,
      accessContext: arg.accessContext,
      scope: arg.scope,
    }),
    rejectWithValue,
  ),
)

export const unlinkDiscountFromListings = createAsyncThunk<
  unknown[],
  {
    discountId: string
    listingIds: string[]
    shopId?: string
    accessContext?: DiscountAccessContext
    scope?: DiscountFetchScope
  },
  ThunkConfig
>('discount/unlinkListings', async (arg, { rejectWithValue }) =>
  resolveResponse(
    discountService.unlinkDiscountFromListings(arg.discountId, arg.listingIds, {
      shopId: arg.shopId,
      accessContext: arg.accessContext,
      scope: arg.scope,
    }),
    rejectWithValue,
  ),
)

export const applyDiscountToOrderItem = createAsyncThunk<
  OrderDiscountRow,
  { input: DiscountApplicationInput },
  ThunkConfig
>('discount/applyToOrderItem', async (arg, { rejectWithValue }) =>
  resolveResponse(discountService.applyDiscountToOrderItem(arg.input), rejectWithValue),
)

export const bulkUpdateDiscountStatus = createAsyncThunk<
  { updatedIds: string[] },
  {
    discountIds: string[]
    isActive: boolean
    shopId?: string
    accessContext?: DiscountAccessContext
    scope?: DiscountFetchScope
  },
  ThunkConfig
>('discount/bulkUpdateStatus', async (arg, { rejectWithValue }) =>
  resolveResponse(
    discountService.bulkUpdateDiscountStatus(arg.discountIds, arg.isActive, {
      shopId: arg.shopId,
      accessContext: arg.accessContext,
      scope: arg.scope,
    }),
    rejectWithValue,
  ),
)

export const bulkDeleteDiscounts = createAsyncThunk<
  { deletedIds: string[] },
  { discountIds: string[]; shopId?: string; accessContext?: DiscountAccessContext; scope?: DiscountFetchScope },
  ThunkConfig
>('discount/bulkDelete', async (arg, { rejectWithValue }) =>
  resolveResponse(
    discountService.bulkDeleteDiscounts(arg.discountIds, {
      shopId: arg.shopId,
      accessContext: arg.accessContext,
      scope: arg.scope,
    }),
    rejectWithValue,
  ),
)

export const uploadDiscountPoster = createAsyncThunk<
  DiscountPosterMetadata,
  {
    discountId: string
    file: File
    posterName: string
    shopId?: string
    accessContext?: DiscountAccessContext
    scope?: DiscountFetchScope
  },
  ThunkConfig
>('discount/uploadPoster', async (arg, { rejectWithValue }) =>
  resolveResponse(
    discountService.uploadDiscountPoster(arg.discountId, arg.file, arg.posterName, {
      shopId: arg.shopId,
      accessContext: arg.accessContext,
      scope: arg.scope,
    }),
    rejectWithValue,
  ),
)

export const deleteDiscountPoster = createAsyncThunk<
  { deletedPosterId: string },
  {
    discountId: string
    posterId: string
    shopId?: string
    accessContext?: DiscountAccessContext
    scope?: DiscountFetchScope
  },
  ThunkConfig
>('discount/deletePoster', async (arg, { rejectWithValue }) =>
  resolveResponse(
    discountService.deleteDiscountPoster(arg.discountId, arg.posterId, {
      shopId: arg.shopId,
      accessContext: arg.accessContext,
      scope: arg.scope,
    }),
    rejectWithValue,
  ),
)

export const updatePosterMetadata = createAsyncThunk<
  DiscountPosterMetadata,
  {
    discountId: string
    posterId: string
    newName: string
    shopId?: string
    accessContext?: DiscountAccessContext
    scope?: DiscountFetchScope
  },
  ThunkConfig
>('discount/updatePosterMetadata', async (arg, { rejectWithValue }) =>
  resolveResponse(
    discountService.updatePosterMetadata(arg.discountId, arg.posterId, arg.newName, {
      shopId: arg.shopId,
      accessContext: arg.accessContext,
      scope: arg.scope,
    }),
    rejectWithValue,
  ),
)

const discountSlice = createSlice({
  name: 'discount',
  initialState,
  reducers: {
    setDiscountShopId(state, action: PayloadAction<string | null>) {
      state.shopId = action.payload
    },
    setDiscountFetchScope(state, action: PayloadAction<DiscountFetchScope>) {
      state.fetchScope = action.payload
    },
    setDiscountFilters(state, action: PayloadAction<Partial<DiscountFilterInput>>) {
      state.filters = { ...state.filters, ...action.payload }
      state.pagination.page = 1
    },
    resetDiscountFilters(state) {
      state.filters = buildDefaultDiscountFilters()
      state.pagination = { ...DEFAULT_DISCOUNT_PAGINATION }
    },
    setDiscountPagination(state, action: PayloadAction<Partial<DiscountPagination>>) {
      state.pagination = { ...state.pagination, ...action.payload }
    },
    setDiscountError(state, action: PayloadAction<string | null>) {
      state.error = action.payload
    },
    clearDiscountError(state) {
      state.error = null
    },
    clearValidationResult(state) {
      state.validationResult = null
    },
    clearPreviewResult(state) {
      state.previewResult = null
    },
    clearAppliedDiscounts(state) {
      state.appliedDiscounts = []
    },
    clearDiscountAnalytics(state) {
      state.analytics = null
      state.usageHistory = null
      state.customerUsage = null
    },
    resetDiscountState(state) {
      Object.assign(state, initialState)
      state.filters = buildDefaultDiscountFilters()
      state.loading = { ...initialLoading }
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(loadShopDiscounts.pending, (state, action) => {
        state.loading.discounts = true
        state.error = null
        state.shopId = action.meta.arg.shopId
        if (action.meta.arg.scope) state.fetchScope = action.meta.arg.scope
      })
      .addCase(loadShopDiscounts.fulfilled, (state, action) => {
        state.loading.discounts = false
        syncDiscountCollections(state, action.payload.discounts)
        state.pagination = action.payload.pagination
        state.lastFetch = Date.now()
      })
      .addCase(loadShopDiscounts.rejected, (state, action) => {
        state.loading.discounts = false
        state.error = action.payload ?? action.error.message ?? null
      })
      .addCase(loadDiscountProfile.pending, (state) => {
        state.loading.discount = true
        state.error = null
      })
      .addCase(loadDiscountProfile.fulfilled, (state, action) => {
        state.loading.discount = false
        const discount = normalizeDiscountRow(action.payload)
        setCurrentDiscount(state, discount)
        state.discounts = upsertDiscount(state.discounts, discount)
      })
      .addCase(loadDiscountProfile.rejected, (state, action) => {
        state.loading.discount = false
        state.error = action.payload ?? null
      })
      .addCase(loadListingDiscounts.pending, (state) => {
        state.loading.discounts = true
        state.error = null
      })
      .addCase(loadListingDiscounts.fulfilled, (state, action) => {
        state.loading.discounts = false
        state.listingDiscounts = action.payload
      })
      .addCase(loadListingDiscounts.rejected, (state, action) => {
        state.loading.discounts = false
        state.error = action.payload ?? null
      })
      .addCase(loadCartEligibleDiscounts.pending, (state) => {
        state.loading.discounts = true
        state.error = null
      })
      .addCase(loadCartEligibleDiscounts.fulfilled, (state) => {
        state.loading.discounts = false
      })
      .addCase(loadCartEligibleDiscounts.rejected, (state, action) => {
        state.loading.discounts = false
        state.error = action.payload ?? null
      })
      .addCase(loadEventDiscountsForShop.pending, (state) => {
        state.loading.eventDiscounts = true
        state.error = null
      })
      .addCase(loadEventDiscountsForShop.fulfilled, (state, action) => {
        state.loading.eventDiscounts = false
        state.eventDiscounts = action.payload
      })
      .addCase(loadEventDiscountsForShop.rejected, (state, action) => {
        state.loading.eventDiscounts = false
        state.error = action.payload ?? null
      })
      .addCase(loadDiscountAnalytics.pending, (state) => {
        state.loading.analytics = true
        state.error = null
      })
      .addCase(loadDiscountAnalytics.fulfilled, (state, action) => {
        state.loading.analytics = false
        state.analytics = action.payload
      })
      .addCase(loadDiscountAnalytics.rejected, (state, action) => {
        state.loading.analytics = false
        state.error = action.payload ?? null
      })
      .addCase(loadDiscountUsageHistory.pending, (state) => {
        state.loading.usageHistory = true
        state.error = null
      })
      .addCase(loadDiscountUsageHistory.fulfilled, (state, action) => {
        state.loading.usageHistory = false
        state.usageHistory = action.payload
      })
      .addCase(loadDiscountUsageHistory.rejected, (state, action) => {
        state.loading.usageHistory = false
        state.error = action.payload ?? null
      })
      .addCase(loadCustomerDiscountUsage.fulfilled, (state, action) => {
        state.customerUsage = action.payload
      })
      .addCase(validateDiscountCode.pending, (state) => {
        state.loading.validatingCode = true
        state.error = null
        state.validationResult = null
      })
      .addCase(validateDiscountCode.fulfilled, (state, action) => {
        state.loading.validatingCode = false
        state.validationResult = action.payload
      })
      .addCase(validateDiscountCode.rejected, (state, action) => {
        state.loading.validatingCode = false
        state.validationResult = null
        state.error = action.payload ?? null
      })
      .addCase(previewDiscountOnCart.pending, (state) => {
        state.loading.validatingCode = true
        state.error = null
        state.previewResult = null
      })
      .addCase(previewDiscountOnCart.fulfilled, (state, action) => {
        state.loading.validatingCode = false
        state.previewResult = action.payload
      })
      .addCase(previewDiscountOnCart.rejected, (state, action) => {
        state.loading.validatingCode = false
        state.previewResult = null
        state.error = action.payload ?? null
      })
      .addCase(createDiscountProfile.pending, (state, action) => {
        stashRollback(action.meta.requestId, snapshotDiscounts(state))
        state.loading.creating = true
        state.error = null
        const temp = buildOptimisticDiscount(optimisticId(action.meta.requestId), {
          ...action.meta.arg.input,
          discount_value: action.meta.arg.input.discount_value,
        })
        state.discounts = [temp, ...state.discounts]
        state.discountsById[temp.id] = temp
        setCurrentDiscount(state, temp)
      })
      .addCase(createDiscountProfile.fulfilled, (state, action) => {
        state.loading.creating = false
        const confirmed = normalizeDiscountRow(action.payload)
        state.discounts = replaceTempDiscount(state.discounts, optimisticId(action.meta.requestId), confirmed)
        state.discountsById = indexDiscountsById(state.discounts)
        setCurrentDiscount(state, confirmed)
        rollbackRegistry.delete(action.meta.requestId)
      })
      .addCase(createDiscountProfile.rejected, (state, action) => {
        state.loading.creating = false
        restoreDiscounts(state, takeRollback(action.meta.requestId))
        state.error = action.payload ?? null
      })
      .addCase(updateDiscountProfile.pending, (state, action) => {
        stashRollback(action.meta.requestId, snapshotDiscounts(state))
        state.loading.updating = true
        state.error = null
        const { discountId, updates } = action.meta.arg
        state.discounts = state.discounts.map((d) =>
          d.id === discountId ? { ...d, ...updates, updated_at: new Date().toISOString() } : d,
        )
      })
      .addCase(updateDiscountProfile.fulfilled, (state, action) => {
        state.loading.updating = false
        const confirmed = normalizeDiscountRow(action.payload)
        state.discounts = upsertDiscount(state.discounts, confirmed)
        state.discountsById = indexDiscountsById(state.discounts)
        if (state.currentDiscountId === confirmed.id) setCurrentDiscount(state, confirmed)
        rollbackRegistry.delete(action.meta.requestId)
      })
      .addCase(updateDiscountProfile.rejected, (state, action) => {
        state.loading.updating = false
        restoreDiscounts(state, takeRollback(action.meta.requestId))
        state.error = action.payload ?? null
      })
      .addCase(deleteDiscountProfile.pending, (state, action) => {
        stashRollback(action.meta.requestId, snapshotDiscounts(state))
        state.loading.deleting = true
        state.error = null
        state.discounts = removeDiscountById(state.discounts, action.meta.arg.discountId)
        state.discountsById = indexDiscountsById(state.discounts)
        if (state.currentDiscountId === action.meta.arg.discountId) state.currentDiscountId = null
      })
      .addCase(deleteDiscountProfile.fulfilled, (state, action) => {
        state.loading.deleting = false
        rollbackRegistry.delete(action.meta.requestId)
      })
      .addCase(deleteDiscountProfile.rejected, (state, action) => {
        state.loading.deleting = false
        restoreDiscounts(state, takeRollback(action.meta.requestId))
        state.error = action.payload ?? null
      })
      .addCase(createBogoDiscount.pending, (state, action) => {
        stashRollback(action.meta.requestId, snapshotDiscounts(state))
        state.loading.creating = true
        state.loading.bogoCreating = true
        state.error = null
        const temp = buildOptimisticDiscount(optimisticId(action.meta.requestId), {
          ...action.meta.arg.discountData,
          discount_type: DISCOUNT_TYPES.BOGO,
          discount_value: 0,
          applies_to: APPLIES_TO.ITEM,
        })
        state.discounts = [temp, ...state.discounts]
        setCurrentDiscount(state, temp)
      })
      .addCase(createBogoDiscount.fulfilled, (state, action) => {
        state.loading.creating = false
        state.loading.bogoCreating = false
        const confirmed = normalizeDiscountRow(action.payload)
        state.discounts = replaceTempDiscount(state.discounts, optimisticId(action.meta.requestId), confirmed)
        state.discountsById = indexDiscountsById(state.discounts)
        setCurrentDiscount(state, confirmed)
        rollbackRegistry.delete(action.meta.requestId)
      })
      .addCase(createBogoDiscount.rejected, (state, action) => {
        state.loading.creating = false
        state.loading.bogoCreating = false
        restoreDiscounts(state, takeRollback(action.meta.requestId))
        state.error = action.payload ?? null
      })
      .addCase(updateBogoDiscount.pending, (state, action) => {
        stashRollback(action.meta.requestId, snapshotDiscounts(state))
        state.loading.updating = true
        state.loading.bogoUpdating = true
        state.error = null
      })
      .addCase(updateBogoDiscount.fulfilled, (state, action) => {
        state.loading.updating = false
        state.loading.bogoUpdating = false
        const confirmed = normalizeDiscountRow(action.payload)
        state.discounts = upsertDiscount(state.discounts, confirmed)
        state.discountsById = indexDiscountsById(state.discounts)
        rollbackRegistry.delete(action.meta.requestId)
      })
      .addCase(updateBogoDiscount.rejected, (state, action) => {
        state.loading.updating = false
        state.loading.bogoUpdating = false
        restoreDiscounts(state, takeRollback(action.meta.requestId))
        state.error = action.payload ?? null
      })
      .addCase(bulkUpdateDiscountStatus.pending, (state, action) => {
        stashRollback(action.meta.requestId, snapshotDiscounts(state))
        state.loading.bulkUpdating = true
        state.error = null
        const ids = new Set(action.meta.arg.discountIds)
        state.discounts = state.discounts.map((d) =>
          ids.has(d.id) ? { ...d, is_active: action.meta.arg.isActive } : d,
        )
      })
      .addCase(bulkUpdateDiscountStatus.fulfilled, (state, action) => {
        state.loading.bulkUpdating = false
        state.discountsById = indexDiscountsById(state.discounts)
        rollbackRegistry.delete(action.meta.requestId)
      })
      .addCase(bulkUpdateDiscountStatus.rejected, (state, action) => {
        state.loading.bulkUpdating = false
        restoreDiscounts(state, takeRollback(action.meta.requestId))
        state.error = action.payload ?? null
      })
      .addCase(bulkDeleteDiscounts.pending, (state, action) => {
        stashRollback(action.meta.requestId, snapshotDiscounts(state))
        state.loading.bulkUpdating = true
        state.error = null
        const ids = new Set(action.meta.arg.discountIds)
        state.discounts = state.discounts.filter((d) => !ids.has(d.id))
        if (state.currentDiscountId && ids.has(state.currentDiscountId)) state.currentDiscountId = null
      })
      .addCase(bulkDeleteDiscounts.fulfilled, (state, action) => {
        state.loading.bulkUpdating = false
        state.discountsById = indexDiscountsById(state.discounts)
        rollbackRegistry.delete(action.meta.requestId)
      })
      .addCase(bulkDeleteDiscounts.rejected, (state, action) => {
        state.loading.bulkUpdating = false
        restoreDiscounts(state, takeRollback(action.meta.requestId))
        state.error = action.payload ?? null
      })
      .addCase(applyDiscountToOrderItem.pending, (state, action) => {
        state.loading.applying = true
        state.error = null
        const optimisticRow: OrderDiscountRow = {
            id: optimisticId(action.meta.requestId),
            order_item_id: action.meta.arg.input.order_item_id,
            discount_profile_id: action.meta.arg.input.discount_profile_id,
            listing_discount_id: action.meta.arg.input.listing_discount_id ?? null,
            discount_name: action.meta.arg.input.discount_name,
            discount_type: action.meta.arg.input.discount_type,
            discount_amount: action.meta.arg.input.discount_amount,
            applied_by_code: action.meta.arg.input.applied_by_code ?? false,
            discount_metadata: (action.meta.arg.input.metadata ?? {}) as Json,
            discount_scope: null,
            applied_at: new Date().toISOString(),
          }
        state.appliedDiscounts = [...state.appliedDiscounts, optimisticRow]
      })
      .addCase(applyDiscountToOrderItem.fulfilled, (state, action) => {
        state.loading.applying = false
        const tempId = optimisticId(action.meta.requestId)
        state.appliedDiscounts = state.appliedDiscounts.map((row) =>
          row.id === tempId ? action.payload : row,
        )
      })
      .addCase(applyDiscountToOrderItem.rejected, (state, action) => {
        state.loading.applying = false
        state.appliedDiscounts = state.appliedDiscounts.filter(
          (row) => row.id !== optimisticId(action.meta.requestId),
        )
        state.error = action.payload ?? null
      })
      .addCase(uploadDiscountPoster.pending, (state) => {
        state.loading.uploadingPoster = true
        state.error = null
      })
      .addCase(uploadDiscountPoster.fulfilled, (state, action) => {
        state.loading.uploadingPoster = false
        const discountId = action.meta.arg.discountId
        state.discounts = state.discounts.map((d) => {
          if (d.id !== discountId) return d
          const posters = Array.isArray(d.discount_poster) ? [...d.discount_poster] : []
          return { ...d, discount_poster: [...posters, action.payload] }
        })
      })
      .addCase(uploadDiscountPoster.rejected, (state, action) => {
        state.loading.uploadingPoster = false
        state.error = action.payload ?? null
      })
      .addCase(linkDiscountToListings.pending, (state) => {
        state.loading.linking = true
        state.error = null
      })
      .addCase(linkDiscountToListings.fulfilled, (state) => {
        state.loading.linking = false
      })
      .addCase(linkDiscountToListings.rejected, (state, action) => {
        state.loading.linking = false
        state.error = action.payload ?? null
      })
      .addCase(unlinkDiscountFromListings.pending, (state) => {
        state.loading.linking = true
        state.error = null
      })
      .addCase(unlinkDiscountFromListings.fulfilled, (state) => {
        state.loading.linking = false
      })
      .addCase(unlinkDiscountFromListings.rejected, (state, action) => {
        state.loading.linking = false
        state.error = action.payload ?? null
      })
  },
})

export const {
  setDiscountShopId,
  setDiscountFetchScope,
  setDiscountFilters,
  resetDiscountFilters,
  setDiscountPagination,
  setDiscountError,
  clearDiscountError,
  clearValidationResult,
  clearPreviewResult,
  clearAppliedDiscounts,
  clearDiscountAnalytics,
  resetDiscountState,
} = discountSlice.actions

export const discountReducer = discountSlice.reducer

export const selectCurrentDiscount = (state: RootState): DiscountProfile | null => {
  const id = state.discount.currentDiscountId
  return id ? state.discount.discountsById[id] ?? null : null
}

export const selectDiscountStats = (state: RootState) => computeDiscountStats(state.discount.discounts)

export const selectActiveDiscounts = (state: RootState) => filterActiveDiscounts(state.discount.discounts)
