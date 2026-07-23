/**
 * Discount feature constants — enums, defaults, limits, and templates.
 *
 * Ported from legacy `discounts-schema.js` and `discountUtils.js` (non-UI portions).
 */

import { DEFAULT_SHOP_CURRENCY } from '~/lib/shop/shop.type'

// ============= DISCOUNT ENUMS =============

export const DISCOUNT_TYPES = {
  PERCENTAGE: 'percentage',
  FIXED: 'fixed',
  BOGO: 'bogo',
  FREE_SHIPPING: 'free_shipping',
} as const

export const DISCOUNT_TYPE_VALUES = [
  DISCOUNT_TYPES.PERCENTAGE,
  DISCOUNT_TYPES.FIXED,
  DISCOUNT_TYPES.BOGO,
  DISCOUNT_TYPES.FREE_SHIPPING,
] as const

export const APPLIES_TO = {
  ORDER: 'order',
  ITEM: 'item',
  SHIPPING: 'shipping',
  CATEGORY: 'category',
} as const

export const APPLIES_TO_VALUES = [
  APPLIES_TO.ORDER,
  APPLIES_TO.ITEM,
  APPLIES_TO.SHIPPING,
  APPLIES_TO.CATEGORY,
] as const

export const DISCOUNT_USER_TYPES = {
  ALL: 'all',
  NEW: 'new',
  RETURNING: 'returning',
  VIP: 'vip',
} as const

export const DISCOUNT_USER_TYPE_VALUES = [
  DISCOUNT_USER_TYPES.ALL,
  DISCOUNT_USER_TYPES.NEW,
  DISCOUNT_USER_TYPES.RETURNING,
  DISCOUNT_USER_TYPES.VIP,
] as const

export const BOGO_GET_DISCOUNT_TYPES = {
  FREE: 'free',
  PERCENTAGE: 'percentage',
} as const

export const BOGO_GET_DISCOUNT_TYPE_VALUES = [
  BOGO_GET_DISCOUNT_TYPES.FREE,
  BOGO_GET_DISCOUNT_TYPES.PERCENTAGE,
] as const

export const DISCOUNT_SOURCE = {
  MANUAL: 'manual',
  EVENT: 'event',
} as const

export const DISCOUNT_SOURCE_VALUES = [DISCOUNT_SOURCE.MANUAL, DISCOUNT_SOURCE.EVENT] as const

export const DISCOUNT_SORT_BY = {
  CREATED_AT: 'created_at',
  UPDATED_AT: 'updated_at',
  DISCOUNT_NAME: 'discount_name',
  VALID_FROM: 'valid_from',
  VALID_UNTIL: 'valid_until',
  TOTAL_USES: 'total_uses',
} as const

export const DISCOUNT_SORT_BY_VALUES = [
  DISCOUNT_SORT_BY.CREATED_AT,
  DISCOUNT_SORT_BY.UPDATED_AT,
  DISCOUNT_SORT_BY.DISCOUNT_NAME,
  DISCOUNT_SORT_BY.VALID_FROM,
  DISCOUNT_SORT_BY.VALID_UNTIL,
  DISCOUNT_SORT_BY.TOTAL_USES,
] as const

export const DISCOUNT_SORT_ORDER = {
  ASC: 'asc',
  DESC: 'desc',
} as const

export const DISCOUNT_SORT_ORDER_VALUES = [DISCOUNT_SORT_ORDER.ASC, DISCOUNT_SORT_ORDER.DESC] as const

export const DISCOUNT_FETCH_SCOPE = {
  VENDOR: 'vendor',
  ADMIN: 'admin',
  BUYER: 'buyer',
} as const

export const DISCOUNT_FETCH_SCOPE_VALUES = [
  DISCOUNT_FETCH_SCOPE.VENDOR,
  DISCOUNT_FETCH_SCOPE.ADMIN,
  DISCOUNT_FETCH_SCOPE.BUYER,
] as const

// ============= VALIDATION LIMITS =============

export const DISCOUNT_VALIDATION = {
  NAME: { MIN_LENGTH: 1, MAX_LENGTH: 100 },
  CODE: { MIN_LENGTH: 3, MAX_LENGTH: 50 },
  DESCRIPTION: { MAX_LENGTH: 500 },
  PERCENTAGE: { MIN: 0, MAX: 100 },
  POSTER_NAME: { MIN_LENGTH: 1, MAX_LENGTH: 100 },
  POSTER_SLUG_MAX_LENGTH: 100,
  HIGH_USAGE_RATIO: 0.8,
  EXPIRING_SOON_DAYS: 7,
  QUERY_TIMEOUT_MS: 10_000,
  ANALYTICS_QUERY_TIMEOUT_MS: 20_000,
  ANALYTICS_PROFILE_TIMEOUT_MS: 5_000,
  ANALYTICS_BATCH_SIZE: 500,
  MAX_RETRIES: 3,
  RETRY_DELAY_MS: 1_000,
} as const

// ============= PAGINATION / FILTER DEFAULTS =============

export const DEFAULT_DISCOUNT_PAGINATION = {
  page: 1,
  limit: 20,
  total: 0,
  total_pages: 0,
  has_more: false,
} as const

export const DEFAULT_DISCOUNT_FILTERS = {
  active_only: false,
  include_expired: false,
  discount_type: null as (typeof DISCOUNT_TYPE_VALUES)[number] | null,
  applies_to: null as (typeof APPLIES_TO_VALUES)[number] | null,
  search: null as string | null,
  sort_by: DISCOUNT_SORT_BY.CREATED_AT,
  sort_order: DISCOUNT_SORT_ORDER.DESC,
  source: null as (typeof DISCOUNT_SOURCE_VALUES)[number] | null,
} as const

export const DEFAULT_DISCOUNT_FORM = {
  discount_name: '',
  discount_code: '',
  description: '',
  discount_type: DISCOUNT_TYPES.PERCENTAGE,
  discount_value: '' as number | string,
  max_discount_amount: '' as number | string,
  applies_to: APPLIES_TO.ORDER,
  min_order_amount: '' as number | string,
  max_uses_total: '' as number | string,
  max_uses_per_customer: 1,
  eligible_user_types: [DISCOUNT_USER_TYPES.ALL],
  is_active: true,
  valid_from: '',
  valid_until: '',
} as const

export const DEFAULT_BOGO_RULE_FORM = {
  buy_listing_ids: [] as string[],
  get_listing_ids: [] as string[],
  buy_categories: [] as string[],
  get_categories: [] as string[],
  buy_quantity: 1,
  get_quantity: 1,
  get_discount_type: BOGO_GET_DISCOUNT_TYPES.FREE,
  get_discount_value: 100,
  template_id: undefined as string | undefined,
} as const

export const DEFAULT_DISCOUNT_CURRENCY = DEFAULT_SHOP_CURRENCY

// ============= POSTER CONFIG =============

export const ALLOWED_POSTER_DIMENSIONS = [
  { width: 330, height: 200, label: '330 × 200' },
  { width: 300, height: 50, label: '300 × 50' },
  { width: 300, height: 100, label: '300 × 100' },
  { width: 250, height: 250, label: '250 × 250' },
  { width: 200, height: 200, label: '200 × 200' },
] as const

export const DISCOUNT_POSTER_CONFIG = {
  MAX_FILE_SIZE_BYTES: 5 * 1024 * 1024,
  ALLOWED_MIME_TYPES: ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'] as const,
  BUCKET_NAME: 'Promotion&Discount',
  CACHE_CONTROL: '3600',
} as const

// ============= BOGO TEMPLATES =============

export type BogoTemplateDefaults = {
  buy_quantity: number
  get_quantity: number
  get_discount_type: (typeof BOGO_GET_DISCOUNT_TYPE_VALUES)[number]
  get_discount_value: number
  use_categories: boolean | 'buy_only' | 'get_only'
  same_buy_get: boolean
}

export type BogoTemplateDefinition = {
  id: string
  label: string
  description: string
  icon: string
  color: string
  defaults: BogoTemplateDefaults
}

export const BOGO_TEMPLATES = {
  SAME_PRODUCT_FREE: {
    id: 'same_product_free',
    label: 'Same Product Free',
    description: 'Buy 1 → Get 1 of same product FREE',
    icon: 'Package',
    color: 'blue',
    defaults: {
      buy_quantity: 1,
      get_quantity: 1,
      get_discount_type: BOGO_GET_DISCOUNT_TYPES.FREE,
      get_discount_value: 100,
      use_categories: false,
      same_buy_get: true,
    },
  },
  DIFFERENT_PRODUCT_FREE: {
    id: 'different_product_free',
    label: 'Different Product Free',
    description: 'Buy X → Get Y FREE (different product)',
    icon: 'Gift',
    color: 'green',
    defaults: {
      buy_quantity: 1,
      get_quantity: 1,
      get_discount_type: BOGO_GET_DISCOUNT_TYPES.FREE,
      get_discount_value: 100,
      use_categories: false,
      same_buy_get: false,
    },
  },
  BUY_2_GET_1_FREE: {
    id: 'buy_2_get_1_free',
    label: 'Buy 2 Get 1 Free',
    description: 'Buy 2 items → Get 1 FREE',
    icon: 'ShoppingBag',
    color: 'purple',
    defaults: {
      buy_quantity: 2,
      get_quantity: 1,
      get_discount_type: BOGO_GET_DISCOUNT_TYPES.FREE,
      get_discount_value: 100,
      use_categories: false,
      same_buy_get: true,
    },
  },
  PRODUCT_PERCENTAGE_OFF: {
    id: 'product_percentage_off',
    label: 'Buy 1 Get % Off',
    description: 'Buy 1 → Get 2nd at X% off',
    icon: 'Percent',
    color: 'orange',
    defaults: {
      buy_quantity: 1,
      get_quantity: 1,
      get_discount_type: BOGO_GET_DISCOUNT_TYPES.PERCENTAGE,
      get_discount_value: 50,
      use_categories: false,
      same_buy_get: true,
    },
  },
  SAME_CATEGORY_FREE: {
    id: 'same_category_free',
    label: 'Same Category Free',
    description: 'Buy from category → Get another from SAME category FREE',
    icon: 'Tags',
    color: 'teal',
    defaults: {
      buy_quantity: 1,
      get_quantity: 1,
      get_discount_type: BOGO_GET_DISCOUNT_TYPES.FREE,
      get_discount_value: 100,
      use_categories: true,
      same_buy_get: true,
    },
  },
  CROSS_CATEGORY_FREE: {
    id: 'cross_category_free',
    label: 'Cross Category Free',
    description: 'Buy from category A → Get from category B FREE',
    icon: 'ArrowRightLeft',
    color: 'pink',
    defaults: {
      buy_quantity: 1,
      get_quantity: 1,
      get_discount_type: BOGO_GET_DISCOUNT_TYPES.FREE,
      get_discount_value: 100,
      use_categories: true,
      same_buy_get: false,
    },
  },
  PRODUCT_TO_CATEGORY: {
    id: 'product_to_category',
    label: 'Product → Category',
    description: 'Buy specific product → Get any from category FREE',
    icon: 'ArrowRight',
    color: 'indigo',
    defaults: {
      buy_quantity: 1,
      get_quantity: 1,
      get_discount_type: BOGO_GET_DISCOUNT_TYPES.FREE,
      get_discount_value: 100,
      use_categories: 'get_only',
      same_buy_get: false,
    },
  },
  CATEGORY_TO_PRODUCT: {
    id: 'category_to_product',
    label: 'Category → Product',
    description: 'Buy any from category → Get specific product FREE',
    icon: 'ArrowLeft',
    color: 'amber',
    defaults: {
      buy_quantity: 1,
      get_quantity: 1,
      get_discount_type: BOGO_GET_DISCOUNT_TYPES.FREE,
      get_discount_value: 100,
      use_categories: 'buy_only',
      same_buy_get: false,
    },
  },
  CATEGORY_PERCENTAGE_OFF: {
    id: 'category_percentage_off',
    label: 'Category % Off',
    description: 'Buy from category → Get from category at X% off',
    icon: 'BadgePercent',
    color: 'rose',
    defaults: {
      buy_quantity: 1,
      get_quantity: 1,
      get_discount_type: BOGO_GET_DISCOUNT_TYPES.PERCENTAGE,
      get_discount_value: 30,
      use_categories: true,
      same_buy_get: true,
    },
  },
  CUSTOM: {
    id: 'custom',
    label: 'Custom Rule',
    description: 'Create your own custom BOGO configuration',
    icon: 'Settings',
    color: 'gray',
    defaults: {
      buy_quantity: 1,
      get_quantity: 1,
      get_discount_type: BOGO_GET_DISCOUNT_TYPES.FREE,
      get_discount_value: 100,
      use_categories: false,
      same_buy_get: false,
    },
  },
} as const satisfies Record<string, BogoTemplateDefinition>

export const BOGO_TEMPLATE_GROUPS = {
  product_based: {
    label: 'Product-Based BOGO',
    description: 'Specific product combinations',
    templates: [
      BOGO_TEMPLATES.SAME_PRODUCT_FREE,
      BOGO_TEMPLATES.DIFFERENT_PRODUCT_FREE,
      BOGO_TEMPLATES.BUY_2_GET_1_FREE,
      BOGO_TEMPLATES.PRODUCT_PERCENTAGE_OFF,
    ],
  },
  category_based: {
    label: 'Category-Based BOGO',
    description: 'Category-wide offers',
    templates: [
      BOGO_TEMPLATES.SAME_CATEGORY_FREE,
      BOGO_TEMPLATES.CROSS_CATEGORY_FREE,
      BOGO_TEMPLATES.PRODUCT_TO_CATEGORY,
      BOGO_TEMPLATES.CATEGORY_TO_PRODUCT,
      BOGO_TEMPLATES.CATEGORY_PERCENTAGE_OFF,
    ],
  },
  custom: {
    label: 'Custom',
    description: 'Build your own rule',
    templates: [BOGO_TEMPLATES.CUSTOM],
  },
} as const

export const DISCOUNT_LIST_SELECT = `
  *,
  event_offers!event_offer_id(
    id,
    offer_name,
    event_id,
    sale_events(id, event_name, event_slug, start_date, end_date, status)
  ),
  bogo_rules(
    id,
    buy_listing_ids,
    buy_categories,
    buy_quantity,
    get_listing_ids,
    get_categories,
    get_quantity,
    get_discount_type,
    get_discount_value
  )
`

export const DISCOUNT_EVENT_SELECT = `
  *,
  event_offers!event_offer_id(
    id,
    offer_name,
    event_id,
    sale_events(id, event_name, event_slug, description, start_date, end_date, banner_image, status)
  )
`
