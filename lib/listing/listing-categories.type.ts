/**
 * Category types + constants.
 *
 * Ported from the legacy `categories-schema.js`, `categories-utils.js` and
 * `categoriesStore.js`, adapted to the new Supabase schema. Categories are a
 * hierarchical, SEO-aware taxonomy shared by buyers (browse), vendors (create /
 * suggest) and admins (full CRUD + stats). Every service call returns a
 * `CategoryServiceResponse<T>`, mirroring listing / shop / profile.
 */

import type { Database, Json, Tables, TablesInsert, TablesUpdate } from '~/lib/supabase'

/**
 * Shared shape returned by every category service call — identical contract to
 * the listing/shop/profile `ServiceResponse` so all stores stay symmetric.
 */
export type CategoryServiceResponse<T> = {
  data: T | null
  error: string | null
  success: boolean
}

// ============= ROW / INSERT / UPDATE HELPERS =============

export type Category = Tables<'categories'>
export type CategoryInsert = TablesInsert<'categories'>
export type CategoryUpdate = TablesUpdate<'categories'>

export type CategoryAssignment = Tables<'category_assignments'>
export type CategoryAssignmentInsert = TablesInsert<'category_assignments'>

export type CategoryTranslation = Tables<'category_translations'>
export type CategoryTranslationInsert = TablesInsert<'category_translations'>

/** Status enum straight from the generated database types (A/D/H). */
export type CategoryStatus = Database['public']['Enums']['category_status_enum']

// ============= RPC ROW TYPES =============

type Fn = Database['public']['Functions']

/** Row from `get_category_children` (one hierarchy level, with `has_children`). */
export type CategoryChildRow = Fn['get_category_children']['Returns'][number]
/** Row from `get_category_path` (breadcrumb ancestry, root → current). */
export type CategoryPathRow = Fn['get_category_path']['Returns'][number]
/** Row from `get_category_tree_with_counts` (full tree with product counts). */
export type CategoryTreeCountRow = Fn['get_category_tree_with_counts']['Returns'][number]
/** Aggregate platform statistics from `get_category_statistics` (admin). */
export type CategoryStatistics = Fn['get_category_statistics']['Returns'][number]

// ============= MEDIA (main_pair JSONB) =============

/**
 * Loose shape of the `main_pair` JSONB. The legacy CS-Cart payload nests a
 * `detailed` object; we read the most common url fields defensively.
 */
export type CategoryMainPairDetailed = {
  url?: string | null
  image_path?: string | null
  https_image_path?: string | null
  http_image_path?: string | null
  alt?: string | null
  alt_text?: string | null
  image_x?: string | number | null
  image_y?: string | number | null
}

export type CategoryMainPair = {
  icon?: string | null
  detailed?: CategoryMainPairDetailed | null
} & Record<string, Json | undefined>

// ============= DERIVED / UI SHAPES =============

/** A category with its resolved children — the shape `buildCategoryTree` emits. */
export type CategoryTreeItem = Category & { children: CategoryTreeItem[] }

/** A single breadcrumb entry for category navigation. */
export type CategoryBreadcrumbItem = {
  id: string
  name: string
  seoName: string | null
  url: string
  level: number
  isLast: boolean
}

/** SEO metadata extracted for a category detail page. */
export type CategorySeoMeta = {
  title: string
  description: string
  keywords: string
  canonical: string
  openGraph: {
    title: string
    description: string
    type: 'website'
    url: string
    image: string | null
  }
}

// ============= FILTERS / QUERY =============

/** Filters accepted by `getCategories` / the store's `loadCategories`. */
export type CategoryFilters = {
  parent_id?: string | null
  status?: CategoryStatus | null
  level?: number | null
  lang_code?: string | null
  search_term?: string | null
  limit?: number
  offset?: number
}

/** Move payload for re-parenting / re-ordering a category. */
export type CategoryMoveInput = {
  new_parent_id?: string | null
  new_position?: number | null
}

/** A category to attach to a listing. */
export type ListingCategoryAssignmentInput = {
  category_id: string
  is_primary?: boolean
}

// ============= FORM DATA =============

/**
 * The subset of category columns collected by the admin/vendor create/edit
 * form. Only `category` is strictly required; everything else has a sensible
 * default so partial updates type-check cleanly.
 */
export type CategoryFormData = {
  category: string
  description?: string | null
  parent_id?: string | null
  status?: CategoryStatus
  position?: number | null
  lang_code?: string
  seo_name?: string | null
  meta_keywords?: string | null
  meta_description?: string | null
  meta_title?: string | null
  page_title?: string | null
  category_image_url?: string | null
  category_icon?: string | null
  og_image?: string | null
  main_pair?: CategoryMainPair | null
  category_meta?: Json | null
}

export type CategoryValidationResult = {
  isValid: boolean
  errors: Record<string, string>
}

// ============= CONSTANTS =============

/** Category status codes (Active / Disabled / Hidden). */
export const CATEGORY_STATUS = {
  ACTIVE: 'A',
  DISABLED: 'D',
  HIDDEN: 'H',
} as const satisfies Record<string, CategoryStatus>

export const CATEGORY_STATUS_OPTIONS: ReadonlyArray<{
  value: CategoryStatus
  label: string
  description: string
}> = [
  { value: CATEGORY_STATUS.ACTIVE, label: 'Active', description: 'Visible to everyone.' },
  { value: CATEGORY_STATUS.DISABLED, label: 'Disabled', description: 'Hidden and not selectable.' },
  { value: CATEGORY_STATUS.HIDDEN, label: 'Hidden', description: 'Reachable by direct link only.' },
]

/** Supported language codes (matches the legacy schema). */
export const CATEGORY_LANGUAGE_CODES = ['en', 'hi', 'es', 'fr', 'de'] as const
export type CategoryLanguageCode = (typeof CATEGORY_LANGUAGE_CODES)[number]

/** Shared limits used by both validation and the DB constraints. */
export const CATEGORY_LIMITS = {
  MAX_NAME_LENGTH: 200,
  MAX_DESCRIPTION_LENGTH: 1000,
  MAX_SEO_NAME_LENGTH: 100,
  MAX_META_KEYWORDS_LENGTH: 500,
  MAX_META_DESCRIPTION_LENGTH: 300,
  MAX_PAGE_TITLE_LENGTH: 100,
  MAX_HIERARCHY_DEPTH: 10,
  MAX_CATEGORIES_PER_LISTING: 10,
} as const

/** Default page size for paginated category listings. */
export const CATEGORY_PAGE_SIZE = 20

/** Category ID pattern — legacy numeric ids or the new `CAT_<uuid>` ids. */
export const CATEGORY_ID_PATTERN = /^(CAT_[a-f0-9-]+|\d+)$/i

/** URL-friendly SEO name pattern. */
export const CATEGORY_SEO_NAME_PATTERN = /^[a-z0-9-_]+$/

/** Columns fetched for compact list/browse rows (keeps payloads lean). */
export const CATEGORY_LIST_COLUMNS =
  'category_id, category, description, parent_id, level, position, product_count, status, seo_name, main_pair, category_image_url, category_icon, created_at'

export const EMPTY_CATEGORY_FORM_DATA: CategoryFormData = {
  category: '',
  description: null,
  parent_id: null,
  status: CATEGORY_STATUS.ACTIVE,
  position: 0,
  lang_code: 'en',
  seo_name: null,
  meta_keywords: null,
  meta_description: null,
  meta_title: null,
  page_title: null,
  category_image_url: null,
  category_icon: null,
  og_image: null,
  main_pair: null,
  category_meta: null,
}

export function getDefaultCategoryFormData(parentId?: string | null): CategoryFormData {
  return { ...EMPTY_CATEGORY_FORM_DATA, parent_id: parentId ?? null }
}

/** Seed a form buffer from an existing category row (edit flow). */
export function categoryToFormData(category: Category): CategoryFormData {
  return {
    category: category.category,
    description: category.description,
    parent_id: category.parent_id,
    status: category.status,
    position: category.position,
    lang_code: category.lang_code,
    seo_name: category.seo_name,
    meta_keywords: category.meta_keywords,
    meta_description: category.meta_description,
    meta_title: category.meta_title,
    page_title: category.page_title,
    category_image_url: category.category_image_url,
    category_icon: category.category_icon,
    og_image: category.og_image,
    main_pair: (category.main_pair as CategoryMainPair | null) ?? null,
    category_meta: category.category_meta,
  }
}
