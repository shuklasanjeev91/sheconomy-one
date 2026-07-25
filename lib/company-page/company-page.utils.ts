/**
 * Company Pages — pure helpers (slug, display labels, image validation).
 */

import { Platform } from 'react-native'

import {
  COMPANY_IMAGE_ACCEPTED_MIME,
  COMPANY_IMAGE_MAX_BYTES,
  type CompanyImageUploadFile,
  type CompanyMemberRole,
  type CompanyPage,
} from '~/lib/company-page/company-page.type'

/** Generate a URL-safe slug from a company name. */
export function generateCompanyPageSlug(name: string | null | undefined): string {
  if (!name || typeof name !== 'string') return ''
  return name
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 120)
}

/** Normalise a user-entered slug (lowercase, hyphens, no spaces). */
export function normalizeCompanyPageSlug(slug: string | null | undefined): string {
  if (!slug) return ''
  return slug
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export function formatCompanyMemberRole(role: CompanyMemberRole | string): string {
  switch (role) {
    case 'owner':
      return 'Owner'
    case 'admin':
      return 'Admin'
    case 'member':
      return 'Member'
    default:
      return role
  }
}

export function formatFoundedYear(year: number | null | undefined): string {
  if (year == null || Number.isNaN(year)) return 'Not set'
  return String(year)
}

export function getCompanyDisplayLocation(
  page: Pick<CompanyPage, 'location' | 'headquarters'> | null | undefined,
): string {
  if (!page) return ''
  return page.location?.trim() || page.headquarters?.trim() || ''
}

export function getCompanySubtitle(
  page: Pick<CompanyPage, 'tagline' | 'industry' | 'page_category'> | null | undefined,
): string {
  if (!page) return ''
  return page.tagline?.trim() || page.industry?.trim() || page.page_category || ''
}

/**
 * Validate a logo/cover file (type + size always).
 * Dimension checks are skipped — company logos vary in aspect ratio.
 */
export function validateCompanyImageFile(
  file: CompanyImageUploadFile | null,
): { valid: boolean; error?: string } {
  if (!file) return { valid: false, error: 'No file selected' }

  if (!(COMPANY_IMAGE_ACCEPTED_MIME as readonly string[]).includes(file.mimeType)) {
    return { valid: false, error: 'Only JPEG, PNG, or WebP images are accepted' }
  }

  if (file.fileSize > COMPANY_IMAGE_MAX_BYTES) {
    const mb = (file.fileSize / 1024 / 1024).toFixed(1)
    return { valid: false, error: `File must be under 5 MB (got ${mb} MB)` }
  }

  // Keep Platform import used so native/web share this helper safely.
  if (Platform.OS === 'web' && file.fileSize <= 0) {
    return { valid: false, error: 'File appears empty' }
  }

  return { valid: true }
}

/** Whether a public URL belongs to one of our company storage buckets. */
export function isCompanyStorageUrl(url: string | null | undefined): boolean {
  if (!url) return false
  return (
    url.includes('/storage/v1/object/public/companypages-logos/') ||
    url.includes('/storage/v1/object/public/company-covers/')
  )
}

export function emptyEngagementStats() {
  return {
    total_reactions: 0,
    total_comments: 0,
    total_views: 0,
    like_count: 0,
    love_count: 0,
    celebrate_count: 0,
    support_count: 0,
    insightful_count: 0,
    funny_count: 0,
  }
}
