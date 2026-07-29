import type {
  CmsBodyFormat,
  CmsContent,
  CmsMediaType,
  CmsPaginationMeta,
  CmsServiceResponse,
} from '~/lib/cms/cms.type'

// ============= SLUG =============

/** Converts any string to a URL-friendly slug. */
export function generateSlug(text: string | null | undefined): string {
  if (!text || typeof text !== 'string') return ''
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

/** Appends a short timestamp suffix to make a slug unique. */
export function uniquifySlug(base: string): string {
  const suffix = Date.now().toString(36)
  return `${base}-${suffix}`
}

// ============= SEO SCORE (0 – 100) =============

type SeoScoreInput = Partial<
  Pick<
    CmsContent,
    | 'title'
    | 'seo_title'
    | 'seo_description'
    | 'focus_keyword'
    | 'body'
    | 'cover_image_id'
    | 'og_image_id'
    | 'schema_org'
    | 'canonical_url'
    | 'sitemap_exclude'
  >
>

/**
 * Lightweight front-end SEO score for a `cms_content` row.
 * Stored in `seo_score` by the service layer.
 */
export function calculateSeoScore(content: SeoScoreInput = {}): number {
  let score = 0

  const {
    title = '',
    seo_title,
    seo_description,
    focus_keyword,
    body = '',
    cover_image_id,
    og_image_id,
    schema_org,
    canonical_url,
    sitemap_exclude,
  } = content

  if (title && title.length >= 10 && title.length <= 160) score += 15
  if (seo_title?.trim()) score += 10
  if (seo_description?.trim()) score += 10

  if (focus_keyword?.trim()) {
    score += 10
    const kw = focus_keyword.toLowerCase()
    if (title.toLowerCase().includes(kw)) score += 10
    if (body && body.slice(0, 300).toLowerCase().includes(kw)) score += 10
  }

  if (body && body.replace(/\s+/g, ' ').length >= 300) score += 10
  if (cover_image_id) score += 5
  if (og_image_id) score += 5
  if (Array.isArray(schema_org) && schema_org.length > 0) score += 5
  if (canonical_url) score += 5
  if (!sitemap_exclude) score += 5

  return Math.min(score, 100)
}

// ============= META TAG BUILDER =============

export type CmsMetaTags = {
  title: string
  description: string
  keywords: string
  canonical: string
  robots: string
  openGraph: {
    title: string
    description: string
    url: string
    type: string
    publishedTime: string | null | undefined
  }
  twitter: {
    card: string
    title: string
    description: string
  }
  schemaOrg: unknown
}

/** Builds a flat meta-tag descriptor for page heads / generateMetadata. */
export function buildMetaTags(
  content: Partial<{
    title: string | null
    slug: string | null
    excerpt: string | null
    published_at: string | null
    seo_title: string | null
    seo_description: string | null
    seo_keywords: string[] | null
    canonical_url: string | null
    og_title: string | null
    og_description: string | null
    og_type: string | null
    twitter_card: string | null
    twitter_title: string | null
    twitter_description: string | null
    robots_index: boolean | null
    robots_follow: boolean | null
    robots_extra: string | null
    schema_org: unknown
  }> = {},
  baseUrl = '',
): CmsMetaTags {
  const {
    title,
    slug,
    excerpt,
    published_at,
    seo_title,
    seo_description,
    seo_keywords,
    canonical_url,
    og_title,
    og_description,
    og_type = 'article',
    twitter_card = 'summary_large_image',
    twitter_title,
    twitter_description,
    robots_index = true,
    robots_follow = true,
    robots_extra,
    schema_org = [],
  } = content

  const metaTitle = seo_title || title || ''
  const metaDesc = seo_description || excerpt || ''
  const url = canonical_url || (slug ? `${baseUrl}/content/${slug}` : baseUrl)

  const robotsParts = [
    robots_index ? 'index' : 'noindex',
    robots_follow ? 'follow' : 'nofollow',
    robots_extra,
  ].filter(Boolean)

  return {
    title: metaTitle,
    description: metaDesc,
    keywords: Array.isArray(seo_keywords) ? seo_keywords.join(', ') : '',
    canonical: url,
    robots: robotsParts.join(', '),
    openGraph: {
      title: og_title || metaTitle,
      description: og_description || metaDesc,
      url,
      type: og_type ?? 'article',
      publishedTime: published_at,
    },
    twitter: {
      card: twitter_card ?? 'summary_large_image',
      title: twitter_title || metaTitle,
      description: twitter_description || metaDesc,
    },
    schemaOrg: schema_org,
  }
}

// ============= PAGINATION =============

export function pageToRange(page = 1, limit = 20): { from: number; to: number } {
  const from = (page - 1) * limit
  const to = from + limit - 1
  return { from, to }
}

export function buildPaginationMeta(total = 0, page = 1, limit = 20): CmsPaginationMeta {
  const totalPages = Math.ceil(total / limit) || 0
  return {
    total,
    page,
    limit,
    totalPages,
    hasNextPage: page < totalPages,
    hasPrevPage: page > 1,
  }
}

// ============= CONTENT HELPERS =============

export function isPublished(content: Pick<CmsContent, 'status' | 'deleted_at'> | null | undefined): boolean {
  return content?.status === 'published' && content?.deleted_at == null
}

export function stripHtml(html = ''): string {
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function autoExcerpt(
  body = '',
  format: CmsBodyFormat | string = 'markdown',
  maxLen = 200,
): string {
  if (!body) return ''
  let text = body
  if (format === 'html') {
    text = stripHtml(body)
  } else if (format === 'markdown') {
    text = body
      .replace(/#{1,6}\s+/g, '')
      .replace(/\*{1,2}(.*?)\*{1,2}/g, '$1')
      .replace(/`[^`]*`/g, '')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .replace(/\n+/g, ' ')
      .trim()
  }
  if (text.length <= maxLen) return text
  return `${text.slice(0, maxLen).replace(/\s\S*$/, '')}…`
}

// ============= MEDIA HELPERS =============

export function mimeToMediaType(mime = ''): CmsMediaType {
  if (mime.startsWith('image/')) return 'image'
  if (mime.startsWith('video/')) return 'video'
  if (mime.startsWith('audio/')) return 'audio'
  if (
    mime === 'application/pdf' ||
    mime.includes('word') ||
    mime.includes('excel') ||
    mime.includes('spreadsheet') ||
    mime.includes('presentation') ||
    mime === 'application/zip'
  ) {
    return 'document'
  }
  return 'other'
}

export function buildStorageUrl(
  supabaseUrl: string | null | undefined,
  bucket: string | null | undefined,
  storagePath: string | null | undefined,
): string {
  if (!supabaseUrl || !bucket || !storagePath) return ''
  return `${supabaseUrl}/storage/v1/object/public/${bucket}/${storagePath}`
}

/**
 * Legacy uploads sometimes omitted a slash between userId and folder
 * (`…/uuiduploads/…`). Prefer the repaired path when building display URLs.
 */
export function repairCmsMediaUrl(url: string | null | undefined): string {
  if (!url) return ''
  return url.replace(
    /\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})(?=[A-Za-z0-9_-])/i,
    '/$1/',
  )
}

/** Cover join can arrive as an object or a one-element array depending on PostgREST. */
export function normalizeCoverMedia(
  cover: unknown,
): { id: string; public_url: string | null; alt_text: string | null; width: number | null; height: number | null } | null {
  if (!cover) return null
  const row = Array.isArray(cover) ? cover[0] : cover
  if (!row || typeof row !== 'object') return null
  const media = row as {
    id?: string
    public_url?: string | null
    alt_text?: string | null
    width?: number | null
    height?: number | null
  }
  if (!media.id) return null
  return {
    id: media.id,
    public_url: media.public_url ?? null,
    alt_text: media.alt_text ?? null,
    width: media.width ?? null,
    height: media.height ?? null,
  }
}

/** Raw cover URL from content (normalize join shape). Path repair happens in CmsCoverImage. */
export function getContentCoverUrl(content: {
  cover_media?: unknown
  cover_image_id?: string | null
}): string {
  const media = normalizeCoverMedia(content.cover_media)
  return media?.public_url?.trim() || ''
}

/** Card/detail teaser when `excerpt` is empty (common in migrated CMS rows). */
export function getContentTeaser(
  content: {
    excerpt?: string | null
    seo_description?: string | null
    og_description?: string | null
    body?: string | null
    body_format?: string | null
  },
  maxLen = 160,
): string {
  const excerpt = content.excerpt?.trim()
  if (excerpt) return excerpt

  const seo = content.seo_description?.trim()
  if (seo) return seo.length > maxLen ? `${seo.slice(0, maxLen).replace(/\s\S*$/, '')}…` : seo

  const og = content.og_description?.trim()
  if (og) return og.length > maxLen ? `${og.slice(0, maxLen).replace(/\s\S*$/, '')}…` : og

  if (content.body) {
    const cleaned = content.body
      .replace(/:::[\w-]+/g, '')
      .replace(/:::/g, '')
      .trim()
    return autoExcerpt(cleaned, content.body_format ?? 'markdown', maxLen)
  }
  return ''
}

/** Strip CMS editor directives for plain display. */
export function cleanCmsBody(body: string | null | undefined): string {
  if (!body) return ''
  return body
    .replace(/:::[\w-]+\s*/g, '')
    .replace(/:::/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

// ============= SEARCH / TAGS =============

/** Converts a user search term into a Postgres websearch-compatible string. */
export function buildFtsQuery(term = ''): string {
  const cleaned = term.trim().replace(/[^\w\s]/g, '')
  const words = cleaned.split(/\s+/).filter(Boolean)
  if (!words.length) return ''
  return words.map((w) => (w.length < 3 ? `${w}:*` : w)).join(' & ')
}

export function diffTagIds(
  existingIds: string[] = [],
  newIds: string[] = [],
): { toAdd: string[]; toRemove: string[] } {
  const existing = new Set(existingIds)
  const desired = new Set(newIds)
  return {
    toAdd: [...desired].filter((id) => !existing.has(id)),
    toRemove: [...existing].filter((id) => !desired.has(id)),
  }
}

// ============= RESPONSE HELPERS =============

export function ok<T>(data: T, meta?: CmsPaginationMeta): CmsServiceResponse<T> {
  return meta !== undefined
    ? { success: true, data, error: null, meta }
    : { success: true, data, error: null }
}

export function fail<T>(err: unknown, data: T | null = null): CmsServiceResponse<T> {
  const message =
    err instanceof Error ? err.message : typeof err === 'string' ? err : 'Unknown error'
  return { success: false, error: message, data }
}

export function toMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  if (typeof error === 'string') return error
  return 'Something went wrong.'
}
