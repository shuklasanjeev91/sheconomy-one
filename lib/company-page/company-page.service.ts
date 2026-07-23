/**
 * Company Pages service — typed Supabase data-access layer for admin (+ reusable).
 *
 * UI should dispatch store thunks rather than calling these directly.
 * Authorisation is enforced by Supabase RLS; admin clients typically have role 'A'.
 */

import { isUuid } from '~/commerce/lib/seo-urls'
import { supabase, type Json } from '~/lib/supabase'
import { getStoragePublicUrl, uploadStorageObject } from '~/lib/supabase/storage-upload'

import { toFriendlyCompanyPageError } from './company-page.errors'
import {
  COMPANY_COVER_BUCKET,
  COMPANY_IMAGE_MAX_BYTES,
  COMPANY_LOGO_BUCKET,
  DEFAULT_COMPANY_PAGE_LIMIT,
  DEFAULT_PAGE_CATEGORY,
  type CompanyCreatorRef,
  type CompanyEngagementStats,
  type CompanyFollowerWithProfile,
  type CompanyImageUploadFile,
  type CompanyMemberRole,
  type CompanyMemberWithProfile,
  type CompanyPage,
  type CompanyPageDetail,
  type CompanyPageFacets,
  type CompanyPageListParams,
  type CompanyPagePlatformStats,
  type CompanyPageServiceResponse,
  type CompanyPageUpdate,
  type CompanyPageWithCounts,
  type CreateCompanyPageInput,
  type UpdateCompanyPageInput,
} from './company-page.type'
import { emptyEngagementStats, normalizeCompanyPageSlug } from './company-page.utils'

// ============= RESPONSE HELPERS =============

function ok<T>(
  data: T,
  meta?: CompanyPageServiceResponse<T>['meta'],
): CompanyPageServiceResponse<T> {
  return { data, error: null, success: true, meta }
}

function fail<T>(error: unknown, fallback?: string): CompanyPageServiceResponse<T> {
  return { data: null, error: toFriendlyCompanyPageError(error, fallback), success: false }
}

async function requireUserId(): Promise<string> {
  const { data, error } = await supabase.auth.getUser()
  if (error || !data.user) throw new Error('User not authenticated')
  return data.user.id
}

// ============= COUNT / PROFILE HELPERS =============

async function fetchCreatorsByIds(
  userIds: string[],
): Promise<Record<string, CompanyCreatorRef>> {
  const unique = Array.from(new Set(userIds.filter(Boolean)))
  if (!unique.length) return {}

  const { data } = await supabase
    .from('profiles')
    .select('id, full_name, username, avatar_url, email, headline')
    .in('id', unique)

  const map: Record<string, CompanyCreatorRef> = {}
  for (const row of data ?? []) {
    map[row.id] = row as CompanyCreatorRef
  }
  return map
}

async function countRelationForCompanyIds(
  table: 'company_followers' | 'company_members',
  companyIds: string[],
): Promise<Record<string, number>> {
  const counts: Record<string, number> = {}
  for (const id of companyIds) counts[id] = 0
  if (!companyIds.length) return counts

  await Promise.all(
    companyIds.map(async (companyId) => {
      const { count } = await supabase
        .from(table)
        .select('id', { count: 'exact', head: true })
        .eq('company_id', companyId)
      counts[companyId] = count ?? 0
    }),
  )
  return counts
}

async function countPostsForCompanyIds(companyIds: string[]): Promise<Record<string, number>> {
  const counts: Record<string, number> = {}
  for (const id of companyIds) counts[id] = 0
  if (!companyIds.length) return counts

  await Promise.all(
    companyIds.map(async (companyId) => {
      const { count } = await supabase
        .from('posts')
        .select('id', { count: 'exact', head: true })
        .eq('company_id', companyId)
        .eq('is_deleted', false)
      counts[companyId] = count ?? 0
    }),
  )
  return counts
}

async function withCounts(pages: CompanyPage[]): Promise<CompanyPageWithCounts[]> {
  if (!pages.length) return []
  const ids = pages.map((p) => p.id)
  const creatorIds = pages.map((p) => p.created_by).filter(Boolean) as string[]

  const [followers, members, posts, creators] = await Promise.all([
    countRelationForCompanyIds('company_followers', ids),
    countRelationForCompanyIds('company_members', ids),
    countPostsForCompanyIds(ids),
    fetchCreatorsByIds(creatorIds),
  ])

  return pages.map((page) => ({
    ...page,
    follower_count: followers[page.id] ?? 0,
    member_count: members[page.id] ?? 0,
    post_count: posts[page.id] ?? 0,
    creator: page.created_by ? creators[page.created_by] ?? null : null,
  }))
}

// ============================================================================
// ADMIN — LIST / READ
// ============================================================================

/** Paginated admin list with optional filters + aggregate counts. */
export async function listCompanyPages(
  params: CompanyPageListParams = {},
): Promise<CompanyPageServiceResponse<CompanyPageWithCounts[]>> {
  try {
    const limit = params.limit ?? DEFAULT_COMPANY_PAGE_LIMIT
    const offset = params.offset ?? 0
    const filters = params.filters ?? {}

    let query = supabase
      .from('companypages')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (filters.search?.trim()) {
      const q = filters.search.trim().replace(/[%]/g, '')
      query = query.or(
        `name.ilike.%${q}%,industry.ilike.%${q}%,page_slug.ilike.%${q}%,headquarters.ilike.%${q}%,location.ilike.%${q}%`,
      )
    }
    if (filters.industry) query = query.eq('industry', filters.industry)
    if (filters.size) query = query.eq('size', filters.size)
    if (filters.type) query = query.eq('type', filters.type)
    if (filters.page_category) query = query.eq('page_category', filters.page_category)
    if (filters.created_by) query = query.eq('created_by', filters.created_by)
    if (filters.location?.trim()) {
      const value = filters.location.trim().replace(/[%,]/g, '')
      query = query.or(`location.ilike.%${value}%,headquarters.ilike.%${value}%`)
    }

    const { data, error, count } = await query
    if (error) return fail(error)

    const enriched = await withCounts((data ?? []) as CompanyPage[])
    const total = count ?? 0

    return ok(enriched, {
      total,
      limit,
      offset,
      hasMore: offset + enriched.length < total,
    })
  } catch (error) {
    return fail(error)
  }
}

/** Single page by id (with counts + creator). */
export async function getCompanyPageById(
  id: string,
): Promise<CompanyPageServiceResponse<CompanyPageWithCounts>> {
  try {
    const { data, error } = await supabase.from('companypages').select('*').eq('id', id).single()
    if (error) return fail(error)
    const [enriched] = await withCounts([data as CompanyPage])
    return ok(enriched)
  } catch (error) {
    return fail(error)
  }
}

/** Resolve by uuid or page_slug. */
export async function getCompanyPageBySlugOrId(
  slugOrId: string,
): Promise<CompanyPageServiceResponse<CompanyPageWithCounts>> {
  try {
    const normalized = decodeURIComponent(slugOrId).trim()
    let query = supabase.from('companypages').select('*')
    query = isUuid(normalized) ? query.eq('id', normalized) : query.eq('page_slug', normalized)

    const { data, error } = await query.maybeSingle()
    if (error) return fail(error)
    if (!data) return fail({ code: 'PGRST116', message: 'Company page not found' })

    const [enriched] = await withCounts([data as CompanyPage])
    return ok(enriched)
  } catch (error) {
    return fail(error)
  }
}

/** Full admin detail payload (page + members + followers + engagement). */
export async function getCompanyPageDetail(
  id: string,
): Promise<CompanyPageServiceResponse<CompanyPageDetail>> {
  try {
    const pageRes = await getCompanyPageById(id)
    if (!pageRes.success || !pageRes.data) return fail(pageRes.error ?? 'Not found')

    const [membersRes, followersRes, engagementRes] = await Promise.all([
      getCompanyMembers(id),
      getCompanyFollowers(id, 12),
      getCompanyEngagementStats(id),
    ])

    return ok({
      ...pageRes.data,
      members: membersRes.data ?? [],
      recent_followers: followersRes.data ?? [],
      engagement: engagementRes.data ?? emptyEngagementStats(),
    })
  } catch (error) {
    return fail(error)
  }
}

// ============================================================================
// ADMIN — CREATE / UPDATE / DELETE
// ============================================================================

export async function createCompanyPage(
  input: CreateCompanyPageInput,
): Promise<CompanyPageServiceResponse<CompanyPage>> {
  try {
    const userId = await requireUserId()
    const slug = normalizeCompanyPageSlug(input.page_slug)

    const { data, error } = await supabase
      .from('companypages')
      .insert({
        name: input.name.trim(),
        page_slug: slug,
        industry: input.industry.trim(),
        size: input.size,
        type: input.type,
        page_category: input.page_category?.trim() || DEFAULT_PAGE_CATEGORY,
        website: input.website ?? null,
        logo_url: input.logo_url ?? null,
        cover_url: input.cover_url ?? null,
        tagline: input.tagline ?? null,
        headquarters: input.headquarters ?? null,
        founded_year: input.founded_year ?? null,
        community_members: input.community_members ?? null,
        location: input.location ?? null,
        raw_page_data: (input.raw_page_data as Json | null | undefined) ?? null,
        created_by: input.created_by ?? userId,
      })
      .select()
      .single()

    if (error) return fail(error)
    return ok(data)
  } catch (error) {
    return fail(error)
  }
}

export async function updateCompanyPage(
  pageId: string,
  input: UpdateCompanyPageInput,
): Promise<CompanyPageServiceResponse<CompanyPage>> {
  try {
    const patch: CompanyPageUpdate = {}

    if (input.name !== undefined) patch.name = input.name.trim()
    if (input.page_slug !== undefined) patch.page_slug = normalizeCompanyPageSlug(input.page_slug)
    if (input.industry !== undefined) patch.industry = input.industry.trim()
    if (input.size !== undefined) patch.size = input.size
    if (input.type !== undefined) patch.type = input.type
    if (input.page_category !== undefined) patch.page_category = input.page_category
    if (input.website !== undefined) patch.website = input.website
    if (input.logo_url !== undefined) patch.logo_url = input.logo_url
    if (input.cover_url !== undefined) patch.cover_url = input.cover_url
    if (input.tagline !== undefined) patch.tagline = input.tagline
    if (input.headquarters !== undefined) patch.headquarters = input.headquarters
    if (input.founded_year !== undefined) patch.founded_year = input.founded_year
    if (input.community_members !== undefined) patch.community_members = input.community_members
    if (input.location !== undefined) patch.location = input.location
    if (input.created_by !== undefined) patch.created_by = input.created_by
    if (input.raw_page_data !== undefined) patch.raw_page_data = input.raw_page_data as Json | null

    const { data, error } = await supabase
      .from('companypages')
      .update(patch)
      .eq('id', pageId)
      .select()
      .single()

    if (error) return fail(error)
    return ok(data)
  } catch (error) {
    return fail(error)
  }
}

/**
 * Delete a company page. Related members/followers should cascade or be cleaned
 * by DB FKs; logo/cover cleanup is best-effort from the caller / store.
 */
export async function deleteCompanyPage(
  pageId: string,
): Promise<CompanyPageServiceResponse<{ id: string }>> {
  try {
    const { error } = await supabase.from('companypages').delete().eq('id', pageId)
    if (error) return fail(error)
    return ok({ id: pageId })
  } catch (error) {
    return fail(error)
  }
}

/** Reassign the page owner (`created_by`). Trigger may not auto-fix members. */
export async function reassignCompanyPageOwner(
  pageId: string,
  newOwnerId: string,
): Promise<CompanyPageServiceResponse<CompanyPage>> {
  try {
    const { data, error } = await supabase
      .from('companypages')
      .update({ created_by: newOwnerId })
      .eq('id', pageId)
      .select()
      .single()

    if (error) return fail(error)

    // Ensure new owner appears as owner member (idempotent upsert-style).
    const { data: existing } = await supabase
      .from('company_members')
      .select('id, role')
      .eq('company_id', pageId)
      .eq('user_id', newOwnerId)
      .maybeSingle()

    if (existing) {
      if (existing.role !== 'owner') {
        await supabase.from('company_members').update({ role: 'owner' }).eq('id', existing.id)
      }
    } else {
      await supabase.from('company_members').insert({
        company_id: pageId,
        user_id: newOwnerId,
        role: 'owner',
        created_by: newOwnerId,
      })
    }

    return ok(data)
  } catch (error) {
    return fail(error)
  }
}

// ============================================================================
// MEMBERS
// ============================================================================

export async function getCompanyMembers(
  companyId: string,
): Promise<CompanyPageServiceResponse<CompanyMemberWithProfile[]>> {
  try {
    const { data, error } = await supabase
      .from('company_members')
      .select('id, company_id, user_id, role, created_at')
      .eq('company_id', companyId)
      .order('role', { ascending: true })

    if (error) return fail(error)

    const rows = data ?? []
    if (!rows.length) return ok([])

    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, username, full_name, headline, avatar_url')
      .in(
        'id',
        rows.map((r) => r.user_id),
      )

    const byId = new Map((profiles ?? []).map((p) => [p.id, p]))

    return ok(
      rows.map((row) => {
        const profile = byId.get(row.user_id)
        return {
          id: row.id,
          company_id: row.company_id,
          user_id: row.user_id,
          role: row.role as CompanyMemberRole,
          created_at: row.created_at,
          username: profile?.username ?? null,
          full_name: profile?.full_name ?? null,
          headline: profile?.headline ?? null,
          avatar_url: profile?.avatar_url ?? null,
        }
      }),
    )
  } catch (error) {
    return fail(error)
  }
}

/** Promote / demote via SECURITY DEFINER RPC (`admin` | `member`). */
export async function setCompanyMemberRole(
  companyId: string,
  userId: string,
  role: 'admin' | 'member',
): Promise<CompanyPageServiceResponse<{ company_id: string; user_id: string; role: string }>> {
  try {
    const { error } = await supabase.rpc('set_company_member_role', {
      p_company_id: companyId,
      p_user_id: userId,
      p_role: role,
    })
    if (error) return fail(error)
    return ok({ company_id: companyId, user_id: userId, role })
  } catch (error) {
    return fail(error)
  }
}

export async function removeCompanyMember(
  companyId: string,
  userId: string,
): Promise<CompanyPageServiceResponse<{ removed: boolean }>> {
  try {
    const { error } = await supabase
      .from('company_members')
      .delete()
      .eq('company_id', companyId)
      .eq('user_id', userId)
      .neq('role', 'owner')

    if (error) return fail(error)
    return ok({ removed: true })
  } catch (error) {
    return fail(error)
  }
}

// ============================================================================
// FOLLOWERS
// ============================================================================

export async function getCompanyFollowerCount(
  companyId: string,
): Promise<CompanyPageServiceResponse<number>> {
  try {
    const { count, error } = await supabase
      .from('company_followers')
      .select('id', { count: 'exact', head: true })
      .eq('company_id', companyId)
    if (error) return fail(error)
    return ok(count ?? 0)
  } catch (error) {
    return fail(error)
  }
}

export async function getCompanyFollowers(
  companyId: string,
  limit = 50,
): Promise<CompanyPageServiceResponse<CompanyFollowerWithProfile[]>> {
  try {
    const { data, error } = await supabase
      .from('company_followers')
      .select('id, company_id, follower_id, created_at')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) return fail(error)
    const rows = data ?? []
    if (!rows.length) return ok([])

    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, username, full_name, headline, avatar_url')
      .in(
        'id',
        rows.map((r) => r.follower_id),
      )

    const byId = new Map((profiles ?? []).map((p) => [p.id, p]))

    return ok(
      rows.map((row) => {
        const profile = byId.get(row.follower_id)
        return {
          id: row.id,
          company_id: row.company_id,
          follower_id: row.follower_id,
          created_at: row.created_at ?? '',
          username: profile?.username ?? null,
          full_name: profile?.full_name ?? null,
          headline: profile?.headline ?? null,
          avatar_url: profile?.avatar_url ?? null,
        }
      }),
    )
  } catch (error) {
    return fail(error)
  }
}

// ============================================================================
// POSTS / ENGAGEMENT
// ============================================================================

export async function getCompanyPostCount(
  companyId: string,
): Promise<CompanyPageServiceResponse<number>> {
  try {
    const { count, error } = await supabase
      .from('posts')
      .select('id', { count: 'exact', head: true })
      .eq('company_id', companyId)
      .eq('is_deleted', false)
    if (error) return fail(error)
    return ok(count ?? 0)
  } catch (error) {
    return fail(error)
  }
}

async function getCompanyPostIds(companyId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('posts')
    .select('id')
    .eq('company_id', companyId)
    .eq('is_deleted', false)
  if (error) throw error
  return (data ?? []).map((r) => r.id)
}

export async function getCompanyEngagementStats(
  companyId: string,
): Promise<CompanyPageServiceResponse<CompanyEngagementStats>> {
  try {
    const ids = await getCompanyPostIds(companyId)
    if (!ids.length) return ok(emptyEngagementStats())

    const { data, error } = await supabase
      .from('posts_with_stats')
      .select(
        'total_reactions, total_comments, total_views, like_count, love_count, celebrate_count, support_count, insightful_count, funny_count',
      )
      .in('id', ids)

    if (error) return fail(error)

    const stats: CompanyEngagementStats = emptyEngagementStats()
    for (const post of data ?? []) {
      stats.total_reactions += Number(post.total_reactions ?? 0)
      stats.total_comments += Number(post.total_comments ?? 0)
      stats.total_views += Number(post.total_views ?? 0)
      stats.like_count += Number(post.like_count ?? 0)
      stats.love_count += Number(post.love_count ?? 0)
      stats.celebrate_count += Number(post.celebrate_count ?? 0)
      stats.support_count += Number(post.support_count ?? 0)
      stats.insightful_count += Number(post.insightful_count ?? 0)
      stats.funny_count += Number(post.funny_count ?? 0)
    }

    return ok(stats)
  } catch (error) {
    return fail(error)
  }
}

// ============================================================================
// FACETS + PLATFORM STATS
// ============================================================================

export async function getCompanyPageFacets(): Promise<CompanyPageServiceResponse<CompanyPageFacets>> {
  try {
    const industries = new Set<string>()
    const locations = new Set<string>()
    const sizes = new Set<string>()
    const types = new Set<string>()
    const categories = new Set<string>()
    const sorted = (set: Set<string>) => Array.from(set).sort((a, b) => a.localeCompare(b))

    const { data: facetRows, error } = await supabase.rpc('community_company_facets')
    if (!error && facetRows) {
      for (const row of facetRows as { facet: string; value: string }[]) {
        if (row.facet === 'industry') industries.add(row.value)
        else if (row.facet === 'location') locations.add(row.value)
        else if (row.facet === 'size') sizes.add(row.value)
      }
    }

    const { data } = await supabase
      .from('companypages')
      .select('industry, location, headquarters, size, type, page_category')
      .limit(2000)

    for (const row of data ?? []) {
      if (row.industry?.trim()) industries.add(row.industry.trim())
      if (row.location?.trim()) locations.add(row.location.trim())
      if (row.headquarters?.trim()) locations.add(row.headquarters.trim())
      if (row.size?.trim()) sizes.add(row.size.trim())
      if (row.type?.trim()) types.add(row.type.trim())
      if (row.page_category?.trim()) categories.add(row.page_category.trim())
    }

    return ok({
      industries: sorted(industries),
      locations: sorted(locations),
      sizes: sorted(sizes),
      types: sorted(types),
      categories: sorted(categories),
    })
  } catch (error) {
    return fail(error)
  }
}

export async function getCompanyPagePlatformStats(): Promise<
  CompanyPageServiceResponse<CompanyPagePlatformStats>
> {
  try {
    const monthStart = new Date()
    monthStart.setUTCDate(1)
    monthStart.setUTCHours(0, 0, 0, 0)

    const [totalRes, monthRes, followersRes, membersRes] = await Promise.all([
      supabase.from('companypages').select('id', { count: 'exact', head: true }),
      supabase
        .from('companypages')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', monthStart.toISOString()),
      supabase.from('company_followers').select('id', { count: 'exact', head: true }),
      supabase.from('company_members').select('id', { count: 'exact', head: true }),
    ])

    if (totalRes.error) return fail(totalRes.error)

    return ok({
      totalPages: totalRes.count ?? 0,
      pagesThisMonth: monthRes.count ?? 0,
      totalFollowers: followersRes.count ?? 0,
      totalMembers: membersRes.count ?? 0,
    })
  } catch (error) {
    return fail(error)
  }
}

// ============================================================================
// LOGO / COVER STORAGE
// ============================================================================

export async function uploadCompanyLogo(
  file: CompanyImageUploadFile,
  companyId?: string,
): Promise<CompanyPageServiceResponse<{ url: string; path: string }>> {
  try {
    const ext = file.fileName.split('.').pop()?.toLowerCase().replace('jpg', 'jpeg') ?? 'jpeg'
    const folder = companyId ?? 'unsaved'
    const storagePath = `${folder}/logo_${Date.now()}.${ext}`

    const upload = await uploadStorageObject(
      COMPANY_LOGO_BUCKET,
      storagePath,
      file.blob,
      file.mimeType,
      { maxBytes: COMPANY_IMAGE_MAX_BYTES },
    )
    if (upload.error || !upload.data) return fail(upload.error ?? 'Upload failed')

    return ok({ url: upload.data.publicUrl, path: storagePath })
  } catch (error) {
    return fail(error)
  }
}

export async function uploadCompanyCover(
  file: CompanyImageUploadFile,
  companyId?: string,
): Promise<CompanyPageServiceResponse<{ url: string; path: string }>> {
  try {
    const ext = file.fileName.split('.').pop()?.toLowerCase().replace('jpg', 'jpeg') ?? 'jpeg'
    const folder = companyId ?? 'unsaved'
    const storagePath = `${folder}/cover_${Date.now()}.${ext}`

    const upload = await uploadStorageObject(
      COMPANY_COVER_BUCKET,
      storagePath,
      file.blob,
      file.mimeType,
      { maxBytes: COMPANY_IMAGE_MAX_BYTES },
    )
    if (upload.error || !upload.data) return fail(upload.error ?? 'Upload failed')

    return ok({ url: upload.data.publicUrl, path: storagePath })
  } catch (error) {
    return fail(error)
  }
}

async function removeStorageByPublicUrl(
  publicUrl: string | null | undefined,
  bucket: string,
): Promise<CompanyPageServiceResponse<{ removed: boolean }>> {
  try {
    if (!publicUrl || typeof publicUrl !== 'string') return ok({ removed: false })

    const marker = `/storage/v1/object/public/${bucket}/`
    const idx = publicUrl.indexOf(marker)
    if (idx === -1) return ok({ removed: false })

    const storagePath = decodeURIComponent(publicUrl.slice(idx + marker.length))
    const { error } = await supabase.storage.from(bucket).remove([storagePath])
    if (error) return fail(error)
    return ok({ removed: true })
  } catch (error) {
    return fail(error)
  }
}

export async function deleteCompanyLogo(
  publicUrl: string | null | undefined,
): Promise<CompanyPageServiceResponse<{ removed: boolean }>> {
  return removeStorageByPublicUrl(publicUrl, COMPANY_LOGO_BUCKET)
}

export async function deleteCompanyCover(
  publicUrl: string | null | undefined,
): Promise<CompanyPageServiceResponse<{ removed: boolean }>> {
  return removeStorageByPublicUrl(publicUrl, COMPANY_COVER_BUCKET)
}

export function getCompanyLogoPublicUrl(path: string): string {
  return getStoragePublicUrl(COMPANY_LOGO_BUCKET, path)
}

export function getCompanyCoverPublicUrl(path: string): string {
  return getStoragePublicUrl(COMPANY_COVER_BUCKET, path)
}
