import type { Database, Tables, TablesInsert, TablesUpdate } from '~/lib/supabase'
import type { ShopSummary } from '~/commerce/lib/commerce'

/**
 * Shared shape returned by every shop service call.
 * Mirrors the profile `ServiceResponse` helper so the two stores stay symmetric.
 */
export type ShopServiceResponse<T> = {
  data: T | null
  error: string | null
  success: boolean
}

/** Full row / insert / update helpers for the `shops` table. */
export type Shop = Tables<'shops'>
export type ShopInsert = TablesInsert<'shops'>
export type ShopUpdate = TablesUpdate<'shops'>

/** Follow row from the `shop_follows` table. */
export type ShopFollow = Tables<'shop_follows'>

/** Row from the `shop_listings_summary` database view. */
export type ShopListingsSummary = Database['public']['Views']['shop_listings_summary']['Row']

/** Re-export the compact browse shape so shop consumers have a single import surface. */
export type { ShopSummary }

/**
 * The subset of shop columns collected by the multi-step create/edit form.
 * Everything is optional so partial updates (autosave) type-check cleanly.
 */
export type ShopFormData = {
  shop_name: string
  shop_description: string
  logo_url: string
  website_url: string
  shop_phone_number: string
  shop_email: string
  shop_address_id: string | null
  shop_categories: string[]
  shop_hours: Record<string, string>
  social_links: Record<string, string>
  shop_currency: string
  shop_metadata: Record<string, unknown>
}

/** Sort options accepted by the public shop directory. */
export type ShopSortBy = 'newest' | 'oldest' | 'name' | 'rating'

export type ShopFilters = {
  category?: string
  search?: string
  shopIds?: string[]
  verified?: boolean
  minListings?: number
  hasFeatured?: boolean
}

export type ShopPagination = {
  limit?: number
  offset?: number
  sortBy?: ShopSortBy
}

/** Normalised statistics derived from `shop_listings_summary`. */
export type ShopStats = {
  totalListings: number
  activeListings: number
  physicalListings: number
  digitalListings: number
  serviceListings: number
  featuredListings: number
  priceRange: { min: number; max: number; avg: number }
  latestListingDate: string | null
  isActive: boolean
  isVerified: boolean
}

/** Platform-wide counts for the admin dashboard. */
export type PlatformShopStats = {
  totalShops: number
  activeShops: number
  verifiedShops: number
  pendingVerification: number
}

/** Result of `validateShopData` / `validateCompleteShop`. */
export type ShopValidationResult = {
  isValid: boolean
  errors: Record<string, string>
}

export type ShopImageUpload = {
  blob: Blob | ArrayBuffer | File
  mimeType: string
  fileName?: string
}

export type ShopFollowerSummary = {
  id: string
  full_name: string | null
  username: string | null
  avatar_url: string | null
  followed_at: string
}

// ============= CONSTANTS =============

/** Default currency assigned to a new shop when none is supplied. */
export const DEFAULT_SHOP_CURRENCY = 'INR'

/** Supabase Storage bucket used for shop logo / banner uploads. */
export const SHOP_MEDIA_BUCKET = 'shop-images'

/** Lifecycle status stored in `shop_follows.status`. */
export const SHOP_FOLLOW_STATUS = {
  ACTIVE: 'active',
  MUTED: 'muted',
  BLOCKED: 'blocked',
} as const

export type ShopFollowStatus = (typeof SHOP_FOLLOW_STATUS)[keyof typeof SHOP_FOLLOW_STATUS]

export const SHOP_FOLLOW_STATUSES: readonly ShopFollowStatus[] = [
  SHOP_FOLLOW_STATUS.ACTIVE,
  SHOP_FOLLOW_STATUS.MUTED,
  SHOP_FOLLOW_STATUS.BLOCKED,
]

/** Field length / count limits, shared by validation + form UIs. */
export const SHOP_VALIDATION = {
  NAME: { MIN_LENGTH: 2, MAX_LENGTH: 200 },
  DESCRIPTION: { MAX_LENGTH: 1000 },
  EMAIL: { MAX_LENGTH: 254 },
  CATEGORIES: { MAX_SELECTED: 5 },
} as const

/** Curated currencies offered in the shop create/edit form. */
export const SUPPORTED_CURRENCIES = [
  { code: 'INR', symbol: '₹', name: 'Indian Rupee' },
  { code: 'USD', symbol: '$', name: 'US Dollar' },
  { code: 'EUR', symbol: '€', name: 'Euro' },
  { code: 'GBP', symbol: '£', name: 'British Pound' },
  { code: 'AUD', symbol: 'A$', name: 'Australian Dollar' },
  { code: 'CAD', symbol: 'C$', name: 'Canadian Dollar' },
  { code: 'SGD', symbol: 'S$', name: 'Singapore Dollar' },
  { code: 'AED', symbol: 'د.إ', name: 'UAE Dirham' },
] as const

/** Broad currency-code → symbol lookup used by display formatting. */
export const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: '$',
  EUR: '€',
  GBP: '£',
  JPY: '¥',
  INR: '₹',
  CAD: 'C$',
  AUD: 'A$',
  CHF: 'CHF',
  CNY: '¥',
  SGD: 'S$',
  HKD: 'HK$',
  NZD: 'NZ$',
  ZAR: 'R',
  AED: 'د.إ',
  SAR: '﷼',
  PKR: '₨',
  LKR: '₨',
  BDT: '৳',
  NPR: '₨',
  THB: '฿',
  VND: '₫',
  IDR: 'Rp',
  MYR: 'RM',
  PHP: '₱',
}

/** Curated list of shop categories offered during onboarding. */
export const COMMON_SHOP_CATEGORIES: readonly string[] = [
  'Fashion & Clothing',
  'Beauty & Cosmetics',
  'Jewelry & Accessories',
  'Home & Garden',
  'Health & Wellness',
  'Arts & Crafts',
  'Food & Beverages',
  'Electronics & Gadgets',
  'Books & Education',
  'Baby & Kids',
  'Sports & Fitness',
  'Travel & Tourism',
  'Services & Consulting',
  'Digital Products',
  'Photography',
  'Event Planning',
  'Pet Care & Supplies',
  'Automotive',
  'Music & Entertainment',
  'Handmade & Artisan',
  'Wedding & Party Supplies',
  'Office Supplies',
  'Toys & Games',
  'Furniture & Decor',
  'Vintage & Antiques',
  'Other',
]

export type ShopCreationStep = {
  id: 'basicInfo' | 'contact' | 'categories' | 'currency' | 'socialMedia'
  title: string
  subtitle: string
  description: string
  /** Icon name (resolved to a component by the UI layer, not this module). */
  icon: string
  required: boolean
  fields: (keyof ShopFormData)[]
}

/**
 * Multi-step create-shop configuration. Icons are stored as string keys so
 * this stays a pure data module (no React / icon-library imports).
 */
export const SHOP_CREATION_STEPS: readonly ShopCreationStep[] = [
  {
    id: 'basicInfo',
    title: 'Basic Information',
    subtitle: 'Tell us about your shop',
    description: 'Shop name and description',
    icon: 'store',
    required: true,
    fields: ['shop_name', 'shop_description'],
  },
  {
    id: 'contact',
    title: 'Contact Details',
    subtitle: 'How customers can reach you',
    description: 'Phone, email, and website',
    icon: 'phone',
    required: true,
    fields: ['shop_phone_number', 'shop_email', 'website_url'],
  },
  {
    id: 'categories',
    title: 'Business Categories',
    subtitle: 'What do you sell?',
    description: 'Select your business categories',
    icon: 'tag',
    required: false,
    fields: ['shop_categories'],
  },
  {
    id: 'currency',
    title: 'Currency Setting',
    subtitle: 'Your pricing currency',
    description: 'Choose your shop currency',
    icon: 'dollar-sign',
    required: false,
    fields: ['shop_currency'],
  },
  {
    id: 'socialMedia',
    title: 'Social Media',
    subtitle: 'Connect your profiles',
    description: 'Link your social accounts (optional)',
    icon: 'share-2',
    required: false,
    fields: ['social_links'],
  },
]

/** Social platforms accepted in `social_links`. */
export const VALID_SOCIAL_PLATFORMS = [
  'facebook',
  'instagram',
  'twitter',
  'linkedin',
  'youtube',
  'pinterest',
  'tiktok',
  'whatsapp',
] as const

export type SocialPlatform = (typeof VALID_SOCIAL_PLATFORMS)[number]

/** Empty form used to seed / reset the create-shop flow. */
export const EMPTY_SHOP_FORM_DATA: ShopFormData = {
  shop_name: '',
  shop_description: '',
  logo_url: '',
  website_url: '',
  shop_phone_number: '',
  shop_email: '',
  shop_address_id: null,
  shop_categories: [],
  shop_hours: {},
  social_links: {},
  shop_currency: DEFAULT_SHOP_CURRENCY,
  shop_metadata: {},
}
