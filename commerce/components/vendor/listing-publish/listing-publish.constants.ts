import {
  LISTING_IMAGE_CONSTRAINTS,
  LISTING_TYPE_OPTIONS,
  LISTING_VALIDATION,
} from '~/lib/listing/listing.type'

/** Amazon-style top-tab identifiers — stable keys for navigation + validation. */
export const LISTING_PUBLISH_STEP_IDS = {
  IDENTITY: 'identity',
  BASIC: 'basic',
  IMAGES: 'images',
  VARIANTS: 'variants',
  PRICING: 'pricing',
  DETAILS: 'details',
  COMPLIANCE: 'compliance',
  APLUS: 'aplus',
  SHIPPING: 'shipping',
  CATEGORIES: 'categories',
  SEO: 'seo',
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
    | 'barcode'
    | 'shield'
    | 'layout'
}

/** Amazon Seller Central tab order: Vital info → Images → Variations → Offer → … */
export const LISTING_PUBLISH_STEPS: readonly ListingPublishStepConfig[] = [
  {
    id: LISTING_PUBLISH_STEP_IDS.IDENTITY,
    label: 'Start',
    headline: 'What are you selling?',
    subtitle: 'Pick the kind of product, say if it is new, and add a barcode if you have one.',
    iconName: 'barcode',
  },
  {
    id: LISTING_PUBLISH_STEP_IDS.BASIC,
    label: 'Name',
    headline: 'Name and description',
    subtitle: 'The name shoppers see, a short story, and a few tags.',
    iconName: 'info',
  },
  {
    id: LISTING_PUBLISH_STEP_IDS.IMAGES,
    label: 'Photos',
    headline: 'Photos of the product',
    subtitle: 'Start with the main photo, then add close-ups and other angles.',
    iconName: 'image',
  },
  {
    id: LISTING_PUBLISH_STEP_IDS.VARIANTS,
    label: 'Options',
    headline: 'Sizes, colors, and options',
    subtitle: 'One product is enough. Add sizes or colors only if you sell more than one.',
    iconName: 'sliders',
  },
  {
    id: LISTING_PUBLISH_STEP_IDS.PRICING,
    label: 'Price',
    headline: 'Your price and stock',
    subtitle: 'What you charge, how many you have, and a sale if you are running one.',
    iconName: 'indian-rupee',
  },
  {
    id: LISTING_PUBLISH_STEP_IDS.DETAILS,
    label: 'Details',
    headline: 'Who made it',
    subtitle: 'Your brand, where it was made, and the details this kind of product needs.',
    iconName: 'layers',
  },
  {
    id: LISTING_PUBLISH_STEP_IDS.COMPLIANCE,
    label: 'Papers',
    headline: 'Papers for this product',
    subtitle: 'Upload a licence or certificate only when this kind of product asks for one.',
    iconName: 'shield',
  },
  {
    id: LISTING_PUBLISH_STEP_IDS.APLUS,
    label: 'Story',
    headline: 'Extra story on the product page',
    subtitle: 'Optional photos and lines under the description. Skip this until you are ready.',
    iconName: 'layout',
  },
  {
    id: LISTING_PUBLISH_STEP_IDS.SHIPPING,
    label: 'Delivery',
    headline: 'How you send it',
    subtitle: 'Parcel weight, size, and the delivery and return options you already set up.',
    iconName: 'truck',
  },
  {
    id: LISTING_PUBLISH_STEP_IDS.CATEGORIES,
    label: 'Category',
    headline: 'Where shoppers browse',
    subtitle: 'Pick the shelves this product belongs on. Up to 10.',
    iconName: 'tags',
  },
  {
    id: LISTING_PUBLISH_STEP_IDS.SEO,
    label: 'Search',
    headline: 'Words shoppers search',
    subtitle: 'The link name, a search title, and extra words that stay off the product page.',
    iconName: 'search',
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

/** All Amazon listing tabs — Variations is always visible (Yes/No gate lives on that tab). */
export function getListingPublishSteps(_structure?: ProductStructure): ListingPublishStepConfig[] {
  return [...LISTING_PUBLISH_STEPS]
}

/** Keys stored inside `listing_metadata` for vendor-only form fields. */
export const LISTING_METADATA_KEYS = {
  /** simple | variable — Amazon product offer type */
  PRODUCT_STRUCTURE: 'product_structure',
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
  SALE_PRICE: 'sale_price',
  SALE_START_AT: 'sale_start_at',
  SALE_END_AT: 'sale_end_at',
  BACKEND_SEARCH_TERMS: 'backend_search_terms',
} as const

export const LISTING_PUBLISH_DEFAULT_METADATA = {
  [LISTING_METADATA_KEYS.PRODUCT_STRUCTURE]: PRODUCT_STRUCTURES.SIMPLE,
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
  PAGE_TITLE_CREATE: 'Add a product',
  PAGE_TITLE_EDIT: 'Edit product',
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
    'Upload at least 3 product photos (main + details). Main image ≥1000px, clean background, no watermarks.',
  IMAGE_GUIDELINES: [
    'Main image: product fills the frame on a clean / white background.',
    `At least ${LISTING_IMAGE_CONSTRAINTS.MIN_LONG_EDGE_PX}px on the longest side (1600px+ recommended).`,
    `Upload ${LISTING_IMAGE_CONSTRAINTS.MIN_COUNT_PUBLISH}–${LISTING_IMAGE_CONSTRAINTS.MAX_COUNT} photos: MAIN, angle, detail, lifestyle.`,
    'No watermarks, logos, or text overlays on the main image.',
    'Use natural lighting; keep colours accurate to the product.',
  ] as const,
} as const
