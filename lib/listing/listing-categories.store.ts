/**
 * Redux Toolkit slice for the category taxonomy.
 *
 * Replaces the legacy Zustand `categoriesStore`. Async work lives in
 * `createAsyncThunk`s that wrap `listing-categories.service`; every mutation
 * applies **optimistically** and rolls back on failure (see the rollback
 * registry below), mirroring the listing/shop/profile stores exactly.
 *
 * The same slice serves normal users (browse / search / breadcrumb), vendors
 * (create / suggest / assign to their listings) and admins (full CRUD, status,
 * stats). Authorisation is enforced by Supabase RLS.
 */

import { createAsyncThunk, createSlice, current, type PayloadAction } from '@reduxjs/toolkit'

import type { AppDispatch } from '~/lib/store'

import * as categoriesService from './listing-categories.service'
import type {
  CategoryWithRelations,
  ListingCategoryRow,
  PaginatedCategories,
} from './listing-categories.service'
import {
  CATEGORY_PAGE_SIZE,
  EMPTY_CATEGORY_FORM_DATA,
  categoryToFormData,
  type Category,
  type CategoryChildRow,
  type CategoryFilters,
  type CategoryFormData,
  type CategoryMoveInput,
  type CategoryPathRow,
  type CategoryStatistics,
  type CategoryStatus,
  type CategoryTreeCountRow,
  type CategoryTreeItem,
  type CategoryValidationResult,
  type ListingCategoryAssignmentInput,
} from './listing-categories.type'
import { buildCategoryTree } from './listing-categories.utils'
import { validateCategoryData } from './listing-categories.validation'

// ============= STATE =============

type CategoryState = {
  categories: Category[]
  categoryTree: CategoryTreeItem[]
  currentCategory: CategoryWithRelations | null
  categoryPath: CategoryPathRow[]
  hierarchyChildren: CategoryChildRow[]
  treeWithCounts: CategoryTreeCountRow[]
  popularCategories: Category[]
  searchResults: Category[]
  listingCategories: Record<string, ListingCategoryRow[]>

  adminCategories: Category[]
  statistics: CategoryStatistics | null

  filters: CategoryFilters
  formData: CategoryFormData
  validation: CategoryValidationResult

  total: number
  hasMore: boolean
  offset: number

  isLoading: boolean
  isSearching: boolean
  isLoadingDetails: boolean
  isCreating: boolean
  isUpdating: boolean
  isDeleting: boolean
  error: string | null
  lastUpdated: string | null
}

const initialState: CategoryState = {
  categories: [],
  categoryTree: [],
  currentCategory: null,
  categoryPath: [],
  hierarchyChildren: [],
  treeWithCounts: [],
  popularCategories: [],
  searchResults: [],
  listingCategories: {},
  adminCategories: [],
  statistics: null,
  filters: { status: 'A', limit: CATEGORY_PAGE_SIZE, offset: 0 },
  formData: { ...EMPTY_CATEGORY_FORM_DATA },
  validation: { isValid: true, errors: {} },
  total: 0,
  hasMore: false,
  offset: 0,
  isLoading: false,
  isSearching: false,
  isLoadingDetails: false,
  isCreating: false,
  isUpdating: false,
  isDeleting: false,
  error: null,
  lastUpdated: null,
}

type ThunkConfig = { rejectValue: string; dispatch: AppDispatch }

// ============= THUNKS: READS =============

export const loadCategories = createAsyncThunk<
  { result: PaginatedCategories; append: boolean },
  { filters?: CategoryFilters; append?: boolean } | undefined,
  ThunkConfig
>('categories/loadCategories', async (arg, { rejectWithValue }) => {
  const filters = arg?.filters ?? {}
  const response = await categoriesService.getCategories(filters)
  if (!response.success || !response.data) {
    return rejectWithValue(response.error ?? 'Failed to load categories.')
  }
  return { result: response.data, append: arg?.append ?? (filters.offset ?? 0) > 0 }
})

export const loadCategoryById = createAsyncThunk<CategoryWithRelations, string, ThunkConfig>(
  'categories/loadCategoryById',
  async (categoryId, { rejectWithValue }) => {
    const response = await categoriesService.getCategoryById(categoryId)
    if (!response.success || !response.data) {
      return rejectWithValue(response.error ?? 'Failed to load category.')
    }
    return response.data
  },
)

export const loadCategoryHierarchy = createAsyncThunk<
  CategoryChildRow[],
  string | null | undefined,
  ThunkConfig
>('categories/loadHierarchy', async (parentId, { rejectWithValue }) => {
  const response = await categoriesService.getCategoryHierarchy(parentId ?? null)
  if (!response.success) return rejectWithValue(response.error ?? 'Failed to load hierarchy.')
  return response.data ?? []
})

export const loadCategoryPath = createAsyncThunk<CategoryPathRow[], string, ThunkConfig>(
  'categories/loadPath',
  async (categoryId, { rejectWithValue }) => {
    const response = await categoriesService.getCategoryPath(categoryId)
    if (!response.success) return rejectWithValue(response.error ?? 'Failed to load breadcrumb.')
    return response.data ?? []
  },
)

export const loadCategoryTree = createAsyncThunk<
  CategoryTreeCountRow[],
  { rootId?: string | null; maxDepth?: number; langCode?: string } | undefined,
  ThunkConfig
>('categories/loadTree', async (arg, { rejectWithValue }) => {
  const response = await categoriesService.getCategoryTreeWithCounts(arg ?? {})
  if (!response.success) return rejectWithValue(response.error ?? 'Failed to load category tree.')
  return response.data ?? []
})

export const searchCategories = createAsyncThunk<
  Category[],
  { term: string; options?: { limit?: number; level?: number } },
  ThunkConfig
>('categories/search', async ({ term, options }, { rejectWithValue }) => {
  const response = await categoriesService.searchCategories(term, options ?? {})
  if (!response.success) return rejectWithValue(response.error ?? 'Search failed.')
  return response.data ?? []
})

export const loadPopularCategories = createAsyncThunk<Category[], number | undefined, ThunkConfig>(
  'categories/loadPopular',
  async (limit, { rejectWithValue }) => {
    const response = await categoriesService.getPopularCategories(limit ?? 10)
    if (!response.success) return rejectWithValue(response.error ?? 'Failed to load categories.')
    return response.data ?? []
  },
)

export const loadListingCategories = createAsyncThunk<
  { listingId: string; rows: ListingCategoryRow[] },
  string,
  ThunkConfig
>('categories/loadListingCategories', async (listingId, { rejectWithValue }) => {
  const response = await categoriesService.getListingCategories(listingId)
  if (!response.success) return rejectWithValue(response.error ?? 'Failed to load listing categories.')
  return { listingId, rows: response.data ?? [] }
})

// ============= THUNKS: WRITES (optimistic) =============

export const createCategory = createAsyncThunk<
  Category,
  { formData: Partial<CategoryFormData>; userId?: string },
  ThunkConfig
>('categories/create', async ({ formData, userId }, { rejectWithValue }) => {
  const response = await categoriesService.createCategory(formData, userId)
  if (!response.success || !response.data) {
    return rejectWithValue(response.error ?? 'Failed to create category.')
  }
  return response.data
})

export const updateCategory = createAsyncThunk<
  Category,
  { categoryId: string; updates: Partial<CategoryFormData>; userId?: string },
  ThunkConfig
>('categories/update', async ({ categoryId, updates, userId }, { rejectWithValue }) => {
  const response = await categoriesService.updateCategory(categoryId, updates, userId)
  if (!response.success || !response.data) {
    return rejectWithValue(response.error ?? 'Failed to update category.')
  }
  return response.data
})

export const deleteCategory = createAsyncThunk<
  string,
  { categoryId: string; userId?: string },
  ThunkConfig
>('categories/delete', async ({ categoryId, userId }, { rejectWithValue }) => {
  const response = await categoriesService.deleteCategory(categoryId, userId)
  if (!response.success || !response.data) {
    return rejectWithValue(response.error ?? 'Failed to delete category.')
  }
  return response.data
})

export const moveCategory = createAsyncThunk<
  Category,
  { categoryId: string; moveInput: CategoryMoveInput; userId?: string },
  ThunkConfig
>('categories/move', async ({ categoryId, moveInput, userId }, { rejectWithValue }) => {
  const response = await categoriesService.moveCategory(categoryId, moveInput, userId)
  if (!response.success || !response.data) {
    return rejectWithValue(response.error ?? 'Failed to move category.')
  }
  return response.data
})

export const setCategoryStatus = createAsyncThunk<
  Category,
  { categoryId: string; status: CategoryStatus; userId?: string },
  ThunkConfig
>('categories/setStatus', async ({ categoryId, status, userId }, { rejectWithValue }) => {
  const response = await categoriesService.setCategoryStatus(categoryId, status, userId)
  if (!response.success || !response.data) {
    return rejectWithValue(response.error ?? 'Failed to update category status.')
  }
  return response.data
})

export const assignCategoriesToListing = createAsyncThunk<
  { listingId: string; rows: ListingCategoryRow[] },
  { listingId: string; categories: ListingCategoryAssignmentInput[]; userId?: string },
  ThunkConfig
>('categories/assignToListing', async ({ listingId, categories, userId }, { rejectWithValue }) => {
  const response = await categoriesService.assignCategoriesToListing(listingId, categories, userId)
  if (!response.success || !response.data) {
    return rejectWithValue(response.error ?? 'Failed to assign categories.')
  }
  return { listingId, rows: response.data }
})

// ============= THUNKS: ADMIN =============

export const loadAdminCategories = createAsyncThunk<
  { result: PaginatedCategories; append: boolean },
  { filters?: CategoryFilters; append?: boolean } | undefined,
  ThunkConfig
>('categories/loadAdmin', async (arg, { rejectWithValue }) => {
  const filters = arg?.filters ?? {}
  const response = await categoriesService.getAllCategoriesForAdmin(filters)
  if (!response.success || !response.data) {
    return rejectWithValue(response.error ?? 'Failed to load categories.')
  }
  return { result: response.data, append: arg?.append ?? (filters.offset ?? 0) > 0 }
})

export const loadCategoryStatistics = createAsyncThunk<
  CategoryStatistics | null,
  string | undefined,
  ThunkConfig
>('categories/loadStatistics', async (userId, { rejectWithValue }) => {
  const response = await categoriesService.getCategoryStatistics(userId)
  if (!response.success) return rejectWithValue(response.error ?? 'Failed to load statistics.')
  return response.data ?? null
})

// ============= OPTIMISTIC ROLLBACK REGISTRY =============
//
// Snapshots for reverts are keyed by the thunk's `requestId` and kept OUTSIDE
// Redux state so the state stays serializable (identical to the listing store).

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

type CategorySnapshot = {
  categories: Category[]
  adminCategories: Category[]
  currentCategory: CategoryWithRelations | null
}

function snapshot(state: CategoryState): CategorySnapshot {
  return {
    categories: current(state.categories),
    adminCategories: current(state.adminCategories),
    currentCategory: state.currentCategory ? current(state.currentCategory) : null,
  }
}

function restore(state: CategoryState, snap: CategorySnapshot | undefined): void {
  if (!snap) return
  state.categories = snap.categories
  state.adminCategories = snap.adminCategories
  state.currentCategory = snap.currentCategory
  state.categoryTree = buildCategoryTree(state.categories)
}

/** Merge a partial patch into every collection a category is held in. */
function patchEverywhere(state: CategoryState, categoryId: string, patch: Partial<Category>): void {
  state.categories = state.categories.map((c) =>
    c.category_id === categoryId ? ({ ...c, ...patch } as Category) : c,
  )
  state.adminCategories = state.adminCategories.map((c) =>
    c.category_id === categoryId ? ({ ...c, ...patch } as Category) : c,
  )
  if (state.currentCategory && state.currentCategory.category_id === categoryId) {
    state.currentCategory = { ...state.currentCategory, ...patch } as CategoryWithRelations
  }
  state.categoryTree = buildCategoryTree(state.categories)
}

/** Replace a category (authoritative server row) everywhere it is held. */
function replaceEverywhere(state: CategoryState, category: Category): void {
  state.categories = state.categories.map((c) =>
    c.category_id === category.category_id ? category : c,
  )
  state.adminCategories = state.adminCategories.map((c) =>
    c.category_id === category.category_id ? category : c,
  )
  if (state.currentCategory && state.currentCategory.category_id === category.category_id) {
    state.currentCategory = { ...state.currentCategory, ...category }
  }
  state.categoryTree = buildCategoryTree(state.categories)
}

/** Build an optimistic placeholder category from form data. */
function buildOptimisticCategory(requestId: string, formData: Partial<CategoryFormData>): Category {
  const now = new Date().toISOString()
  return {
    category_id: optimisticId(requestId),
    parent_id: formData.parent_id ?? null,
    category: formData.category ?? '',
    description: formData.description ?? null,
    id_path: null,
    level: null,
    position: formData.position ?? 0,
    product_count: 0,
    status: formData.status ?? 'A',
    seo_name: formData.seo_name ?? null,
    seo_path: null,
    meta_keywords: formData.meta_keywords ?? null,
    meta_description: formData.meta_description ?? null,
    meta_title: formData.meta_title ?? null,
    page_title: formData.page_title ?? null,
    lang_code: formData.lang_code ?? 'en',
    main_pair: (formData.main_pair as Category['main_pair']) ?? null,
    category_meta: formData.category_meta ?? null,
    category_image_url: formData.category_image_url ?? null,
    category_icon: formData.category_icon ?? null,
    og_image: formData.og_image ?? null,
    timestamp: Math.floor(Date.now() / 1000),
    created_at: now,
    updated_at: now,
  }
}

// ============= SLICE =============

const categoriesSlice = createSlice({
  name: 'categories',
  initialState,
  reducers: {
    setCategoryFilters: (state, action: PayloadAction<Partial<CategoryFilters>>) => {
      state.filters = { ...state.filters, ...action.payload }
      // Reset the offset whenever filters change (unless it was set explicitly).
      if (!('offset' in action.payload)) state.filters.offset = 0
    },
    setCategoryFormData: (state, action: PayloadAction<Partial<CategoryFormData>>) => {
      state.formData = { ...state.formData, ...action.payload }
    },
    updateCategoryField: (
      state,
      action: PayloadAction<{ field: keyof CategoryFormData; value: CategoryFormData[keyof CategoryFormData] }>,
    ) => {
      state.formData = { ...state.formData, [action.payload.field]: action.payload.value }
    },
    loadFormFromCategory: (state, action: PayloadAction<Category>) => {
      state.formData = categoryToFormData(action.payload)
      state.validation = { isValid: true, errors: {} }
    },
    resetCategoryFormData: (state) => {
      state.formData = { ...EMPTY_CATEGORY_FORM_DATA }
      state.validation = { isValid: true, errors: {} }
    },
    validateCategoryForm: (state) => {
      state.validation = validateCategoryData(state.formData)
    },
    setCurrentCategory: (state, action: PayloadAction<CategoryWithRelations | null>) => {
      state.currentCategory = action.payload
    },
    clearCategorySearch: (state) => {
      state.searchResults = []
    },
    clearCategoryError: (state) => {
      state.error = null
    },
    resetCategories: () => initialState,
  },
  extraReducers: (builder) => {
    builder
      // ---- reads ----
      .addCase(loadCategories.pending, (state, action) => {
        if (!((action.meta.arg?.filters?.offset ?? 0) > 0)) state.isLoading = true
        state.error = null
      })
      .addCase(loadCategories.fulfilled, (state, action) => {
        const { result, append } = action.payload
        state.categories = append ? [...state.categories, ...result.items] : result.items
        state.total = result.count
        state.hasMore = result.hasMore
        state.offset = state.categories.length
        state.categoryTree = buildCategoryTree(state.categories)
        state.lastUpdated = new Date().toISOString()
        state.isLoading = false
      })
      .addCase(loadCategories.rejected, (state, action) => {
        state.error = action.payload ?? 'Failed to load categories.'
        state.isLoading = false
      })

      .addCase(loadCategoryById.pending, (state) => {
        state.isLoadingDetails = true
        state.error = null
      })
      .addCase(loadCategoryById.fulfilled, (state, action) => {
        state.currentCategory = action.payload
        state.isLoadingDetails = false
      })
      .addCase(loadCategoryById.rejected, (state, action) => {
        state.error = action.payload ?? 'Failed to load category.'
        state.isLoadingDetails = false
      })

      .addCase(loadCategoryHierarchy.fulfilled, (state, action) => {
        state.hierarchyChildren = action.payload
      })
      .addCase(loadCategoryPath.fulfilled, (state, action) => {
        state.categoryPath = action.payload
      })
      .addCase(loadCategoryTree.fulfilled, (state, action) => {
        state.treeWithCounts = action.payload
      })

      .addCase(searchCategories.pending, (state) => {
        state.isSearching = true
        state.error = null
      })
      .addCase(searchCategories.fulfilled, (state, action) => {
        state.searchResults = action.payload
        state.isSearching = false
      })
      .addCase(searchCategories.rejected, (state, action) => {
        state.error = action.payload ?? 'Search failed.'
        state.isSearching = false
      })

      .addCase(loadPopularCategories.fulfilled, (state, action) => {
        state.popularCategories = action.payload
      })
      .addCase(loadListingCategories.fulfilled, (state, action) => {
        state.listingCategories[action.payload.listingId] = action.payload.rows
      })

      // ---- create (optimistic insert) ----
      .addCase(createCategory.pending, (state, action) => {
        state.isCreating = true
        state.error = null
        const optimistic = buildOptimisticCategory(action.meta.requestId, action.meta.arg.formData)
        state.categories.unshift(optimistic)
        state.categoryTree = buildCategoryTree(state.categories)
      })
      .addCase(createCategory.fulfilled, (state, action) => {
        const tempId = optimisticId(action.meta.requestId)
        state.categories = state.categories.map((c) => (c.category_id === tempId ? action.payload : c))
        state.categoryTree = buildCategoryTree(state.categories)
        state.lastUpdated = new Date().toISOString()
        state.isCreating = false
      })
      .addCase(createCategory.rejected, (state, action) => {
        const tempId = optimisticId(action.meta.requestId)
        state.categories = state.categories.filter((c) => c.category_id !== tempId)
        state.categoryTree = buildCategoryTree(state.categories)
        state.error = action.payload ?? 'Failed to create category.'
        state.isCreating = false
      })

      // ---- update (optimistic merge) ----
      .addCase(updateCategory.pending, (state, action) => {
        state.isUpdating = true
        state.error = null
        stashRollback(action.meta.requestId, snapshot(state))
        patchEverywhere(state, action.meta.arg.categoryId, action.meta.arg.updates as Partial<Category>)
      })
      .addCase(updateCategory.fulfilled, (state, action) => {
        rollbackRegistry.delete(action.meta.requestId)
        replaceEverywhere(state, action.payload)
        state.isUpdating = false
      })
      .addCase(updateCategory.rejected, (state, action) => {
        restore(state, takeRollback<CategorySnapshot>(action.meta.requestId))
        state.error = action.payload ?? 'Failed to update category.'
        state.isUpdating = false
      })

      // ---- delete (optimistic remove) ----
      .addCase(deleteCategory.pending, (state, action) => {
        state.isDeleting = true
        state.error = null
        stashRollback(action.meta.requestId, snapshot(state))
        const { categoryId } = action.meta.arg
        state.categories = state.categories.filter((c) => c.category_id !== categoryId)
        state.adminCategories = state.adminCategories.filter((c) => c.category_id !== categoryId)
        if (state.currentCategory?.category_id === categoryId) state.currentCategory = null
        state.categoryTree = buildCategoryTree(state.categories)
      })
      .addCase(deleteCategory.fulfilled, (state, action) => {
        rollbackRegistry.delete(action.meta.requestId)
        state.isDeleting = false
      })
      .addCase(deleteCategory.rejected, (state, action) => {
        restore(state, takeRollback<CategorySnapshot>(action.meta.requestId))
        state.error = action.payload ?? 'Failed to delete category.'
        state.isDeleting = false
      })

      // ---- move (optimistic re-parent) ----
      .addCase(moveCategory.pending, (state, action) => {
        state.error = null
        stashRollback(action.meta.requestId, snapshot(state))
        const { categoryId, moveInput } = action.meta.arg
        const patch: Partial<Category> = { parent_id: moveInput.new_parent_id ?? null }
        if (moveInput.new_position !== undefined && moveInput.new_position !== null) {
          patch.position = moveInput.new_position
        }
        patchEverywhere(state, categoryId, patch)
      })
      .addCase(moveCategory.fulfilled, (state, action) => {
        rollbackRegistry.delete(action.meta.requestId)
        replaceEverywhere(state, action.payload)
      })
      .addCase(moveCategory.rejected, (state, action) => {
        restore(state, takeRollback<CategorySnapshot>(action.meta.requestId))
        state.error = action.payload ?? 'Failed to move category.'
      })

      // ---- status (optimistic patch) ----
      .addCase(setCategoryStatus.pending, (state, action) => {
        state.error = null
        stashRollback(action.meta.requestId, snapshot(state))
        patchEverywhere(state, action.meta.arg.categoryId, { status: action.meta.arg.status })
      })
      .addCase(setCategoryStatus.fulfilled, (state, action) => {
        rollbackRegistry.delete(action.meta.requestId)
        replaceEverywhere(state, action.payload)
      })
      .addCase(setCategoryStatus.rejected, (state, action) => {
        restore(state, takeRollback<CategorySnapshot>(action.meta.requestId))
        state.error = action.payload ?? 'Failed to update category status.'
      })

      // ---- assignment ----
      .addCase(assignCategoriesToListing.fulfilled, (state, action) => {
        state.listingCategories[action.payload.listingId] = action.payload.rows
      })
      .addCase(assignCategoriesToListing.rejected, (state, action) => {
        state.error = action.payload ?? 'Failed to assign categories.'
      })

      // ---- admin ----
      .addCase(loadAdminCategories.pending, (state, action) => {
        if (!((action.meta.arg?.filters?.offset ?? 0) > 0)) state.isLoading = true
        state.error = null
      })
      .addCase(loadAdminCategories.fulfilled, (state, action) => {
        const { result, append } = action.payload
        state.adminCategories = append ? [...state.adminCategories, ...result.items] : result.items
        state.total = result.count
        state.hasMore = result.hasMore
        state.isLoading = false
      })
      .addCase(loadAdminCategories.rejected, (state, action) => {
        state.error = action.payload ?? 'Failed to load categories.'
        state.isLoading = false
      })

      .addCase(loadCategoryStatistics.fulfilled, (state, action) => {
        state.statistics = action.payload
      })
  },
})

export const {
  setCategoryFilters,
  setCategoryFormData,
  updateCategoryField,
  loadFormFromCategory,
  resetCategoryFormData,
  validateCategoryForm,
  setCurrentCategory,
  clearCategorySearch,
  clearCategoryError,
  resetCategories,
} = categoriesSlice.actions

export const categoriesReducer = categoriesSlice.reducer
