/**
 * CMS service — typed data-access layer for all CMS tables.
 *
 * Ported from the legacy class-based `cms-service.js` into flat functions
 * (same pattern as `profile.service` / `shop.service`). UI code should
 * dispatch store thunks rather than calling these directly.
 */

import { supabase } from '~/lib/supabase'
import { getStoragePublicUrl, uploadStorageObject } from '~/lib/supabase/storage-upload'

import {
  CMS_MEDIA_BUCKETS,
  type CmsCategory,
  type CmsCommentWithAuthor,
  type CmsContent,
  type CmsContentCreateInput,
  type CmsContentDetail,
  type CmsContentUpdateInput,
  type CmsContentVersion,
  type CmsGalleryItem,
  type CmsLikeToggleResult,
  type CmsLikeWithUser,
  type CmsListCommentsParams,
  type CmsProfileRef,
  type CmsListContentParams,
  type CmsListMediaParams,
  type CmsListRedirectsParams,
  type CmsMedia,
  type CmsMediaUpdate,
  type CmsMediaUploadFile,
  type CmsMediaUploadOptions,
  type CmsRedirect,
  type CmsRedirectInsert,
  type CmsRedirectUpdate,
  type CmsSeo,
  type CmsSeoInsert,
  type CmsSeoUpdate,
  type CmsServiceResponse,
  type CmsSitemapFeedRow,
  type CmsTag,
} from '~/lib/cms/cms.type'
import {
  autoExcerpt,
  buildPaginationMeta,
  calculateSeoScore,
  diffTagIds,
  fail,
  generateSlug,
  mimeToMediaType,
  normalizeCoverMedia,
  ok,
  pageToRange,
  toMessage,
} from '~/lib/cms/cms.utils'

// ============= SELECT FRAGMENTS =============
// Keep join selects as single-line strings so the Supabase typed parser accepts them.
// Hint by column — cms_content also has og_image_id / twitter_image_id → cms_media.

const CONTENT_LIST_SELECT =
  '*, cms_categories(id, name, slug), cover_media:cms_media!cover_image_id(id, public_url, alt_text, width, height), cms_content_tag_map(tag_id)'

const CONTENT_DETAIL_SELECT =
  '*, cms_categories(id, name, slug), cover_media:cms_media!cover_image_id(id, public_url, alt_text, width, height), cms_content_tag_map(tag_id, cms_tags(id, name, slug)), cms_content_media(id, media_id, sort_order, cms_media(*))'

const COMMENT_SELECT =
  '*, author:profiles!author_id(id, full_name, username, avatar_url)'

async function requireUserId(): Promise<string> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthenticated')
  return user.id
}

async function fetchProfilesByIds(ids: string[]): Promise<Map<string, CmsProfileRef>> {
  const unique = [...new Set(ids.filter(Boolean))]
  if (unique.length === 0) return new Map()

  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, username, avatar_url')
    .in('id', unique)

  if (error) throw error
  return new Map((data ?? []).map((row) => [row.id, row as CmsProfileRef]))
}

async function withAuthors<T extends { author_id: string }>(
  rows: T[],
): Promise<Array<T & { author: CmsProfileRef | null }>> {
  const byId = await fetchProfilesByIds(rows.map((row) => row.author_id))
  return rows.map((row) => ({
    ...row,
    author: byId.get(row.author_id) ?? null,
  }))
}

type Coverable = {
  cover_image_id?: string | null
  cover_media?: unknown
}

/** Normalize join shape and backfill cover_media when the FK embed is missing. */
async function withCoverMedia<T extends Coverable>(rows: T[]): Promise<T[]> {
  const normalized = rows.map((row) => ({
    ...row,
    cover_media: normalizeCoverMedia(row.cover_media),
  }))

  const missingIds = [
    ...new Set(
      normalized
        .filter((row) => row.cover_image_id && !row.cover_media?.public_url)
        .map((row) => row.cover_image_id as string),
    ),
  ]

  if (missingIds.length === 0) return normalized

  const { data, error } = await supabase
    .from('cms_media')
    .select('id, public_url, alt_text, width, height')
    .in('id', missingIds)

  if (error) return normalized

  const byId = new Map((data ?? []).map((m) => [m.id, normalizeCoverMedia(m)]))
  return normalized.map((row) => {
    if (row.cover_media?.public_url || !row.cover_image_id) return row
    return { ...row, cover_media: byId.get(row.cover_image_id) ?? row.cover_media }
  })
}

// ============================================================================
// CATEGORIES
// ============================================================================

export async function listCategories(): Promise<CmsServiceResponse<CmsCategory[]>> {
  try {
    const { data, error } = await supabase
      .from('cms_categories')
      .select('*')
      .eq('is_active', true)
      .order('sort_order', { ascending: true })

    if (error) throw error
    return ok((data ?? []) as unknown as CmsCategory[])
  } catch (err) {
    return fail(toMessage(err), [])
  }
}

export async function getCategoryById(id: string): Promise<CmsServiceResponse<CmsCategory>> {
  try {
    const { data, error } = await supabase
      .from('cms_categories')
      .select('*')
      .eq('id', id)
      .single()

    if (error) throw error
    return ok(data as unknown as CmsCategory)
  } catch (err) {
    return fail(toMessage(err))
  }
}

export async function getCategoryBySlug(slug: string): Promise<CmsServiceResponse<CmsCategory>> {
  try {
    const { data, error } = await supabase
      .from('cms_categories')
      .select('*')
      .eq('slug', slug)
      .single()

    if (error) throw error
    return ok(data as unknown as CmsCategory)
  } catch (err) {
    return fail(toMessage(err))
  }
}

export async function createCategory(payload: {
  name: string
  slug: string
  description?: string | null
  parent_id?: string | null
  cover_url?: string | null
  sort_order?: number
  is_active?: boolean
  created_by?: string | null
}): Promise<CmsServiceResponse<CmsCategory>> {
  try {
    const slug = payload.slug || generateSlug(payload.name)
    const { data, error } = await supabase
      .from('cms_categories')
      .insert({ ...payload, slug })
      .select('*')
      .single()

    if (error) throw error
    return ok(data as unknown as CmsCategory)
  } catch (err) {
    return fail(toMessage(err))
  }
}

export async function updateCategory(
  id: string,
  payload: Partial<CmsCategory>,
): Promise<CmsServiceResponse<CmsCategory>> {
  try {
    const { data, error } = await supabase
      .from('cms_categories')
      .update(payload)
      .eq('id', id)
      .select('*')
      .single()

    if (error) throw error
    return ok(data as unknown as CmsCategory)
  } catch (err) {
    return fail(toMessage(err))
  }
}

export async function softDeleteCategory(id: string): Promise<CmsServiceResponse<{ id: string }>> {
  try {
    const { error } = await supabase
      .from('cms_categories')
      .update({ is_active: false })
      .eq('id', id)

    if (error) throw error
    return ok({ id })
  } catch (err) {
    return fail(toMessage(err))
  }
}

export async function deleteCategory(id: string): Promise<CmsServiceResponse<{ id: string }>> {
  try {
    const { error } = await supabase.from('cms_categories').delete().eq('id', id)
    if (error) throw error
    return ok({ id })
  } catch (err) {
    return fail(toMessage(err))
  }
}

// ============================================================================
// TAGS
// ============================================================================

export async function listTags(): Promise<CmsServiceResponse<CmsTag[]>> {
  try {
    const { data, error } = await supabase.from('cms_tags').select('*').order('name')
    if (error) throw error
    return ok((data ?? []) as unknown as CmsTag[])
  } catch (err) {
    return fail(toMessage(err), [])
  }
}

export async function getTagById(id: string): Promise<CmsServiceResponse<CmsTag>> {
  try {
    const { data, error } = await supabase.from('cms_tags').select('*').eq('id', id).single()
    if (error) throw error
    return ok(data as unknown as CmsTag)
  } catch (err) {
    return fail(toMessage(err))
  }
}

export async function createTag(payload: {
  name: string
  slug?: string
}): Promise<CmsServiceResponse<CmsTag>> {
  try {
    const name = payload.name.trim()
    const slug = payload.slug || generateSlug(name)

    const { data: existing } = await supabase
      .from('cms_tags')
      .select('*')
      .ilike('name', name)
      .maybeSingle()

    if (existing) return ok(existing as unknown as CmsTag)

    const { data, error } = await supabase
      .from('cms_tags')
      .insert({ name, slug })
      .select('*')
      .single()

    if (error) throw error
    return ok(data as unknown as CmsTag)
  } catch (err) {
    return fail(toMessage(err))
  }
}

export async function updateTag(
  id: string,
  payload: Partial<Pick<CmsTag, 'name' | 'slug'>>,
): Promise<CmsServiceResponse<CmsTag>> {
  try {
    const { data, error } = await supabase
      .from('cms_tags')
      .update(payload)
      .eq('id', id)
      .select('*')
      .single()

    if (error) throw error
    return ok(data as unknown as CmsTag)
  } catch (err) {
    return fail(toMessage(err))
  }
}

export async function deleteTag(id: string): Promise<CmsServiceResponse<{ id: string }>> {
  try {
    const { error } = await supabase.from('cms_tags').delete().eq('id', id)
    if (error) throw error
    return ok({ id })
  } catch (err) {
    return fail(toMessage(err))
  }
}

// ============================================================================
// MEDIA
// ============================================================================

export async function listMedia(
  params: CmsListMediaParams = {},
): Promise<CmsServiceResponse<CmsMedia[]>> {
  try {
    const { folder, media_type, page = 1, limit = 30 } = params
    const { from, to } = pageToRange(page, limit)

    let q = supabase
      .from('cms_media')
      .select('*', { count: 'exact' })
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .range(from, to)

    if (folder) q = q.eq('folder', folder)
    if (media_type) q = q.eq('media_type', media_type)

    const { data, error, count } = await q
    if (error) throw error
    return ok((data ?? []) as unknown as CmsMedia[], buildPaginationMeta(count ?? 0, page, limit))
  } catch (err) {
    return fail(toMessage(err), [])
  }
}

export async function getMediaById(id: string): Promise<CmsServiceResponse<CmsMedia>> {
  try {
    const { data, error } = await supabase
      .from('cms_media')
      .select('*')
      .eq('id', id)
      .single()

    if (error) throw error
    return ok(data as unknown as CmsMedia)
  } catch (err) {
    return fail(toMessage(err))
  }
}

export async function uploadMedia(
  file: CmsMediaUploadFile,
  options: CmsMediaUploadOptions = {},
): Promise<CmsServiceResponse<CmsMedia>> {
  try {
    const {
      folder = '/',
      bucket = CMS_MEDIA_BUCKETS.PUBLIC,
      alt_text,
      caption,
    } = options

    const userId = await requireUserId()
    const safeName = file.fileName.replace(/[^a-zA-Z0-9._-]/g, '_')
    // Always separate userId and folder with `/` (legacy used `uuid` + `uploads` → broken paths).
    const folderPart =
      !folder || folder === '/' ? '' : folder.startsWith('/') ? folder : `/${folder}`
    const storagePath = `${userId}${folderPart}/${Date.now()}-${safeName}`

    const upload = await uploadStorageObject(bucket, storagePath, file.blob, file.mimeType, {
      maxBytes: bucket === CMS_MEDIA_BUCKETS.PRIVATE ? 100 * 1024 * 1024 : 50 * 1024 * 1024,
    })
    if (upload.error) throw new Error(upload.error)

    const publicUrl =
      bucket === CMS_MEDIA_BUCKETS.PUBLIC
        ? (upload.data?.publicUrl ?? getStoragePublicUrl(bucket, storagePath))
        : null

    const mediaRow = {
      uploaded_by: userId,
      file_name: file.fileName,
      file_size: file.fileSize,
      mime_type: file.mimeType,
      media_type: mimeToMediaType(file.mimeType),
      bucket_id: bucket,
      storage_path: storagePath,
      public_url: publicUrl,
      alt_text: alt_text ?? null,
      caption: caption ?? null,
      folder,
      is_active: true,
    }

    const { data, error } = await supabase
      .from('cms_media')
      .insert(mediaRow)
      .select('*')
      .single()

    if (error) throw error
    return ok(data as unknown as CmsMedia)
  } catch (err) {
    return fail(toMessage(err))
  }
}

export async function updateMedia(
  id: string,
  payload: CmsMediaUpdate,
): Promise<CmsServiceResponse<CmsMedia>> {
  try {
    const { data, error } = await supabase
      .from('cms_media')
      .update(payload)
      .eq('id', id)
      .select('*')
      .single()

    if (error) throw error
    return ok(data as unknown as CmsMedia)
  } catch (err) {
    return fail(toMessage(err))
  }
}

export async function deleteMedia(id: string): Promise<CmsServiceResponse<{ id: string }>> {
  try {
    const { data: media, error: fetchError } = await supabase
      .from('cms_media')
      .select('bucket_id, storage_path')
      .eq('id', id)
      .single()

    if (fetchError) throw fetchError

    const { error: storageError } = await supabase.storage
      .from(media.bucket_id)
      .remove([media.storage_path])

    if (storageError) throw storageError

    const { error: dbError } = await supabase.from('cms_media').delete().eq('id', id)
    if (dbError) throw dbError
    return ok({ id })
  } catch (err) {
    return fail(toMessage(err))
  }
}

// ============================================================================
// CONTENT
// ============================================================================

export async function listContents(
  params: CmsListContentParams = {},
): Promise<CmsServiceResponse<CmsContentDetail[]>> {
  try {
    const {
      type,
      status,
      category_id,
      author_id,
      vendor_id,
      is_featured,
      search,
      tag_ids,
      page = 1,
      limit = 20,
      order_by = 'created_at',
      ascending = false,
    } = params

    const { from, to } = pageToRange(page, limit)

    let q = supabase
      .from('cms_content')
      .select(CONTENT_LIST_SELECT, { count: 'exact' })
      .is('deleted_at', null)
      .order(order_by, { ascending })
      .range(from, to)

    if (type) q = q.eq('type', type)
    if (status) q = q.eq('status', status)
    if (category_id) q = q.eq('category_id', category_id)
    if (author_id) q = q.eq('author_id', author_id)
    if (vendor_id) q = q.eq('vendor_id', vendor_id)
    if (is_featured !== undefined) q = q.eq('is_featured', is_featured)

    if (search?.trim()) {
      const term = search.trim().replace(/[%_]/g, '')
      if (term) {
        q = q.or(`title.ilike.%${term}%,excerpt.ilike.%${term}%,slug.ilike.%${term}%`)
      }
    }

    if (tag_ids && tag_ids.length > 0) {
      q = q.in('cms_content_tag_map.tag_id', tag_ids)
    }

    const { data, error, count } = await q
    if (error) throw error
    const withCover = await withCoverMedia((data ?? []) as Coverable[])
    const withAuthor = await withAuthors(withCover as Array<{ author_id: string }>)
    return ok(withAuthor as unknown as CmsContentDetail[], buildPaginationMeta(count ?? 0, page, limit))
  } catch (err) {
    return fail(toMessage(err), [])
  }
}

export async function getContentById(id: string): Promise<CmsServiceResponse<CmsContentDetail>> {
  try {
    const { data, error } = await supabase
      .from('cms_content')
      .select(CONTENT_DETAIL_SELECT)
      .eq('id', id)
      .is('deleted_at', null)
      .single()

    if (error) throw error
    const [withCover] = await withCoverMedia([data as Coverable])
    const [withAuthor] = await withAuthors([withCover as { author_id: string }])
    return ok(withAuthor as unknown as CmsContentDetail)
  } catch (err) {
    return fail(toMessage(err))
  }
}

export async function getContentBySlug(slug: string): Promise<CmsServiceResponse<CmsContentDetail>> {
  try {
    const { data, error } = await supabase
      .from('cms_content')
      .select(CONTENT_DETAIL_SELECT)
      .eq('slug', slug)
      .is('deleted_at', null)
      .single()

    if (error) throw error
    const [withCover] = await withCoverMedia([data as Coverable])
    const [withAuthor] = await withAuthors([withCover as { author_id: string }])
    return ok(withAuthor as unknown as CmsContentDetail)
  } catch (err) {
    return fail(toMessage(err))
  }
}

async function getTagIds(contentId: string): Promise<string[]> {
  const { data } = await supabase
    .from('cms_content_tag_map')
    .select('tag_id')
    .eq('content_id', contentId)
  return (data ?? []).map((r) => r.tag_id)
}

async function setTags(contentId: string, newTagIds: string[]): Promise<void> {
  await supabase.from('cms_content_tag_map').delete().eq('content_id', contentId)
  if (newTagIds.length === 0) return
  const rows = newTagIds.map((tag_id) => ({ content_id: contentId, tag_id }))
  const { error } = await supabase.from('cms_content_tag_map').insert(rows)
  if (error) throw error
}

async function addTags(contentId: string, tagIds: string[]): Promise<void> {
  if (!tagIds.length) return
  const rows = tagIds.map((tag_id) => ({ content_id: contentId, tag_id }))
  await supabase.from('cms_content_tag_map').insert(rows)
}

async function removeTags(contentId: string, tagIds: string[]): Promise<void> {
  if (!tagIds.length) return
  await supabase
    .from('cms_content_tag_map')
    .delete()
    .eq('content_id', contentId)
    .in('tag_id', tagIds)
}

export async function createContent(
  payload: CmsContentCreateInput,
): Promise<CmsServiceResponse<CmsContentDetail>> {
  try {
    const userId = await requireUserId()
    const { tag_ids = [], change_note: _changeNote, ...contentPayload } = payload

    if (!contentPayload.excerpt && contentPayload.body) {
      contentPayload.excerpt = autoExcerpt(
        contentPayload.body,
        contentPayload.body_format ?? 'markdown',
      )
    }

    const insertRow = {
      ...contentPayload,
      author_id: userId,
      seo_score: calculateSeoScore(contentPayload),
      slug: contentPayload.slug || generateSlug(contentPayload.title),
    }

    const { data: content, error: contentError } = await supabase
      .from('cms_content')
      .insert(insertRow)
      .select('*')
      .single()

    if (contentError) throw contentError

    if (tag_ids.length > 0) {
      await setTags(content.id, tag_ids)
    }

    await createVersion({
      content_id: content.id,
      title: content.title,
      body: content.body,
      body_format: content.body_format,
      status: content.status,
      change_note: 'Initial draft',
    })

    return ok(content as unknown as CmsContentDetail)
  } catch (err) {
    return fail(toMessage(err))
  }
}

export async function updateContent(
  id: string,
  payload: CmsContentUpdateInput,
): Promise<CmsServiceResponse<CmsContentDetail>> {
  try {
    await requireUserId()
    const { tag_ids, change_note, ...contentPayload } = payload

    if (
      contentPayload.body !== undefined ||
      contentPayload.title !== undefined ||
      contentPayload.seo_title !== undefined
    ) {
      const current = await getContentById(id)
      if (current.success && current.data) {
        contentPayload.seo_score = calculateSeoScore({ ...current.data, ...contentPayload })
      }
    }

    const { data: content, error: contentError } = await supabase
      .from('cms_content')
      .update(contentPayload)
      .eq('id', id)
      .select('*')
      .single()

    if (contentError) throw contentError

    if (Array.isArray(tag_ids)) {
      const existing = await getTagIds(id)
      const { toAdd, toRemove } = diffTagIds(existing, tag_ids)
      await addTags(id, toAdd)
      await removeTags(id, toRemove)
    }

    await createVersion({
      content_id: id,
      title: content.title,
      body: content.body,
      body_format: content.body_format,
      status: content.status,
      change_note: change_note ?? null,
    })

    return ok(content as unknown as CmsContentDetail)
  } catch (err) {
    return fail(toMessage(err))
  }
}

export async function publishContent(
  id: string,
  publishedAt: string | null = null,
): Promise<CmsServiceResponse<CmsContentDetail>> {
  try {
    const { data, error } = await supabase
      .from('cms_content')
      .update({
        status: 'published',
        published_at: publishedAt ?? new Date().toISOString(),
      })
      .eq('id', id)
      .select('*')
      .single()

    if (error) throw error
    return ok(data as unknown as CmsContentDetail)
  } catch (err) {
    return fail(toMessage(err))
  }
}

export async function scheduleContent(
  id: string,
  scheduledAt: string,
): Promise<CmsServiceResponse<CmsContentDetail>> {
  try {
    const { data, error } = await supabase
      .from('cms_content')
      .update({ status: 'scheduled', scheduled_at: scheduledAt })
      .eq('id', id)
      .select('*')
      .single()

    if (error) throw error
    return ok(data as unknown as CmsContentDetail)
  } catch (err) {
    return fail(toMessage(err))
  }
}

export async function archiveContent(id: string): Promise<CmsServiceResponse<CmsContentDetail>> {
  try {
    const { data, error } = await supabase
      .from('cms_content')
      .update({ status: 'archived' })
      .eq('id', id)
      .select('*')
      .single()

    if (error) throw error
    return ok(data as unknown as CmsContentDetail)
  } catch (err) {
    return fail(toMessage(err))
  }
}

export async function softDeleteContent(id: string): Promise<CmsServiceResponse<{ id: string }>> {
  try {
    const { error } = await supabase
      .from('cms_content')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)

    if (error) throw error
    return ok({ id })
  } catch (err) {
    return fail(toMessage(err))
  }
}

export async function deleteContent(id: string): Promise<CmsServiceResponse<{ id: string }>> {
  try {
    const { error } = await supabase.from('cms_content').delete().eq('id', id)
    if (error) throw error
    return ok({ id })
  } catch (err) {
    return fail(toMessage(err))
  }
}

export async function incrementViewCount(id: string): Promise<CmsServiceResponse<{ id: string }>> {
  try {
    const { error } = await supabase.rpc('cms_increment_view_count' as never, {
      p_content_id: id,
    } as never)
    if (error) throw error
    return ok({ id })
  } catch {
    return ok({ id })
  }
}

export async function listGallery(contentId: string): Promise<CmsServiceResponse<CmsGalleryItem[]>> {
  try {
    const { data, error } = await supabase
      .from('cms_content_media')
      .select('id, media_id, sort_order, cms_media(*)')
      .eq('content_id', contentId)
      .order('sort_order')

    if (error) throw error
    return ok((data ?? []) as unknown as CmsGalleryItem[])
  } catch (err) {
    return fail(toMessage(err), [])
  }
}

export async function addGalleryItem(
  contentId: string,
  mediaId: string,
  sortOrder = 0,
): Promise<CmsServiceResponse<CmsGalleryItem>> {
  try {
    const { data, error } = await supabase
      .from('cms_content_media')
      .insert({ content_id: contentId, media_id: mediaId, sort_order: sortOrder })
      .select()
      .single()

    if (error) throw error
    return ok(data as unknown as CmsGalleryItem)
  } catch (err) {
    return fail(toMessage(err))
  }
}

export async function removeGalleryItem(
  contentMediaId: string,
): Promise<CmsServiceResponse<{ id: string }>> {
  try {
    const { error } = await supabase.from('cms_content_media').delete().eq('id', contentMediaId)
    if (error) throw error
    return ok({ id: contentMediaId })
  } catch (err) {
    return fail(toMessage(err))
  }
}

// ============================================================================
// VERSIONS
// ============================================================================

export async function listVersions(
  contentId: string,
): Promise<CmsServiceResponse<CmsContentVersion[]>> {
  try {
    const { data, error } = await supabase
      .from('cms_content_versions')
      .select('*')
      .eq('content_id', contentId)
      .order('version_no', { ascending: false })

    if (error) throw error
    return ok((data ?? []) as unknown as CmsContentVersion[])
  } catch (err) {
    return fail(toMessage(err), [])
  }
}

export async function getVersionById(id: string): Promise<CmsServiceResponse<CmsContentVersion>> {
  try {
    const { data, error } = await supabase
      .from('cms_content_versions')
      .select('*')
      .eq('id', id)
      .single()

    if (error) throw error
    return ok(data as unknown as CmsContentVersion)
  } catch (err) {
    return fail(toMessage(err))
  }
}

export async function createVersion(payload: {
  content_id: string
  title: string
  body?: string | null
  body_format?: string
  status: CmsContent['status']
  change_note?: string | null
}): Promise<CmsServiceResponse<CmsContentVersion>> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser()

    const { data, error } = await supabase
      .from('cms_content_versions')
      .insert({
        ...payload,
        body_format: payload.body_format ?? 'markdown',
        saved_by: user?.id ?? null,
        // Overwritten by `cms_set_version_no` trigger.
        version_no: 0,
      })
      .select('*')
      .single()

    if (error) throw error
    return ok(data as unknown as CmsContentVersion)
  } catch (err) {
    return fail(toMessage(err))
  }
}

export async function restoreVersion(
  versionId: string,
): Promise<CmsServiceResponse<CmsContentDetail>> {
  try {
    const vResult = await getVersionById(versionId)
    if (!vResult.success || !vResult.data) throw new Error(vResult.error ?? 'Version not found')

    const { content_id, title, body, body_format, version_no } = vResult.data
    return updateContent(content_id, {
      title,
      body,
      body_format,
      change_note: `Restored from version ${version_no}`,
    })
  } catch (err) {
    return fail(toMessage(err))
  }
}

export async function deleteVersionsByContentId(
  contentId: string,
): Promise<CmsServiceResponse<{ contentId: string }>> {
  try {
    const { error } = await supabase
      .from('cms_content_versions')
      .delete()
      .eq('content_id', contentId)

    if (error) throw error
    return ok({ contentId })
  } catch (err) {
    return fail(toMessage(err))
  }
}

// ============================================================================
// COMMENTS
// ============================================================================

export async function listComments(
  params: CmsListCommentsParams,
): Promise<CmsServiceResponse<CmsCommentWithAuthor[]>> {
  try {
    const {
      content_id,
      parent_id,
      is_approved,
      is_flagged,
      search,
      page = 1,
      limit = 20,
    } = params
    const { from, to } = pageToRange(page, limit)

    let q = supabase
      .from('cms_blog_comments')
      .select(COMMENT_SELECT, { count: 'exact' })
      .is('deleted_at', null)
      .order('created_at', { ascending: content_id ? true : false })
      .range(from, to)

    if (content_id) q = q.eq('content_id', content_id)
    if (parent_id !== undefined) {
      q = parent_id === null ? q.is('parent_id', null) : q.eq('parent_id', parent_id)
    }
    if (is_approved !== undefined) q = q.eq('is_approved', is_approved)
    if (is_flagged !== undefined) q = q.eq('is_flagged', is_flagged)
    if (search?.trim()) {
      const term = search.trim().replace(/[%_]/g, '')
      if (term) q = q.ilike('body', `%${term}%`)
    }

    const { data, error, count } = await q
    if (error) throw error
    return ok(
      (data ?? []) as unknown as CmsCommentWithAuthor[],
      buildPaginationMeta(count ?? 0, page, limit),
    )
  } catch (err) {
    return fail(toMessage(err), [])
  }
}

export async function getCommentById(
  id: string,
): Promise<CmsServiceResponse<CmsCommentWithAuthor>> {
  try {
    const { data, error } = await supabase
      .from('cms_blog_comments')
      .select(COMMENT_SELECT)
      .eq('id', id)
      .single()

    if (error) throw error
    return ok(data as unknown as CmsCommentWithAuthor)
  } catch (err) {
    return fail(toMessage(err))
  }
}

export async function createComment(payload: {
  content_id: string
  parent_id?: string | null
  body: string
}): Promise<CmsServiceResponse<CmsCommentWithAuthor>> {
  try {
    const userId = await requireUserId()
    const { data, error } = await supabase
      .from('cms_blog_comments')
      .insert({ ...payload, author_id: userId, is_approved: false })
      .select(COMMENT_SELECT)
      .single()

    if (error) throw error
    return ok(data as unknown as CmsCommentWithAuthor)
  } catch (err) {
    return fail(toMessage(err))
  }
}

export async function updateComment(
  id: string,
  body: string,
): Promise<CmsServiceResponse<CmsCommentWithAuthor>> {
  try {
    const { data, error } = await supabase
      .from('cms_blog_comments')
      .update({ body })
      .eq('id', id)
      .select(COMMENT_SELECT)
      .single()

    if (error) throw error
    return ok(data as unknown as CmsCommentWithAuthor)
  } catch (err) {
    return fail(toMessage(err))
  }
}

export async function moderateComment(
  id: string,
  payload: { is_approved?: boolean; is_flagged?: boolean; deleted_at?: string | null },
): Promise<CmsServiceResponse<CmsCommentWithAuthor>> {
  try {
    const { data, error } = await supabase
      .from('cms_blog_comments')
      .update(payload)
      .eq('id', id)
      .select(COMMENT_SELECT)
      .single()

    if (error) throw error
    return ok(data as unknown as CmsCommentWithAuthor)
  } catch (err) {
    return fail(toMessage(err))
  }
}

export async function softDeleteComment(
  id: string,
): Promise<CmsServiceResponse<CmsCommentWithAuthor>> {
  return moderateComment(id, { deleted_at: new Date().toISOString() })
}

export async function deleteComment(id: string): Promise<CmsServiceResponse<{ id: string }>> {
  try {
    const { error } = await supabase.from('cms_blog_comments').delete().eq('id', id)
    if (error) throw error
    return ok({ id })
  } catch (err) {
    return fail(toMessage(err))
  }
}

// ============================================================================
// LIKES
// ============================================================================

export async function toggleLike(
  contentId: string,
): Promise<CmsServiceResponse<CmsLikeToggleResult>> {
  try {
    const userId = await requireUserId()

    const { data: existing } = await supabase
      .from('cms_blog_likes')
      .select('id')
      .eq('content_id', contentId)
      .eq('user_id', userId)
      .maybeSingle()

    if (existing) {
      const { error } = await supabase.from('cms_blog_likes').delete().eq('id', existing.id)
      if (error) throw error
    } else {
      const { error } = await supabase
        .from('cms_blog_likes')
        .insert({ content_id: contentId, user_id: userId })
      if (error) throw error
    }

    const { data: content } = await supabase
      .from('cms_content')
      .select('like_count')
      .eq('id', contentId)
      .single()

    return ok({
      liked: !existing,
      like_count: content?.like_count ?? 0,
    })
  } catch (err) {
    return fail(toMessage(err))
  }
}

export async function checkLike(
  contentId: string,
): Promise<CmsServiceResponse<{ liked: boolean }>> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return ok({ liked: false })

    const { data } = await supabase
      .from('cms_blog_likes')
      .select('id')
      .eq('content_id', contentId)
      .eq('user_id', user.id)
      .maybeSingle()

    return ok({ liked: !!data })
  } catch (err) {
    return fail(toMessage(err), { liked: false })
  }
}

/**
 * List everyone who liked a content item (newest first), with profile info.
 * Used by admin engagement views — there is no dislike table in CMS.
 */
export async function listContentLikes(
  contentId: string,
): Promise<CmsServiceResponse<CmsLikeWithUser[]>> {
  try {
    const { data: likes, error } = await supabase
      .from('cms_blog_likes')
      .select('id, content_id, user_id, created_at')
      .eq('content_id', contentId)
      .order('created_at', { ascending: false })

    if (error) throw error
    const rows = likes ?? []
    if (rows.length === 0) return ok([])

    const byId = await fetchProfilesByIds(rows.map((row) => row.user_id))
    return ok(
      rows.map((row) => ({
        ...row,
        user: byId.get(row.user_id) ?? null,
      })),
    )
  } catch (err) {
    return fail(toMessage(err), [])
  }
}

// ============================================================================
// SEO
// ============================================================================

export async function getSeoByContentId(
  contentId: string,
): Promise<CmsServiceResponse<CmsSeo | null>> {
  try {
    const { data, error } = await supabase
      .from('cms_seo')
      .select('*')
      .eq('content_id', contentId)
      .maybeSingle()

    if (error) throw error
    return ok((data as unknown as CmsSeo | null) ?? null)
  } catch (err) {
    return fail(toMessage(err))
  }
}

export async function getSeoByCategoryId(
  categoryId: string,
): Promise<CmsServiceResponse<CmsSeo | null>> {
  try {
    const { data, error } = await supabase
      .from('cms_seo')
      .select('*')
      .eq('category_id', categoryId)
      .maybeSingle()

    if (error) throw error
    return ok((data as unknown as CmsSeo | null) ?? null)
  } catch (err) {
    return fail(toMessage(err))
  }
}

export async function getSeoByPath(
  customPath: string,
): Promise<CmsServiceResponse<CmsSeo | null>> {
  try {
    const { data, error } = await supabase
      .from('cms_seo')
      .select('*')
      .eq('custom_path', customPath)
      .maybeSingle()

    if (error) throw error
    return ok((data as unknown as CmsSeo | null) ?? null)
  } catch (err) {
    return fail(toMessage(err))
  }
}

export async function upsertSeo(payload: CmsSeoInsert): Promise<CmsServiceResponse<CmsSeo>> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser()

    let conflictColumn: 'content_id' | 'category_id' | 'custom_path' = 'custom_path'
    if (payload.content_id) conflictColumn = 'content_id'
    else if (payload.category_id) conflictColumn = 'category_id'

    const row = {
      ...payload,
      updated_by: user?.id ?? null,
      created_by: user?.id ?? null,
    }

    const { data, error } = await supabase
      .from('cms_seo')
      .upsert(row, { onConflict: conflictColumn, ignoreDuplicates: false })
      .select('*')
      .single()

    if (error) throw error
    return ok(data as unknown as CmsSeo)
  } catch (err) {
    return fail(toMessage(err))
  }
}

export async function updateSeo(
  id: string,
  payload: CmsSeoUpdate,
): Promise<CmsServiceResponse<CmsSeo>> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser()

    const { data, error } = await supabase
      .from('cms_seo')
      .update({ ...payload, updated_by: user?.id ?? null })
      .eq('id', id)
      .select('*')
      .single()

    if (error) throw error
    return ok(data as unknown as CmsSeo)
  } catch (err) {
    return fail(toMessage(err))
  }
}

export async function deleteSeo(id: string): Promise<CmsServiceResponse<{ id: string }>> {
  try {
    const { error } = await supabase.from('cms_seo').delete().eq('id', id)
    if (error) throw error
    return ok({ id })
  } catch (err) {
    return fail(toMessage(err))
  }
}

export async function getSitemapFeed(): Promise<CmsServiceResponse<CmsSitemapFeedRow[]>> {
  try {
    const { data, error } = await supabase
      .from('cms_sitemap_feed')
      .select('path, last_modified, priority, changefreq')

    if (error) throw error
    return ok((data ?? []) as unknown as CmsSitemapFeedRow[])
  } catch (err) {
    return fail(toMessage(err), [])
  }
}

// ============================================================================
// REDIRECTS
// ============================================================================

export async function listRedirects(
  params: CmsListRedirectsParams = {},
): Promise<CmsServiceResponse<CmsRedirect[]>> {
  try {
    const { page = 1, limit = 50 } = params
    const { from, to } = pageToRange(page, limit)

    const { data, error, count } = await supabase
      .from('cms_seo_redirects')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to)

    if (error) throw error
    return ok((data ?? []) as unknown as CmsRedirect[], buildPaginationMeta(count ?? 0, page, limit))
  } catch (err) {
    return fail(toMessage(err), [])
  }
}

export async function lookupRedirect(
  fromPath: string,
): Promise<CmsServiceResponse<CmsRedirect | null>> {
  try {
    const { data, error } = await supabase
      .from('cms_seo_redirects')
      .select('*')
      .eq('from_path', fromPath)
      .eq('is_active', true)
      .maybeSingle()

    if (error) throw error
    return ok((data as unknown as CmsRedirect | null) ?? null)
  } catch (err) {
    return fail(toMessage(err))
  }
}

export async function createRedirect(
  payload: Omit<CmsRedirectInsert, 'created_by' | 'id' | 'created_at' | 'updated_at' | 'hit_count'>,
): Promise<CmsServiceResponse<CmsRedirect>> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser()

    const { data, error } = await supabase
      .from('cms_seo_redirects')
      .insert({ ...payload, created_by: user?.id ?? null })
      .select('*')
      .single()

    if (error) throw error
    return ok(data as unknown as CmsRedirect)
  } catch (err) {
    return fail(toMessage(err))
  }
}

export async function updateRedirect(
  id: string,
  payload: CmsRedirectUpdate,
): Promise<CmsServiceResponse<CmsRedirect>> {
  try {
    const { data, error } = await supabase
      .from('cms_seo_redirects')
      .update(payload)
      .eq('id', id)
      .select('*')
      .single()

    if (error) throw error
    return ok(data as unknown as CmsRedirect)
  } catch (err) {
    return fail(toMessage(err))
  }
}

export async function incrementRedirectHitCount(
  id: string,
): Promise<CmsServiceResponse<{ id: string }>> {
  try {
    const { error } = await supabase.rpc('cms_increment_redirect_hit' as never, {
      p_redirect_id: id,
    } as never)
    if (error) throw error
    return ok({ id })
  } catch {
    return ok({ id })
  }
}

export async function setRedirectActive(
  id: string,
  isActive: boolean,
): Promise<CmsServiceResponse<CmsRedirect>> {
  try {
    const { data, error } = await supabase
      .from('cms_seo_redirects')
      .update({ is_active: isActive })
      .eq('id', id)
      .select('*')
      .single()

    if (error) throw error
    return ok(data as unknown as CmsRedirect)
  } catch (err) {
    return fail(toMessage(err))
  }
}

export async function deleteRedirect(id: string): Promise<CmsServiceResponse<{ id: string }>> {
  try {
    const { error } = await supabase.from('cms_seo_redirects').delete().eq('id', id)
    if (error) throw error
    return ok({ id })
  } catch (err) {
    return fail(toMessage(err))
  }
}
