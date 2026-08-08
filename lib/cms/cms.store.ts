/**
 * Redux Toolkit slice for CMS state.
 *
 * Replaces the legacy Zustand `cms-store`. Async work lives in
 * `createAsyncThunk`s that wrap `cms.service`. Like toggles apply
 * optimistically and roll back on failure (same pattern as profile/shop).
 */

import { createAsyncThunk, createSlice, type PayloadAction } from '@reduxjs/toolkit'

import type { AppDispatch } from '~/lib/store'

import * as cmsService from '~/lib/cms/cms.service'
import {
  DEFAULT_CONTENT_FILTERS,
  type CmsCategory,
  type CmsCommentWithAuthor,
  type CmsContentCreateInput,
  type CmsContentDetail,
  type CmsContentUpdateInput,
  type CmsContentVersion,
  type CmsLikeToggleResult,
  type CmsLikeWithUser,
  type CmsListCommentsParams,
  type CmsListContentParams,
  type CmsListMediaParams,
  type CmsListRedirectsParams,
  type CmsMedia,
  type CmsMediaUpdate,
  type CmsMediaUploadFile,
  type CmsMediaUploadOptions,
  type CmsPaginationMeta,
  type CmsRedirect,
  type CmsSeo,
  type CmsSitemapFeedRow,
  type CmsTag,
} from '~/lib/cms/cms.type'
import {
  createCategorySchema,
  createCommentSchema,
  createContentSchema,
  createRedirectSchema,
  createSeoSchema,
  createTagSchema,
  listCommentsParamsSchema,
  listContentParamsSchema,
  moderateCommentSchema,
  parseOrThrow,
  updateCategorySchema,
  updateCommentSchema,
  updateContentSchema,
  updateRedirectSchema,
  updateSeoSchema,
  updateTagSchema,
} from '~/lib/cms/cms.validation'

// ============= STATE =============

type CmsState = {
  items: CmsContentDetail[]
  currentContent: CmsContentDetail | null
  contentMeta: CmsPaginationMeta
  contentFilters: CmsListContentParams
  contentError: string | null

  categories: CmsCategory[]
  currentCategory: CmsCategory | null
  categoryError: string | null

  tags: CmsTag[]
  tagError: string | null

  mediaItems: CmsMedia[]
  currentMedia: CmsMedia | null
  mediaMeta: CmsPaginationMeta
  mediaError: string | null
  isUploading: boolean
  uploadProgress: number

  comments: CmsCommentWithAuthor[]
  commentMeta: CmsPaginationMeta
  commentError: string | null

  versions: CmsContentVersion[]
  versionError: string | null

  likedContentIds: Record<string, boolean>
  likeCounts: Record<string, number>
  contentLikes: CmsLikeWithUser[]
  contentLikesError: string | null

  seoRecords: Record<string, CmsSeo>
  seoError: string | null
  sitemapFeed: CmsSitemapFeedRow[]

  redirects: CmsRedirect[]
  redirectMeta: CmsPaginationMeta
  redirectError: string | null

  isFetching: boolean
  isCreating: boolean
  isUpdating: boolean
  isDeleting: boolean
}

const emptyMeta = (limit: number): CmsPaginationMeta => ({
  total: 0,
  page: 1,
  limit,
  totalPages: 0,
  hasNextPage: false,
  hasPrevPage: false,
})

const initialState: CmsState = {
  items: [],
  currentContent: null,
  contentMeta: emptyMeta(20),
  contentFilters: { ...DEFAULT_CONTENT_FILTERS },
  contentError: null,

  categories: [],
  currentCategory: null,
  categoryError: null,

  tags: [],
  tagError: null,

  mediaItems: [],
  currentMedia: null,
  mediaMeta: emptyMeta(30),
  mediaError: null,
  isUploading: false,
  uploadProgress: 0,

  comments: [],
  commentMeta: emptyMeta(20),
  commentError: null,

  versions: [],
  versionError: null,

  likedContentIds: {},
  likeCounts: {},
  contentLikes: [],
  contentLikesError: null,

  seoRecords: {},
  seoError: null,
  sitemapFeed: [],

  redirects: [],
  redirectMeta: emptyMeta(50),
  redirectError: null,

  isFetching: false,
  isCreating: false,
  isUpdating: false,
  isDeleting: false,
}

type ThunkConfig = { rejectValue: string; dispatch: AppDispatch; state: { cms: CmsState } }

async function resolveResponse<T>(
  promise: Promise<{ data: T | null; error: string | null; success: boolean; meta?: CmsPaginationMeta }>,
  rejectWithValue: (value: string) => unknown,
): Promise<{ data: T; meta?: CmsPaginationMeta }> {
  const response = await promise
  if (!response.success || response.data === null) {
    return rejectWithValue(response.error ?? 'Request failed.') as never
  }
  return { data: response.data, meta: response.meta }
}

function seoRecordKey(seo: CmsSeo): string {
  if (seo.content_id) return seo.content_id
  if (seo.category_id) return `cat:${seo.category_id}`
  return `path:${seo.custom_path}`
}

// ============= CONTENT THUNKS =============

export const loadContents = createAsyncThunk<
  {
    items: CmsContentDetail[]
    meta: CmsPaginationMeta
    filters: CmsListContentParams
    append: boolean
  },
  (Partial<CmsListContentParams> & { append?: boolean; replaceFilters?: boolean }) | undefined,
  ThunkConfig
>('cms/loadContents', async (overrides = {}, { getState, rejectWithValue }) => {
  try {
    const { append = false, replaceFilters = false, ...filterOverrides } = overrides
    // Public blog (and other “fresh” lists) must not inherit admin CMS filters
    // (category / author / type) left in the shared cms slice.
    const base = replaceFilters ? DEFAULT_CONTENT_FILTERS : getState().cms.contentFilters
    const params = parseOrThrow(listContentParamsSchema, {
      ...base,
      ...filterOverrides,
    })
    const result = await resolveResponse(cmsService.listContents(params), rejectWithValue)
    return {
      items: result.data,
      meta: result.meta ?? emptyMeta(params.limit),
      filters: params,
      append,
    }
  } catch (err) {
    return rejectWithValue(err instanceof Error ? err.message : 'Failed to load content.')
  }
})

export const loadContentById = createAsyncThunk<CmsContentDetail, string, ThunkConfig>(
  'cms/loadContentById',
  async (id, { rejectWithValue }) => {
    const result = await resolveResponse(cmsService.getContentById(id), rejectWithValue)
    return result.data
  },
)

export const loadContentBySlug = createAsyncThunk<CmsContentDetail, string, ThunkConfig>(
  'cms/loadContentBySlug',
  async (slug, { rejectWithValue }) => {
    const result = await resolveResponse(cmsService.getContentBySlug(slug), rejectWithValue)
    return result.data
  },
)

export const createContent = createAsyncThunk<CmsContentDetail, unknown, ThunkConfig>(
  'cms/createContent',
  async (payload, { rejectWithValue }) => {
    try {
      const validated = parseOrThrow(createContentSchema, payload) as CmsContentCreateInput
      const result = await resolveResponse(cmsService.createContent(validated), rejectWithValue)
      return result.data
    } catch (err) {
      return rejectWithValue(err instanceof Error ? err.message : 'Create failed.')
    }
  },
)

export const updateContent = createAsyncThunk<
  CmsContentDetail,
  { id: string; payload: unknown },
  ThunkConfig
>('cms/updateContent', async ({ id, payload }, { rejectWithValue }) => {
  try {
    const validated = parseOrThrow(updateContentSchema, payload) as CmsContentUpdateInput
    const result = await resolveResponse(cmsService.updateContent(id, validated), rejectWithValue)
    return result.data
  } catch (err) {
    return rejectWithValue(err instanceof Error ? err.message : 'Update failed.')
  }
})

export const publishContent = createAsyncThunk<
  CmsContentDetail,
  { id: string; publishedAt?: string | null },
  ThunkConfig
>('cms/publishContent', async ({ id, publishedAt = null }, { rejectWithValue }) => {
  const result = await resolveResponse(
    cmsService.publishContent(id, publishedAt),
    rejectWithValue,
  )
  return result.data
})

export const scheduleContent = createAsyncThunk<
  CmsContentDetail,
  { id: string; scheduledAt: string },
  ThunkConfig
>('cms/scheduleContent', async ({ id, scheduledAt }, { rejectWithValue }) => {
  const result = await resolveResponse(
    cmsService.scheduleContent(id, scheduledAt),
    rejectWithValue,
  )
  return result.data
})

export const archiveContent = createAsyncThunk<CmsContentDetail, string, ThunkConfig>(
  'cms/archiveContent',
  async (id, { rejectWithValue }) => {
    const result = await resolveResponse(cmsService.archiveContent(id), rejectWithValue)
    return result.data
  },
)

export const softDeleteContent = createAsyncThunk<string, string, ThunkConfig>(
  'cms/softDeleteContent',
  async (id, { rejectWithValue }) => {
    const response = await cmsService.softDeleteContent(id)
    if (!response.success) return rejectWithValue(response.error ?? 'Delete failed.')
    return id
  },
)

export const deleteContent = createAsyncThunk<string, string, ThunkConfig>(
  'cms/deleteContent',
  async (id, { rejectWithValue }) => {
    const response = await cmsService.deleteContent(id)
    if (!response.success) return rejectWithValue(response.error ?? 'Delete failed.')
    return id
  },
)

export const addGalleryItem = createAsyncThunk<
  CmsContentDetail | null,
  { contentId: string; mediaId: string; sortOrder?: number },
  ThunkConfig
>('cms/addGalleryItem', async ({ contentId, mediaId, sortOrder = 0 }, { rejectWithValue }) => {
  const response = await cmsService.addGalleryItem(contentId, mediaId, sortOrder)
  if (!response.success) return rejectWithValue(response.error ?? 'Failed to attach media.')
  const refreshed = await cmsService.getContentById(contentId)
  if (!refreshed.success) return null
  return refreshed.data
})

export const removeGalleryItem = createAsyncThunk<
  CmsContentDetail | null,
  { contentMediaId: string; contentId: string },
  ThunkConfig
>('cms/removeGalleryItem', async ({ contentMediaId, contentId }, { rejectWithValue }) => {
  const response = await cmsService.removeGalleryItem(contentMediaId)
  if (!response.success) return rejectWithValue(response.error ?? 'Failed to remove media.')
  const refreshed = await cmsService.getContentById(contentId)
  if (!refreshed.success) return null
  return refreshed.data
})

// ============= CATEGORY / TAG THUNKS =============

export const loadCategories = createAsyncThunk<CmsCategory[], void, ThunkConfig>(
  'cms/loadCategories',
  async (_, { rejectWithValue }) => {
    const result = await resolveResponse(cmsService.listCategories(), rejectWithValue)
    return result.data
  },
)

export const loadCategoryById = createAsyncThunk<CmsCategory, string, ThunkConfig>(
  'cms/loadCategoryById',
  async (id, { rejectWithValue }) => {
    const result = await resolveResponse(cmsService.getCategoryById(id), rejectWithValue)
    return result.data
  },
)

export const createCategory = createAsyncThunk<CmsCategory, unknown, ThunkConfig>(
  'cms/createCategory',
  async (payload, { rejectWithValue }) => {
    try {
      const validated = parseOrThrow(createCategorySchema, payload)
      const result = await resolveResponse(
        cmsService.createCategory(validated as Parameters<typeof cmsService.createCategory>[0]),
        rejectWithValue,
      )
      return result.data
    } catch (err) {
      return rejectWithValue(err instanceof Error ? err.message : 'Create failed.')
    }
  },
)

export const updateCategory = createAsyncThunk<
  CmsCategory,
  { id: string; payload: unknown },
  ThunkConfig
>('cms/updateCategory', async ({ id, payload }, { rejectWithValue }) => {
  try {
    const validated = parseOrThrow(updateCategorySchema, payload)
    const result = await resolveResponse(
      cmsService.updateCategory(id, validated),
      rejectWithValue,
    )
    return result.data
  } catch (err) {
    return rejectWithValue(err instanceof Error ? err.message : 'Update failed.')
  }
})

export const deleteCategory = createAsyncThunk<
  { id: string; mode: 'soft' | 'hard' },
  { id: string; mode?: 'soft' | 'hard' },
  ThunkConfig
>('cms/deleteCategory', async ({ id, mode = 'soft' }, { rejectWithValue }) => {
  const response =
    mode === 'hard' ? await cmsService.deleteCategory(id) : await cmsService.softDeleteCategory(id)
  if (!response.success) return rejectWithValue(response.error ?? 'Delete failed.')
  return { id, mode }
})

export const loadTags = createAsyncThunk<CmsTag[], void, ThunkConfig>(
  'cms/loadTags',
  async (_, { rejectWithValue }) => {
    const result = await resolveResponse(cmsService.listTags(), rejectWithValue)
    return result.data
  },
)

export const createTag = createAsyncThunk<CmsTag, unknown, ThunkConfig>(
  'cms/createTag',
  async (payload, { rejectWithValue }) => {
    try {
      const validated = parseOrThrow(createTagSchema, payload)
      const result = await resolveResponse(cmsService.createTag(validated), rejectWithValue)
      return result.data
    } catch (err) {
      return rejectWithValue(err instanceof Error ? err.message : 'Create failed.')
    }
  },
)

export const updateTag = createAsyncThunk<
  CmsTag,
  { id: string; payload: unknown },
  ThunkConfig
>('cms/updateTag', async ({ id, payload }, { rejectWithValue }) => {
  try {
    const validated = parseOrThrow(updateTagSchema, payload)
    const result = await resolveResponse(cmsService.updateTag(id, validated), rejectWithValue)
    return result.data
  } catch (err) {
    return rejectWithValue(err instanceof Error ? err.message : 'Update failed.')
  }
})

export const deleteTag = createAsyncThunk<string, string, ThunkConfig>(
  'cms/deleteTag',
  async (id, { rejectWithValue }) => {
    const response = await cmsService.deleteTag(id)
    if (!response.success) return rejectWithValue(response.error ?? 'Delete failed.')
    return id
  },
)

// ============= MEDIA THUNKS =============

export const loadMedia = createAsyncThunk<
  { items: CmsMedia[]; meta: CmsPaginationMeta },
  CmsListMediaParams | undefined,
  ThunkConfig
>('cms/loadMedia', async (params = {}, { rejectWithValue }) => {
  const result = await resolveResponse(cmsService.listMedia(params), rejectWithValue)
  return { items: result.data, meta: result.meta ?? emptyMeta(params.limit ?? 30) }
})

export const uploadMedia = createAsyncThunk<
  CmsMedia,
  { file: CmsMediaUploadFile; options?: CmsMediaUploadOptions },
  ThunkConfig
>('cms/uploadMedia', async ({ file, options }, { rejectWithValue }) => {
  const result = await resolveResponse(cmsService.uploadMedia(file, options), rejectWithValue)
  return result.data
})

export const updateMedia = createAsyncThunk<
  CmsMedia,
  { id: string; payload: CmsMediaUpdate },
  ThunkConfig
>('cms/updateMedia', async ({ id, payload }, { rejectWithValue }) => {
  const result = await resolveResponse(cmsService.updateMedia(id, payload), rejectWithValue)
  return result.data
})

export const deleteMedia = createAsyncThunk<string, string, ThunkConfig>(
  'cms/deleteMedia',
  async (id, { rejectWithValue }) => {
    const response = await cmsService.deleteMedia(id)
    if (!response.success) return rejectWithValue(response.error ?? 'Delete failed.')
    return id
  },
)

// ============= COMMENT / LIKE THUNKS =============

export const loadComments = createAsyncThunk<
  { comments: CmsCommentWithAuthor[]; meta: CmsPaginationMeta },
  unknown,
  ThunkConfig
>('cms/loadComments', async (params, { rejectWithValue }) => {
  try {
    const validated = parseOrThrow(listCommentsParamsSchema, params) as CmsListCommentsParams
    const result = await resolveResponse(cmsService.listComments(validated), rejectWithValue)
    return {
      comments: result.data,
      meta: result.meta ?? emptyMeta(validated.limit ?? 20),
    }
  } catch (err) {
    return rejectWithValue(err instanceof Error ? err.message : 'Failed to load comments.')
  }
})

export const createComment = createAsyncThunk<CmsCommentWithAuthor, unknown, ThunkConfig>(
  'cms/createComment',
  async (payload, { rejectWithValue }) => {
    try {
      const validated = parseOrThrow(createCommentSchema, payload)
      const result = await resolveResponse(cmsService.createComment(validated), rejectWithValue)
      return result.data
    } catch (err) {
      return rejectWithValue(err instanceof Error ? err.message : 'Create failed.')
    }
  },
)

export const updateComment = createAsyncThunk<
  CmsCommentWithAuthor,
  { id: string; body: string },
  ThunkConfig
>('cms/updateComment', async ({ id, body }, { rejectWithValue }) => {
  try {
    const { body: validBody } = parseOrThrow(updateCommentSchema, { body })
    const result = await resolveResponse(
      cmsService.updateComment(id, validBody),
      rejectWithValue,
    )
    return result.data
  } catch (err) {
    return rejectWithValue(err instanceof Error ? err.message : 'Update failed.')
  }
})

export const moderateComment = createAsyncThunk<
  CmsCommentWithAuthor,
  { id: string; payload: unknown },
  ThunkConfig
>('cms/moderateComment', async ({ id, payload }, { rejectWithValue }) => {
  try {
    const validated = parseOrThrow(moderateCommentSchema, payload)
    const result = await resolveResponse(
      cmsService.moderateComment(id, validated),
      rejectWithValue,
    )
    return result.data
  } catch (err) {
    return rejectWithValue(err instanceof Error ? err.message : 'Moderate failed.')
  }
})

export const softDeleteComment = createAsyncThunk<CmsCommentWithAuthor, string, ThunkConfig>(
  'cms/softDeleteComment',
  async (id, { rejectWithValue }) => {
    const result = await resolveResponse(cmsService.softDeleteComment(id), rejectWithValue)
    return result.data
  },
)

export const deleteComment = createAsyncThunk<string, string, ThunkConfig>(
  'cms/deleteComment',
  async (id, { rejectWithValue }) => {
    const response = await cmsService.deleteComment(id)
    if (!response.success) return rejectWithValue(response.error ?? 'Delete failed.')
    return id
  },
)

export const toggleLike = createAsyncThunk<
  { contentId: string; result: CmsLikeToggleResult },
  string,
  ThunkConfig
>('cms/toggleLike', async (contentId, { rejectWithValue }) => {
  const response = await cmsService.toggleLike(contentId)
  if (!response.success || !response.data) {
    return rejectWithValue(response.error ?? 'Like failed.')
  }
  return { contentId, result: response.data }
})

export const checkLike = createAsyncThunk<
  { contentId: string; liked: boolean },
  string,
  ThunkConfig
>('cms/checkLike', async (contentId, { rejectWithValue }) => {
  const response = await cmsService.checkLike(contentId)
  if (!response.success || !response.data) {
    return rejectWithValue(response.error ?? 'Check failed.')
  }
  return { contentId, liked: response.data.liked }
})

export const loadContentLikes = createAsyncThunk<CmsLikeWithUser[], string, ThunkConfig>(
  'cms/loadContentLikes',
  async (contentId, { rejectWithValue }) => {
    const result = await resolveResponse(cmsService.listContentLikes(contentId), rejectWithValue)
    return result.data
  },
)

// ============= VERSION / SEO / REDIRECT THUNKS =============

export const loadVersions = createAsyncThunk<CmsContentVersion[], string, ThunkConfig>(
  'cms/loadVersions',
  async (contentId, { rejectWithValue }) => {
    const result = await resolveResponse(cmsService.listVersions(contentId), rejectWithValue)
    return result.data
  },
)

export const restoreVersion = createAsyncThunk<CmsContentDetail, string, ThunkConfig>(
  'cms/restoreVersion',
  async (versionId, { rejectWithValue, dispatch }) => {
    const result = await resolveResponse(cmsService.restoreVersion(versionId), rejectWithValue)
    if (result.data.id) {
      void dispatch(loadVersions(result.data.id))
    }
    return result.data
  },
)

export const loadSeoByContentId = createAsyncThunk<CmsSeo | null, string, ThunkConfig>(
  'cms/loadSeoByContentId',
  async (contentId, { rejectWithValue }) => {
    const result = await resolveResponse(cmsService.getSeoByContentId(contentId), rejectWithValue)
    return result.data
  },
)

export const loadSeoByCategoryId = createAsyncThunk<
  { categoryId: string; seo: CmsSeo | null },
  string,
  ThunkConfig
>('cms/loadSeoByCategoryId', async (categoryId, { rejectWithValue }) => {
  const result = await resolveResponse(cmsService.getSeoByCategoryId(categoryId), rejectWithValue)
  return { categoryId, seo: result.data }
})

export const loadSeoByPath = createAsyncThunk<
  { path: string; seo: CmsSeo | null },
  string,
  ThunkConfig
>('cms/loadSeoByPath', async (path, { rejectWithValue }) => {
  const result = await resolveResponse(cmsService.getSeoByPath(path), rejectWithValue)
  return { path, seo: result.data }
})

export const upsertSeo = createAsyncThunk<CmsSeo, unknown, ThunkConfig>(
  'cms/upsertSeo',
  async (payload, { rejectWithValue }) => {
    try {
      const validated = parseOrThrow(createSeoSchema, payload)
      const result = await resolveResponse(
        cmsService.upsertSeo(validated as Parameters<typeof cmsService.upsertSeo>[0]),
        rejectWithValue,
      )
      return result.data
    } catch (err) {
      return rejectWithValue(err instanceof Error ? err.message : 'Upsert failed.')
    }
  },
)

export const updateSeo = createAsyncThunk<
  CmsSeo,
  { id: string; payload: unknown },
  ThunkConfig
>('cms/updateSeo', async ({ id, payload }, { rejectWithValue }) => {
  try {
    const validated = parseOrThrow(updateSeoSchema, payload)
    const result = await resolveResponse(
      cmsService.updateSeo(id, validated as Parameters<typeof cmsService.updateSeo>[1]),
      rejectWithValue,
    )
    return result.data
  } catch (err) {
    return rejectWithValue(err instanceof Error ? err.message : 'Update failed.')
  }
})

export const deleteSeo = createAsyncThunk<string, string, ThunkConfig>(
  'cms/deleteSeo',
  async (id, { rejectWithValue }) => {
    const response = await cmsService.deleteSeo(id)
    if (!response.success) return rejectWithValue(response.error ?? 'Delete failed.')
    return id
  },
)

export const loadSitemapFeed = createAsyncThunk<CmsSitemapFeedRow[], void, ThunkConfig>(
  'cms/loadSitemapFeed',
  async (_, { rejectWithValue }) => {
    const result = await resolveResponse(cmsService.getSitemapFeed(), rejectWithValue)
    return result.data
  },
)

export const loadRedirects = createAsyncThunk<
  { redirects: CmsRedirect[]; meta: CmsPaginationMeta },
  CmsListRedirectsParams | undefined,
  ThunkConfig
>('cms/loadRedirects', async (params = {}, { rejectWithValue }) => {
  const result = await resolveResponse(cmsService.listRedirects(params), rejectWithValue)
  return {
    redirects: result.data,
    meta: result.meta ?? emptyMeta(params.limit ?? 50),
  }
})

export const createRedirect = createAsyncThunk<CmsRedirect, unknown, ThunkConfig>(
  'cms/createRedirect',
  async (payload, { rejectWithValue }) => {
    try {
      const validated = parseOrThrow(createRedirectSchema, payload)
      const result = await resolveResponse(cmsService.createRedirect(validated), rejectWithValue)
      return result.data
    } catch (err) {
      return rejectWithValue(err instanceof Error ? err.message : 'Create failed.')
    }
  },
)

export const updateRedirect = createAsyncThunk<
  CmsRedirect,
  { id: string; payload: unknown },
  ThunkConfig
>('cms/updateRedirect', async ({ id, payload }, { rejectWithValue }) => {
  try {
    const validated = parseOrThrow(updateRedirectSchema, payload)
    const result = await resolveResponse(
      cmsService.updateRedirect(id, validated),
      rejectWithValue,
    )
    return result.data
  } catch (err) {
    return rejectWithValue(err instanceof Error ? err.message : 'Update failed.')
  }
})

export const toggleRedirectActive = createAsyncThunk<
  CmsRedirect,
  { id: string; isActive: boolean },
  ThunkConfig
>('cms/toggleRedirectActive', async ({ id, isActive }, { rejectWithValue }) => {
  const result = await resolveResponse(
    cmsService.setRedirectActive(id, isActive),
    rejectWithValue,
  )
  return result.data
})

export const deleteRedirect = createAsyncThunk<string, string, ThunkConfig>(
  'cms/deleteRedirect',
  async (id, { rejectWithValue }) => {
    const response = await cmsService.deleteRedirect(id)
    if (!response.success) return rejectWithValue(response.error ?? 'Delete failed.')
    return id
  },
)

// ============= SLICE =============

const cmsSlice = createSlice({
  name: 'cms',
  initialState,
  reducers: {
    clearCurrentContent(state) {
      state.currentContent = null
      state.contentError = null
      state.contentLikes = []
      state.contentLikesError = null
      state.comments = []
      state.versions = []
    },
    resetContentFilters(state) {
      state.contentFilters = { ...DEFAULT_CONTENT_FILTERS }
    },
    setCmsError(
      state,
      action: PayloadAction<{
        domain:
          | 'content'
          | 'category'
          | 'tag'
          | 'media'
          | 'comment'
          | 'version'
          | 'seo'
          | 'redirect'
        error: string | null
      }>,
    ) {
      const { domain, error } = action.payload
      if (domain === 'content') state.contentError = error
      if (domain === 'category') state.categoryError = error
      if (domain === 'tag') state.tagError = error
      if (domain === 'media') state.mediaError = error
      if (domain === 'comment') state.commentError = error
      if (domain === 'version') state.versionError = error
      if (domain === 'seo') state.seoError = error
      if (domain === 'redirect') state.redirectError = error
    },
    resetCms() {
      return initialState
    },
  },
  extraReducers: (builder) => {
    const setFetching = (state: CmsState) => {
      state.isFetching = true
    }
    const clearFetching = (state: CmsState) => {
      state.isFetching = false
    }

    // Content
    builder
      .addCase(loadContents.pending, (state, action) => {
        setFetching(state)
        state.contentError = null
        const { append: _append, replaceFilters, ...filters } = action.meta.arg ?? {}
        state.contentFilters = {
          ...(replaceFilters ? DEFAULT_CONTENT_FILTERS : state.contentFilters),
          ...filters,
        }
      })
      .addCase(loadContents.fulfilled, (state, action) => {
        clearFetching(state)
        state.items = action.payload.append
          ? [...state.items, ...action.payload.items]
          : action.payload.items
        state.contentMeta = action.payload.meta
        state.contentFilters = action.payload.filters
      })
      .addCase(loadContents.rejected, (state, action) => {
        clearFetching(state)
        state.contentError = action.payload ?? 'Failed to load content.'
        state.items = []
      })
      .addCase(loadContentById.pending, (state) => {
        setFetching(state)
        state.contentError = null
      })
      .addCase(loadContentById.fulfilled, (state, action) => {
        clearFetching(state)
        state.currentContent = action.payload
      })
      .addCase(loadContentById.rejected, (state, action) => {
        clearFetching(state)
        state.contentError = action.payload ?? 'Failed to load content.'
        state.currentContent = null
      })
      .addCase(loadContentBySlug.pending, (state) => {
        setFetching(state)
        state.contentError = null
      })
      .addCase(loadContentBySlug.fulfilled, (state, action) => {
        clearFetching(state)
        state.currentContent = action.payload
      })
      .addCase(loadContentBySlug.rejected, (state, action) => {
        clearFetching(state)
        state.contentError = action.payload ?? 'Failed to load content.'
        state.currentContent = null
      })
      .addCase(createContent.pending, (state) => {
        state.isCreating = true
        state.contentError = null
      })
      .addCase(createContent.fulfilled, (state, action) => {
        state.isCreating = false
        state.items = [action.payload, ...state.items]
      })
      .addCase(createContent.rejected, (state, action) => {
        state.isCreating = false
        state.contentError = action.payload ?? 'Create failed.'
      })
      .addCase(updateContent.pending, (state) => {
        state.isUpdating = true
        state.contentError = null
      })
      .addCase(updateContent.fulfilled, (state, action) => {
        state.isUpdating = false
        state.items = state.items.map((c) => (c.id === action.payload.id ? action.payload : c))
        if (state.currentContent?.id === action.payload.id) {
          state.currentContent = action.payload
        }
      })
      .addCase(updateContent.rejected, (state, action) => {
        state.isUpdating = false
        state.contentError = action.payload ?? 'Update failed.'
      })

    const applyContentMutation = (
      state: CmsState,
      action: { payload: CmsContentDetail },
    ) => {
      state.isUpdating = false
      state.items = state.items.map((c) => (c.id === action.payload.id ? action.payload : c))
      if (state.currentContent?.id === action.payload.id) {
        state.currentContent = action.payload
      }
    }

    builder
      .addCase(publishContent.pending, (state) => {
        state.isUpdating = true
        state.contentError = null
      })
      .addCase(publishContent.fulfilled, applyContentMutation)
      .addCase(publishContent.rejected, (state, action) => {
        state.isUpdating = false
        state.contentError = action.payload ?? 'Publish failed.'
      })
      .addCase(scheduleContent.pending, (state) => {
        state.isUpdating = true
        state.contentError = null
      })
      .addCase(scheduleContent.fulfilled, applyContentMutation)
      .addCase(scheduleContent.rejected, (state, action) => {
        state.isUpdating = false
        state.contentError = action.payload ?? 'Schedule failed.'
      })
      .addCase(archiveContent.pending, (state) => {
        state.isUpdating = true
        state.contentError = null
      })
      .addCase(archiveContent.fulfilled, applyContentMutation)
      .addCase(archiveContent.rejected, (state, action) => {
        state.isUpdating = false
        state.contentError = action.payload ?? 'Archive failed.'
      })
      .addCase(softDeleteContent.pending, (state) => {
        state.isDeleting = true
        state.contentError = null
      })
      .addCase(softDeleteContent.fulfilled, (state, action) => {
        state.isDeleting = false
        state.items = state.items.filter((c) => c.id !== action.payload)
        if (state.currentContent?.id === action.payload) state.currentContent = null
      })
      .addCase(softDeleteContent.rejected, (state, action) => {
        state.isDeleting = false
        state.contentError = action.payload ?? 'Delete failed.'
      })
      .addCase(deleteContent.pending, (state) => {
        state.isDeleting = true
        state.contentError = null
      })
      .addCase(deleteContent.fulfilled, (state, action) => {
        state.isDeleting = false
        state.items = state.items.filter((c) => c.id !== action.payload)
        if (state.currentContent?.id === action.payload) state.currentContent = null
      })
      .addCase(deleteContent.rejected, (state, action) => {
        state.isDeleting = false
        state.contentError = action.payload ?? 'Delete failed.'
      })
      .addCase(addGalleryItem.fulfilled, (state, action) => {
        if (action.payload) state.currentContent = action.payload
      })
      .addCase(removeGalleryItem.fulfilled, (state, action) => {
        if (action.payload) state.currentContent = action.payload
      })

    // Categories / tags
    builder
      .addCase(loadCategories.pending, (state) => {
        setFetching(state)
        state.categoryError = null
      })
      .addCase(loadCategories.fulfilled, (state, action) => {
        clearFetching(state)
        state.categories = action.payload
      })
      .addCase(loadCategories.rejected, (state, action) => {
        clearFetching(state)
        state.categoryError = action.payload ?? 'Failed to load categories.'
        state.categories = []
      })
      .addCase(loadCategoryById.fulfilled, (state, action) => {
        clearFetching(state)
        state.currentCategory = action.payload
      })
      .addCase(createCategory.pending, (state) => {
        state.isCreating = true
        state.categoryError = null
      })
      .addCase(createCategory.fulfilled, (state, action) => {
        state.isCreating = false
        state.categories = [...state.categories, action.payload]
      })
      .addCase(createCategory.rejected, (state, action) => {
        state.isCreating = false
        state.categoryError = action.payload ?? 'Create failed.'
      })
      .addCase(updateCategory.pending, (state) => {
        state.isUpdating = true
        state.categoryError = null
      })
      .addCase(updateCategory.fulfilled, (state, action) => {
        state.isUpdating = false
        state.categories = state.categories.map((c) =>
          c.id === action.payload.id ? action.payload : c,
        )
        if (state.currentCategory?.id === action.payload.id) {
          state.currentCategory = action.payload
        }
      })
      .addCase(updateCategory.rejected, (state, action) => {
        state.isUpdating = false
        state.categoryError = action.payload ?? 'Update failed.'
      })
      .addCase(deleteCategory.pending, (state) => {
        state.isDeleting = true
        state.categoryError = null
      })
      .addCase(deleteCategory.fulfilled, (state, action) => {
        state.isDeleting = false
        if (action.payload.mode === 'hard') {
          state.categories = state.categories.filter((c) => c.id !== action.payload.id)
        } else {
          state.categories = state.categories.map((c) =>
            c.id === action.payload.id ? { ...c, is_active: false } : c,
          )
        }
      })
      .addCase(deleteCategory.rejected, (state, action) => {
        state.isDeleting = false
        state.categoryError = action.payload ?? 'Delete failed.'
      })
      .addCase(loadTags.pending, (state) => {
        setFetching(state)
        state.tagError = null
      })
      .addCase(loadTags.fulfilled, (state, action) => {
        clearFetching(state)
        state.tags = action.payload
      })
      .addCase(loadTags.rejected, (state, action) => {
        clearFetching(state)
        state.tagError = action.payload ?? 'Failed to load tags.'
        state.tags = []
      })
      .addCase(createTag.fulfilled, (state, action) => {
        state.isCreating = false
        state.tags = [...state.tags, action.payload]
      })
      .addCase(createTag.pending, (state) => {
        state.isCreating = true
        state.tagError = null
      })
      .addCase(createTag.rejected, (state, action) => {
        state.isCreating = false
        state.tagError = action.payload ?? 'Create failed.'
      })
      .addCase(updateTag.fulfilled, (state, action) => {
        state.isUpdating = false
        state.tags = state.tags.map((t) => (t.id === action.payload.id ? action.payload : t))
      })
      .addCase(updateTag.pending, (state) => {
        state.isUpdating = true
        state.tagError = null
      })
      .addCase(updateTag.rejected, (state, action) => {
        state.isUpdating = false
        state.tagError = action.payload ?? 'Update failed.'
      })
      .addCase(deleteTag.fulfilled, (state, action) => {
        state.isDeleting = false
        state.tags = state.tags.filter((t) => t.id !== action.payload)
      })
      .addCase(deleteTag.pending, (state) => {
        state.isDeleting = true
        state.tagError = null
      })
      .addCase(deleteTag.rejected, (state, action) => {
        state.isDeleting = false
        state.tagError = action.payload ?? 'Delete failed.'
      })

    // Media
    builder
      .addCase(loadMedia.pending, (state) => {
        setFetching(state)
        state.mediaError = null
      })
      .addCase(loadMedia.fulfilled, (state, action) => {
        clearFetching(state)
        state.mediaItems = action.payload.items
        state.mediaMeta = action.payload.meta
      })
      .addCase(loadMedia.rejected, (state, action) => {
        clearFetching(state)
        state.mediaError = action.payload ?? 'Failed to load media.'
        state.mediaItems = []
      })
      .addCase(uploadMedia.pending, (state) => {
        state.isUploading = true
        state.uploadProgress = 0
        state.mediaError = null
      })
      .addCase(uploadMedia.fulfilled, (state, action) => {
        state.isUploading = false
        state.uploadProgress = 100
        state.mediaItems = [action.payload, ...state.mediaItems]
      })
      .addCase(uploadMedia.rejected, (state, action) => {
        state.isUploading = false
        state.mediaError = action.payload ?? 'Upload failed.'
      })
      .addCase(updateMedia.fulfilled, (state, action) => {
        state.isUpdating = false
        state.mediaItems = state.mediaItems.map((m) =>
          m.id === action.payload.id ? action.payload : m,
        )
        if (state.currentMedia?.id === action.payload.id) {
          state.currentMedia = action.payload
        }
      })
      .addCase(deleteMedia.fulfilled, (state, action) => {
        state.isDeleting = false
        state.mediaItems = state.mediaItems.filter((m) => m.id !== action.payload)
        if (state.currentMedia?.id === action.payload) state.currentMedia = null
      })

    // Comments / likes
    builder
      .addCase(loadComments.pending, (state) => {
        setFetching(state)
        state.commentError = null
      })
      .addCase(loadComments.fulfilled, (state, action) => {
        clearFetching(state)
        state.comments = action.payload.comments
        state.commentMeta = action.payload.meta
      })
      .addCase(loadComments.rejected, (state, action) => {
        clearFetching(state)
        state.commentError = action.payload ?? 'Failed to load comments.'
        state.comments = []
      })
      .addCase(createComment.fulfilled, (state, action) => {
        state.isCreating = false
        state.comments = [...state.comments, action.payload]
      })
      .addCase(createComment.pending, (state) => {
        state.isCreating = true
        state.commentError = null
      })
      .addCase(createComment.rejected, (state, action) => {
        state.isCreating = false
        state.commentError = action.payload ?? 'Create failed.'
      })
      .addCase(updateComment.fulfilled, (state, action) => {
        state.isUpdating = false
        state.comments = state.comments.map((c) =>
          c.id === action.payload.id ? action.payload : c,
        )
      })
      .addCase(moderateComment.fulfilled, (state, action) => {
        state.isUpdating = false
        state.comments = state.comments.map((c) =>
          c.id === action.payload.id ? action.payload : c,
        )
      })
      .addCase(softDeleteComment.fulfilled, (state, action) => {
        state.comments = state.comments.map((c) =>
          c.id === action.payload.id ? action.payload : c,
        )
      })
      .addCase(deleteComment.fulfilled, (state, action) => {
        state.isDeleting = false
        state.comments = state.comments.filter((c) => c.id !== action.payload)
      })
      .addCase(toggleLike.pending, (state, action) => {
        const contentId = action.meta.arg
        const wasLiked = !!state.likedContentIds[contentId]
        const currentCount = state.likeCounts[contentId] ?? 0
        state.likedContentIds[contentId] = !wasLiked
        state.likeCounts[contentId] = wasLiked
          ? Math.max(currentCount - 1, 0)
          : currentCount + 1
      })
      .addCase(toggleLike.fulfilled, (state, action) => {
        const { contentId, result } = action.payload
        state.likedContentIds[contentId] = result.liked
        state.likeCounts[contentId] = result.like_count
      })
      .addCase(toggleLike.rejected, (state, action) => {
        const contentId = action.meta.arg
        const wasLiked = !!state.likedContentIds[contentId]
        const currentCount = state.likeCounts[contentId] ?? 0
        // Invert the optimistic flip
        state.likedContentIds[contentId] = !wasLiked
        state.likeCounts[contentId] = wasLiked
          ? Math.max(currentCount - 1, 0)
          : currentCount + 1
      })
      .addCase(checkLike.fulfilled, (state, action) => {
        state.likedContentIds[action.payload.contentId] = action.payload.liked
      })
      .addCase(loadContentLikes.pending, (state) => {
        state.contentLikesError = null
      })
      .addCase(loadContentLikes.fulfilled, (state, action) => {
        state.contentLikes = action.payload
      })
      .addCase(loadContentLikes.rejected, (state, action) => {
        state.contentLikesError = action.payload ?? 'Failed to load likes.'
        state.contentLikes = []
      })

    // Versions / SEO / redirects
    builder
      .addCase(loadVersions.pending, (state) => {
        setFetching(state)
        state.versionError = null
      })
      .addCase(loadVersions.fulfilled, (state, action) => {
        clearFetching(state)
        state.versions = action.payload
      })
      .addCase(loadVersions.rejected, (state, action) => {
        clearFetching(state)
        state.versionError = action.payload ?? 'Failed to load versions.'
        state.versions = []
      })
      .addCase(restoreVersion.pending, (state) => {
        state.isUpdating = true
        state.versionError = null
      })
      .addCase(restoreVersion.fulfilled, (state, action) => {
        state.isUpdating = false
        if (state.currentContent?.id === action.payload.id) {
          state.currentContent = action.payload
        }
        state.items = state.items.map((c) =>
          c.id === action.payload.id ? action.payload : c,
        )
      })
      .addCase(restoreVersion.rejected, (state, action) => {
        state.isUpdating = false
        state.versionError = action.payload ?? 'Restore failed.'
      })
      .addCase(loadSeoByContentId.fulfilled, (state, action) => {
        clearFetching(state)
        if (action.payload) {
          state.seoRecords[action.payload.content_id ?? action.meta.arg] = action.payload
        }
      })
      .addCase(loadSeoByCategoryId.fulfilled, (state, action) => {
        clearFetching(state)
        if (action.payload.seo) {
          state.seoRecords[`cat:${action.payload.categoryId}`] = action.payload.seo
        }
      })
      .addCase(loadSeoByPath.fulfilled, (state, action) => {
        clearFetching(state)
        if (action.payload.seo) {
          state.seoRecords[`path:${action.payload.path}`] = action.payload.seo
        }
      })
      .addCase(upsertSeo.fulfilled, (state, action) => {
        state.isUpdating = false
        state.seoRecords[seoRecordKey(action.payload)] = action.payload
      })
      .addCase(updateSeo.fulfilled, (state, action) => {
        state.isUpdating = false
        state.seoRecords[seoRecordKey(action.payload)] = action.payload
      })
      .addCase(deleteSeo.fulfilled, (state, action) => {
        state.isDeleting = false
        for (const key of Object.keys(state.seoRecords)) {
          if (state.seoRecords[key]?.id === action.payload) {
            delete state.seoRecords[key]
          }
        }
      })
      .addCase(loadSitemapFeed.fulfilled, (state, action) => {
        clearFetching(state)
        state.sitemapFeed = action.payload
      })
      .addCase(loadRedirects.fulfilled, (state, action) => {
        clearFetching(state)
        state.redirects = action.payload.redirects
        state.redirectMeta = action.payload.meta
      })
      .addCase(createRedirect.fulfilled, (state, action) => {
        state.isCreating = false
        state.redirects = [action.payload, ...state.redirects]
      })
      .addCase(updateRedirect.fulfilled, (state, action) => {
        state.isUpdating = false
        state.redirects = state.redirects.map((r) =>
          r.id === action.payload.id ? action.payload : r,
        )
      })
      .addCase(toggleRedirectActive.fulfilled, (state, action) => {
        state.redirects = state.redirects.map((r) =>
          r.id === action.payload.id ? action.payload : r,
        )
      })
      .addCase(deleteRedirect.fulfilled, (state, action) => {
        state.isDeleting = false
        state.redirects = state.redirects.filter((r) => r.id !== action.payload)
      })
  },
})

export const { clearCurrentContent, resetContentFilters, setCmsError, resetCms } = cmsSlice.actions
export const cmsReducer = cmsSlice.reducer
