/**
 * Redux Toolkit slice for listing state.
 *
 * Replaces the legacy Zustand `listingsStore`. Async work lives in
 * `createAsyncThunk`s that wrap `listing.service`; every mutation applies
 * **optimistically** and rolls back on failure (see the rollback registry
 * below), mirroring the shop/profile stores exactly.
 *
 * The same slice serves normal users (browse / search), vendors (create /
 * manage / dashboard) and admins (feature / list-all / platform stats).
 */

import { createAsyncThunk, createSlice, current, type PayloadAction } from '@reduxjs/toolkit'

import type { AppDispatch } from '~/lib/store'

import * as listingService from './listing.service'
import type {
  AdminListingRow,
  ListingDetails,
  PaginatedListings,
  PopularTag,
  PublicListing,
  RecommendedListing,
  ShopListingRow,
} from './listing.service'
import {
  EMPTY_LISTING_FORM_DATA,
  LISTING_STATUS,
  getDefaultListingFormData,
  type Listing,
  type ListingFilters,
  type ListingFormData,
  type ListingPagination,
  type ListingStatus,
  type ListingType,
  type ListingUpdate,
  type ListingValidationResult,
  type PlatformListingStats,
} from './listing.type'
import { validateListingData } from './listing.validation'

// ============= STATE =============

type ListingState = {
  myListings: Listing[]
  shopListings: ShopListingRow[]
  publicListings: PublicListing[]
  adminListings: AdminListingRow[]
  currentListing: ListingDetails | null

  featuredListings: PublicListing[]
  popularTags: PopularTag[]
  recommendations: RecommendedListing[]
  platformStats: PlatformListingStats | null

  formData: ListingFormData
  validation: ListingValidationResult

  totalPublicListings: number
  hasMorePublicListings: boolean
  publicOffset: number

  isLoading: boolean
  isLoadingListings: boolean
  isLoadingDetails: boolean
  isCreating: boolean
  isUpdating: boolean
  isDeleting: boolean
  error: string | null
}

const initialState: ListingState = {
  myListings: [],
  shopListings: [],
  publicListings: [],
  adminListings: [],
  currentListing: null,
  featuredListings: [],
  popularTags: [],
  recommendations: [],
  platformStats: null,
  formData: { ...EMPTY_LISTING_FORM_DATA },
  validation: { isValid: true, errors: {} },
  totalPublicListings: 0,
  hasMorePublicListings: false,
  publicOffset: 0,
  isLoading: false,
  isLoadingListings: false,
  isLoadingDetails: false,
  isCreating: false,
  isUpdating: false,
  isDeleting: false,
  error: null,
}

type ThunkConfig = { rejectValue: string; dispatch: AppDispatch }

// ============= THUNKS: READS =============

export const loadMyListings = createAsyncThunk<
  Listing[],
  { query?: listingService.ShopListingQuery; userId?: string } | undefined,
  ThunkConfig
>('listing/loadMyListings', async (arg, { rejectWithValue }) => {
  const response = await listingService.getMyListings(arg?.query ?? {}, arg?.userId)
  if (!response.success) return rejectWithValue(response.error ?? 'Failed to load your listings.')
  return response.data ?? []
})

export const loadShopListings = createAsyncThunk<
  ShopListingRow[],
  { shopId: string; query?: listingService.ShopListingQuery },
  ThunkConfig
>('listing/loadShopListings', async ({ shopId, query }, { rejectWithValue }) => {
  const response = await listingService.getShopListings(shopId, query ?? {})
  if (!response.success) return rejectWithValue(response.error ?? 'Failed to load shop listings.')
  return response.data ?? []
})

export const loadListingDetails = createAsyncThunk<
  ListingDetails | null,
  { listingId?: string; slug?: string },
  ThunkConfig
>('listing/loadListingDetails', async (identifier, { rejectWithValue }) => {
  const response = await listingService.getListingDetails(identifier)
  if (!response.success) return rejectWithValue(response.error ?? 'Failed to load listing.')
  return response.data ?? null
})

export const loadPublicListings = createAsyncThunk<
  { result: PaginatedListings<PublicListing>; append: boolean },
  { filters?: ListingFilters; pagination?: ListingPagination } | undefined,
  ThunkConfig
>('listing/loadPublicListings', async (arg, { rejectWithValue }) => {
  const { filters = {}, pagination = {} } = arg ?? {}
  const response = await listingService.getPublicListings(filters, pagination)
  if (!response.success || !response.data) {
    return rejectWithValue(response.error ?? 'Failed to load listings.')
  }
  return { result: response.data, append: (pagination.offset ?? 0) > 0 }
})

export const searchListings = createAsyncThunk<
  { result: PaginatedListings<PublicListing>; append: boolean },
  { query: string; filters?: Omit<ListingFilters, 'search'>; pagination?: ListingPagination },
  ThunkConfig
>('listing/searchListings', async ({ query, filters = {}, pagination = {} }, { rejectWithValue }) => {
  const response = await listingService.searchPublicListings(query, filters, pagination)
  if (!response.success || !response.data) {
    return rejectWithValue(response.error ?? 'Search failed.')
  }
  return { result: response.data, append: (pagination.offset ?? 0) > 0 }
})

export const loadFeaturedListings = createAsyncThunk<PublicListing[], number | undefined, ThunkConfig>(
  'listing/loadFeatured',
  async (limit, { rejectWithValue }) => {
    const response = await listingService.getFeaturedListings(limit)
    if (!response.success) return rejectWithValue(response.error ?? 'Failed to load featured listings.')
    return response.data ?? []
  },
)

export const loadPopularTags = createAsyncThunk<PopularTag[], number | undefined, ThunkConfig>(
  'listing/loadPopularTags',
  async (limit, { rejectWithValue }) => {
    const response = await listingService.getPopularTags(limit)
    if (!response.success) return rejectWithValue(response.error ?? 'Failed to load tags.')
    return response.data ?? []
  },
)

export const loadRecommendations = createAsyncThunk<
  RecommendedListing[],
  { listingId: string; limit?: number },
  ThunkConfig
>('listing/loadRecommendations', async ({ listingId, limit }, { rejectWithValue }) => {
  const response = await listingService.getRecommendations(listingId, limit)
  if (!response.success) return rejectWithValue(response.error ?? 'Failed to load recommendations.')
  return response.data ?? []
})

// ============= THUNKS: WRITES (optimistic) =============

export const createListing = createAsyncThunk<
  Listing | null,
  { formData: Partial<ListingFormData>; userId?: string },
  ThunkConfig
>('listing/createListing', async ({ formData, userId }, { rejectWithValue }) => {
  const response = await listingService.createListing(formData, userId)
  if (!response.success) return rejectWithValue(response.error ?? 'Failed to create listing.')
  return response.data
})

export const updateListing = createAsyncThunk<
  Listing,
  { listingId: string; updates: ListingUpdate; userId?: string },
  ThunkConfig
>('listing/updateListing', async ({ listingId, updates, userId }, { rejectWithValue }) => {
  const response = await listingService.updateListing(listingId, updates, userId)
  if (!response.success || !response.data) {
    return rejectWithValue(response.error ?? 'Failed to update listing.')
  }
  return response.data
})

export const updateListingWithDetails = createAsyncThunk<
  Listing | null,
  { listingId: string; formData: Partial<ListingFormData>; userId?: string },
  ThunkConfig
>('listing/updateListingWithDetails', async ({ listingId, formData, userId }, { rejectWithValue }) => {
  const response = await listingService.updateListingWithDetails(listingId, formData, userId)
  if (!response.success) return rejectWithValue(response.error ?? 'Failed to update listing.')
  return response.data
})

export const deleteListing = createAsyncThunk<
  string,
  { listingId: string; userId?: string },
  ThunkConfig
>('listing/deleteListing', async ({ listingId, userId }, { rejectWithValue }) => {
  const response = await listingService.deleteListing(listingId, userId)
  if (!response.success) return rejectWithValue(response.error ?? 'Failed to delete listing.')
  return listingId
})

export const setListingStatus = createAsyncThunk<
  Listing,
  { listingId: string; status: ListingStatus; userId?: string },
  ThunkConfig
>('listing/setStatus', async ({ listingId, status, userId }, { rejectWithValue }) => {
  const response = await listingService.setListingStatus(listingId, status, userId)
  if (!response.success || !response.data) {
    return rejectWithValue(response.error ?? 'Failed to update status.')
  }
  return response.data
})

export const setListingActive = createAsyncThunk<
  Listing,
  { listingId: string; isActive: boolean; userId?: string },
  ThunkConfig
>('listing/setActive', async ({ listingId, isActive, userId }, { rejectWithValue }) => {
  const response = await listingService.setListingActive(listingId, isActive, userId)
  if (!response.success || !response.data) {
    return rejectWithValue(response.error ?? 'Failed to update listing.')
  }
  return response.data
})

export const setListingFeatured = createAsyncThunk<
  Listing,
  { listingId: string; isFeatured: boolean; userId?: string },
  ThunkConfig
>('listing/setFeatured', async ({ listingId, isFeatured, userId }, { rejectWithValue }) => {
  const response = await listingService.setListingFeatured(listingId, isFeatured, userId)
  if (!response.success || !response.data) {
    return rejectWithValue(response.error ?? 'Failed to update listing.')
  }
  return response.data
})

export const adjustStock = createAsyncThunk<
  { listingId: string; quantityChange: number },
  { listingId: string; quantityChange: number; variationId?: string },
  ThunkConfig
>('listing/adjustStock', async ({ listingId, quantityChange, variationId }, { rejectWithValue }) => {
  const response = await listingService.updateStock(listingId, quantityChange, variationId)
  if (!response.success) return rejectWithValue(response.error ?? 'Failed to update stock.')
  return { listingId, quantityChange }
})

// ---- Admin ----

export const loadAdminListings = createAsyncThunk<
  { rows: AdminListingRow[]; append: boolean },
  { query?: listingService.AdminListingQuery },
  ThunkConfig
>('listing/loadAdminListings', async ({ query = {} }, { rejectWithValue }) => {
  const response = await listingService.adminSearchListings(query)
  if (!response.success) return rejectWithValue(response.error ?? 'Failed to load listings.')
  return { rows: response.data ?? [], append: (query.offset ?? 0) > 0 }
})

export const adminUpdateListing = createAsyncThunk<
  Listing,
  { listingId: string; updates: ListingUpdate; userId?: string },
  ThunkConfig
>('listing/adminUpdateListing', async ({ listingId, updates, userId }, { rejectWithValue }) => {
  const response = await listingService.adminUpdateListing(listingId, updates, userId)
  if (!response.success || !response.data) {
    return rejectWithValue(response.error ?? 'Failed to update listing.')
  }
  return response.data
})

export const loadPlatformListingStats = createAsyncThunk<
  PlatformListingStats,
  string | undefined,
  ThunkConfig
>('listing/loadPlatformStats', async (userId, { rejectWithValue }) => {
  const response = await listingService.getPlatformListingStats(userId)
  if (!response.success || !response.data) {
    return rejectWithValue(response.error ?? 'Failed to load platform stats.')
  }
  return response.data
})

// ============= OPTIMISTIC ROLLBACK REGISTRY =============
//
// Snapshots for reverts are keyed by the thunk's `requestId` and kept OUTSIDE
// Redux state so the state stays serializable (identical to the shop store).

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

type ListingsSnapshot = {
  myListings: Listing[]
  currentListing: ListingDetails | null
  adminListings: AdminListingRow[]
}

function snapshotListings(state: ListingState): ListingsSnapshot {
  return {
    myListings: current(state.myListings),
    currentListing: state.currentListing ? current(state.currentListing) : null,
    adminListings: current(state.adminListings),
  }
}

function restoreListings(state: ListingState, snapshot: ListingsSnapshot | undefined): void {
  if (!snapshot) return
  state.myListings = snapshot.myListings
  state.currentListing = snapshot.currentListing
  state.adminListings = snapshot.adminListings
}

/** Merge a partial patch into every place a listing is held. */
function patchListingEverywhere(state: ListingState, listingId: string, patch: Partial<Listing>): void {
  state.myListings = state.myListings.map((listing) =>
    listing.id === listingId ? ({ ...listing, ...patch } as Listing) : listing,
  )
  state.adminListings = state.adminListings.map((listing) =>
    listing.id === listingId ? ({ ...listing, ...patch } as AdminListingRow) : listing,
  )
  if (state.currentListing && state.currentListing.id === listingId) {
    state.currentListing = { ...state.currentListing, ...patch } as ListingDetails
  }
}

/** Replace a listing (with the authoritative server row) everywhere it is held. */
function replaceListingEverywhere(state: ListingState, listing: Listing): void {
  state.myListings = state.myListings.map((item) => (item.id === listing.id ? listing : item))
  patchListingEverywhere(state, listing.id, listing)
}

/** Build an optimistic placeholder listing from form data. */
function buildOptimisticListing(requestId: string, formData: Partial<ListingFormData>): Listing {
  const now = new Date().toISOString()
  const price = typeof formData.price === 'number' ? formData.price : Number(formData.price ?? 0)
  return {
    id: optimisticId(requestId),
    shop_id: formData.shop_id ?? '',
    title: formData.title ?? '',
    description: formData.description ?? null,
    listing_type: (formData.listing_type ?? 'physical') as ListingType,
    price: Number.isFinite(price) ? price : 0,
    quantity: typeof formData.quantity === 'number' ? formData.quantity : null,
    is_active: formData.is_active ?? false,
    is_featured: formData.is_featured ?? false,
    listing_status: formData.listing_status ?? LISTING_STATUS.DRAFT,
    slug: formData.slug || null,
    created_at: now,
    updated_at: now,
  } as unknown as Listing
}

// ============= SLICE =============

const listingSlice = createSlice({
  name: 'listing',
  initialState,
  reducers: {
    setListingFormData: (state, action: PayloadAction<Partial<ListingFormData>>) => {
      state.formData = { ...state.formData, ...action.payload }
    },
    updateListingField: (
      state,
      action: PayloadAction<{ field: keyof ListingFormData; value: ListingFormData[keyof ListingFormData] }>,
    ) => {
      state.formData = { ...state.formData, [action.payload.field]: action.payload.value }
    },
    initFormForType: (state, action: PayloadAction<ListingType>) => {
      state.formData = getDefaultListingFormData(action.payload)
      state.validation = { isValid: true, errors: {} }
    },
    loadFormFromListing: (state, action: PayloadAction<ListingFormData>) => {
      state.formData = { ...action.payload }
    },
    resetListingFormData: (state) => {
      state.formData = { ...EMPTY_LISTING_FORM_DATA }
      state.validation = { isValid: true, errors: {} }
    },
    validateForm: (state) => {
      state.validation = validateListingData(state.formData)
    },
    setCurrentListing: (state, action: PayloadAction<ListingDetails | null>) => {
      state.currentListing = action.payload
    },
    clearListingError: (state) => {
      state.error = null
    },
    resetListings: () => initialState,
  },
  extraReducers: (builder) => {
    builder
      // ---- reads ----
      .addCase(loadMyListings.pending, (state) => {
        state.isLoadingListings = true
        state.error = null
      })
      .addCase(loadMyListings.fulfilled, (state, action) => {
        state.myListings = action.payload
        state.isLoadingListings = false
      })
      .addCase(loadMyListings.rejected, (state, action) => {
        state.error = action.payload ?? 'Failed to load your listings.'
        state.isLoadingListings = false
      })

      .addCase(loadShopListings.pending, (state) => {
        state.isLoadingListings = true
        state.error = null
      })
      .addCase(loadShopListings.fulfilled, (state, action) => {
        state.shopListings = action.payload
        state.isLoadingListings = false
      })
      .addCase(loadShopListings.rejected, (state, action) => {
        state.error = action.payload ?? 'Failed to load shop listings.'
        state.isLoadingListings = false
      })

      .addCase(loadListingDetails.pending, (state) => {
        state.isLoadingDetails = true
        state.error = null
      })
      .addCase(loadListingDetails.fulfilled, (state, action) => {
        state.currentListing = action.payload
        state.isLoadingDetails = false
      })
      .addCase(loadListingDetails.rejected, (state, action) => {
        state.error = action.payload ?? 'Failed to load listing.'
        state.isLoadingDetails = false
      })

      .addCase(loadPublicListings.pending, (state, action) => {
        if ((action.meta.arg?.pagination?.offset ?? 0) === 0) state.isLoadingListings = true
        state.error = null
      })
      .addCase(loadPublicListings.fulfilled, (state, action) => {
        const { result, append } = action.payload
        state.publicListings = append ? [...state.publicListings, ...result.items] : result.items
        state.totalPublicListings = result.count
        state.hasMorePublicListings = result.hasMore
        state.publicOffset = state.publicListings.length
        state.isLoadingListings = false
      })
      .addCase(loadPublicListings.rejected, (state, action) => {
        state.error = action.payload ?? 'Failed to load listings.'
        state.isLoadingListings = false
      })

      .addCase(searchListings.pending, (state, action) => {
        if ((action.meta.arg.pagination?.offset ?? 0) === 0) state.isLoadingListings = true
        state.error = null
      })
      .addCase(searchListings.fulfilled, (state, action) => {
        const { result, append } = action.payload
        state.publicListings = append ? [...state.publicListings, ...result.items] : result.items
        state.totalPublicListings = result.count
        state.hasMorePublicListings = result.hasMore
        state.publicOffset = state.publicListings.length
        state.isLoadingListings = false
      })
      .addCase(searchListings.rejected, (state, action) => {
        state.error = action.payload ?? 'Search failed.'
        state.isLoadingListings = false
      })

      .addCase(loadFeaturedListings.fulfilled, (state, action) => {
        state.featuredListings = action.payload
      })
      .addCase(loadPopularTags.fulfilled, (state, action) => {
        state.popularTags = action.payload
      })
      .addCase(loadRecommendations.fulfilled, (state, action) => {
        state.recommendations = action.payload
      })

      // ---- create (optimistic insert) ----
      .addCase(createListing.pending, (state, action) => {
        state.isCreating = true
        state.error = null
        const optimistic = buildOptimisticListing(action.meta.requestId, action.meta.arg.formData)
        state.myListings.unshift(optimistic)
      })
      .addCase(createListing.fulfilled, (state, action) => {
        const tempId = optimisticId(action.meta.requestId)
        if (action.payload) {
          state.myListings = state.myListings.map((listing) =>
            listing.id === tempId ? action.payload! : listing,
          )
        } else {
          state.myListings = state.myListings.filter((listing) => listing.id !== tempId)
        }
        state.isCreating = false
      })
      .addCase(createListing.rejected, (state, action) => {
        const tempId = optimisticId(action.meta.requestId)
        state.myListings = state.myListings.filter((listing) => listing.id !== tempId)
        state.error = action.payload ?? 'Failed to create listing.'
        state.isCreating = false
      })

      // ---- update (optimistic merge) ----
      .addCase(updateListing.pending, (state, action) => {
        state.isUpdating = true
        state.error = null
        stashRollback(action.meta.requestId, snapshotListings(state))
        patchListingEverywhere(state, action.meta.arg.listingId, action.meta.arg.updates as Partial<Listing>)
      })
      .addCase(updateListing.fulfilled, (state, action) => {
        rollbackRegistry.delete(action.meta.requestId)
        replaceListingEverywhere(state, action.payload)
        state.isUpdating = false
      })
      .addCase(updateListing.rejected, (state, action) => {
        restoreListings(state, takeRollback<ListingsSnapshot>(action.meta.requestId))
        state.error = action.payload ?? 'Failed to update listing.'
        state.isUpdating = false
      })

      // ---- comprehensive update ----
      .addCase(updateListingWithDetails.pending, (state, action) => {
        state.isUpdating = true
        state.error = null
        stashRollback(action.meta.requestId, snapshotListings(state))
        patchListingEverywhere(
          state,
          action.meta.arg.listingId,
          action.meta.arg.formData as Partial<Listing>,
        )
      })
      .addCase(updateListingWithDetails.fulfilled, (state, action) => {
        rollbackRegistry.delete(action.meta.requestId)
        if (action.payload) replaceListingEverywhere(state, action.payload)
        state.isUpdating = false
      })
      .addCase(updateListingWithDetails.rejected, (state, action) => {
        restoreListings(state, takeRollback<ListingsSnapshot>(action.meta.requestId))
        state.error = action.payload ?? 'Failed to update listing.'
        state.isUpdating = false
      })

      // ---- delete (optimistic remove) ----
      .addCase(deleteListing.pending, (state, action) => {
        state.isDeleting = true
        state.error = null
        stashRollback(action.meta.requestId, snapshotListings(state))
        const { listingId } = action.meta.arg
        state.myListings = state.myListings.filter((listing) => listing.id !== listingId)
        state.adminListings = state.adminListings.filter((listing) => listing.id !== listingId)
        if (state.currentListing?.id === listingId) state.currentListing = null
      })
      .addCase(deleteListing.fulfilled, (state, action) => {
        rollbackRegistry.delete(action.meta.requestId)
        state.isDeleting = false
      })
      .addCase(deleteListing.rejected, (state, action) => {
        restoreListings(state, takeRollback<ListingsSnapshot>(action.meta.requestId))
        state.error = action.payload ?? 'Failed to delete listing.'
        state.isDeleting = false
      })

      // ---- status / active / featured (optimistic patch) ----
      .addCase(setListingStatus.pending, (state, action) => {
        state.error = null
        stashRollback(action.meta.requestId, snapshotListings(state))
        patchListingEverywhere(state, action.meta.arg.listingId, {
          listing_status: action.meta.arg.status,
          is_active: action.meta.arg.status === LISTING_STATUS.ACTIVE,
        })
      })
      .addCase(setListingStatus.fulfilled, (state, action) => {
        rollbackRegistry.delete(action.meta.requestId)
        replaceListingEverywhere(state, action.payload)
      })
      .addCase(setListingStatus.rejected, (state, action) => {
        restoreListings(state, takeRollback<ListingsSnapshot>(action.meta.requestId))
        state.error = action.payload ?? 'Failed to update status.'
      })

      .addCase(setListingActive.pending, (state, action) => {
        state.error = null
        stashRollback(action.meta.requestId, snapshotListings(state))
        patchListingEverywhere(state, action.meta.arg.listingId, { is_active: action.meta.arg.isActive })
      })
      .addCase(setListingActive.fulfilled, (state, action) => {
        rollbackRegistry.delete(action.meta.requestId)
        replaceListingEverywhere(state, action.payload)
      })
      .addCase(setListingActive.rejected, (state, action) => {
        restoreListings(state, takeRollback<ListingsSnapshot>(action.meta.requestId))
        state.error = action.payload ?? 'Failed to update listing.'
      })

      .addCase(setListingFeatured.pending, (state, action) => {
        state.error = null
        stashRollback(action.meta.requestId, snapshotListings(state))
        patchListingEverywhere(state, action.meta.arg.listingId, { is_featured: action.meta.arg.isFeatured })
      })
      .addCase(setListingFeatured.fulfilled, (state, action) => {
        rollbackRegistry.delete(action.meta.requestId)
        replaceListingEverywhere(state, action.payload)
      })
      .addCase(setListingFeatured.rejected, (state, action) => {
        restoreListings(state, takeRollback<ListingsSnapshot>(action.meta.requestId))
        state.error = action.payload ?? 'Failed to update listing.'
      })

      // ---- stock (optimistic adjust) ----
      .addCase(adjustStock.pending, (state, action) => {
        state.error = null
        stashRollback(action.meta.requestId, snapshotListings(state))
        const { listingId, quantityChange } = action.meta.arg
        const target = state.myListings.find((listing) => listing.id === listingId)
        if (target && typeof target.stock === 'number') {
          patchListingEverywhere(state, listingId, {
            stock: Math.max(0, (target.stock ?? 0) + quantityChange),
          })
        }
      })
      .addCase(adjustStock.fulfilled, (state, action) => {
        rollbackRegistry.delete(action.meta.requestId)
      })
      .addCase(adjustStock.rejected, (state, action) => {
        restoreListings(state, takeRollback<ListingsSnapshot>(action.meta.requestId))
        state.error = action.payload ?? 'Failed to update stock.'
      })

      // ---- admin ----
      .addCase(loadAdminListings.pending, (state, action) => {
        if (!((action.meta.arg.query?.offset ?? 0) > 0)) state.isLoadingListings = true
        state.error = null
      })
      .addCase(loadAdminListings.fulfilled, (state, action) => {
        const { rows, append } = action.payload
        state.adminListings = append ? [...state.adminListings, ...rows] : rows
        state.isLoadingListings = false
      })
      .addCase(loadAdminListings.rejected, (state, action) => {
        state.error = action.payload ?? 'Failed to load listings.'
        state.isLoadingListings = false
      })

      .addCase(adminUpdateListing.pending, (state, action) => {
        state.isUpdating = true
        state.error = null
        stashRollback(action.meta.requestId, snapshotListings(state))
        patchListingEverywhere(state, action.meta.arg.listingId, action.meta.arg.updates as Partial<Listing>)
      })
      .addCase(adminUpdateListing.fulfilled, (state, action) => {
        rollbackRegistry.delete(action.meta.requestId)
        replaceListingEverywhere(state, action.payload)
        state.isUpdating = false
      })
      .addCase(adminUpdateListing.rejected, (state, action) => {
        restoreListings(state, takeRollback<ListingsSnapshot>(action.meta.requestId))
        state.error = action.payload ?? 'Failed to update listing.'
        state.isUpdating = false
      })

      .addCase(loadPlatformListingStats.fulfilled, (state, action) => {
        state.platformStats = action.payload
      })
  },
})

export const {
  setListingFormData,
  updateListingField,
  initFormForType,
  loadFormFromListing,
  resetListingFormData,
  validateForm,
  setCurrentListing,
  clearListingError,
  resetListings,
} = listingSlice.actions

export const listingReducer = listingSlice.reducer
