/**
 * Redux Toolkit slice for shop state.
 *
 * Replaces the legacy Zustand `shopStore`. Async work lives in
 * `createAsyncThunk`s that wrap `shop.service`; every mutation applies
 * **optimistically** and rolls back on failure (see the rollback registry
 * below), mirroring the profile store exactly.
 *
 * The same slice serves normal users (browse / follow), vendors (create /
 * manage / dashboard) and admins (verify / activate / list-all).
 */

import { createAsyncThunk, createSlice, current, type PayloadAction } from '@reduxjs/toolkit'

import type { ShopDashboardData } from '~/commerce/lib/seller-dashboard'
import type { AppDispatch } from '~/lib/store'

import * as shopService from './shop.service'
import type { PaginatedShops } from './shop.service'
import {
  DEFAULT_SHOP_CURRENCY,
  EMPTY_SHOP_FORM_DATA,
  type PlatformShopStats,
  type Shop,
  type ShopFollowStatus,
  type ShopFormData,
  type ShopImageUpload,
  type ShopListingsSummary,
  type ShopStats,
  type ShopSummary,
  type ShopUpdate,
  type ShopValidationResult,
} from './shop.type'
import { validateShopData } from './shop.validation'

// ============= STATE =============

type ShopState = {
  myShops: Shop[]
  currentShop: Shop | null
  viewedShop: Shop | null
  publicShops: ShopSummary[]
  followedShops: Shop[]
  adminShops: Shop[]

  shopStats: ShopStats | null
  shopSummary: ShopListingsSummary | null
  dashboard: ShopDashboardData | null
  platformStats: PlatformShopStats | null
  isFollowingViewedShop: boolean

  formData: ShopFormData
  validation: ShopValidationResult

  totalPublicShops: number
  hasMorePublicShops: boolean
  totalAdminShops: number
  hasMoreAdminShops: boolean

  isLoading: boolean
  isLoadingShops: boolean
  isCreating: boolean
  isUpdating: boolean
  isDeleting: boolean
  isLoadingStats: boolean
  error: string | null
}

const initialState: ShopState = {
  myShops: [],
  currentShop: null,
  viewedShop: null,
  publicShops: [],
  followedShops: [],
  adminShops: [],
  shopStats: null,
  shopSummary: null,
  dashboard: null,
  platformStats: null,
  isFollowingViewedShop: false,
  formData: { ...EMPTY_SHOP_FORM_DATA },
  validation: { isValid: true, errors: {} },
  totalPublicShops: 0,
  hasMorePublicShops: false,
  totalAdminShops: 0,
  hasMoreAdminShops: false,
  isLoading: false,
  isLoadingShops: false,
  isCreating: false,
  isUpdating: false,
  isDeleting: false,
  isLoadingStats: false,
  error: null,
}

type ThunkConfig = { rejectValue: string; dispatch: AppDispatch }

/** Resolve a ShopServiceResponse into thunk data or a rejection. */
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

// ============= THUNKS =============

export const loadMyShops = createAsyncThunk<Shop[], string | undefined, ThunkConfig>(
  'shop/loadMyShops',
  async (userId, { rejectWithValue }) => {
    const response = await shopService.getMyShops(userId)
    if (!response.success) return rejectWithValue(response.error ?? 'Failed to load your shops.')
    return response.data ?? []
  },
)

export const loadMyShop = createAsyncThunk<Shop | null, string | undefined, ThunkConfig>(
  'shop/loadMyShop',
  (userId, { rejectWithValue }) =>
    resolveResponse(shopService.getMyShop(userId), rejectWithValue) as Promise<Shop | null>,
)

export const loadShopById = createAsyncThunk<Shop | null, string, ThunkConfig>(
  'shop/loadShopById',
  (shopId, { rejectWithValue }) =>
    resolveResponse(shopService.getShopById(shopId), rejectWithValue) as Promise<Shop | null>,
)

export const loadShopBySlug = createAsyncThunk<Shop | null, string, ThunkConfig>(
  'shop/loadShopBySlug',
  (slug, { rejectWithValue }) =>
    resolveResponse(shopService.getShopBySlug(slug), rejectWithValue) as Promise<Shop | null>,
)

export const loadPublicShops = createAsyncThunk<
  { result: PaginatedShops<ShopSummary>; append: boolean },
  {
    filters?: { category?: string; search?: string; shopIds?: string[] }
    pagination?: { limit?: number; offset?: number; sortBy?: 'newest' | 'oldest' | 'name' | 'rating' }
  },
  ThunkConfig
>('shop/loadPublicShops', async ({ filters = {}, pagination = {} }, { rejectWithValue }) => {
  const response = await shopService.getPublicShops(filters, pagination)
  if (!response.success || !response.data) {
    return rejectWithValue(response.error ?? 'Failed to load shops.')
  }
  return { result: response.data, append: (pagination.offset ?? 0) > 0 }
})

export const createShop = createAsyncThunk<
  Shop | null,
  { formData: Partial<ShopFormData>; userId?: string },
  ThunkConfig
>('shop/createShop', ({ formData, userId }, { rejectWithValue }) =>
  resolveResponse(shopService.createShop(formData, userId), rejectWithValue) as Promise<Shop | null>,
)

export const updateShop = createAsyncThunk<
  Shop,
  { shopId: string; updates: ShopUpdate },
  ThunkConfig
>('shop/updateShop', ({ shopId, updates }, { rejectWithValue }) =>
  resolveResponse(shopService.updateShop(shopId, updates), rejectWithValue) as Promise<Shop>,
)

export const deleteShop = createAsyncThunk<string, string, ThunkConfig>(
  'shop/deleteShop',
  async (shopId, { rejectWithValue }) => {
    const response = await shopService.deleteShop(shopId)
    if (!response.success) return rejectWithValue(response.error ?? 'Failed to delete shop.')
    return shopId
  },
)

export const uploadShopLogo = createAsyncThunk<
  { shopId: string; logo_url: string },
  { userId: string; shopId: string; file: ShopImageUpload },
  ThunkConfig
>('shop/uploadShopLogo', async ({ userId, shopId, file }, { rejectWithValue }) => {
  const response = await shopService.uploadShopLogo(userId, shopId, file)
  if (!response.success || !response.data) {
    return rejectWithValue(response.error ?? 'Logo upload failed.')
  }
  return { shopId, logo_url: response.data.logo_url }
})

export const loadShopStats = createAsyncThunk<ShopStats, string, ThunkConfig>(
  'shop/loadShopStats',
  (shopId, { rejectWithValue }) =>
    resolveResponse(shopService.getShopStats(shopId), rejectWithValue) as Promise<ShopStats>,
)

export const loadShopSummary = createAsyncThunk<ShopListingsSummary | null, string, ThunkConfig>(
  'shop/loadShopSummary',
  (shopId, { rejectWithValue }) =>
    resolveResponse(
      shopService.getShopWithListingsSummary(shopId),
      rejectWithValue,
    ) as Promise<ShopListingsSummary | null>,
)

export const loadShopDashboard = createAsyncThunk<ShopDashboardData, string, ThunkConfig>(
  'shop/loadShopDashboard',
  (shopId, { rejectWithValue }) =>
    resolveResponse(shopService.getShopDashboard(shopId), rejectWithValue) as Promise<ShopDashboardData>,
)

export const loadFollowedShops = createAsyncThunk<Shop[], string, ThunkConfig>(
  'shop/loadFollowedShops',
  async (userId, { rejectWithValue }) => {
    const response = await shopService.getFollowedShops(userId)
    if (!response.success) return rejectWithValue(response.error ?? 'Failed to load followed shops.')
    return response.data ?? []
  },
)

export const checkFollowingShop = createAsyncThunk<
  boolean,
  { shopId: string; userId: string },
  ThunkConfig
>('shop/checkFollowingShop', async ({ shopId, userId }, { rejectWithValue }) => {
  const response = await shopService.checkIsFollowingShop(shopId, userId)
  if (!response.success) return rejectWithValue(response.error ?? 'Failed to check follow state.')
  return response.data ?? false
})

export const followShop = createAsyncThunk<
  { shopId: string },
  { shopId: string; userId: string },
  ThunkConfig
>('shop/followShop', async ({ shopId, userId }, { rejectWithValue }) => {
  const response = await shopService.followShop(shopId, userId)
  if (!response.success) return rejectWithValue(response.error ?? 'Failed to follow shop.')
  return { shopId }
})

export const unfollowShop = createAsyncThunk<
  { shopId: string },
  { shopId: string; userId: string },
  ThunkConfig
>('shop/unfollowShop', async ({ shopId, userId }, { rejectWithValue }) => {
  const response = await shopService.unfollowShop(shopId, userId)
  if (!response.success) return rejectWithValue(response.error ?? 'Failed to unfollow shop.')
  return { shopId }
})

// ---- Admin ----

export const loadAdminShops = createAsyncThunk<
  { result: PaginatedShops<Shop>; append: boolean },
  {
    filters?: { verified?: boolean; isActive?: boolean; search?: string; category?: string }
    pagination?: { limit?: number; offset?: number }
  },
  ThunkConfig
>('shop/loadAdminShops', async ({ filters = {}, pagination = {} }, { rejectWithValue }) => {
  const response = await shopService.listAllShops(filters, pagination)
  if (!response.success || !response.data) {
    return rejectWithValue(response.error ?? 'Failed to load shops.')
  }
  return { result: response.data, append: (pagination.offset ?? 0) > 0 }
})

export const verifyShop = createAsyncThunk<
  Shop,
  { shopId: string; verified: boolean },
  ThunkConfig
>('shop/verifyShop', ({ shopId, verified }, { rejectWithValue }) =>
  resolveResponse(shopService.setShopVerified(shopId, verified), rejectWithValue) as Promise<Shop>,
)

export const setShopActiveAdmin = createAsyncThunk<
  Shop,
  { shopId: string; isActive: boolean },
  ThunkConfig
>('shop/setShopActive', ({ shopId, isActive }, { rejectWithValue }) =>
  resolveResponse(shopService.setShopActive(shopId, isActive), rejectWithValue) as Promise<Shop>,
)

export const adminUpdateShop = createAsyncThunk<
  Shop,
  { shopId: string; updates: ShopUpdate },
  ThunkConfig
>('shop/adminUpdateShop', ({ shopId, updates }, { rejectWithValue }) =>
  resolveResponse(shopService.adminUpdateShop(shopId, updates), rejectWithValue) as Promise<Shop>,
)

export const loadPlatformStats = createAsyncThunk<PlatformShopStats, void, ThunkConfig>(
  'shop/loadPlatformStats',
  (_, { rejectWithValue }) =>
    resolveResponse(shopService.getPlatformShopStats(), rejectWithValue) as Promise<PlatformShopStats>,
)

// ============= OPTIMISTIC ROLLBACK REGISTRY =============
//
// Snapshots for reverts are keyed by the thunk's `requestId` and kept OUTSIDE
// Redux state so the state stays serializable (identical to the profile store).

const rollbackRegistry = new Map<string, unknown>()

function stashRollback(requestId: string, snapshot: unknown): void {
  rollbackRegistry.set(requestId, snapshot)
}

function takeRollback<T>(requestId: string): T | undefined {
  const snapshot = rollbackRegistry.get(requestId) as T | undefined
  rollbackRegistry.delete(requestId)
  return snapshot
}

function optimisticId(requestId: string): string {
  return `temp-${requestId}`
}

type ShopsSnapshot = {
  myShops: Shop[]
  adminShops: Shop[]
  currentShop: Shop | null
  viewedShop: Shop | null
}

function snapshotShops(state: ShopState): ShopsSnapshot {
  return {
    myShops: current(state.myShops),
    adminShops: current(state.adminShops),
    currentShop: state.currentShop ? current(state.currentShop) : null,
    viewedShop: state.viewedShop ? current(state.viewedShop) : null,
  }
}

function restoreShops(state: ShopState, snapshot: ShopsSnapshot | undefined): void {
  if (!snapshot) return
  state.myShops = snapshot.myShops
  state.adminShops = snapshot.adminShops
  state.currentShop = snapshot.currentShop
  state.viewedShop = snapshot.viewedShop
}

/** Merge a partial patch into every place a shop is held. */
function patchShopEverywhere(state: ShopState, shopId: string, patch: Partial<Shop>): void {
  state.myShops = state.myShops.map((shop) =>
    shop.id === shopId ? ({ ...shop, ...patch } as Shop) : shop,
  )
  state.adminShops = state.adminShops.map((shop) =>
    shop.id === shopId ? ({ ...shop, ...patch } as Shop) : shop,
  )
  if (state.currentShop?.id === shopId) {
    state.currentShop = { ...state.currentShop, ...patch } as Shop
  }
  if (state.viewedShop?.id === shopId) {
    state.viewedShop = { ...state.viewedShop, ...patch } as Shop
  }
}

/** Replace a shop (with the authoritative server row) everywhere it is held. */
function replaceShopEverywhere(state: ShopState, shop: Shop): void {
  state.myShops = state.myShops.map((item) => (item.id === shop.id ? shop : item))
  state.adminShops = state.adminShops.map((item) => (item.id === shop.id ? shop : item))
  if (state.currentShop?.id === shop.id) state.currentShop = shop
  if (state.viewedShop?.id === shop.id) state.viewedShop = shop
}

/** Build an optimistic placeholder shop from form data. */
function buildOptimisticShop(
  requestId: string,
  formData: Partial<ShopFormData>,
  userId?: string,
): Shop {
  const now = new Date().toISOString()
  return {
    id: optimisticId(requestId),
    user_id: userId ?? '',
    shop_name: formData.shop_name ?? '',
    shop_description: formData.shop_description ?? null,
    shop_currency: formData.shop_currency || DEFAULT_SHOP_CURRENCY,
    logo_url: formData.logo_url || null,
    website_url: formData.website_url || null,
    shop_phone_number: formData.shop_phone_number || null,
    shop_email: formData.shop_email || null,
    shop_categories: formData.shop_categories ?? [],
    shop_hours: formData.shop_hours ?? {},
    social_links: formData.social_links ?? {},
    is_active: true,
    verified: false,
    created_at: now,
    updated_at: now,
  } as Shop
}

// ============= SLICE =============

const shopSlice = createSlice({
  name: 'shop',
  initialState,
  reducers: {
    setShopFormData: (state, action: PayloadAction<Partial<ShopFormData>>) => {
      state.formData = { ...state.formData, ...action.payload }
    },
    updateShopField: (
      state,
      action: PayloadAction<{ field: keyof ShopFormData; value: ShopFormData[keyof ShopFormData] }>,
    ) => {
      state.formData = { ...state.formData, [action.payload.field]: action.payload.value }
    },
    loadFormFromShop: (state, action: PayloadAction<ShopFormData>) => {
      state.formData = { ...action.payload }
    },
    resetShopFormData: (state) => {
      state.formData = { ...EMPTY_SHOP_FORM_DATA }
      state.validation = { isValid: true, errors: {} }
    },
    validateForm: (state) => {
      state.validation = validateShopData(state.formData)
    },
    setCurrentShop: (state, action: PayloadAction<Shop | null>) => {
      state.currentShop = action.payload
    },
    setViewedShop: (state, action: PayloadAction<Shop | null>) => {
      state.viewedShop = action.payload
    },
    setShopError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload
    },
    clearShopError: (state) => {
      state.error = null
    },
    resetShop: () => initialState,
  },
  extraReducers: (builder) => {
    builder
      // ---- reads ----
      .addCase(loadMyShops.pending, (state) => {
        state.isLoadingShops = true
        state.error = null
      })
      .addCase(loadMyShops.fulfilled, (state, action) => {
        state.myShops = action.payload
        // Reconcile the selected shop against the freshly loaded set. A persisted
        // `currentShop` can belong to a previous session/account, so only keep it
        // if it's actually one of this user's shops; otherwise pick their active
        // (or first) shop.
        const stillOwned =
          state.currentShop != null &&
          action.payload.some((shop) => shop.id === state.currentShop!.id)
        if (!stillOwned) {
          state.currentShop = action.payload.find((shop) => shop.is_active) ?? action.payload[0] ?? null
        }
        state.isLoadingShops = false
      })
      .addCase(loadMyShops.rejected, (state, action) => {
        state.error = action.payload ?? 'Failed to load your shops.'
        state.isLoadingShops = false
      })

      .addCase(loadMyShop.pending, (state) => {
        state.isLoading = true
        state.error = null
      })
      .addCase(loadMyShop.fulfilled, (state, action) => {
        state.currentShop = action.payload
        state.isLoading = false
      })
      .addCase(loadMyShop.rejected, (state, action) => {
        state.error = action.payload ?? 'Failed to load shop.'
        state.isLoading = false
      })

      .addCase(loadShopById.pending, (state) => {
        state.isLoading = true
        state.error = null
      })
      .addCase(loadShopById.fulfilled, (state, action) => {
        state.viewedShop = action.payload
        state.isLoading = false
      })
      .addCase(loadShopById.rejected, (state, action) => {
        state.error = action.payload ?? 'Failed to load shop.'
        state.isLoading = false
      })

      .addCase(loadShopBySlug.pending, (state) => {
        state.isLoading = true
        state.error = null
      })
      .addCase(loadShopBySlug.fulfilled, (state, action) => {
        state.viewedShop = action.payload
        state.isLoading = false
      })
      .addCase(loadShopBySlug.rejected, (state, action) => {
        state.error = action.payload ?? 'Failed to load shop.'
        state.isLoading = false
      })

      .addCase(loadPublicShops.pending, (state, action) => {
        if (!((action.meta.arg.pagination?.offset ?? 0) > 0)) state.isLoadingShops = true
        state.error = null
      })
      .addCase(loadPublicShops.fulfilled, (state, action) => {
        const { result, append } = action.payload
        state.publicShops = append ? [...state.publicShops, ...result.items] : result.items
        state.totalPublicShops = result.count
        state.hasMorePublicShops = result.hasMore
        state.isLoadingShops = false
      })
      .addCase(loadPublicShops.rejected, (state, action) => {
        state.error = action.payload ?? 'Failed to load shops.'
        state.isLoadingShops = false
      })

      // ---- create (optimistic insert) ----
      .addCase(createShop.pending, (state, action) => {
        state.isCreating = true
        state.error = null
        const optimistic = buildOptimisticShop(
          action.meta.requestId,
          action.meta.arg.formData,
          action.meta.arg.userId,
        )
        state.myShops.unshift(optimistic)
        state.currentShop = optimistic
      })
      .addCase(createShop.fulfilled, (state, action) => {
        const tempId = optimisticId(action.meta.requestId)
        if (action.payload) {
          state.myShops = state.myShops.map((shop) => (shop.id === tempId ? action.payload! : shop))
          state.currentShop = action.payload
        } else {
          state.myShops = state.myShops.filter((shop) => shop.id !== tempId)
          if (state.currentShop?.id === tempId) state.currentShop = null
        }
        state.isCreating = false
      })
      .addCase(createShop.rejected, (state, action) => {
        const tempId = optimisticId(action.meta.requestId)
        state.myShops = state.myShops.filter((shop) => shop.id !== tempId)
        if (state.currentShop?.id === tempId) state.currentShop = null
        state.error = action.payload ?? 'Failed to create shop.'
        state.isCreating = false
      })

      // ---- update (optimistic merge) ----
      .addCase(updateShop.pending, (state, action) => {
        state.isUpdating = true
        state.error = null
        stashRollback(action.meta.requestId, snapshotShops(state))
        patchShopEverywhere(state, action.meta.arg.shopId, action.meta.arg.updates as Partial<Shop>)
      })
      .addCase(updateShop.fulfilled, (state, action) => {
        rollbackRegistry.delete(action.meta.requestId)
        replaceShopEverywhere(state, action.payload)
        state.isUpdating = false
      })
      .addCase(updateShop.rejected, (state, action) => {
        restoreShops(state, takeRollback<ShopsSnapshot>(action.meta.requestId))
        state.error = action.payload ?? 'Failed to update shop.'
        state.isUpdating = false
      })

      // ---- delete (optimistic remove) ----
      .addCase(deleteShop.pending, (state, action) => {
        state.isDeleting = true
        state.error = null
        stashRollback(action.meta.requestId, snapshotShops(state))
        const shopId = action.meta.arg
        state.myShops = state.myShops.filter((shop) => shop.id !== shopId)
        state.adminShops = state.adminShops.map((shop) =>
          shop.id === shopId ? ({ ...shop, is_active: false } as Shop) : shop,
        )
        if (state.currentShop?.id === shopId) state.currentShop = null
      })
      .addCase(deleteShop.fulfilled, (state, action) => {
        rollbackRegistry.delete(action.meta.requestId)
        state.isDeleting = false
      })
      .addCase(deleteShop.rejected, (state, action) => {
        restoreShops(state, takeRollback<ShopsSnapshot>(action.meta.requestId))
        state.error = action.payload ?? 'Failed to delete shop.'
        state.isDeleting = false
      })

      // ---- logo upload ----
      .addCase(uploadShopLogo.pending, (state) => {
        state.isUpdating = true
        state.error = null
      })
      .addCase(uploadShopLogo.fulfilled, (state, action) => {
        patchShopEverywhere(state, action.payload.shopId, { logo_url: action.payload.logo_url })
        state.isUpdating = false
      })
      .addCase(uploadShopLogo.rejected, (state, action) => {
        state.error = action.payload ?? 'Logo upload failed.'
        state.isUpdating = false
      })

      // ---- stats / summary / dashboard ----
      .addCase(loadShopStats.pending, (state) => {
        state.isLoadingStats = true
      })
      .addCase(loadShopStats.fulfilled, (state, action) => {
        state.shopStats = action.payload
        state.isLoadingStats = false
      })
      .addCase(loadShopStats.rejected, (state, action) => {
        state.error = action.payload ?? 'Failed to load shop stats.'
        state.isLoadingStats = false
      })
      .addCase(loadShopSummary.fulfilled, (state, action) => {
        state.shopSummary = action.payload
      })
      .addCase(loadShopDashboard.fulfilled, (state, action) => {
        state.dashboard = action.payload
      })
      .addCase(loadShopDashboard.rejected, (state, action) => {
        state.error = action.payload ?? 'Failed to load dashboard.'
      })

      // ---- follows (optimistic toggle) ----
      .addCase(loadFollowedShops.fulfilled, (state, action) => {
        state.followedShops = action.payload
      })
      .addCase(checkFollowingShop.fulfilled, (state, action) => {
        state.isFollowingViewedShop = action.payload
      })
      .addCase(followShop.pending, (state, action) => {
        state.error = null
        stashRollback(action.meta.requestId, state.isFollowingViewedShop)
        if (state.viewedShop?.id === action.meta.arg.shopId) state.isFollowingViewedShop = true
      })
      .addCase(followShop.rejected, (state, action) => {
        const previous = takeRollback<boolean>(action.meta.requestId)
        if (previous !== undefined) state.isFollowingViewedShop = previous
        state.error = action.payload ?? 'Failed to follow shop.'
      })
      .addCase(followShop.fulfilled, (state, action) => {
        rollbackRegistry.delete(action.meta.requestId)
      })
      .addCase(unfollowShop.pending, (state, action) => {
        state.error = null
        stashRollback(action.meta.requestId, state.isFollowingViewedShop)
        if (state.viewedShop?.id === action.meta.arg.shopId) state.isFollowingViewedShop = false
        state.followedShops = state.followedShops.filter(
          (shop) => shop.id !== action.meta.arg.shopId,
        )
      })
      .addCase(unfollowShop.rejected, (state, action) => {
        const previous = takeRollback<boolean>(action.meta.requestId)
        if (previous !== undefined) state.isFollowingViewedShop = previous
        state.error = action.payload ?? 'Failed to unfollow shop.'
      })
      .addCase(unfollowShop.fulfilled, (state, action) => {
        rollbackRegistry.delete(action.meta.requestId)
      })

      // ---- admin ----
      .addCase(loadAdminShops.pending, (state, action) => {
        if (!((action.meta.arg.pagination?.offset ?? 0) > 0)) state.isLoadingShops = true
        state.error = null
      })
      .addCase(loadAdminShops.fulfilled, (state, action) => {
        const { result, append } = action.payload
        state.adminShops = append ? [...state.adminShops, ...result.items] : result.items
        state.totalAdminShops = result.count
        state.hasMoreAdminShops = result.hasMore
        state.isLoadingShops = false
      })
      .addCase(loadAdminShops.rejected, (state, action) => {
        state.error = action.payload ?? 'Failed to load shops.'
        state.isLoadingShops = false
      })

      .addCase(verifyShop.pending, (state, action) => {
        state.error = null
        stashRollback(action.meta.requestId, snapshotShops(state))
        patchShopEverywhere(state, action.meta.arg.shopId, { verified: action.meta.arg.verified })
      })
      .addCase(verifyShop.fulfilled, (state, action) => {
        rollbackRegistry.delete(action.meta.requestId)
        replaceShopEverywhere(state, action.payload)
      })
      .addCase(verifyShop.rejected, (state, action) => {
        restoreShops(state, takeRollback<ShopsSnapshot>(action.meta.requestId))
        state.error = action.payload ?? 'Failed to update verification.'
      })

      .addCase(setShopActiveAdmin.pending, (state, action) => {
        state.error = null
        stashRollback(action.meta.requestId, snapshotShops(state))
        patchShopEverywhere(state, action.meta.arg.shopId, { is_active: action.meta.arg.isActive })
      })
      .addCase(setShopActiveAdmin.fulfilled, (state, action) => {
        rollbackRegistry.delete(action.meta.requestId)
        replaceShopEverywhere(state, action.payload)
      })
      .addCase(setShopActiveAdmin.rejected, (state, action) => {
        restoreShops(state, takeRollback<ShopsSnapshot>(action.meta.requestId))
        state.error = action.payload ?? 'Failed to update shop status.'
      })

      .addCase(adminUpdateShop.pending, (state, action) => {
        state.isUpdating = true
        state.error = null
        stashRollback(action.meta.requestId, snapshotShops(state))
        patchShopEverywhere(state, action.meta.arg.shopId, action.meta.arg.updates as Partial<Shop>)
      })
      .addCase(adminUpdateShop.fulfilled, (state, action) => {
        rollbackRegistry.delete(action.meta.requestId)
        replaceShopEverywhere(state, action.payload)
        state.isUpdating = false
      })
      .addCase(adminUpdateShop.rejected, (state, action) => {
        restoreShops(state, takeRollback<ShopsSnapshot>(action.meta.requestId))
        state.error = action.payload ?? 'Failed to update shop.'
        state.isUpdating = false
      })

      .addCase(loadPlatformStats.fulfilled, (state, action) => {
        state.platformStats = action.payload
      })
  },
})

export const {
  setShopFormData,
  updateShopField,
  loadFormFromShop,
  resetShopFormData,
  validateForm,
  setCurrentShop,
  setViewedShop,
  setShopError,
  clearShopError,
  resetShop,
} = shopSlice.actions

export const shopReducer = shopSlice.reducer

export type { ShopFollowStatus }
