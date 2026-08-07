import type { Database, Tables, TablesInsert, TablesUpdate } from '~/lib/supabase'

/**
 * Shared shape returned by every CMS service call.
 * Mirrors the profile / shop `ServiceResponse` helper.
 */
export type CmsServiceResponse<T> = {
  data: T | null
  error: string | null
  success: boolean
  meta?: CmsPaginationMeta
}

export type CmsPaginationMeta = {
  total: number
  page: number
  limit: number
  totalPages: number
  hasNextPage: boolean
  hasPrevPage: boolean
}

// ============= TABLE ROW TYPES =============

export type CmsCategory = Tables<'cms_categories'>
export type CmsCategoryInsert = TablesInsert<'cms_categories'>
export type CmsCategoryUpdate = TablesUpdate<'cms_categories'>

export type CmsTag = Tables<'cms_tags'>
export type CmsTagInsert = TablesInsert<'cms_tags'>
export type CmsTagUpdate = TablesUpdate<'cms_tags'>

export type CmsMedia = Tables<'cms_media'>
export type CmsMediaInsert = TablesInsert<'cms_media'>
export type CmsMediaUpdate = TablesUpdate<'cms_media'>

export type CmsContent = Tables<'cms_content'>
export type CmsContentInsert = TablesInsert<'cms_content'>
export type CmsContentUpdate = TablesUpdate<'cms_content'>

export type CmsContentTagMap = Tables<'cms_content_tag_map'>
export type CmsContentMedia = Tables<'cms_content_media'>
export type CmsContentVersion = Tables<'cms_content_versions'>
export type CmsContentVersionInsert = TablesInsert<'cms_content_versions'>

export type CmsComment = Tables<'cms_blog_comments'>
export type CmsCommentInsert = TablesInsert<'cms_blog_comments'>
export type CmsCommentUpdate = TablesUpdate<'cms_blog_comments'>

export type CmsLike = Tables<'cms_blog_likes'>

export type CmsSeo = Tables<'cms_seo'>
export type CmsSeoInsert = TablesInsert<'cms_seo'>
export type CmsSeoUpdate = TablesUpdate<'cms_seo'>

export type CmsRedirect = Tables<'cms_seo_redirects'>
export type CmsRedirectInsert = TablesInsert<'cms_seo_redirects'>
export type CmsRedirectUpdate = TablesUpdate<'cms_seo_redirects'>

export type CmsSitemapFeedRow = Database['public']['Views']['cms_sitemap_feed']['Row']

export type CmsContentType = Database['public']['Enums']['cms_content_type']
export type CmsContentStatus = Database['public']['Enums']['cms_content_status']
export type CmsMediaType = Database['public']['Enums']['cms_media_type']

// ============= JOIN / UI SHAPES =============

export type CmsCategoryRef = Pick<CmsCategory, 'id' | 'name' | 'slug'>
export type CmsMediaRef = Pick<CmsMedia, 'id' | 'public_url' | 'alt_text' | 'width' | 'height'>
export type CmsTagRef = Pick<CmsTag, 'id' | 'name' | 'slug'>

export type CmsProfileRef = {
  id: string
  full_name: string | null
  username: string | null
  avatar_url: string | null
}

export type CmsCommentAuthor = CmsProfileRef

export type CmsCommentWithAuthor = CmsComment & {
  author: CmsCommentAuthor | null
}

/** Like row joined with the liker's profile (admin engagement views). */
export type CmsLikeWithUser = CmsLike & {
  user: CmsProfileRef | null
}

export type CmsGalleryItem = CmsContentMedia & {
  cms_media: CmsMedia | null
}

export type CmsContentTagLink = {
  tag_id: string
  cms_tags?: CmsTagRef | null
}

/** Content row with common joins used by list / detail queries. */
export type CmsContentDetail = CmsContent & {
  author?: CmsProfileRef | null
  cms_categories?: CmsCategoryRef | null
  cover_media?: CmsMediaRef | null
  cms_content_tag_map?: CmsContentTagLink[]
  cms_content_media?: CmsGalleryItem[]
}

export type CmsBodyFormat = 'markdown' | 'html' | 'plain'
export type CmsOgType = 'article' | 'website' | 'product' | 'profile'
export type CmsTwitterCard = 'summary' | 'summary_large_image' | 'app' | 'player'
export type CmsSitemapChangefreq =
  | 'always'
  | 'hourly'
  | 'daily'
  | 'weekly'
  | 'monthly'
  | 'yearly'
  | 'never'

export type CmsMediaBucket = 'cms-media' | 'cms-private'

/** Create payload accepted by the content service (includes front-end-only `tag_ids`). */
export type CmsContentCreateInput = Omit<
  CmsContentInsert,
  'id' | 'author_id' | 'created_at' | 'updated_at' | 'view_count' | 'like_count' | 'comment_count'
> & {
  tag_ids?: string[]
  change_note?: string | null
}

export type CmsContentUpdateInput = CmsContentUpdate & {
  tag_ids?: string[]
  change_note?: string | null
}

export type CmsListContentParams = {
  type?: CmsContentType
  status?: CmsContentStatus
  category_id?: string
  author_id?: string
  vendor_id?: string
  is_featured?: boolean
  search?: string
  tag_ids?: string[]
  page?: number
  limit?: number
  order_by?: 'created_at' | 'published_at' | 'updated_at' | 'like_count' | 'view_count'
  ascending?: boolean
}

export type CmsListMediaParams = {
  folder?: string
  media_type?: CmsMediaType
  page?: number
  limit?: number
}

export type CmsListCommentsParams = {
  content_id?: string
  parent_id?: string | null
  is_approved?: boolean
  is_flagged?: boolean
  search?: string
  page?: number
  limit?: number
}

export type CmsListRedirectsParams = {
  page?: number
  limit?: number
}

export type CmsMediaUploadOptions = {
  folder?: string
  bucket?: CmsMediaBucket
  alt_text?: string
  caption?: string
}

export type CmsMediaUploadFile = {
  blob: Blob | File
  mimeType: string
  fileName: string
  fileSize: number
}

export type CmsLikeToggleResult = {
  liked: boolean
  like_count: number
}

export type CmsValidationResult = {
  isValid: boolean
  errors: string[]
}

// ============= CONSTANTS =============

export const CMS_CONTENT_TYPES = {
  POST: 'post',
  PAGE: 'page',
  PRODUCT: 'product',
  ANNOUNCEMENT: 'announcement',
} as const satisfies Record<string, CmsContentType>

export const CMS_CONTENT_STATUSES = {
  DRAFT: 'draft',
  REVIEW: 'review',
  SCHEDULED: 'scheduled',
  PUBLISHED: 'published',
  ARCHIVED: 'archived',
} as const satisfies Record<string, CmsContentStatus>

export const CMS_MEDIA_TYPES = {
  IMAGE: 'image',
  VIDEO: 'video',
  DOCUMENT: 'document',
  AUDIO: 'audio',
  OTHER: 'other',
} as const satisfies Record<string, CmsMediaType>

export const CMS_BODY_FORMATS = ['markdown', 'html', 'plain'] as const
export const CMS_OG_TYPES = ['article', 'website', 'product', 'profile'] as const
export const CMS_TWITTER_CARDS = [
  'summary',
  'summary_large_image',
  'app',
  'player',
] as const
export const CMS_SITEMAP_CHANGEFREQS = [
  'always',
  'hourly',
  'daily',
  'weekly',
  'monthly',
  'yearly',
  'never',
] as const
export const CMS_REDIRECT_CODES = [301, 302, 307, 308, 410] as const

/** Public + private Supabase Storage buckets for CMS media. */
export const CMS_MEDIA_BUCKETS = {
  PUBLIC: 'cms-media',
  PRIVATE: 'cms-private',
} as const satisfies Record<string, CmsMediaBucket>

export const CMS_VALIDATION = {
  CATEGORY_NAME: { MIN: 1, MAX: 100 },
  CATEGORY_SLUG: { MAX: 120 },
  CATEGORY_DESCRIPTION: { MAX: 2000 },
  TAG_NAME: { MIN: 1, MAX: 60 },
  TAG_SLUG: { MAX: 80 },
  CONTENT_TITLE: { MIN: 1, MAX: 300 },
  CONTENT_SLUG: { MAX: 320 },
  CONTENT_EXCERPT: { MAX: 1000 },
  SEO_TITLE: { MAX: 160 },
  SEO_DESCRIPTION: { MAX: 320 },
  FOCUS_KEYWORD: { MAX: 100 },
  COMMENT_BODY: { MIN: 1, MAX: 2000 },
  META_TITLE: { MIN: 1, MAX: 60 },
  META_DESCRIPTION: { MAX: 160 },
  REDIRECT_PATH: { MAX: 500 },
  NOTE: { MAX: 500 },
} as const

export const DEFAULT_CONTENT_FILTERS: Required<
  Pick<CmsListContentParams, 'page' | 'limit' | 'order_by' | 'ascending'>
> &
  Omit<CmsListContentParams, 'page' | 'limit' | 'order_by' | 'ascending'> = {
  type: undefined,
  status: undefined,
  category_id: undefined,
  author_id: undefined,
  vendor_id: undefined,
  is_featured: undefined,
  search: '',
  tag_ids: undefined,
  page: 1,
  limit: 20,
  order_by: 'created_at',
  ascending: false,
}
