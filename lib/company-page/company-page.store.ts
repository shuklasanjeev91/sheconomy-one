/**
 * Redux Toolkit slice for Company Pages (admin-first).
 *
 * Async work lives in createAsyncThunks wrapping company-page.service.
 * Create / update / delete apply optimistically and roll back on failure.
 */

import { createAsyncThunk, createSlice, type PayloadAction } from '@reduxjs/toolkit'

import type { AppDispatch } from '~/lib/store'

import * as companyPageService from '~/lib/company-page/company-page.service'
import {
  DEFAULT_COMPANY_PAGE_LIMIT,
  type CompanyPage,
  type CompanyPageDetail,
  type CompanyPageFacets,
  type CompanyPageListParams,
  type CompanyPagePlatformStats,
  type CompanyPageServiceResponse,
  type CompanyPageWithCounts,
} from '~/lib/company-page/company-page.type'
import {
  createCompanyPageSchema,
  parseOrThrow,
  setMemberRoleSchema,
  updateCompanyPageSchema,
} from '~/lib/company-page/company-page.validation'

// ============= STATE =============

type CompanyPageState = {
  pages: CompanyPageWithCounts[]
  totalPages: number
  hasMore: boolean
  currentPage: CompanyPageDetail | null
  facets: CompanyPageFacets | null
  platformStats: CompanyPagePlatformStats | null

  error: string | null
  successMessage: string | null

  isLoadingList: boolean
  isLoadingDetail: boolean
  isSaving: boolean
  isDeleting: boolean
  isLoadingFacets: boolean
  isLoadingStats: boolean
  isUpdatingMember: boolean
}

const initialState: CompanyPageState = {
  pages: [],
  totalPages: 0,
  hasMore: false,
  currentPage: null,
  facets: null,
  platformStats: null,

  error: null,
  successMessage: null,

  isLoadingList: false,
  isLoadingDetail: false,
  isSaving: false,
  isDeleting: false,
  isLoadingFacets: false,
  isLoadingStats: false,
  isUpdatingMember: false,
}

// ============= ROLLBACK REGISTRY =============

const rollbackRegistry = new Map<string, unknown>()

function stashRollback(requestId: string, snapshot: unknown): void {
  rollbackRegistry.set(requestId, snapshot)
}

function takeRollback<T>(requestId: string): T | undefined {
  const snapshot = rollbackRegistry.get(requestId) as T | undefined
  rollbackRegistry.delete(requestId)
  return snapshot
}

function tempId(requestId: string): string {
  return `optimistic-${requestId}`
}

// ============= THUNK PLUMBING =============

type ThunkConfig = {
  rejectValue: string
  dispatch: AppDispatch
  state: { companyPage: CompanyPageState }
}

async function resolve<T>(
  promise: Promise<CompanyPageServiceResponse<T>>,
  rejectWithValue: (value: string) => unknown,
): Promise<{ data: T; meta?: CompanyPageServiceResponse<T>['meta'] }> {
  const response = await promise
  if (!response.success || response.data === null) {
    return rejectWithValue(response.error ?? 'Request failed.') as never
  }
  return { data: response.data, meta: response.meta }
}

// ============= THUNKS =============

export const loadCompanyPages = createAsyncThunk<
  { items: CompanyPageWithCounts[]; total: number; hasMore: boolean; append: boolean },
  CompanyPageListParams | undefined,
  ThunkConfig
>('companyPage/loadCompanyPages', async (params = {}, { rejectWithValue }) => {
  const limit = params.limit ?? DEFAULT_COMPANY_PAGE_LIMIT
  const offset = params.offset ?? 0
  const { data, meta } = await resolve(
    companyPageService.listCompanyPages({ ...params, limit, offset }),
    rejectWithValue,
  )
  return {
    items: data,
    total: meta?.total ?? data.length,
    hasMore: meta?.hasMore ?? false,
    append: offset > 0,
  }
})

export const loadCompanyPageDetail = createAsyncThunk<CompanyPageDetail, string, ThunkConfig>(
  'companyPage/loadCompanyPageDetail',
  async (id, { rejectWithValue }) =>
    (await resolve(companyPageService.getCompanyPageDetail(id), rejectWithValue)).data,
)

export const createCompanyPage = createAsyncThunk<CompanyPageWithCounts, unknown, ThunkConfig>(
  'companyPage/createCompanyPage',
  async (payload, { rejectWithValue }) => {
    try {
      const validated = parseOrThrow(createCompanyPageSchema, payload)
      const { data } = await resolve(companyPageService.createCompanyPage(validated), rejectWithValue)
      return {
        ...data,
        follower_count: 0,
        member_count: 1,
        post_count: 0,
        creator: null,
      }
    } catch (err) {
      return rejectWithValue(err instanceof Error ? err.message : 'Create failed.')
    }
  },
)

export const updateCompanyPage = createAsyncThunk<
  CompanyPageWithCounts,
  { pageId: string; payload: unknown },
  ThunkConfig
>('companyPage/updateCompanyPage', async ({ pageId, payload }, { getState, rejectWithValue }) => {
  try {
    const validated = parseOrThrow(updateCompanyPageSchema, payload)
    const { data } = await resolve(
      companyPageService.updateCompanyPage(pageId, validated),
      rejectWithValue,
    )
    const existing = getState().companyPage.pages.find((p) => p.id === pageId)
    return {
      ...data,
      follower_count: existing?.follower_count ?? 0,
      member_count: existing?.member_count ?? 0,
      post_count: existing?.post_count ?? 0,
      creator: existing?.creator ?? null,
    }
  } catch (err) {
    return rejectWithValue(err instanceof Error ? err.message : 'Update failed.')
  }
})

export const deleteCompanyPage = createAsyncThunk<string, string, ThunkConfig>(
  'companyPage/deleteCompanyPage',
  async (pageId, { rejectWithValue }) => {
    const response = await companyPageService.deleteCompanyPage(pageId)
    if (!response.success) return rejectWithValue(response.error ?? 'Delete failed.')
    return pageId
  },
)

export const reassignCompanyPageOwner = createAsyncThunk<
  CompanyPage,
  { pageId: string; newOwnerId: string },
  ThunkConfig
>('companyPage/reassignCompanyPageOwner', async ({ pageId, newOwnerId }, { rejectWithValue }) => {
  const { data } = await resolve(
    companyPageService.reassignCompanyPageOwner(pageId, newOwnerId),
    rejectWithValue,
  )
  return data
})

export const setCompanyMemberRole = createAsyncThunk<
  { company_id: string; user_id: string; role: string },
  { companyId: string; userId: string; role: 'admin' | 'member' },
  ThunkConfig
>('companyPage/setCompanyMemberRole', async ({ companyId, userId, role }, { rejectWithValue }) => {
  try {
    parseOrThrow(setMemberRoleSchema, {
      company_id: companyId,
      user_id: userId,
      role,
    })
    const { data } = await resolve(
      companyPageService.setCompanyMemberRole(companyId, userId, role),
      rejectWithValue,
    )
    return data
  } catch (err) {
    return rejectWithValue(err instanceof Error ? err.message : 'Failed to update member role.')
  }
})

export const removeCompanyMember = createAsyncThunk<
  { companyId: string; userId: string },
  { companyId: string; userId: string },
  ThunkConfig
>('companyPage/removeCompanyMember', async ({ companyId, userId }, { rejectWithValue }) => {
  const response = await companyPageService.removeCompanyMember(companyId, userId)
  if (!response.success) return rejectWithValue(response.error ?? 'Failed to remove member.')
  return { companyId, userId }
})

export const loadCompanyPageFacets = createAsyncThunk<CompanyPageFacets, void, ThunkConfig>(
  'companyPage/loadCompanyPageFacets',
  async (_, { rejectWithValue }) =>
    (await resolve(companyPageService.getCompanyPageFacets(), rejectWithValue)).data,
)

export const loadCompanyPagePlatformStats = createAsyncThunk<
  CompanyPagePlatformStats,
  void,
  ThunkConfig
>('companyPage/loadCompanyPagePlatformStats', async (_, { rejectWithValue }) =>
  (await resolve(companyPageService.getCompanyPagePlatformStats(), rejectWithValue)).data,
)

// ============= SLICE =============

const companyPageSlice = createSlice({
  name: 'companyPage',
  initialState,
  reducers: {
    setCurrentCompanyPage(state, action: PayloadAction<CompanyPageDetail | null>) {
      state.currentPage = action.payload
    },
    clearCurrentCompanyPage(state) {
      state.currentPage = null
    },
    clearCompanyPageMessages(state) {
      state.error = null
      state.successMessage = null
    },
    setCompanyPageError(state, action: PayloadAction<string | null>) {
      state.error = action.payload
    },
    resetCompanyPage() {
      return initialState
    },
  },
  extraReducers: (builder) => {
    builder
      // ---- list ----
      .addCase(loadCompanyPages.pending, (state) => {
        state.isLoadingList = true
        state.error = null
      })
      .addCase(loadCompanyPages.fulfilled, (state, action) => {
        state.isLoadingList = false
        state.pages = action.payload.append
          ? [...state.pages, ...action.payload.items]
          : action.payload.items
        state.totalPages = action.payload.total
        state.hasMore = action.payload.hasMore
      })
      .addCase(loadCompanyPages.rejected, (state, action) => {
        state.isLoadingList = false
        state.error = action.payload ?? 'Failed to load company pages.'
      })

      // ---- detail ----
      .addCase(loadCompanyPageDetail.pending, (state) => {
        state.isLoadingDetail = true
        state.error = null
      })
      .addCase(loadCompanyPageDetail.fulfilled, (state, action) => {
        state.isLoadingDetail = false
        state.currentPage = action.payload
      })
      .addCase(loadCompanyPageDetail.rejected, (state, action) => {
        state.isLoadingDetail = false
        state.error = action.payload ?? 'Failed to load company page.'
      })

      // ---- create (optimistic) ----
      .addCase(createCompanyPage.pending, (state, action) => {
        state.isSaving = true
        state.error = null
        const arg = action.meta.arg as Record<string, unknown>
        state.pages.unshift({
          ...(arg as unknown as CompanyPage),
          id: tempId(action.meta.requestId),
          created_at: new Date().toISOString(),
          follower_count: 0,
          member_count: 1,
          post_count: 0,
          creator: null,
        } as CompanyPageWithCounts)
        state.totalPages += 1
      })
      .addCase(createCompanyPage.fulfilled, (state, action) => {
        state.isSaving = false
        state.successMessage = 'Company page created'
        const temp = tempId(action.meta.requestId)
        const idx = state.pages.findIndex((p) => p.id === temp)
        if (idx >= 0) state.pages[idx] = action.payload
        else state.pages.unshift(action.payload)
      })
      .addCase(createCompanyPage.rejected, (state, action) => {
        state.isSaving = false
        state.error = action.payload ?? 'Failed to create company page.'
        const temp = tempId(action.meta.requestId)
        state.pages = state.pages.filter((p) => p.id !== temp)
        state.totalPages = Math.max(0, state.totalPages - 1)
      })

      // ---- update (optimistic) ----
      .addCase(updateCompanyPage.pending, (state, action) => {
        state.isSaving = true
        state.error = null
        stashRollback(action.meta.requestId, {
          pages: state.pages,
          currentPage: state.currentPage,
        })
        const patch = action.meta.arg.payload as Record<string, unknown>
        state.pages = state.pages.map((p) =>
          p.id === action.meta.arg.pageId ? { ...p, ...patch } : p,
        )
        if (state.currentPage?.id === action.meta.arg.pageId) {
          state.currentPage = { ...state.currentPage, ...patch }
        }
      })
      .addCase(updateCompanyPage.fulfilled, (state, action) => {
        state.isSaving = false
        state.successMessage = 'Company page updated'
        rollbackRegistry.delete(action.meta.requestId)
        state.pages = state.pages.map((p) =>
          p.id === action.payload.id ? action.payload : p,
        )
        if (state.currentPage?.id === action.payload.id) {
          state.currentPage = { ...state.currentPage, ...action.payload }
        }
      })
      .addCase(updateCompanyPage.rejected, (state, action) => {
        state.isSaving = false
        state.error = action.payload ?? 'Failed to update company page.'
        const snap = takeRollback<{
          pages: CompanyPageWithCounts[]
          currentPage: CompanyPageDetail | null
        }>(action.meta.requestId)
        if (snap) {
          state.pages = snap.pages
          state.currentPage = snap.currentPage
        }
      })

      // ---- delete (optimistic) ----
      .addCase(deleteCompanyPage.pending, (state, action) => {
        state.isDeleting = true
        state.error = null
        stashRollback(action.meta.requestId, {
          pages: state.pages,
          currentPage: state.currentPage,
          totalPages: state.totalPages,
        })
        state.pages = state.pages.filter((p) => p.id !== action.meta.arg)
        state.totalPages = Math.max(0, state.totalPages - 1)
        if (state.currentPage?.id === action.meta.arg) state.currentPage = null
      })
      .addCase(deleteCompanyPage.fulfilled, (state, action) => {
        state.isDeleting = false
        state.successMessage = 'Company page deleted'
        rollbackRegistry.delete(action.meta.requestId)
      })
      .addCase(deleteCompanyPage.rejected, (state, action) => {
        state.isDeleting = false
        state.error = action.payload ?? 'Failed to delete company page.'
        const snap = takeRollback<{
          pages: CompanyPageWithCounts[]
          currentPage: CompanyPageDetail | null
          totalPages: number
        }>(action.meta.requestId)
        if (snap) {
          state.pages = snap.pages
          state.currentPage = snap.currentPage
          state.totalPages = snap.totalPages
        }
      })

      // ---- reassign owner ----
      .addCase(reassignCompanyPageOwner.fulfilled, (state, action) => {
        state.successMessage = 'Owner reassigned'
        state.pages = state.pages.map((p) =>
          p.id === action.payload.id ? { ...p, created_by: action.payload.created_by } : p,
        )
        if (state.currentPage?.id === action.payload.id) {
          state.currentPage = { ...state.currentPage, created_by: action.payload.created_by }
        }
      })
      .addCase(reassignCompanyPageOwner.rejected, (state, action) => {
        state.error = action.payload ?? 'Failed to reassign owner.'
      })

      // ---- members ----
      .addCase(setCompanyMemberRole.pending, (state) => {
        state.isUpdatingMember = true
        state.error = null
      })
      .addCase(setCompanyMemberRole.fulfilled, (state, action) => {
        state.isUpdatingMember = false
        state.successMessage = `Member role set to ${action.payload.role}`
        if (state.currentPage?.id === action.payload.company_id) {
          state.currentPage.members = state.currentPage.members.map((m) =>
            m.user_id === action.payload.user_id
              ? { ...m, role: action.payload.role as typeof m.role }
              : m,
          )
        }
      })
      .addCase(setCompanyMemberRole.rejected, (state, action) => {
        state.isUpdatingMember = false
        state.error = action.payload ?? 'Failed to update member role.'
      })

      .addCase(removeCompanyMember.pending, (state, action) => {
        state.isUpdatingMember = true
        state.error = null
        stashRollback(action.meta.requestId, state.currentPage?.members ?? [])
        if (state.currentPage?.id === action.meta.arg.companyId) {
          state.currentPage.members = state.currentPage.members.filter(
            (m) => m.user_id !== action.meta.arg.userId,
          )
        }
      })
      .addCase(removeCompanyMember.fulfilled, (state, action) => {
        state.isUpdatingMember = false
        state.successMessage = 'Member removed'
        rollbackRegistry.delete(action.meta.requestId)
      })
      .addCase(removeCompanyMember.rejected, (state, action) => {
        state.isUpdatingMember = false
        state.error = action.payload ?? 'Failed to remove member.'
        const snap = takeRollback<CompanyPageDetail['members']>(action.meta.requestId)
        if (snap && state.currentPage) state.currentPage.members = snap
      })

      // ---- facets / stats ----
      .addCase(loadCompanyPageFacets.pending, (state) => {
        state.isLoadingFacets = true
      })
      .addCase(loadCompanyPageFacets.fulfilled, (state, action) => {
        state.isLoadingFacets = false
        state.facets = action.payload
      })
      .addCase(loadCompanyPageFacets.rejected, (state, action) => {
        state.isLoadingFacets = false
        state.error = action.payload ?? 'Failed to load facets.'
      })

      .addCase(loadCompanyPagePlatformStats.pending, (state) => {
        state.isLoadingStats = true
      })
      .addCase(loadCompanyPagePlatformStats.fulfilled, (state, action) => {
        state.isLoadingStats = false
        state.platformStats = action.payload
      })
      .addCase(loadCompanyPagePlatformStats.rejected, (state, action) => {
        state.isLoadingStats = false
        state.error = action.payload ?? 'Failed to load stats.'
      })
  },
})

export const {
  setCurrentCompanyPage,
  clearCurrentCompanyPage,
  clearCompanyPageMessages,
  setCompanyPageError,
  resetCompanyPage,
} = companyPageSlice.actions

export const companyPageReducer = companyPageSlice.reducer
