import { formatCurrency } from '~/lib/format'
import { slugifyTitle } from '~/commerce/lib/seo-urls'
import { USER_ROLES, type UserRole } from '~/lib/profile/profile.type'

import {
  DIGITAL_FILE_TYPES,
  LISTING_STATUS,
  LISTING_TYPE_OPTIONS,
  LISTING_TYPES,
  LISTING_STATUS_OPTIONS,
  SERVICE_TYPE_OPTIONS,
  WEIGHT_UNITS,
  type ListingFormData,
  type ListingInsert,
  type ListingStatus,
  type ListingType,
  type ServiceTypeValue,
} from '~/lib/listing/listing.type'

// ============= SLUG =============

/** SEO-friendly slug from a listing title (delegates to the shared commerce helper). */
export function generateListingSlug(title: string | null | undefined): string {
  if (!title) return ''
  return slugifyTitle(title)
}

// ============= PRICE / MONEY =============

/** Format a listing price for display (converted into the shopper currency). */
export function formatListingPrice(
  price: number | string | null | undefined,
  currencyCode = 'INR',
): string {
  const numeric = typeof price === 'number' ? price : Number(price ?? 0)
  if (!Number.isFinite(numeric) || numeric === 0) return 'Free'
  return formatCurrency(numeric, currencyCode || 'INR')
}

// ============= TYPE / STATUS INFO =============

export function getListingTypeInfo(type: ListingType | string | null | undefined) {
  return LISTING_TYPE_OPTIONS.find((option) => option.value === type) ?? null
}

export function getListingStatusInfo(status: ListingStatus | string | null | undefined) {
  return LISTING_STATUS_OPTIONS.find((option) => option.value === status) ?? null
}

export function getServiceTypeInfo(type: ServiceTypeValue | string | null | undefined) {
  return SERVICE_TYPE_OPTIONS.find((option) => option.value === type) ?? null
}

export function getDigitalFileTypeInfo(type: string | null | undefined) {
  return DIGITAL_FILE_TYPES.find((fileType) => fileType.value === type) ?? null
}

/** Detect a digital file type from a file name / URL extension. */
export function detectFileTypeFromExtension(filename: string | null | undefined): string {
  if (!filename) return 'other'
  const extension = filename.toLowerCase().substring(filename.lastIndexOf('.'))
  for (const fileType of DIGITAL_FILE_TYPES) {
    if (fileType.extensions.includes(extension)) return fileType.value
  }
  return 'other'
}

// ============= FILE / WEIGHT / DIMENSIONS =============

/** Human-readable file size (e.g. "1.2 MB"). */
export function formatFileSize(bytes: number | null | undefined): string {
  if (!bytes || bytes === 0) return '0 B'
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  return `${Math.round((bytes / 1024 ** i) * 100) / 100} ${sizes[i]}`
}

/** Convert a weight in the given unit to kilograms. */
export function convertWeightToKg(weight: number | null | undefined, unit: string): number {
  if (!weight || !unit) return 0
  const unitInfo = WEIGHT_UNITS.find((entry) => entry.value === unit)
  return unitInfo ? weight * unitInfo.factor : weight
}

/** Format a weight (stored in kg) into a preferred unit. */
export function formatWeight(weight: number | null | undefined, preferredUnit = 'kg'): string {
  if (!weight) return ''
  const unitInfo = WEIGHT_UNITS.find((entry) => entry.value === preferredUnit)
  if (!unitInfo) return `${weight} kg`
  return `${Math.round((weight / unitInfo.factor) * 100) / 100} ${unitInfo.value}`
}

type Dimensions = { width?: number; height?: number; depth?: number; unit?: string }

/** Format a dimensions object into a "W × H × D" string. */
export function formatDimensions(dimensions: Dimensions | null | undefined): string {
  if (!dimensions || typeof dimensions !== 'object') return ''
  const { width, height, depth, unit = 'cm' } = dimensions
  if (!width && !height && !depth) return ''
  const parts: string[] = []
  if (width) parts.push(`W: ${width}${unit}`)
  if (height) parts.push(`H: ${height}${unit}`)
  if (depth) parts.push(`D: ${depth}${unit}`)
  return parts.join(' × ')
}

/** Estimated shipping weight (product + 10% packaging, min 0.1 kg) for physical items. */
export function calculateShippingWeight(
  productWeight: number | null | undefined,
  listingType: ListingType | string,
): number {
  if (listingType !== LISTING_TYPES.PHYSICAL || !productWeight) return 0
  const packaging = Math.max(productWeight * 0.1, 0.1)
  return productWeight + packaging
}

// ============= AVAILABILITY =============

type AvailabilityListing = {
  is_active?: boolean | null
  listing_status?: ListingStatus | string | null
  listing_type?: ListingType | string | null
  stock?: number | null
  quantity?: number | null
}

/** Whether a listing is currently purchasable, with a reason when it is not. */
export function checkListingAvailability(listing: AvailabilityListing | null | undefined): {
  available: boolean
  reason: string | null
} {
  if (!listing) return { available: false, reason: 'Listing not found' }
  if (!listing.is_active) return { available: false, reason: 'Listing is inactive' }
  if (listing.listing_status === LISTING_STATUS.ARCHIVED) {
    return { available: false, reason: 'Listing is archived' }
  }
  if (listing.listing_status === LISTING_STATUS.PAUSED) {
    return { available: false, reason: 'Listing is temporarily paused' }
  }
  if (listing.listing_status === LISTING_STATUS.SOLD_OUT) {
    return { available: false, reason: 'Currently sold out' }
  }
  if (listing.listing_type === LISTING_TYPES.PHYSICAL) {
    if ((listing.stock ?? 0) <= 0) return { available: false, reason: 'Out of stock' }
    if ((listing.stock ?? 0) < (listing.quantity ?? 1)) {
      return { available: false, reason: 'Insufficient stock' }
    }
  }
  return { available: true, reason: null }
}

export function isProductOutOfStock(listing: AvailabilityListing | null | undefined): boolean {
  if (!listing) return false
  if (listing.listing_type === LISTING_TYPES.PHYSICAL) return (listing.stock ?? 0) <= 0
  return false
}

// ============= FILTER / SORT (pure, client-side) =============

type FilterableListing = {
  listing_type?: ListingType | string | null
  listing_status?: ListingStatus | string | null
  is_active?: boolean | null
  is_featured?: boolean | null
  price?: number | null
  title?: string | null
  description?: string | null
  tags?: string[] | null
}

export function filterListings<T extends FilterableListing>(
  listings: T[],
  filters: {
    listing_type?: string
    listing_status?: string
    is_active?: boolean
    is_featured?: boolean
    min_price?: number
    max_price?: number
    available_only?: boolean
    search?: string
  } = {},
): T[] {
  if (!Array.isArray(listings)) return []
  return listings.filter((listing) => {
    if (filters.listing_type && listing.listing_type !== filters.listing_type) return false
    if (filters.listing_status && listing.listing_status !== filters.listing_status) return false
    if (filters.is_active !== undefined && listing.is_active !== filters.is_active) return false
    if (filters.is_featured !== undefined && listing.is_featured !== filters.is_featured) return false
    if (filters.min_price !== undefined && (listing.price ?? 0) < filters.min_price) return false
    if (filters.max_price !== undefined && (listing.price ?? 0) > filters.max_price) return false
    if (filters.available_only && !checkListingAvailability(listing).available) return false
    if (filters.search) {
      const term = filters.search.toLowerCase()
      const haystack = [listing.title, listing.description, ...(listing.tags ?? [])]
        .join(' ')
        .toLowerCase()
      if (!haystack.includes(term)) return false
    }
    return true
  })
}

export function sortListings<T extends Record<string, unknown>>(
  listings: T[],
  sortBy = 'created_at',
  sortOrder: 'asc' | 'desc' = 'desc',
): T[] {
  if (!Array.isArray(listings)) return []
  const direction = sortOrder === 'desc' ? -1 : 1

  return [...listings].sort((a, b) => {
    let valueA = a[sortBy] as string | number | undefined
    let valueB = b[sortBy] as string | number | undefined

    if (sortBy.includes('_at') || sortBy.includes('date')) {
      valueA = new Date((valueA as string) ?? 0).getTime()
      valueB = new Date((valueB as string) ?? 0).getTime()
    } else if (typeof valueA === 'string' && typeof valueB === 'string') {
      valueA = valueA.toLowerCase()
      valueB = valueB.toLowerCase()
    }

    if ((valueA ?? 0) < (valueB ?? 0)) return -1 * direction
    if ((valueA ?? 0) > (valueB ?? 0)) return 1 * direction
    return 0
  })
}

// ============= IMAGES =============

type ImageBearingListing = {
  primary_image_url?: string | null
  listing_images?: { image_url?: string; url?: string; is_primary?: boolean }[] | null
  images?: { image_url?: string; url?: string; is_primary?: boolean }[] | null
}

/** Resolve the best "primary" image record for a listing. */
export function getPrimaryListingImage(
  listing: ImageBearingListing | null | undefined,
): { image_url: string; is_primary: boolean } | null {
  if (!listing) return null
  if (listing.primary_image_url) {
    return { image_url: listing.primary_image_url, is_primary: true }
  }
  const images = listing.listing_images ?? listing.images ?? []
  if (!Array.isArray(images) || images.length === 0) return null
  const chosen = images.find((image) => image?.is_primary) ?? images[0]
  const url = chosen?.image_url ?? chosen?.url
  return url ? { image_url: url, is_primary: chosen?.is_primary ?? false } : null
}

export function hasListingImage(listing: ImageBearingListing | null | undefined): boolean {
  return Boolean(getPrimaryListingImage(listing)?.image_url)
}

// ============= TAGS / CATEGORIES =============

/** Derive simple suggested tags from a title (deduped, max 6). */
export function generateSuggestedTags(title: string | null | undefined): string[] {
  if (!title || typeof title !== 'string') return []
  const words = title
    .toLowerCase()
    .split(' ')
    .map((word) => word.replace(/[^\w]/g, ''))
    .filter((word) => word.length > 2)
  return [...new Set(words)].slice(0, 6)
}

export function extractCategoryIds(
  categories: ({ category_id?: string } | string)[] | null | undefined,
): string[] {
  if (!Array.isArray(categories)) return []
  return categories
    .map((cat) => (typeof cat === 'string' ? cat : cat.category_id))
    .filter((id): id is string => Boolean(id))
}

export function getPrimaryCategory<T extends { is_primary?: boolean }>(
  categories: T[] | null | undefined,
): T | null {
  if (!Array.isArray(categories) || categories.length === 0) return null
  return categories.find((cat) => cat.is_primary) ?? categories[0] ?? null
}

// ============= ROLES / OWNERSHIP =============

export function isAdminRole(role: string | null | undefined): boolean {
  return role === USER_ROLES.ADMIN
}

export function isVendorRole(role: string | null | undefined): boolean {
  return role === USER_ROLES.VENDOR
}

/**
 * Whether a user may edit / manage a listing: the shop owner, or an admin.
 * `shopUserId` is the `shops.user_id` that owns the listing; `role` is the
 * viewer's `profiles.role` (A / V / U). Server-side RLS is the source of truth.
 */
export function canManageListing(
  shopUserId: string | null | undefined,
  userId: string | null | undefined,
  role?: UserRole | string | null,
): boolean {
  if (isAdminRole(role)) return true
  return Boolean(shopUserId && userId && shopUserId === userId)
}

// ============= IMAGE FILE VALIDATION (client-side) =============

/** Lightweight pre-upload validation for a picked image file. */
export function validateImageFile(file: { size?: number; type?: string } | null | undefined): {
  isValid: boolean
  message: string
} {
  const maxSize = 5 * 1024 * 1024
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
  if (!file) return { isValid: false, message: 'No file selected' }
  if ((file.size ?? 0) > maxSize) return { isValid: false, message: 'Image must be smaller than 5MB' }
  if (!file.type || !allowedTypes.includes(file.type)) {
    return { isValid: false, message: 'Only JPEG, PNG, and WebP images are allowed' }
  }
  return { isValid: true, message: '' }
}

// ============= SUBMISSION PREP =============

const LISTING_TABLE_FIELDS: (keyof ListingInsert)[] = [
  'shop_id',
  'title',
  'description',
  'listing_type',
  'price',
  'quantity',
  'category',
  'is_featured',
  'is_active',
  'listing_status',
  'slug',
  'meta_title',
  'meta_description',
  'tags',
  'stock',
  'sku',
  'weight',
  'dimensions',
  'shipping_required',
  'digital_file_url',
  'digital_file_size',
  'digital_file_type',
  'download_limit',
  'is_online',
  'booking_duration_minutes',
  'max_attendees',
  'requires_approval',
  'meeting_url',
  'listing_metadata',
]

function toNumberOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

/**
 * Clean + coerce form data into a `listings` table payload. Trims strings,
 * converts numeric fields, and drops any keys that aren't real columns (the
 * related collections — images/variations/etc. — are handled separately).
 */
export function prepareListingDataForSubmission(formData: Partial<ListingFormData>): ListingInsert {
  const payload: Record<string, unknown> = {}

  for (const key of LISTING_TABLE_FIELDS) {
    const value = (formData as Record<string, unknown>)[key]
    if (value === undefined) continue
    payload[key] = value
  }

  // Trim string fields.
  for (const field of ['title', 'description', 'meta_title', 'meta_description', 'slug', 'sku', 'digital_file_type', 'digital_file_url', 'meeting_url']) {
    if (typeof payload[field] === 'string') payload[field] = (payload[field] as string).trim()
  }

  // Coerce numeric fields.
  if (payload.price !== undefined) payload.price = toNumberOrNull(payload.price) ?? 0
  for (const field of ['quantity', 'stock', 'weight', 'digital_file_size', 'download_limit', 'booking_duration_minutes', 'max_attendees']) {
    if (payload[field] !== undefined) payload[field] = toNumberOrNull(payload[field])
  }

  // Clean tags array.
  if (Array.isArray(payload.tags)) {
    payload.tags = (payload.tags as string[]).filter((tag) => tag && tag.trim()).map((tag) => tag.trim())
  }

  // Ensure JSON objects are objects.
  if (payload.listing_metadata && typeof payload.listing_metadata !== 'object') {
    payload.listing_metadata = {}
  }

  return payload as ListingInsert
}
