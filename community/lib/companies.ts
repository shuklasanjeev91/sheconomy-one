import { isUuid } from '~/commerce/lib/seo-urls'
import { supabase } from '~/lib/supabase/client'

export const COMPANY_PAGE_SIZE = 20

export type CompanyPage = {
  id: string
  name: string
  page_slug: string
  tagline: string | null
  industry: string
  location: string | null
  headquarters: string | null
  website: string | null
  logo_url: string | null
  cover_url: string | null
  size: string
  type: string
  page_category: string
  founded_year: number | null
  community_members: number | null
  created_by: string | null
  created_at: string
}

export async function fetchCompanyBySlug(slugOrId: string): Promise<{
  data: CompanyPage | null
  error: string | null
}> {
  const normalized = decodeURIComponent(slugOrId).trim()

  // Company page_slug values are user-entered and often contain spaces or
  // slashes, which break URL routing. Prefer resolving by the stable id (uuid);
  // fall back to page_slug for legacy links.
  let query = supabase.from('companypages').select('*')
  query = isUuid(normalized) ? query.eq('id', normalized) : query.eq('page_slug', normalized)

  const { data, error } = await query.maybeSingle()

  return { data: (data as CompanyPage | null) ?? null, error: error?.message ?? null }
}

export type CompanyFilters = {
  industry?: string
  location?: string
  size?: string
}

export async function fetchCompanies(
  page = 0,
  search = '',
  filters: CompanyFilters = {},
): Promise<{ items: CompanyPage[]; hasMore: boolean; error: string | null }> {
  const from = page * COMPANY_PAGE_SIZE
  const to = from + COMPANY_PAGE_SIZE - 1

  let query = supabase
    .from('companypages')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })

  if (search.trim()) {
    query = query.or(`name.ilike.%${search.trim()}%,industry.ilike.%${search.trim()}%`)
  }

  if (filters.industry) query = query.eq('industry', filters.industry)
  if (filters.size) query = query.eq('size', filters.size)
  if (filters.location) {
    const value = filters.location.replace(/[%,]/g, '')
    query = query.or(`location.eq.${value},headquarters.eq.${value}`)
  }

  const { data, error, count } = await query.range(from, to)
  if (error) return { items: [], hasMore: false, error: error.message }

  const total = count ?? 0
  return {
    items: (data ?? []) as CompanyPage[],
    hasMore: total ? to + 1 < total : (data?.length ?? 0) === COMPANY_PAGE_SIZE,
    error: null,
  }
}

export type CompanyFacets = {
  industries: string[]
  locations: string[]
  sizes: string[]
}

/** Distinct filter option values across all pages (for stable filter menus). */
export async function fetchCompanyFacets(): Promise<CompanyFacets> {
  const industries = new Set<string>()
  const locations = new Set<string>()
  const sizes = new Set<string>()
  const sorted = (set: Set<string>) => Array.from(set).sort((a, b) => a.localeCompare(b))

  // Prefer the SECURITY DEFINER RPC (distinct across all rows); fall back to a
  // bounded column scan if the function is not deployed in this environment.
  const { data: facetRows, error } = await supabase.rpc('community_company_facets')
  if (!error && facetRows) {
    for (const row of facetRows as { facet: string; value: string }[]) {
      if (row.facet === 'industry') industries.add(row.value)
      else if (row.facet === 'location') locations.add(row.value)
      else if (row.facet === 'size') sizes.add(row.value)
    }
    return { industries: sorted(industries), locations: sorted(locations), sizes: sorted(sizes) }
  }

  const { data } = await supabase
    .from('companypages')
    .select('industry, location, headquarters, size')
    .limit(1000)

  for (const row of (data ?? []) as Partial<CompanyPage>[]) {
    if (row.industry?.trim()) industries.add(row.industry.trim())
    if (row.location?.trim()) locations.add(row.location.trim())
    if (row.headquarters?.trim()) locations.add(row.headquarters.trim())
    if (row.size?.trim()) sizes.add(row.size.trim())
  }

  return { industries: sorted(industries), locations: sorted(locations), sizes: sorted(sizes) }
}

/**
 * Suggest company/organization names for the profile autocomplete. Matches
 * existing company pages by name and returns de-duplicated, ordered names.
 */
export async function suggestCompanyNames(query: string, limit = 12): Promise<string[]> {
  const trimmed = query.trim()
  let request = supabase
    .from('companypages')
    .select('name')
    .order('community_members', { ascending: false, nullsFirst: false })
    .limit(limit)

  if (trimmed) {
    request = request.ilike('name', `%${trimmed}%`)
  }

  const { data, error } = await request
  if (error || !data) return []

  const seen = new Set<string>()
  const names: string[] = []
  for (const row of data as { name: string | null }[]) {
    const name = row.name?.trim()
    if (!name) continue
    const key = name.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    names.push(name)
  }
  return names
}

export type CompanyMemberRole = 'owner' | 'admin'

export type CompanyMember = {
  user_id: string
  role: CompanyMemberRole
  username: string | null
  full_name: string
  headline: string | null
  avatar_url: string | null
}

export async function fetchCompanyMembership(
  companyId: string,
  userId: string,
): Promise<{ role: CompanyMemberRole | null; isManager: boolean; isOwner: boolean }> {
  const { data } = await supabase
    .from('company_members')
    .select('role')
    .eq('company_id', companyId)
    .eq('user_id', userId)
    .maybeSingle()

  const role = (data?.role as CompanyMemberRole | undefined) ?? null
  if (role) {
    return { role, isManager: true, isOwner: role === 'owner' }
  }

  // Fallback for pages created before company_members backfill / RLS lag.
  const { data: company } = await supabase
    .from('companypages')
    .select('created_by')
    .eq('id', companyId)
    .maybeSingle()

  if (company?.created_by === userId) {
    return { role: 'owner', isManager: true, isOwner: true }
  }

  return { role: null, isManager: false, isOwner: false }
}

export async function fetchCompanyMembers(companyId: string): Promise<CompanyMember[]> {
  const { data } = await supabase
    .from('company_members')
    .select('user_id, role')
    .eq('company_id', companyId)
    .order('role', { ascending: true })

  const rows = (data ?? []).filter((row) => row.user_id) as { user_id: string; role: CompanyMemberRole }[]
  if (!rows.length) return []

  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, username, full_name, headline, avatar_url')
    .in(
      'id',
      rows.map((row) => row.user_id),
    )

  const profileById = new Map((profiles ?? []).map((profile) => [profile.id, profile]))

  return rows.map((row) => {
    const profile = profileById.get(row.user_id)
    return {
      user_id: row.user_id,
      role: row.role,
      username: profile?.username ?? null,
      full_name: profile?.full_name ?? profile?.username ?? 'Member',
      headline: profile?.headline ?? null,
      avatar_url: profile?.avatar_url ?? null,
    }
  })
}

export async function setCompanyMemberRole(
  companyId: string,
  userId: string,
  role: 'admin' | 'member',
): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc('set_company_member_role', {
    p_company_id: companyId,
    p_user_id: userId,
    p_role: role,
  })
  return { error: error?.message ?? null }
}

export async function fetchMyCompanies(userId: string): Promise<CompanyPage[]> {
  const { data: memberships } = await supabase
    .from('company_members')
    .select('company_id')
    .eq('user_id', userId)
    .in('role', ['owner', 'admin'])

  const memberIds = (memberships ?? []).map((row) => row.company_id).filter(Boolean) as string[]

  const [{ data: byMembership }, { data: byCreator }] = await Promise.all([
    memberIds.length
      ? supabase.from('companypages').select('*').in('id', memberIds)
      : Promise.resolve({ data: [] as CompanyPage[] }),
    supabase.from('companypages').select('*').eq('created_by', userId),
  ])

  const byId = new Map<string, CompanyPage>()
  for (const page of [...(byMembership ?? []), ...(byCreator ?? [])] as CompanyPage[]) {
    byId.set(page.id, page)
  }

  return Array.from(byId.values()).sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  )
}

export type CreateCompanyInput = {
  name: string
  pageSlug: string
  industry: string
  size: string
  type: string
  tagline?: string
  location?: string
  headquarters?: string
  website?: string
  logoUrl?: string
  coverUrl?: string
  foundedYear?: number
}

export async function createCompanyPage(
  userId: string,
  input: CreateCompanyInput,
): Promise<{ data: CompanyPage | null; error: string | null }> {
  const { data, error } = await supabase
    .from('companypages')
    .insert({
      name: input.name.trim(),
      page_slug: input.pageSlug.trim().toLowerCase().replace(/\s+/g, '-'),
      industry: input.industry.trim(),
      size: input.size,
      type: input.type,
      page_category: 'business',
      tagline: input.tagline ?? null,
      location: input.location ?? null,
      headquarters: input.headquarters ?? null,
      website: input.website ?? null,
      logo_url: input.logoUrl ?? null,
      cover_url: input.coverUrl ?? null,
      founded_year: input.foundedYear ?? null,
      created_by: userId,
    })
    .select('*')
    .maybeSingle()

  return { data: (data as CompanyPage | null) ?? null, error: error?.message ?? null }
}

export async function fetchCompanyFollowState(
  companyId: string,
  userId: string,
): Promise<{ isFollowing: boolean; followId: string | null }> {
  const { data } = await supabase
    .from('company_followers')
    .select('id')
    .eq('company_id', companyId)
    .eq('follower_id', userId)
    .maybeSingle()

  return { isFollowing: !!data, followId: data?.id ?? null }
}

export async function followCompany(
  companyId: string,
  userId: string,
): Promise<{ error: string | null }> {
  const { error } = await supabase.from('company_followers').insert({
    company_id: companyId,
    follower_id: userId,
  })
  return { error: error?.message ?? null }
}

export async function unfollowCompany(
  companyId: string,
  userId: string,
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('company_followers')
    .delete()
    .eq('company_id', companyId)
    .eq('follower_id', userId)
  return { error: error?.message ?? null }
}

export async function fetchCompanyFollowerCount(companyId: string): Promise<number> {
  const { count } = await supabase
    .from('company_followers')
    .select('id', { count: 'exact', head: true })
    .eq('company_id', companyId)
  return count ?? 0
}

export type CompanyFollower = {
  user_id: string
  username: string | null
  full_name: string
  headline: string | null
  avatar_url: string | null
}

export async function fetchCompanyFollowers(companyId: string): Promise<CompanyFollower[]> {
  const { data } = await supabase
    .from('company_followers')
    .select('follower_id')
    .eq('company_id', companyId)
    .order('created_at', { ascending: false })
    .limit(50)

  const userIds = (data ?? []).map((row) => row.follower_id).filter(Boolean)
  if (!userIds.length) return []

  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, username, full_name, headline, avatar_url')
    .in('id', userIds)

  return (profiles ?? []).map((profile) => ({
    user_id: profile.id,
    username: profile.username,
    full_name: profile.full_name ?? profile.username,
    headline: profile.headline,
    avatar_url: profile.avatar_url,
  }))
}

export type UpdateCompanyInput = Partial<{
  name: string
  tagline: string
  industry: string
  size: string
  type: string
  location: string
  headquarters: string
  website: string
  logoUrl: string
  coverUrl: string
  foundedYear: number
}>

export async function updateCompanyPage(
  companyId: string,
  userId: string,
  input: UpdateCompanyInput,
): Promise<{ error: string | null }> {
  const membership = await fetchCompanyMembership(companyId, userId)
  if (!membership.isManager) {
    return { error: 'You do not have permission to edit this page.' }
  }

  const { error } = await supabase
    .from('companypages')
    .update({
      name: input.name?.trim(),
      tagline: input.tagline ?? null,
      industry: input.industry?.trim(),
      size: input.size,
      type: input.type,
      location: input.location ?? null,
      headquarters: input.headquarters ?? null,
      website: input.website ?? null,
      logo_url: input.logoUrl ?? null,
      cover_url: input.coverUrl ?? null,
      founded_year: input.foundedYear ?? null,
    })
    .eq('id', companyId)

  return { error: error?.message ?? null }
}
