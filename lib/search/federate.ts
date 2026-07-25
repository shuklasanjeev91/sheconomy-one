import { searchListingsPage, type ListingSummary } from '~/commerce/lib/commerce'
import { searchJobs } from '~/community/lib/jobs'
import { searchProfiles } from '~/community/lib/network'
import { fetchCompanies } from '~/community/lib/companies'
import { fetchGroups } from '~/community/lib/groups'
import { searchPosts } from '~/community/lib/community'
import { programToSearchFields, searchPrograms } from '~/class/lib/program-search'
import { searchMeetings } from '~/co-work/lib/meetings'
import { searchCategories } from '~/lib/listing/listing-categories.service'
import { getPublicShops } from '~/lib/shop/shop.service'
import {
  classRoutes,
  commerceRoutes,
  communityRoutes,
  coWorkRoutes,
} from '~/lib/routes'
import { supabase } from '~/lib/supabase/client'

import { blockedSearchScopes, scopesToQuery, type AccessTier } from '~/lib/search/access'
import type {
  CategoryHit,
  CompanyHit,
  FederateOptions,
  FederatedSearchResult,
  GroupHit,
  JobHit,
  ListingHit,
  MeetingHit,
  PersonHit,
  PostHit,
  ProgramHit,
  SearchScope,
  ShopHit,
} from '~/lib/search/types'

function listingToHit(listing: ListingSummary): ListingHit {
  const slug = listing.slug?.trim() || listing.id
  return {
    kind: 'listing',
    id: listing.id,
    title: listing.card_title || listing.title,
    subtitle: listing.shop_name,
    imageUrl: listing.image_url ?? listing.image_urls?.[0] ?? null,
    href: String(commerceRoutes.listing(slug)),
    price: listing.price ?? null,
    currency: listing.currency ?? null,
    slug: listing.slug,
  }
}

function snippet(text: string, max = 90): string {
  const cleaned = text.replace(/\s+/g, ' ').trim()
  if (cleaned.length <= max) return cleaned
  return `${cleaned.slice(0, max - 1)}…`
}

async function searchPersonalizedListings(
  query: string,
  userId: string,
  latitude: number | null | undefined,
  longitude: number | null | undefined,
  limit: number,
): Promise<ListingHit[] | null> {
  try {
    const { data, error } = await supabase.rpc('get_personalized_search_results', {
      search_query: query,
      target_user_id: userId,
      max_results: limit,
      user_lat: latitude ?? undefined,
      user_lng: longitude ?? undefined,
    })
    if (error || !data?.length) return null

    return (
      data as Array<{
        id: string
        title: string
        shop_name: string
        price: number
        category: string
      }>
    ).map((row) => ({
      kind: 'listing' as const,
      id: row.id,
      title: row.title,
      subtitle: row.shop_name || row.category || null,
      imageUrl: null,
      href: String(commerceRoutes.listing(row.id)),
      price: row.price ?? null,
      currency: null,
      slug: null,
    }))
  } catch {
    return null
  }
}

async function searchListingHits(
  query: string,
  limit: number,
  options: FederateOptions,
): Promise<ListingHit[]> {
  if (options.userId && (options.latitude != null || options.longitude != null)) {
    const personalized = await searchPersonalizedListings(
      query,
      options.userId,
      options.latitude,
      options.longitude,
      limit,
    )
    if (personalized?.length) return personalized
  }

  const page = await searchListingsPage(query, 0, { pageSize: limit })
  return page.items.map(listingToHit)
}

async function searchCategoryHits(query: string, limit: number): Promise<CategoryHit[]> {
  if (query.trim().length < 2) return []
  const res = await searchCategories(query, { limit })
  if (!res.success || !res.data) return []
  return res.data.map((category) => {
    const slug = category.seo_name?.trim() || category.category_id
    return {
      kind: 'category' as const,
      id: category.category_id,
      title: category.category,
      subtitle:
        category.product_count != null
          ? `${category.product_count} listing${category.product_count === 1 ? '' : 's'}`
          : category.description,
      imageUrl: category.category_image_url ?? null,
      href: String(commerceRoutes.category(slug)),
      slug,
    }
  })
}

async function searchShopHits(query: string, limit: number): Promise<ShopHit[]> {
  const res = await getPublicShops({ search: query }, { limit, offset: 0, sortBy: 'rating' })
  if (!res.success || !res.data) return []
  return res.data.items.map((shop) => {
    const slug = shop.slug?.trim() || shop.id
    return {
      kind: 'shop' as const,
      id: shop.id,
      title: shop.shop_name,
      subtitle: shop.shop_description ? snippet(shop.shop_description) : null,
      imageUrl: shop.logo_url,
      href: String(commerceRoutes.shop(slug)),
      slug: shop.slug,
    }
  })
}

async function searchPeopleHits(query: string, limit: number): Promise<PersonHit[]> {
  const rows = await searchProfiles(query, limit)
  return rows.map((row) => {
    const handle = row.username?.trim() || row.id
    return {
      kind: 'person' as const,
      id: row.id,
      title: row.full_name?.trim() || row.username || 'Member',
      subtitle: row.headline || (row.username ? `@${row.username}` : null),
      imageUrl: row.avatar_url,
      href: String(communityRoutes.userProfile(handle)),
      username: row.username,
    }
  })
}

async function searchCompanyHits(query: string, limit: number): Promise<CompanyHit[]> {
  const { items } = await fetchCompanies(0, query)
  return items.slice(0, limit).map((company) => ({
    kind: 'company' as const,
    id: company.id,
    title: company.name,
    subtitle: company.tagline || company.industry || null,
    imageUrl: company.logo_url,
    href: String(communityRoutes.company(company.id)),
    slug: company.page_slug || company.id,
  }))
}

async function searchGroupHits(query: string, limit: number): Promise<GroupHit[]> {
  const { items } = await fetchGroups(0, query)
  return items.slice(0, limit).map((group) => ({
    kind: 'group' as const,
    id: group.id,
    title: group.title || group.name,
    subtitle:
      group.members_count != null
        ? `${group.members_count} member${group.members_count === 1 ? '' : 's'}`
        : group.description
          ? snippet(group.description)
          : null,
    imageUrl: group.avatar_url,
    href: String(communityRoutes.group(group.id)),
  }))
}

async function searchJobHits(query: string, limit: number): Promise<JobHit[]> {
  const { items } = await searchJobs({ search: query, page: 0 })
  return items.slice(0, limit).map((job) => ({
    kind: 'job' as const,
    id: job.id,
    title: job.title,
    subtitle: [job.company_name, job.location].filter(Boolean).join(' · ') || null,
    imageUrl: job.company_logo,
    href: String(communityRoutes.job(job.id)),
    companyName: job.company_name,
    location: job.location,
  }))
}

async function searchPostHits(query: string, limit: number): Promise<PostHit[]> {
  const rows = await searchPosts(query, limit)
  return rows.map((row) => ({
    kind: 'post' as const,
    id: row.id,
    title: snippet(row.content || 'Post', 80) || 'Post',
    subtitle: row.author_name ? `by ${row.author_name}` : null,
    imageUrl: row.image_url ?? row.author_avatar,
    href: String(communityRoutes.post(row.id)),
  }))
}

async function searchProgramHits(query: string, limit: number): Promise<ProgramHit[]> {
  const { programs } = await searchPrograms(query, limit)
  return programs.map((program) => {
    const fields = programToSearchFields(program)
    return {
      kind: 'program' as const,
      id: fields.id,
      title: fields.title,
      subtitle: fields.subtitle,
      imageUrl: fields.imageUrl,
      href: String(classRoutes.program(fields.slug)),
      slug: fields.slug,
    }
  })
}

async function searchMeetingHits(query: string, limit: number): Promise<MeetingHit[]> {
  const rows = await searchMeetings(query, limit)
  return rows.map((meeting) => ({
    kind: 'meeting' as const,
    id: meeting.id,
    title: meeting.title,
    subtitle:
      meeting.host?.full_name || meeting.host?.username
        ? `Hosted by ${meeting.host.full_name || meeting.host.username}`
        : meeting.meeting_code
          ? `Code ${meeting.meeting_code}`
          : meeting.description
            ? snippet(meeting.description)
            : null,
    imageUrl: meeting.host?.avatar_url ?? null,
    href: String(coWorkRoutes.meeting(meeting.meeting_code)),
    code: meeting.meeting_code,
  }))
}

function emptyResult(query: string, scope: SearchScope, blocked: SearchScope[]): FederatedSearchResult {
  return {
    query,
    scope,
    listings: [],
    categories: [],
    shops: [],
    people: [],
    companies: [],
    groups: [],
    jobs: [],
    posts: [],
    programs: [],
    meetings: [],
    blockedScopes: blocked,
  }
}

export async function federatedSearch(
  query: string,
  options: FederateOptions,
): Promise<FederatedSearchResult> {
  const trimmed = query.trim()
  const limit = options.limitPerScope ?? 8
  const blocked = blockedSearchScopes(options.tier)
  const result = emptyResult(trimmed, options.scope, blocked)

  if (!trimmed) return result

  const targets = scopesToQuery(options.scope, options.tier)
  const tasks: Array<Promise<void>> = []

  if (targets.includes('listings')) {
    tasks.push(
      searchListingHits(trimmed, limit, options).then((listings) => {
        result.listings = listings
      }),
    )
  }
  if (targets.includes('categories')) {
    tasks.push(
      searchCategoryHits(trimmed, limit).then((categories) => {
        result.categories = categories
      }),
    )
  }
  if (targets.includes('shops')) {
    tasks.push(
      searchShopHits(trimmed, limit).then((shops) => {
        result.shops = shops
      }),
    )
  }
  if (targets.includes('people')) {
    tasks.push(
      searchPeopleHits(trimmed, limit).then((people) => {
        result.people = people
      }),
    )
  }
  if (targets.includes('companies')) {
    tasks.push(
      searchCompanyHits(trimmed, limit).then((companies) => {
        result.companies = companies
      }),
    )
  }
  if (targets.includes('groups')) {
    tasks.push(
      searchGroupHits(trimmed, limit).then((groups) => {
        result.groups = groups
      }),
    )
  }
  if (targets.includes('jobs')) {
    tasks.push(
      searchJobHits(trimmed, limit).then((jobs) => {
        result.jobs = jobs
      }),
    )
  }
  if (targets.includes('posts')) {
    tasks.push(
      searchPostHits(trimmed, limit).then((posts) => {
        result.posts = posts
      }),
    )
  }
  if (targets.includes('programs')) {
    tasks.push(
      searchProgramHits(trimmed, limit).then((programs) => {
        result.programs = programs
      }),
    )
  }
  if (targets.includes('meetings')) {
    tasks.push(
      searchMeetingHits(trimmed, limit).then((meetings) => {
        result.meetings = meetings
      }),
    )
  }

  await Promise.allSettled(tasks)
  return result
}

export function flattenFederatedHits(result: FederatedSearchResult, scope: SearchScope) {
  if (scope === 'listings') return result.listings
  if (scope === 'categories') return result.categories
  if (scope === 'shops') return result.shops
  if (scope === 'people') return result.people
  if (scope === 'companies') return result.companies
  if (scope === 'groups') return result.groups
  if (scope === 'jobs') return result.jobs
  if (scope === 'posts') return result.posts
  if (scope === 'programs') return result.programs
  if (scope === 'meetings') return result.meetings
  return [
    ...result.listings,
    ...result.categories,
    ...result.shops,
    ...result.people,
    ...result.companies,
    ...result.groups,
    ...result.jobs,
    ...result.posts,
    ...result.programs,
    ...result.meetings,
  ]
}

export type { AccessTier }
