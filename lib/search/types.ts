import type { AccessTier } from '~/lib/auth/access'

export const SEARCH_SCOPES = [
  'all',
  'listings',
  'categories',
  'shops',
  'people',
  'companies',
  'groups',
  'jobs',
  'posts',
  'programs',
  'meetings',
] as const

export type SearchScope = (typeof SEARCH_SCOPES)[number]

/** Legacy URL values accepted by `parseSearchScope`. */
export const SEARCH_SCOPE_ALIASES: Record<string, SearchScope> = {
  shop: 'listings',
  product: 'listings',
  products: 'listings',
  listing: 'listings',
  category: 'categories',
  company: 'companies',
  group: 'groups',
  post: 'posts',
  class: 'programs',
  classes: 'programs',
  program: 'programs',
  meeting: 'meetings',
}

type HitBase = {
  id: string
  title: string
  subtitle: string | null
  imageUrl: string | null
  href: string
}

export type ListingHit = HitBase & {
  kind: 'listing'
  price: number | null
  currency: string | null
  slug: string | null
}

export type CategoryHit = HitBase & {
  kind: 'category'
  slug: string
}

export type ShopHit = HitBase & {
  kind: 'shop'
  slug: string | null
}

export type PersonHit = HitBase & {
  kind: 'person'
  username: string | null
}

export type CompanyHit = HitBase & {
  kind: 'company'
  slug: string
}

export type GroupHit = HitBase & {
  kind: 'group'
}

export type JobHit = HitBase & {
  kind: 'job'
  companyName: string
  location: string
}

export type PostHit = HitBase & {
  kind: 'post'
}

export type ProgramHit = HitBase & {
  kind: 'program'
  slug: string
}

/** @deprecated Use ProgramHit */
export type ClassHit = ProgramHit

export type MeetingHit = HitBase & {
  kind: 'meeting'
  code: string
}

export type SearchHit =
  | ListingHit
  | CategoryHit
  | ShopHit
  | PersonHit
  | CompanyHit
  | GroupHit
  | JobHit
  | PostHit
  | ProgramHit
  | MeetingHit

export type FederatedSearchResult = {
  query: string
  scope: SearchScope
  listings: ListingHit[]
  categories: CategoryHit[]
  shops: ShopHit[]
  people: PersonHit[]
  companies: CompanyHit[]
  groups: GroupHit[]
  jobs: JobHit[]
  posts: PostHit[]
  programs: ProgramHit[]
  meetings: MeetingHit[]
  blockedScopes: SearchScope[]
}

export type SearchSuggestResult = {
  query: string
  recent: string[]
  hits: SearchHit[]
  blockedScopes: SearchScope[]
}

export type FederateOptions = {
  scope: SearchScope
  limitPerScope?: number
  tier: AccessTier
  userId?: string | null
  latitude?: number | null
  longitude?: number | null
}

export const SEARCH_SCOPE_LABELS: Record<SearchScope, string> = {
  all: 'All',
  listings: 'Listings',
  categories: 'Categories',
  shops: 'Shops',
  people: 'People',
  companies: 'Companies',
  groups: 'Groups',
  jobs: 'Jobs',
  posts: 'Posts',
  programs: 'Programs',
  meetings: 'Meetings',
}

export const SEARCH_SCOPE_PLACEHOLDERS: Record<SearchScope, string> = {
  all: 'Search anything',
  listings: 'Search listings',
  categories: 'Search categories',
  shops: 'Search shops',
  people: 'Search people',
  companies: 'Search companies',
  groups: 'Search groups',
  jobs: 'Search jobs',
  posts: 'Search posts',
  programs: 'Search programs',
  meetings: 'Search meetings',
}

export const SEARCH_HIT_KIND_LABELS: Record<SearchHit['kind'], string> = {
  listing: 'Listing',
  category: 'Category',
  shop: 'Shop',
  person: 'People',
  company: 'Company',
  group: 'Group',
  job: 'Job',
  post: 'Post',
  program: 'Program',
  meeting: 'Meeting',
}
