/**
 * Company Pages — shared types + constants.
 *
 * Typed against the generated Supabase schema (`Tables<'companypages'>`, …).
 * Related tables: `company_members`, `company_followers`, `posts` (via company_id).
 */

import type { Tables, TablesInsert, TablesUpdate } from '~/lib/supabase'

// ============= SERVICE RESPONSE =============

export type CompanyPageServiceResponse<T> = {
  data: T | null
  error: string | null
  success: boolean
  meta?: CompanyPagePaginationMeta
}

export type CompanyPagePaginationMeta = {
  total: number
  limit: number
  offset: number
  hasMore: boolean
}

// ============= TABLE ROW TYPES =============

export type CompanyPage = Tables<'companypages'>
export type CompanyPageInsert = TablesInsert<'companypages'>
export type CompanyPageUpdate = TablesUpdate<'companypages'>

export type CompanyMemberRow = Tables<'company_members'>
export type CompanyFollowerRow = Tables<'company_followers'>

// ============= JOIN / UI SHAPES =============

/** Minimal profile ref embedded on admin list / detail rows. */
export type CompanyCreatorRef = {
  id: string
  full_name: string | null
  username: string | null
  avatar_url: string | null
  email: string | null
  headline: string | null
}

/** Admin list row with aggregate counts. */
export type CompanyPageWithCounts = CompanyPage & {
  follower_count: number
  member_count: number
  post_count: number
  creator?: CompanyCreatorRef | null
}

/** Full admin detail: counts + creator + members + recent followers. */
export type CompanyPageDetail = CompanyPageWithCounts & {
  members: CompanyMemberWithProfile[]
  recent_followers: CompanyFollowerWithProfile[]
  engagement: CompanyEngagementStats
}

export type CompanyMemberRole = 'owner' | 'admin' | 'member'

export type CompanyMemberWithProfile = {
  id: string
  company_id: string
  user_id: string
  role: CompanyMemberRole
  created_at: string
  username: string | null
  full_name: string | null
  headline: string | null
  avatar_url: string | null
}

export type CompanyFollowerWithProfile = {
  id: string
  company_id: string
  follower_id: string
  created_at: string
  username: string | null
  full_name: string | null
  headline: string | null
  avatar_url: string | null
}

export type CompanyEngagementStats = {
  total_reactions: number
  total_comments: number
  total_views: number
  like_count: number
  love_count: number
  celebrate_count: number
  support_count: number
  insightful_count: number
  funny_count: number
}

/** Platform-level admin dashboard stats. */
export type CompanyPagePlatformStats = {
  totalPages: number
  pagesThisMonth: number
  totalFollowers: number
  totalMembers: number
}

export type CompanyPageFacets = {
  industries: string[]
  locations: string[]
  sizes: string[]
  types: string[]
  categories: string[]
}

// ============= ENUMS / CONSTANTS =============

/** Schema default for `page_category`. */
export const DEFAULT_PAGE_CATEGORY = 'Company'

export const COMPANY_PAGE_CATEGORIES = [
  'Company',
  'Organization',
  'School',
  'Community',
  'Other',
] as const
export type CompanyPageCategory = (typeof COMPANY_PAGE_CATEGORIES)[number]

export const COMPANY_PAGE_SIZES = [
  '1-10',
  '11-50',
  '51-200',
  '201-500',
  '501-1000',
  '1001-5000',
  '5001+',
] as const
export type CompanyPageSize = (typeof COMPANY_PAGE_SIZES)[number]

export const COMPANY_PAGE_TYPES = [
  'company',
  'nonprofit',
  'government',
  'educational',
  'community',
  'other',
] as const
export type CompanyPageType = (typeof COMPANY_PAGE_TYPES)[number]

export const COMPANY_MEMBER_ROLES = {
  OWNER: 'owner',
  ADMIN: 'admin',
  MEMBER: 'member',
} as const

/** Storage buckets used by logo / cover uploads (legacy admin paths). */
export const COMPANY_LOGO_BUCKET = 'companypages-logos'
export const COMPANY_COVER_BUCKET = 'company-covers'

export const COMPANY_IMAGE_MAX_BYTES = 5 * 1024 * 1024
export const COMPANY_IMAGE_ACCEPTED_MIME = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
] as const

export const DEFAULT_COMPANY_PAGE_LIMIT = 20

// ============= INPUT TYPES =============

export type CreateCompanyPageInput = {
  name: string
  page_slug: string
  industry: string
  size: string
  type: string
  page_category?: string
  website?: string | null
  logo_url?: string | null
  cover_url?: string | null
  tagline?: string | null
  headquarters?: string | null
  founded_year?: number | null
  community_members?: number | null
  location?: string | null
  created_by?: string | null
  raw_page_data?: Record<string, unknown> | null
}

export type UpdateCompanyPageInput = Partial<CreateCompanyPageInput>

export type CompanyPageListFilters = {
  search?: string
  industry?: string
  size?: string
  type?: string
  page_category?: string
  location?: string
  created_by?: string
}

export type CompanyPageListParams = {
  filters?: CompanyPageListFilters
  limit?: number
  offset?: number
}

/** Image file passed as a service arg (never stored in Redux). */
export type CompanyImageUploadFile = {
  blob: Blob
  mimeType: string
  fileName: string
  fileSize: number
}
