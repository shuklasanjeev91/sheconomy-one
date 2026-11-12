import type { Database, Tables, TablesInsert, TablesUpdate } from '~/lib/supabase'

/**
 * Shared shape returned by every listing service call.
 * Mirrors the shop/profile `ServiceResponse` helper so all three stores stay symmetric.
 */
export type ListingServiceResponse<T> = {
  data: T | null
  error: string | null
  success: boolean
}

// ============= ROW / INSERT / UPDATE HELPERS =============

/** Full row / insert / update helpers for the `listings` table. */
export type Listing = Tables<'listings'>
export type ListingInsert = TablesInsert<'listings'>
export type ListingUpdate = TablesUpdate<'listings'>

/** Child table helpers. */
export type ListingImage = Tables<'listing_images'>
export type ListingImageInsert = TablesInsert<'listing_images'>
export type ListingImageUpdate = TablesUpdate<'listing_images'>

export type ListingVariation = Tables<'listing_variations'>
export type ListingVariationInsert = TablesInsert<'listing_variations'>
export type ListingVariationUpdate = TablesUpdate<'listing_variations'>

export type ListingAttribute = Tables<'listing_attributes'>
export type ListingAttributeInsert = TablesInsert<'listing_attributes'>
export type ListingAttributeUpdate = TablesUpdate<'listing_attributes'>

export type ListingMaterial = Tables<'listing_materials'>
export type ListingMaterialInsert = TablesInsert<'listing_materials'>
export type ListingMaterialUpdate = TablesUpdate<'listing_materials'>

export type ListingTag = Tables<'listing_tags'>
export type CategoryAssignment = Tables<'category_assignments'>

/** Aggregated detail row from the `listing_details_view` (images/variations/etc. as JSON). */
export type ListingDetailsView = Database['public']['Views']['listing_details_view']['Row']

/** Compact public browse shape — a row from `active_listings_view`. */
export type PublicListing = Database['public']['Views']['active_listings_view']['Row']

/** Enum unions straight from the generated database types. */
export type ListingType = Database['public']['Enums']['listing_type_enum']
export type ListingStatus = Database['public']['Enums']['listing_status_enum']

// ============= CATEGORY ASSIGNMENT INPUT =============

/** A category to attach to a listing (used by create/update + `assign_categories_to_listing`). */
export type ListingCategoryInput = {
  category_id: string
  is_primary?: boolean
}

// ============= FORM DATA =============

/**
 * The subset of listing columns collected by the create/edit form, plus the
 * related-table collections (`images`, `variations`, `attributes`, `materials`,
 * `categories`, `tags`) that are persisted into their own tables on submit.
 *
 * Everything except `title` / `listing_type` / `price` is optional so partial
 * updates (autosave) type-check cleanly.
 */
export type ListingFormData = {
  // Core fields
  shop_id?: string
  title: string
  description?: string
  listing_type: ListingType
  price: number | string
  quantity?: number | string
  category?: string

  // Display & status
  is_featured?: boolean
  is_active?: boolean
  listing_status?: ListingStatus

  // SEO & metadata
  slug?: string
  meta_title?: string
  meta_description?: string
  tags?: string[]
  listing_metadata?: Record<string, unknown>

  // Pricing disclosure (buyer PDP)
  mrp?: number | string | null
  price_includes_tax?: boolean
  tax_percent?: number | string | null
  /** Manufacturing / legal bag stored on `listings.product_info`. */
  product_info?: Record<string, unknown>

  // Physical
  stock?: number | string
  sku?: string
  weight?: number | string | null
  dimensions?: Record<string, unknown>
  shipping_required?: boolean

  // Digital
  digital_file_url?: string
  digital_file_size?: number | string | null
  digital_file_type?: string
  download_limit?: number | string | null

  // Service
  is_online?: boolean
  booking_duration_minutes?: number | string | null
  max_attendees?: number | string | null
  requires_approval?: boolean
  meeting_url?: string

  // Related collections (persisted into child tables)
  categories?: ListingCategoryInput[]
  images?: ListingImageDraft[]
  variations?: Partial<ListingVariationInsert>[]
  attributes?: Partial<ListingAttributeInsert>[]
  materials?: Partial<ListingMaterialInsert>[]
}

/**
 * A single image entry as held by the form. May be an already-uploaded record
 * (has `id` / `image_url`) or a freshly-picked upload payload (`blob`).
 */
export type ListingImageDraft = {
  id?: string
  image_url?: string
  alt_text?: string | null
  is_primary?: boolean
  display_order?: number
  width?: number | null
  height?: number | null
  file_size?: number | null
  image_type?: string | null
  /** Present only for a not-yet-uploaded file. */
  blob?: Blob | File
  mimeType?: string
  fileName?: string
}

/** File payload for a single listing image upload (kept out of Redux state). */
export type ListingImageUpload = {
  blob: Blob | File
  mimeType: string
  fileName?: string
}

// ============= FILTERS / PAGINATION =============

export type ListingSortBy = 'newest' | 'oldest' | 'price' | 'title' | 'rating'

export type ListingFilters = {
  search?: string
  listingType?: ListingType
  listingStatus?: ListingStatus
  shopId?: string
  shopIds?: string[]
  minPrice?: number
  maxPrice?: number
  tags?: string[]
  isFeatured?: boolean
  isActive?: boolean
}

export type ListingPagination = {
  limit?: number
  offset?: number
  sortBy?: ListingSortBy
  sortOrder?: 'asc' | 'desc'
}

// ============= STATS =============

/** Normalised stats for a single shop's catalogue. */
export type ListingStats = {
  totalListings: number
  activeListings: number
  draftListings: number
  physicalListings: number
  digitalListings: number
  serviceListings: number
  featuredListings: number
  avgPrice: number | null
}

/** Platform-wide listing counts for the admin dashboard. */
export type PlatformListingStats = {
  totalListings: number
  activeListings: number
  draftListings: number
  featuredListings: number
  physicalListings: number
  digitalListings: number
  serviceListings: number
}

/** Result of `validateListingData` / `validateListingStep`. */
export type ListingValidationResult = {
  isValid: boolean
  errors: Record<string, string>
}

// ============= CONSTANTS =============

/** Supabase Storage bucket used for listing image uploads. */
export const LISTING_MEDIA_BUCKET = 'listing-images'

/** Listing types (mirrors `listing_type_enum`). */
export const LISTING_TYPES = {
  PHYSICAL: 'physical',
  DIGITAL: 'digital',
  SERVICE: 'service',
} as const satisfies Record<string, ListingType>

/** Listing statuses (mirrors `listing_status_enum`). */
export const LISTING_STATUS = {
  DRAFT: 'draft',
  ACTIVE: 'active',
  PAUSED: 'paused',
  SOLD_OUT: 'sold_out',
  ARCHIVED: 'archived',
} as const satisfies Record<string, ListingStatus>

export const SERVICE_TYPE = {
  ONLINE: 'online',
  HOME: 'home',
} as const

export type ServiceTypeValue = (typeof SERVICE_TYPE)[keyof typeof SERVICE_TYPE]

/**
 * UI option lists (icons/colors are string keys resolved by the UI layer).
 *
 * `hidden` options stay in this list so existing rows still resolve a label via
 * `getListingTypeInfo` / `listingTypeLabel`, but they are kept out of every
 * picker and filter — see `LISTING_TYPE_OPTIONS_SELECTABLE`.
 */
export const LISTING_TYPE_OPTIONS: readonly {
  value: ListingType
  label: string
  description: string
  icon: string
  disabled: boolean
  hidden?: boolean
}[] = [
  {
    value: LISTING_TYPES.PHYSICAL,
    label: 'Physical Product',
    description: 'Physical items that will be shipped',
    icon: 'package',
    disabled: false,
  },
  {
    value: LISTING_TYPES.DIGITAL,
    label: 'Digital Product',
    description: 'Digital downloads or online content',
    icon: 'download',
    disabled: false,
  },
  {
    value: LISTING_TYPES.SERVICE,
    label: 'Service',
    description: 'Services you provide to customers',
    icon: 'zap',
    disabled: true,
    hidden: true,
  },
]

/** Listing types a vendor may see when creating, editing or filtering listings. */
export const LISTING_TYPE_OPTIONS_SELECTABLE = LISTING_TYPE_OPTIONS.filter(
  (option) => !option.hidden,
)

export const LISTING_STATUS_OPTIONS: readonly {
  value: ListingStatus
  label: string
  color: string
}[] = [
  { value: LISTING_STATUS.DRAFT, label: 'Draft', color: 'gray' },
  { value: LISTING_STATUS.ACTIVE, label: 'Active', color: 'green' },
  { value: LISTING_STATUS.PAUSED, label: 'Paused', color: 'yellow' },
  { value: LISTING_STATUS.SOLD_OUT, label: 'Sold Out', color: 'red' },
  { value: LISTING_STATUS.ARCHIVED, label: 'Archived', color: 'gray' },
]

export const ATTRIBUTE_TYPE_OPTIONS: readonly { value: string; label: string }[] = [
  { value: 'text', label: 'Text' },
  { value: 'number', label: 'Number' },
]

export const SERVICE_TYPE_OPTIONS: readonly {
  value: ServiceTypeValue
  label: string
  icon: string
}[] = [
  { value: SERVICE_TYPE.ONLINE, label: 'Online Service', icon: 'globe' },
  { value: SERVICE_TYPE.HOME, label: 'Home Service', icon: 'home' },
]

/** Digital file types supported by the platform. */
export const DIGITAL_FILE_TYPES: readonly {
  value: string
  label: string
  extensions: string[]
}[] = [
  { value: 'pdf', label: 'PDF Document', extensions: ['.pdf'] },
  { value: 'image', label: 'Image', extensions: ['.jpg', '.jpeg', '.png', '.gif', '.webp'] },
  { value: 'video', label: 'Video', extensions: ['.mp4', '.avi', '.mov', '.wmv'] },
  { value: 'audio', label: 'Audio', extensions: ['.mp3', '.wav', '.aac', '.flac'] },
  { value: 'ebook', label: 'E-book', extensions: ['.epub', '.mobi', '.azw'] },
  { value: 'archive', label: 'Archive', extensions: ['.zip', '.rar', '.7z'] },
  { value: 'document', label: 'Document', extensions: ['.doc', '.docx', '.txt', '.rtf'] },
  { value: 'spreadsheet', label: 'Spreadsheet', extensions: ['.xls', '.xlsx', '.csv'] },
  { value: 'presentation', label: 'Presentation', extensions: ['.ppt', '.pptx'] },
  { value: 'software', label: 'Software', extensions: ['.exe', '.dmg', '.app'] },
  { value: 'other', label: 'Other', extensions: [] },
]

/** Weight units with conversion factor to kilograms. */
export const WEIGHT_UNITS: readonly { value: string; label: string; factor: number }[] = [
  { value: 'kg', label: 'Kilograms (kg)', factor: 1 },
  { value: 'g', label: 'Grams (g)', factor: 0.001 },
  { value: 'lb', label: 'Pounds (lb)', factor: 0.453592 },
  { value: 'oz', label: 'Ounces (oz)', factor: 0.0283495 },
]

export const DIMENSION_UNITS: readonly { value: string; label: string }[] = [
  { value: 'cm', label: 'Centimeters (cm)' },
  { value: 'inch', label: 'Inches (in)' },
  { value: 'm', label: 'Meters (m)' },
  { value: 'ft', label: 'Feet (ft)' },
]

/** Field length / count limits shared by validation + form UIs. No magic numbers in code. */
export const LISTING_VALIDATION = {
  TITLE: { MIN_LENGTH: 3, MAX_LENGTH: 200 },
  DESCRIPTION: { MAX_LENGTH: 2000 },
  SKU: { MAX_LENGTH: 100 },
  META_TITLE: { MAX_LENGTH: 60 },
  META_DESCRIPTION: { MAX_LENGTH: 160 },
  SLUG: { MIN_LENGTH: 3 },
  PRICE: { MIN: 0 },
  QUANTITY: { MIN: 0 },
  STOCK: { MIN: 0 },
  BOOKING_DURATION: { MIN: 1 },
  MAX_ATTENDEES: { MIN: 1 },
  CATEGORIES: { MAX_SELECTED: 10 },
  DIGITAL_FILE_TYPE: { MAX_LENGTH: 50 },
} as const

/** Image upload constraints. */
export const LISTING_IMAGE_CONSTRAINTS = {
  MAX_SIZE_BYTES: 10 * 1024 * 1024,
  ALLOWED_MIME_TYPES: ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'] as const,
} as const

/** Default page size for public/seller/admin listing feeds. */
export const LISTING_PAGE_SIZE = 24

/**
 * Build the empty form buffer for a given listing type. Only the fields
 * relevant to that type are populated so downstream payloads stay clean.
 */
export function getDefaultListingFormData(
  listingType: ListingType = LISTING_TYPES.PHYSICAL,
): ListingFormData {
  const base: ListingFormData = {
    title: '',
    description: '',
    listing_type: listingType,
    price: '',
    quantity: 1,
    mrp: '',
    price_includes_tax: true,
    tax_percent: '18',
    product_info: {},
    is_featured: false,
    is_active: true,
    listing_status: LISTING_STATUS.DRAFT,
    slug: '',
    meta_title: '',
    meta_description: '',
    tags: [],
    categories: [],
    listing_metadata: {},
    images: [],
    variations: [],
    attributes: [],
    materials: [],
  }

  if (listingType === LISTING_TYPES.PHYSICAL) {
    return { ...base, stock: 0, sku: '', weight: null, dimensions: {}, shipping_required: true }
  }
  if (listingType === LISTING_TYPES.DIGITAL) {
    return {
      ...base,
      digital_file_url: '',
      digital_file_size: null,
      digital_file_type: '',
      download_limit: null,
    }
  }
  if (listingType === LISTING_TYPES.SERVICE) {
    return {
      ...base,
      is_online: true,
      booking_duration_minutes: 60,
      max_attendees: 1,
      requires_approval: false,
      meeting_url: '',
    }
  }
  return base
}

/** Convenience default used to seed / reset the create-listing flow. */
export const EMPTY_LISTING_FORM_DATA: ListingFormData = getDefaultListingFormData()
