import {
  inferCountryFromLocale,
  parseProfileLocation,
  type UserGeo,
} from '~/commerce/lib/marketplace-personalization'
import { fetchCompanies, type CompanyPage } from '~/community/lib/companies'
import { fetchUpcomingEvents, type CommunityEvent } from '~/community/lib/events'
import { fetchGroups, type Group } from '~/community/lib/groups'
import { searchJobs, type JobListing } from '~/community/lib/jobs'
import { fetchDiscoverMembers, type NetworkMember } from '~/community/lib/network'
import { fetchListingFeedPage, fetchShopsPage, type ListingSummary } from '~/commerce/lib/commerce'
import { getListingSlug } from '~/commerce/lib/seo-urls'
import { formatMoneyLabel } from '~/lib/format'
import { communityRoutes, commerceRoutes } from '~/lib/routes'
import { supabase } from '~/lib/supabase/client'

import { BRAND_NAME, BRAND_SHOP_LABEL } from '~/config/brand'

export type SuggestionKind = 'person' | 'listing' | 'shop' | 'company' | 'group' | 'job' | 'event'

export type SuggestionSectionMeta = {
  kind: SuggestionKind
  title: string
  seeAllHref: string
}

export type CommunitySuggestionListingMeta = {
  slug: string
  price: number | null
  currency: string | null
  shopName: string | null
}

export type CommunitySuggestion = {
  id: string
  kind: SuggestionKind
  title: string
  subtitle: string
  href: string
  imageUrl?: string | null
  score: number
  reason: string
  /** Present on `listing` suggestions — powers Add to cart / Buy now in the feed. */
  listingMeta?: CommunitySuggestionListingMeta
}

export type PersonalizationContext = {
  userId?: string
  industry?: string | null
  occupation?: string | null
  interests?: string[] | null
  location?: string | null
  geo: UserGeo
  networkSuggestions?: NetworkMember[]
  excludeUserIds?: Set<string>
}

const KIND_LABEL: Record<SuggestionKind, string> = {
  person: 'Network',
  listing: 'Product',
  shop: 'Shop',
  company: 'Page',
  group: 'Group',
  job: 'Job',
  event: 'Event',
}

const SUGGESTION_KIND_ORDER: SuggestionKind[] = [
  'person',
  'listing',
  'shop',
  'company',
  'group',
  'job',
  'event',
]

/** Destination for each suggestion section's "See all" action. */
export function getSuggestionSeeAllHref(kind: SuggestionKind): string {
  switch (kind) {
    case 'person':
      return communityRoutes.network
    case 'listing':
      return commerceRoutes.browse('featured')
    case 'shop':
      return commerceRoutes.shops
    case 'company':
      return communityRoutes.companies
    case 'group':
      return communityRoutes.groups
    case 'job':
      return communityRoutes.jobs
    case 'event':
      return communityRoutes.events
  }
}

export const SUGGESTION_SECTIONS: SuggestionSectionMeta[] = [
  { kind: 'person', title: 'Network suggestions', seeAllHref: getSuggestionSeeAllHref('person') },
  { kind: 'listing', title: 'Products for you', seeAllHref: getSuggestionSeeAllHref('listing') },
  { kind: 'shop', title: 'Shops for you', seeAllHref: getSuggestionSeeAllHref('shop') },
  { kind: 'company', title: 'Pages for you', seeAllHref: getSuggestionSeeAllHref('company') },
  { kind: 'group', title: 'Groups for you', seeAllHref: getSuggestionSeeAllHref('group') },
  { kind: 'job', title: 'Jobs for you', seeAllHref: getSuggestionSeeAllHref('job') },
  { kind: 'event', title: 'Events for you', seeAllHref: getSuggestionSeeAllHref('event') },
]

/** Ensures every candidate competes even without profile/geo signals. */
const BASE_SCORE = 10

export function suggestionKindLabel(kind: SuggestionKind) {
  return KIND_LABEL[kind]
}

function normalize(value?: string | null) {
  return value?.trim().toLowerCase() ?? ''
}

function tokenize(...parts: Array<string | null | undefined>) {
  return parts
    .flatMap((part) => (part ?? '').toLowerCase().split(/[^a-z0-9]+/))
    .filter((token) => token.length > 2)
}

function locationScore(userGeo: UserGeo, userLocation: string | null | undefined, target?: string | null) {
  if (!target?.trim()) return 0
  const userParts = parseProfileLocation(userLocation)
  const targetParts = parseProfileLocation(target)
  let score = 0

  const userCity = normalize(userGeo.city ?? userParts.city)
  const userState = normalize(userGeo.state ?? userParts.state)
  const userCountry = normalize(userGeo.country ?? userParts.country ?? inferCountryFromLocale())

  const targetCity = normalize(targetParts.city ?? target)
  const targetState = normalize(targetParts.state)
  const targetCountry = normalize(targetParts.country)
  const targetNorm = normalize(target)

  if (userCity && (targetCity === userCity || targetNorm.includes(userCity))) score += 18
  if (userState && (targetState === userState || targetNorm.includes(userState))) score += 12
  if (userCountry && (targetCountry === userCountry || targetNorm.includes(userCountry))) score += 8

  return score
}

function interestScore(
  interests: string[] | null | undefined,
  industry: string | null | undefined,
  occupation: string | null | undefined,
  ...texts: Array<string | null | undefined>
) {
  const needles = [
    ...tokenize(industry, occupation),
    ...(interests ?? []).flatMap((item) => tokenize(item)),
  ]
  if (!needles.length) return 0

  const haystack = tokenize(...texts).join(' ')
  if (!haystack) return 0

  let score = 0
  for (const needle of needles) {
    if (haystack.includes(needle)) score += 10
  }
  return Math.min(score, 35)
}

function popularityScore(value?: number | null, multiplier = 1) {
  if (!value || value <= 0) return 0
  return Math.min(20, Math.log10(value + 1) * 6 * multiplier)
}

function scorePerson(member: NetworkMember, ctx: PersonalizationContext): CommunitySuggestion {
  const score =
    member.mutual_count * 14 +
    locationScore(ctx.geo, ctx.location, member.location) +
    interestScore(ctx.interests, ctx.industry, ctx.occupation, member.headline, member.industry, member.full_name) +
    popularityScore(member.mutual_count, 0.8) +
    (member.is_verified ? 6 : 0)

  const reasons: string[] = []
  if (member.mutual_count > 0) reasons.push(`${member.mutual_count} mutual`)
  if (locationScore(ctx.geo, ctx.location, member.location) > 0) reasons.push('Near you')
  if (interestScore(ctx.interests, ctx.industry, ctx.occupation, member.headline, member.industry) > 0) {
    reasons.push('Shared interests')
  }
  if (!reasons.length) reasons.push(`Popular on ${BRAND_NAME}`)

  return {
    id: member.user_id,
    kind: 'person',
    title: member.full_name,
    subtitle: member.headline || member.industry || 'Network member',
    href: member.username ? `/profile/${member.username}` : communityRoutes.network,
    imageUrl: member.avatar_url,
    score: score + BASE_SCORE,
    reason: reasons[0],
  }
}

function scoreListing(listing: ListingSummary, ctx: PersonalizationContext): CommunitySuggestion {
  const locationText = [
    listing.shop_address?.city,
    listing.shop_address?.state,
    listing.shop_address?.country,
  ]
    .filter(Boolean)
    .join(', ')

  const score =
    interestScore(
      ctx.interests,
      ctx.industry,
      ctx.occupation,
      listing.title,
      listing.card_title,
      listing.category,
      listing.shop_name,
    ) +
    locationScore(ctx.geo, ctx.location, locationText) +
    popularityScore(listing.total_reviews) +
    ((listing.average_rating ?? 0) >= 4.5 ? 14 : (listing.average_rating ?? 0) >= 4 ? 8 : 0) +
    (listing.is_featured ? 10 : 0) +
    (listing.shop_verified ? 6 : 0)

  const reasons: string[] = []
  if (interestScore(ctx.interests, ctx.industry, ctx.occupation, listing.title, listing.category) > 0) {
    reasons.push('Matches your interests')
  } else if (locationScore(ctx.geo, ctx.location, locationText) > 0) {
    reasons.push('From a shop near you')
  } else if ((listing.average_rating ?? 0) >= 4.5) {
    reasons.push('Top rated product')
  } else if (listing.is_featured) {
    reasons.push('Featured pick')
  } else {
    reasons.push('Trending on marketplace')
  }

  const slug = getListingSlug(listing)
  const imageUrl = listing.image_urls[0] ?? listing.image_url ?? listing.images[0]?.image_url ?? null
  const priceLabel = formatMoneyLabel(listing.price, listing.currency)

  return {
    id: listing.id,
    kind: 'listing',
    title: listing.card_title || listing.title,
    subtitle: listing.shop_name ? `${listing.shop_name} · ${priceLabel}` : priceLabel,
    href: commerceRoutes.listing(slug),
    imageUrl,
    score: score + BASE_SCORE,
    reason: reasons[0],
    listingMeta: {
      slug,
      price: listing.price ?? null,
      currency: listing.currency ?? null,
      shopName: listing.shop_name ?? null,
    },
  }
}

function scoreShop(
  shop: {
    id: string
    shop_name: string
    slug: string | null
    logo_url: string | null
    shop_description: string | null
    average_rating: number | null
    total_reviews: number | null
    verified: boolean
  },
  ctx: PersonalizationContext,
): CommunitySuggestion {
  const score =
    interestScore(ctx.interests, ctx.industry, ctx.occupation, shop.shop_name, shop.shop_description) +
    popularityScore(shop.total_reviews) +
    ((shop.average_rating ?? 0) >= 4.5 ? 14 : (shop.average_rating ?? 0) >= 4 ? 8 : 0) +
    (shop.verified ? 8 : 0)

  const reasons: string[] = []
  if (interestScore(ctx.interests, ctx.industry, ctx.occupation, shop.shop_name, shop.shop_description) > 0) {
    reasons.push('Matches your interests')
  } else if ((shop.average_rating ?? 0) >= 4.5) {
    reasons.push('Top rated shop')
  } else if (shop.verified) {
    reasons.push('Verified seller')
  } else {
    reasons.push('Trending marketplace')
  }

  return {
    id: shop.id,
    kind: 'shop',
    title: shop.shop_name,
    subtitle: shop.shop_description || BRAND_SHOP_LABEL,
    href: shop.slug ? commerceRoutes.shop(shop.slug) : commerceRoutes.shops,
    imageUrl: shop.logo_url,
    score: score + BASE_SCORE,
    reason: reasons[0],
  }
}

function scoreCompany(company: CompanyPage, ctx: PersonalizationContext): CommunitySuggestion {
  const score =
    interestScore(ctx.interests, ctx.industry, ctx.occupation, company.name, company.industry, company.tagline) +
    locationScore(ctx.geo, ctx.location, company.location ?? company.headquarters) +
    popularityScore(company.community_members) +
    (normalize(company.industry) === normalize(ctx.industry) ? 20 : 0)

  const reasons: string[] = []
  if (normalize(company.industry) === normalize(ctx.industry)) reasons.push('In your industry')
  else if (locationScore(ctx.geo, ctx.location, company.location ?? company.headquarters) > 0) {
    reasons.push('Near you')
  } else {
    reasons.push('Popular page')
  }

  return {
    id: company.id,
    kind: 'company',
    title: company.name,
    subtitle: company.tagline || company.industry,
    href: communityRoutes.company(company.id),
    imageUrl: company.logo_url,
    score: score + BASE_SCORE,
    reason: reasons[0],
  }
}

function scoreGroup(group: Group, ctx: PersonalizationContext): CommunitySuggestion {
  const industryText = (group.industries ?? []).join(' ')
  const score =
    interestScore(ctx.interests, ctx.industry, ctx.occupation, group.title, group.description, industryText) +
    locationScore(ctx.geo, ctx.location, group.location) +
    popularityScore(group.members_count) +
    (group.group_type === 'public' ? 4 : 0)

  return {
    id: group.id,
    kind: 'group',
    title: group.title,
    subtitle: `${group.members_count ?? 0} members · ${group.group_type ?? 'public'}`,
    href: communityRoutes.group(group.id),
    imageUrl: group.avatar_url,
    score: score + BASE_SCORE,
    reason:
      interestScore(ctx.interests, ctx.industry, ctx.occupation, group.title, group.description, industryText) > 0
        ? 'Based on your interests'
        : locationScore(ctx.geo, ctx.location, group.location) > 0
          ? 'Local community'
          : 'Active group',
  }
}

function scoreJob(job: JobListing, ctx: PersonalizationContext): CommunitySuggestion {
  const score =
    locationScore(ctx.geo, ctx.location, job.location) +
    interestScore(ctx.interests, ctx.industry, ctx.occupation, job.title, job.description, job.company_name, job.industry) +
    popularityScore(job.application_count) +
    (job.is_remote ? 10 : 0) +
    (job.is_saved ? 12 : 0)

  const reasons: string[] = []
  if (job.is_remote) reasons.push('Remote friendly')
  else if (locationScore(ctx.geo, ctx.location, job.location) > 0) reasons.push('Near you')
  else if (interestScore(ctx.interests, ctx.industry, ctx.occupation, job.title, job.description) > 0) {
    reasons.push('Matches your profile')
  } else {
    reasons.push('Popular role')
  }

  return {
    id: job.id,
    kind: 'job',
    title: job.title,
    subtitle: `${job.company_name} · ${job.location}`,
    href: communityRoutes.job(job.id),
    imageUrl: job.company_logo,
    score: score + BASE_SCORE,
    reason: reasons[0],
  }
}

function scoreEvent(event: CommunityEvent, ctx: PersonalizationContext): CommunitySuggestion {
  const starts = new Date(event.start_time).getTime()
  const daysAway = Number.isNaN(starts) ? 99 : (starts - Date.now()) / (1000 * 60 * 60 * 24)
  const soonBoost = daysAway >= 0 && daysAway <= 14 ? Math.max(0, 14 - daysAway) : 0

  const score =
    (event.is_online ? 12 : locationScore(ctx.geo, ctx.location, event.location)) +
    interestScore(ctx.interests, ctx.industry, ctx.occupation, event.title, event.description, ...(event.tags ?? [])) +
    soonBoost +
    (event.is_free ? 4 : 0)

  return {
    id: event.id,
    kind: 'event',
    title: event.title,
    subtitle: event.is_online ? 'Online event' : event.location || 'In person',
    href: communityRoutes.event(event.id),
    imageUrl: event.image_url,
    score: score + BASE_SCORE,
    reason: event.is_online ? 'Online · fits your schedule' : 'Happening near you',
  }
}

function sortByScore(items: CommunitySuggestion[]) {
  return [...items].sort((a, b) => b.score - a.score)
}

/** Round-robin across kinds so one high-scoring type cannot fill the whole widget. */
function diversifyByKind(pools: Record<SuggestionKind, CommunitySuggestion[]>, limit: number) {
  const picked: CommunitySuggestion[] = []
  const pointers = new Map<SuggestionKind, number>()

  for (const kind of SUGGESTION_KIND_ORDER) {
    pointers.set(kind, 0)
  }

  while (picked.length < limit) {
    let addedThisRound = false

    for (const kind of SUGGESTION_KIND_ORDER) {
      const pool = pools[kind]
      const index = pointers.get(kind) ?? 0
      if (!pool?.length || index >= pool.length) continue

      picked.push(pool[index])
      pointers.set(kind, index + 1)
      addedThisRound = true
      if (picked.length >= limit) break
    }

    if (!addedThisRound) break
  }

  return picked
}

export async function fetchCommunitySuggestions(
  ctx: PersonalizationContext,
  options: { limit?: number; perKindLimit?: number } = {},
): Promise<{
  items: CommunitySuggestion[]
  byKind: Record<SuggestionKind, CommunitySuggestion[]>
  people: CommunitySuggestion[]
  error: string | null
}> {
  const limit = options.limit ?? 8
  const perKindLimit = options.perKindLimit ?? 4
  const exclude = ctx.excludeUserIds ?? new Set<string>()
  if (ctx.userId) exclude.add(ctx.userId)

  const [peopleRpc, discoverPeople, listings, shops, companies, groups, jobs, events] =
    await Promise.all([
      ctx.userId
        ? supabase.rpc('get_connection_suggestions', {
            target_user_id: ctx.userId,
            limit_count: 12,
          })
        : Promise.resolve({ data: [], error: null }),
      fetchDiscoverMembers(ctx.userId, 16),
      fetchListingFeedPage('featured', 0, { pageSize: 12 }),
      fetchShopsPage(0, 12),
      fetchCompanies(0, ''),
      fetchGroups(0, ''),
      searchJobs({ page: 0 }),
      fetchUpcomingEvents(0),
    ])

  const rpcPeople: NetworkMember[] = ((peopleRpc.data ?? []) as Array<{
    user_id: string
    full_name: string
    headline: string | null
    avatar_url: string | null
    mutual_count: number
  }>).map((row) => ({
    user_id: row.user_id,
    username: null,
    full_name: row.full_name,
    headline: row.headline,
    avatar_url: row.avatar_url,
    location: null,
    industry: null,
    is_verified: false,
    mutual_count: row.mutual_count ?? 0,
    connection_id: null,
    connection_status: null,
    is_sender: false,
  }))

  const peoplePool = [...(ctx.networkSuggestions ?? []), ...rpcPeople, ...discoverPeople.items].filter(
    (member, index, list) =>
      !exclude.has(member.user_id) &&
      list.findIndex((item) => item.user_id === member.user_id) === index,
  )

  const pools: Record<SuggestionKind, CommunitySuggestion[]> = {
    person: sortByScore(peoplePool.map((member) => scorePerson(member, ctx))),
    listing: sortByScore((listings.items ?? []).map((listing) => scoreListing(listing, ctx))),
    shop: sortByScore((shops.items ?? []).map((shop) => scoreShop(shop, ctx))),
    company: sortByScore(companies.items.map((company) => scoreCompany(company, ctx))),
    group: sortByScore(groups.items.map((group) => scoreGroup(group, ctx))),
    job: sortByScore(jobs.items.map((job) => scoreJob(job, ctx))),
    event: sortByScore(events.items.map((event) => scoreEvent(event, ctx))),
  }

  const byKind = Object.fromEntries(
    SUGGESTION_KIND_ORDER.map((kind) => [kind, pools[kind].slice(0, perKindLimit)]),
  ) as Record<SuggestionKind, CommunitySuggestion[]>

  return {
    items: diversifyByKind(pools, limit),
    byKind,
    people: pools.person.slice(0, 5),
    error:
      peopleRpc.error?.message ??
      discoverPeople.error ??
      listings.error ??
      shops.error ??
      companies.error ??
      groups.error ??
      jobs.error ??
      events.error ??
      null,
  }
}

export async function fetchPersonalizationProfile(userId: string) {
  const { data } = await supabase
    .from('profiles')
    .select('industry, occupation, interests, location')
    .eq('id', userId)
    .maybeSingle()

  return {
    industry: data?.industry ?? null,
    occupation: data?.occupation ?? null,
    interests: (data?.interests as string[] | null) ?? null,
    location: data?.location ?? null,
  }
}
