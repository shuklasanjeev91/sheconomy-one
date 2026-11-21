import {
  LISTING_IMAGE_CONSTRAINTS,
  LISTING_TYPE_OPTIONS,
  LISTING_VALIDATION,
} from '~/lib/listing/listing.type'

/** Section anchors for the single listing page. */
export const LISTING_PUBLISH_STEP_IDS = {
  PHOTOS: 'photos',
  CATEGORY: 'category',
  ABOUT: 'about',
  PRICE: 'price',
  VARIATIONS: 'item-options',
  PERSONALIZATION: 'personalization',
  SHIPPING: 'shipping',
  RETURNS: 'returns',
  MADE: 'how-its-made',
  SETTINGS: 'settings',
  DETAILS: 'details',
} as const

export type ListingPublishStepId =
  (typeof LISTING_PUBLISH_STEP_IDS)[keyof typeof LISTING_PUBLISH_STEP_IDS]

export type ListingPublishStepConfig = {
  id: ListingPublishStepId
  label: string
  headline: string
  subtitle: string
  iconName:
    | 'info'
    | 'layers'
    | 'indian-rupee'
    | 'tags'
    | 'image'
    | 'search'
    | 'sliders'
    | 'truck'
}

/** One scrolling page: photos, category, details, options, price, shipping, maker, settings. */
export const LISTING_PUBLISH_STEPS: readonly ListingPublishStepConfig[] = [
  {
    id: LISTING_PUBLISH_STEP_IDS.PHOTOS,
    label: 'Photos',
    headline: 'Photos and video',
    subtitle: `Add up to ${LISTING_IMAGE_CONSTRAINTS.MAX_COUNT} photos and ${LISTING_IMAGE_CONSTRAINTS.MAX_VIDEOS} videos. The first photo is the thumbnail.`,
    iconName: 'image',
  },
  {
    id: LISTING_PUBLISH_STEP_IDS.CATEGORY,
    label: 'Category',
    headline: 'Category',
    subtitle: 'One category, physical or digital, and when it was made.',
    iconName: 'search',
  },
  {
    id: LISTING_PUBLISH_STEP_IDS.ABOUT,
    label: 'Details',
    headline: 'Item details',
    subtitle: 'Title, description, and download files for digital items.',
    iconName: 'info',
  },
  {
    id: LISTING_PUBLISH_STEP_IDS.VARIATIONS,
    label: 'Options',
    headline: 'Item options',
    subtitle: 'Up to three options such as color, size, and style, plus personalization and tags.',
    iconName: 'sliders',
  },
  {
    id: LISTING_PUBLISH_STEP_IDS.PRICE,
    label: 'Price',
    headline: 'Price and inventory',
    subtitle: 'What you charge, how many you have, and an optional SKU.',
    iconName: 'indian-rupee',
  },
  {
    id: LISTING_PUBLISH_STEP_IDS.SHIPPING,
    label: 'Shipping',
    headline: 'Pricing and shipping',
    subtitle: 'Processing time, delivery profile, package size, and returns.',
    iconName: 'truck',
  },
  {
    id: LISTING_PUBLISH_STEP_IDS.MADE,
    label: 'Made',
    headline: 'How it is made',
    subtitle: 'Who made it and whether it is a finished product or a supply.',
    iconName: 'layers',
  },
  {
    id: LISTING_PUBLISH_STEP_IDS.SETTINGS,
    label: 'Settings',
    headline: 'Settings',
    subtitle: 'Shop section and whether this listing is featured.',
    iconName: 'tags',
  },
] as const

/** Re-export listing type options so UIs never duplicate labels. */
export { LISTING_TYPE_OPTIONS, LISTING_VALIDATION, LISTING_IMAGE_CONSTRAINTS }

/** Image guidance (main + detail shots). */
export const LISTING_PUBLISH_IMAGE_HINTS = {
  MIN_REQUIRED_PUBLISH: LISTING_IMAGE_CONSTRAINTS.MIN_COUNT_PUBLISH,
  MIN_RECOMMENDED: LISTING_IMAGE_CONSTRAINTS.MIN_COUNT_RECOMMENDED,
  MAX_COUNT: LISTING_IMAGE_CONSTRAINTS.MAX_COUNT,
  MIN_LONG_EDGE_PX: LISTING_IMAGE_CONSTRAINTS.MIN_LONG_EDGE_PX,
  MAX_SIZE_MB: LISTING_IMAGE_CONSTRAINTS.MAX_SIZE_BYTES / (1024 * 1024),
  ACCEPTED_FORMATS_LABEL: 'JPG, PNG, WebP',
} as const

/** Catalog structure: Simple (single SKU) or Variant/Variable (parent + children). */
export const PRODUCT_STRUCTURES = {
  SIMPLE: 'simple',
  VARIABLE: 'variable',
  /** @deprecated Kept for reading legacy metadata only — UI no longer offers Grouped. */
  GROUPED: 'grouped',
} as const

export type ProductStructure =
  (typeof PRODUCT_STRUCTURES)[keyof typeof PRODUCT_STRUCTURES]

export const PRODUCT_STRUCTURE_OPTIONS = [
  {
    value: PRODUCT_STRUCTURES.SIMPLE,
    label: 'No',
    description: 'Sold as a single SKU.',
  },
  {
    value: PRODUCT_STRUCTURES.VARIABLE,
    label: 'Yes',
    description: 'Size, color, or other options.',
  },
] as const

/** Every section on the single listing page. */
export function getListingPublishSteps(_structure?: ProductStructure): ListingPublishStepConfig[] {
  return [...LISTING_PUBLISH_STEPS]
}

/** Keys stored inside `listing_metadata` for vendor-only form fields. */
export const LISTING_METADATA_KEYS = {
  /** simple | variable — whether this listing uses variation rows */
  PRODUCT_STRUCTURE: 'product_structure',
  VARIATION_PRICES_VARY: 'variation_prices_vary',
  VARIATION_QUANTITIES_VARY: 'variation_quantities_vary',
  VARIATION_SKUS_VARY: 'variation_skus_vary',
  VARIATION_PROCESSING_VARIES: 'variation_processing_varies',
  VARIATION_VISIBILITY_VARIES: 'variation_visibility_varies',
  /** Legacy grouped listing IDs (no longer edited in UI) */
  GROUPED_LISTING_IDS: 'grouped_listing_ids',
  PRICING_NOTES: 'pricing_notes',
  MIN_ORDER_QUANTITY: 'min_order_quantity',
  LOW_STOCK_THRESHOLD: 'low_stock_threshold',
  ALLOW_PREORDER: 'allow_preorder',
  EXPECTED_SHIP_AT: 'expected_ship_at',
  REPLENISHABLE: 'replenishable',
  FOLLOWERS_ONLY: 'followers_only',
  ACCEPT_OFFERS: 'accept_offers',
  OFFER_BULK_DISCOUNTS: 'offer_bulk_discounts',
  SEO_INDEX: 'seo_index',
  SEO_FOLLOW_LINKS: 'seo_follow_links',
  SEO_EXCLUDE_SITE_SEARCH: 'seo_exclude_site_search',
  SEO_RICH_SNIPPETS: 'seo_rich_snippets',
  HS_CODE: 'hs_code',
  COUNTRY_OF_ORIGIN: 'country_of_origin',
  PACKAGE_LENGTH_CM: 'package_length_cm',
  PACKAGE_WIDTH_CM: 'package_width_cm',
  PACKAGE_HEIGHT_CM: 'package_height_cm',
  HANDLING_TIME_DAYS: 'handling_time_days',
  ITEM_READINESS: 'item_readiness',
  PROCESSING_MIN_DAYS: 'processing_min_days',
  PROCESSING_MAX_DAYS: 'processing_max_days',
  DIGITAL_FILES: 'digital_files',
  SALE_PRICE: 'sale_price',
  SALE_START_AT: 'sale_start_at',
  SALE_END_AT: 'sale_end_at',
  BACKEND_SEARCH_TERMS: 'backend_search_terms',
} as const

export const LISTING_PUBLISH_DEFAULT_METADATA = {
  [LISTING_METADATA_KEYS.PRODUCT_STRUCTURE]: PRODUCT_STRUCTURES.SIMPLE,
  [LISTING_METADATA_KEYS.VARIATION_PRICES_VARY]: true,
  [LISTING_METADATA_KEYS.VARIATION_QUANTITIES_VARY]: true,
  [LISTING_METADATA_KEYS.VARIATION_SKUS_VARY]: false,
  [LISTING_METADATA_KEYS.VARIATION_PROCESSING_VARIES]: false,
  [LISTING_METADATA_KEYS.VARIATION_VISIBILITY_VARIES]: false,
  [LISTING_METADATA_KEYS.GROUPED_LISTING_IDS]: [] as string[],
  [LISTING_METADATA_KEYS.PRICING_NOTES]: '',
  [LISTING_METADATA_KEYS.MIN_ORDER_QUANTITY]: '1',
  [LISTING_METADATA_KEYS.LOW_STOCK_THRESHOLD]: '5',
  [LISTING_METADATA_KEYS.ALLOW_PREORDER]: false,
  [LISTING_METADATA_KEYS.EXPECTED_SHIP_AT]: '',
  [LISTING_METADATA_KEYS.REPLENISHABLE]: false,
  [LISTING_METADATA_KEYS.FOLLOWERS_ONLY]: false,
  [LISTING_METADATA_KEYS.ACCEPT_OFFERS]: false,
  [LISTING_METADATA_KEYS.OFFER_BULK_DISCOUNTS]: false,
  [LISTING_METADATA_KEYS.SEO_INDEX]: true,
  [LISTING_METADATA_KEYS.SEO_FOLLOW_LINKS]: true,
  [LISTING_METADATA_KEYS.SEO_EXCLUDE_SITE_SEARCH]: false,
  [LISTING_METADATA_KEYS.SEO_RICH_SNIPPETS]: true,
  [LISTING_METADATA_KEYS.HS_CODE]: '',
  [LISTING_METADATA_KEYS.COUNTRY_OF_ORIGIN]: '',
  [LISTING_METADATA_KEYS.PACKAGE_LENGTH_CM]: '',
  [LISTING_METADATA_KEYS.PACKAGE_WIDTH_CM]: '',
  [LISTING_METADATA_KEYS.PACKAGE_HEIGHT_CM]: '',
  [LISTING_METADATA_KEYS.HANDLING_TIME_DAYS]: '2',
  [LISTING_METADATA_KEYS.SALE_PRICE]: '',
  [LISTING_METADATA_KEYS.SALE_START_AT]: '',
  [LISTING_METADATA_KEYS.SALE_END_AT]: '',
  [LISTING_METADATA_KEYS.BACKEND_SEARCH_TERMS]: '',
} as const

export const LISTING_PUBLISH_COPY = {
  PAGE_TITLE_CREATE: 'Add a listing',
  PAGE_TITLE_EDIT: 'Edit listing',
  PAGE_TITLE_DUPLICATE: 'Copy product',
  SAVE_DRAFT: 'Save draft',
  PUBLISH: 'Publish',
  BACK: 'Back',
  NEXT: 'Next',
  STEP_LOCKED: 'Finish this step first',
  CANCEL_CHANGES: 'Cancel',
  LOAD_FAILED_TITLE: "We couldn't open this listing",
  LOAD_MISSING: "This listing no longer exists, or it isn't part of your shop.",
  LOAD_RETRY: 'Try again',
  BACK_TO_PRODUCTS: 'Back to products',
  NO_SHOP_TITLE: 'Create your shop first',
  NO_SHOP_MESSAGE: 'You need an active shop before you can add or edit products.',
  NO_SHOP_ACTION: 'Go to My Shop',
  CLEAR_ALL: 'Clear All',
  LAST_SAVED_PREFIX: 'Last saved:',
  LAST_SAVED_NEVER: 'Not saved yet',
  IMAGES_REQUIRED_BANNER:
    `Add at least 1 photo. You can upload up to ${LISTING_IMAGE_CONSTRAINTS.MAX_COUNT} photos and ${LISTING_IMAGE_CONSTRAINTS.MAX_VIDEOS} videos. The first photo is the thumbnail.`,
  IMAGE_GUIDELINES: [
    'The first photo is the thumbnail buyers see in search.',
    `At least ${LISTING_IMAGE_CONSTRAINTS.MIN_LONG_EDGE_PX}px on the longest side (1600px+ recommended).`,
    `Upload up to ${LISTING_IMAGE_CONSTRAINTS.MAX_COUNT} photos and ${LISTING_IMAGE_CONSTRAINTS.MAX_VIDEOS} videos.`,
    'Drag is not required — the first photo stays the thumbnail.',
    'Use natural lighting and keep colours accurate to the product.',
  ] as const,
} as const
