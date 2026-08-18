import {
  LISTING_IMAGE_CONSTRAINTS,
  LISTING_TYPE_OPTIONS,
  LISTING_VALIDATION,
} from '~/lib/listing/listing.type'

/** Wizard step identifiers — stable keys for navigation + validation. */
export const LISTING_PUBLISH_STEP_IDS = {
  BASIC: 'basic',
  DETAILS: 'details',
  PRICING: 'pricing',
  CATEGORIES: 'categories',
  IMAGES: 'images',
  SEO: 'seo',
} as const

export type ListingPublishStepId =
  (typeof LISTING_PUBLISH_STEP_IDS)[keyof typeof LISTING_PUBLISH_STEP_IDS]

export type ListingPublishStepConfig = {
  id: ListingPublishStepId
  label: string
  headline: string
  subtitle: string
  iconName: 'info' | 'layers' | 'indian-rupee' | 'tags' | 'image' | 'search'
}

export const LISTING_PUBLISH_STEPS: readonly ListingPublishStepConfig[] = [
  {
    id: LISTING_PUBLISH_STEP_IDS.BASIC,
    label: 'Basic Info',
    headline: 'Listing Basics',
    subtitle: 'Introduce your product with a compelling title, description, and tags.',
    iconName: 'info',
  },
  {
    id: LISTING_PUBLISH_STEP_IDS.DETAILS,
    label: 'Details',
    headline: 'Listing Details',
    subtitle:
      'Specify the core characteristics, material composition, and logistical data that define this unique artisan piece.',
    iconName: 'layers',
  },
  {
    id: LISTING_PUBLISH_STEP_IDS.PRICING,
    label: 'Pricing',
    headline: 'Pricing & Inventory',
    subtitle: 'Define your commercial strategy and stock management.',
    iconName: 'indian-rupee',
  },
  {
    id: LISTING_PUBLISH_STEP_IDS.CATEGORIES,
    label: 'Categories',
    headline: 'Select Categories',
    subtitle: 'Classify your item to help customers find it more easily.',
    iconName: 'tags',
  },
  {
    id: LISTING_PUBLISH_STEP_IDS.IMAGES,
    label: 'Images',
    headline: 'Select Images',
    subtitle: 'Help customers discover your item with clear and appealing product photos.',
    iconName: 'image',
  },
  {
    id: LISTING_PUBLISH_STEP_IDS.SEO,
    label: 'SEO',
    headline: 'Search Engine Optimization',
    subtitle: 'Fine-tune how your product appears in global search results and discoverability feeds.',
    iconName: 'search',
  },
] as const

/** Re-export listing type options so UIs never duplicate labels. */
export { LISTING_TYPE_OPTIONS, LISTING_VALIDATION, LISTING_IMAGE_CONSTRAINTS }

/** Image guidance aligned with orchestrator (≥1) and design mockup (≥3 recommended). */
export const LISTING_PUBLISH_IMAGE_HINTS = {
  MIN_REQUIRED_PUBLISH: 1,
  MIN_RECOMMENDED: 3,
  MAX_SIZE_MB: LISTING_IMAGE_CONSTRAINTS.MAX_SIZE_BYTES / (1024 * 1024),
  ACCEPTED_FORMATS_LABEL: 'JPG, PNG, WebP',
} as const

/** Keys stored inside `listing_metadata` for vendor-only form fields. */
export const LISTING_METADATA_KEYS = {
  PRICING_NOTES: 'pricing_notes',
  MIN_ORDER_QUANTITY: 'min_order_quantity',
  LOW_STOCK_THRESHOLD: 'low_stock_threshold',
  FOLLOWERS_ONLY: 'followers_only',
  ACCEPT_OFFERS: 'accept_offers',
  OFFER_BULK_DISCOUNTS: 'offer_bulk_discounts',
  SEO_INDEX: 'seo_index',
  SEO_FOLLOW_LINKS: 'seo_follow_links',
  SEO_EXCLUDE_SITE_SEARCH: 'seo_exclude_site_search',
  SEO_RICH_SNIPPETS: 'seo_rich_snippets',
  HS_CODE: 'hs_code',
  PACKAGE_LENGTH_CM: 'package_length_cm',
  PACKAGE_WIDTH_CM: 'package_width_cm',
  PACKAGE_HEIGHT_CM: 'package_height_cm',
} as const

export const LISTING_PUBLISH_DEFAULT_METADATA = {
  [LISTING_METADATA_KEYS.PRICING_NOTES]: '',
  [LISTING_METADATA_KEYS.MIN_ORDER_QUANTITY]: '1',
  [LISTING_METADATA_KEYS.LOW_STOCK_THRESHOLD]: '5',
  [LISTING_METADATA_KEYS.FOLLOWERS_ONLY]: false,
  [LISTING_METADATA_KEYS.ACCEPT_OFFERS]: false,
  [LISTING_METADATA_KEYS.OFFER_BULK_DISCOUNTS]: false,
  [LISTING_METADATA_KEYS.SEO_INDEX]: true,
  [LISTING_METADATA_KEYS.SEO_FOLLOW_LINKS]: true,
  [LISTING_METADATA_KEYS.SEO_EXCLUDE_SITE_SEARCH]: false,
  [LISTING_METADATA_KEYS.SEO_RICH_SNIPPETS]: true,
  [LISTING_METADATA_KEYS.HS_CODE]: '',
  [LISTING_METADATA_KEYS.PACKAGE_LENGTH_CM]: '',
  [LISTING_METADATA_KEYS.PACKAGE_WIDTH_CM]: '',
  [LISTING_METADATA_KEYS.PACKAGE_HEIGHT_CM]: '',
} as const

export const LISTING_PUBLISH_COPY = {
  PAGE_TITLE_CREATE: 'Create New Listing',
  PAGE_TITLE_EDIT: 'Edit Listing',
  SAVE_DRAFT: 'Save as Draft',
  PUBLISH: 'Publish',
  BACK: 'Back',
  NEXT: 'Next',
  STEP_LOCKED: 'Finish the current step first',
  CANCEL_CHANGES: 'Cancel Changes',
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
  IMAGES_REQUIRED_BANNER: 'Images Required: Please upload at least 3 high-quality product images to proceed with listing.',
  LISTING_TIP_CATEGORIES:
    'Vendors who select specific sub-categories see a 24% increase in discovery rates. Our Orchestrator AI will verify these tags after you publish.',
  EXPERT_TIP_PRICING:
    "Products with 'Accept Offers' enabled see a 14% higher engagement rate. Bulk discounts are recommended for items in the Lifestyle category.",
  IMAGE_GUIDELINES: [
    'Use clean, neutral backgrounds.',
    'Upload at least 2000px on the longest side.',
    'Include lifestyle shots.',
    'Avoid watermarks or text overlays.',
    'Ensure natural lighting.',
  ] as const,
  SEO_BEST_PRACTICES: [
    'Include your primary keyword naturally in the title and description.',
    'Ensure your SEO Title is unique across your catalogue.',
    'Use descriptive alt-text on every product image.',
  ] as const,
} as const
