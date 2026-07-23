/**
 * Sale Events — shared types + constants.
 *
 * Ported 1:1 from the legacy `sales.event-*` modules and re-typed against the
 * generated Supabase schema (`Tables<'sale_events'>`, …). Nothing here is
 * hard-coded: currency options are reused from the shop module so the two
 * feature areas never drift apart.
 */

import type { Tables, TablesInsert, TablesUpdate } from '~/lib/supabase'
import { DEFAULT_SHOP_CURRENCY, SUPPORTED_CURRENCIES } from '~/lib/shop/shop.type'

// ============= SERVICE RESPONSE =============

/** Shared shape returned by every sale service call (mirrors shop/cms). */
export type SaleServiceResponse<T> = {
  data: T | null
  error: string | null
  success: boolean
  meta?: SalePaginationMeta
}

export type SalePaginationMeta = {
  total: number
  limit: number
  offset: number
  hasMore: boolean
}

// ============= TABLE ROW TYPES =============

export type SaleEvent = Tables<'sale_events'>
export type SaleEventInsert = TablesInsert<'sale_events'>
export type SaleEventUpdate = TablesUpdate<'sale_events'>

export type EventOffer = Tables<'event_offers'>
export type EventOfferInsert = TablesInsert<'event_offers'>
export type EventOfferUpdate = TablesUpdate<'event_offers'>

export type EventOfferCategory = Tables<'event_offer_categories'>
export type EventOfferListing = Tables<'event_offer_listings'>

export type VendorEnrollment = Tables<'vendor_event_enrollments'>
export type VendorEnrollmentInsert = TablesInsert<'vendor_event_enrollments'>

export type DiscountProfile = Tables<'discount_profiles'>

// ============= JOIN / UI SHAPES =============

/** Minimal shop reference embedded in admin enrollment rows. */
export type SaleShopRef = {
  id: string
  shop_name: string
  slug: string | null
  logo_url: string | null
}

/** Event row enriched with the aggregate counts the admin list needs. */
export type SaleEventWithCounts = SaleEvent & {
  offer_count: number
  enrollment_count: number
  accepted_count: number
}

/** Full event detail: offers (with their attached category/listing ids) + counts. */
export type SaleEventDetail = SaleEventWithCounts & {
  event_offers: EventOfferWithLinks[]
}

export type EventOfferWithLinks = EventOffer & {
  event_offer_categories: Pick<EventOfferCategory, 'id' | 'category_id'>[]
  event_offer_listings: Pick<EventOfferListing, 'id' | 'listing_id'>[]
}

/** Active event with its offers summarised for vendor discovery. */
export type SaleEventForVendor = SaleEvent & {
  event_offers: Pick<
    EventOffer,
    'id' | 'offer_name' | 'discount_type' | 'discount_value' | 'applies_to'
  >[]
}

/** Admin view of a vendor enrollment (shop attached). */
export type EnrollmentWithShop = VendorEnrollment & {
  shops: SaleShopRef | null
}

/** Vendor view of their enrollment (event attached), plus a UI convenience flag. */
export type EnrollmentWithEvent = VendorEnrollment & {
  sale_events: Pick<
    SaleEvent,
    | 'id'
    | 'event_name'
    | 'event_slug'
    | 'description'
    | 'start_date'
    | 'end_date'
    | 'banner_image'
    | 'status'
  > | null
  canWithdraw?: boolean
}

/** Optimistic enrollment row (temp id before the server confirms). */
export type OptimisticEnrollment = EnrollmentWithEvent & { _optimistic?: boolean }

/** Event-sourced discount profile with its offer + parent event for display. */
export type EnrolledEventDiscount = DiscountProfile & {
  event_offers:
    | (Pick<EventOffer, 'id' | 'offer_name' | 'discount_type' | 'discount_value'> & {
        sale_events: Pick<SaleEvent, 'id' | 'event_name' | 'event_slug'> | null
      })
    | null
}

/** Category row shown in the offer category picker. */
export type SaleCategoryOption = {
  category_id: string
  parent_id: string | null
  category: string
  description?: string | null
  level: number | null
  position: number | null
  product_count?: number | null
  status: string
  seo_name: string | null
  seo_path?: string | null
  category_image_url: string | null
  main_pair: unknown
}

/** Listing row shown in the offer product picker (primary image flattened). */
export type SaleListingOption = {
  id: string
  shop_id: string
  shop_name: string | null
  title: string
  description: string | null
  listing_type: string
  price: number
  stock: number | null
  listing_status: string
  slug: string | null
  category: string | null
  sku: string | null
  primary_image_url: string | null
}

// ============= ENUMS / CONSTANTS =============

export const SALE_EVENT_STATUS = {
  DRAFT: 'draft',
  ACTIVE: 'active',
  EXPIRED: 'expired',
} as const
export type SaleEventStatus = (typeof SALE_EVENT_STATUS)[keyof typeof SALE_EVENT_STATUS]

export const DISCOUNT_TYPE = {
  PERCENTAGE: 'percentage',
  FIXED: 'fixed',
} as const
export type DiscountType = (typeof DISCOUNT_TYPE)[keyof typeof DISCOUNT_TYPE]

export const OFFER_APPLIES_TO = {
  ORDER: 'order',
  PRODUCT: 'product',
  CATEGORY: 'category',
} as const
export type OfferAppliesTo = (typeof OFFER_APPLIES_TO)[keyof typeof OFFER_APPLIES_TO]

export const ENROLLMENT_STATUS = {
  PENDING: 'pending',
  ACCEPTED: 'accepted',
  REJECTED: 'rejected',
} as const
export type EnrollmentStatus = (typeof ENROLLMENT_STATUS)[keyof typeof ENROLLMENT_STATUS]

/** Admin can only move an enrollment into one of these terminal states. */
export type EnrollmentDecision = typeof ENROLLMENT_STATUS.ACCEPTED | typeof ENROLLMENT_STATUS.REJECTED

/** Storage bucket for sale-event banner images (see migration 104 port). */
export const SALE_BANNER_BUCKET = 'sale-event-banners'

/** Banner upload limits (kept in sync with the bucket policy). */
export const SALE_BANNER_MAX_BYTES = 5 * 1024 * 1024
export const SALE_BANNER_ACCEPTED_MIME = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
] as const

/** Fallback banner used when an event has none. */
export const DEFAULT_SALE_BANNER_URL = '/images/defaults/sale-event-banner.png'

/** Currency defaults reused from the shop module — never hard-code a list here. */
export const DEFAULT_SALE_CURRENCY = DEFAULT_SHOP_CURRENCY
export const SALE_CURRENCY_CODES = SUPPORTED_CURRENCIES.map((c) => c.code)

/** Recommended banner dimensions surfaced as guidance in the upload UI. */
export const SALE_BANNER_SPECS = {
  desktop: { label: 'Desktop Banner', width: 1600, height: 600, ratio: '8:3', hint: '1600 × 600 px — 8:3' },
  mobile: { label: 'Mobile Banner', width: 800, height: 400, ratio: '2:1', hint: '800 × 400 px — 2:1' },
  hero: { label: 'Best Quality (Hero)', width: 1920, height: 720, ratio: '8:3', hint: '1920 × 720 px — 8:3' },
  heroMobile: { label: 'Best Quality Mobile', width: 800, height: 500, ratio: '8:5', hint: '800 × 500 px — 8:5' },
} as const

// ============= INPUT TYPES =============

export type CreateEventInput = {
  event_name: string
  event_slug: string
  description?: string | null
  start_date: string
  end_date: string
  banner_image?: string | null
  currency?: string
  registration_start_date?: string | null
  registration_end_date?: string | null
  status?: SaleEventStatus
}

export type UpdateEventInput = Partial<CreateEventInput>

export type CreateOfferInput = {
  event_id: string
  offer_name: string
  discount_type: DiscountType
  discount_value: number
  max_discount_amount?: number | null
  min_order_amount?: number
  max_uses_total?: number | null
  max_uses_per_customer?: number
  applies_to: OfferAppliesTo
  currency?: string
}

export type CategoryPickerParams = {
  parentId?: string | null
  search?: string | null
  status?: string
  langCode?: string
}

export type ListingPickerParams = {
  shopIds?: string[]
  search?: string | null
  listingType?: 'physical' | 'digital' | 'service' | null
  limit?: number
  offset?: number
}

/** A banner file passed as a thunk arg (never stored in Redux). */
export type SaleBannerUploadFile = {
  blob: Blob
  mimeType: string
  fileName: string
  fileSize: number
}

export type SaleBannerValidation = {
  valid: boolean
  error?: string
  width?: number
  height?: number
}
