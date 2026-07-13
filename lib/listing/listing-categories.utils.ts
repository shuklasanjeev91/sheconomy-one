/**
 * Category utility functions — pure, side-effect-free helpers for hierarchy,
 * SEO, breadcrumbs and display. Ported 1:1 from the legacy `categories-utils.js`
 * with proper typing and no hardcoded app values.
 */

import { USER_ROLES, type UserRole } from '~/lib/profile/profile.type'

import {
  CATEGORY_LIMITS,
  CATEGORY_STATUS,
  type Category,
  type CategoryBreadcrumbItem,
  type CategoryMainPair,
  type CategorySeoMeta,
  type CategoryStatus,
  type CategoryTreeItem,
} from './listing-categories.type'

/** Minimal shape shared by DB rows and tree nodes for hierarchy operations. */
type CategoryLike = {
  category_id: string
  category?: string | null
  parent_id?: string | null
  level?: number | null
  position?: number | null
  description?: string | null
  seo_name?: string | null
}

// ============= SEO =============

/** Generate an SEO-friendly slug from a category name. */
export function generateCategorySeoName(categoryName: string | null | undefined): string {
  if (!categoryName || typeof categoryName !== 'string') return ''

  return categoryName
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, CATEGORY_LIMITS.MAX_SEO_NAME_LENGTH)
}

/** Build a `/`-joined id path from an ordered hierarchy array. */
export function buildHierarchyPath(pathArray: ReadonlyArray<CategoryLike>): string {
  if (!Array.isArray(pathArray) || pathArray.length === 0) return ''
  return pathArray.map((category) => category.category_id).join('/')
}

/** Depth implied by a `/`-joined id path (0 for a root path). */
export function extractCategoryLevel(hierarchyPath: string | null | undefined): number {
  if (!hierarchyPath || typeof hierarchyPath !== 'string') return 0
  const segments = hierarchyPath.split('/').filter(Boolean)
  return Math.max(0, segments.length - 1)
}

/** Build breadcrumb navigation items from a root → current path. */
export function buildCategoryBreadcrumb(
  categoryPath: ReadonlyArray<CategoryLike>,
  baseUrl = '/categories',
): CategoryBreadcrumbItem[] {
  if (!Array.isArray(categoryPath)) return []

  return categoryPath.map((category, index) => ({
    id: category.category_id,
    name: category.category ?? '',
    seoName: category.seo_name ?? null,
    url: `${baseUrl}/${category.seo_name || category.category_id}`,
    level: index,
    isLast: index === categoryPath.length - 1,
  }))
}

// ============= TREE / HIERARCHY =============

/** Transform a flat categories array into a nested tree from `parentId` down. */
export function buildCategoryTree(
  categories: ReadonlyArray<Category>,
  parentId: string | null = null,
): CategoryTreeItem[] {
  if (!Array.isArray(categories)) return []

  return categories
    .filter((category) => (category.parent_id ?? null) === parentId)
    .map((category) => ({
      ...category,
      children: buildCategoryTree(categories, category.category_id),
    }))
    .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
}

/** Flatten a nested tree back into an array, tracking depth + `hasChildren`. */
export function flattenCategoryTree(
  categoryTree: ReadonlyArray<CategoryTreeItem>,
  currentLevel = 0,
): Array<Category & { level: number; hasChildren: boolean }> {
  if (!Array.isArray(categoryTree)) return []

  const flattened: Array<Category & { level: number; hasChildren: boolean }> = []

  for (const node of categoryTree) {
    const { children, ...categoryData } = node
    flattened.push({
      ...(categoryData as Category),
      level: currentLevel,
      hasChildren: Array.isArray(children) && children.length > 0,
    })
    if (children && children.length > 0) {
      flattened.push(...flattenCategoryTree(children, currentLevel + 1))
    }
  }

  return flattened
}

/** Depth-first search for a category by id within a nested tree. */
export function findCategoryInTree(
  categoryTree: ReadonlyArray<CategoryTreeItem>,
  categoryId: string,
): CategoryTreeItem | null {
  if (!Array.isArray(categoryTree) || !categoryId) return null

  for (const category of categoryTree) {
    if (category.category_id === categoryId) return category
    if (category.children && category.children.length > 0) {
      const found = findCategoryInTree(category.children, categoryId)
      if (found) return found
    }
  }
  return null
}

/** Ancestor ids for a category, ordered root → direct parent. */
export function getCategoryParents(
  categories: ReadonlyArray<CategoryLike>,
  categoryId: string,
): string[] {
  if (!Array.isArray(categories) || !categoryId) return []

  const parents: string[] = []
  let current = categories.find((c) => c.category_id === categoryId)

  while (current && current.parent_id) {
    parents.unshift(current.parent_id)
    const parentId = current.parent_id
    current = categories.find((c) => c.category_id === parentId)
  }

  return parents
}

/** All descendant ids beneath a category. */
export function getCategoryDescendants(
  categories: ReadonlyArray<CategoryLike>,
  categoryId: string,
): string[] {
  if (!Array.isArray(categories) || !categoryId) return []

  const descendants: string[] = []
  const directChildren = categories.filter((c) => c.parent_id === categoryId)

  for (const child of directChildren) {
    descendants.push(child.category_id)
    descendants.push(...getCategoryDescendants(categories, child.category_id))
  }

  return descendants
}

/** Depth of a category within a flat set (0 for roots). */
export function calculateCategoryDepth(
  categories: ReadonlyArray<CategoryLike>,
  categoryId: string,
): number {
  return getCategoryParents(categories, categoryId).length
}

/**
 * Validate a proposed move for circular references / missing parents. Pure —
 * the service layer additionally validates against the live DB path.
 */
export function validateCategoryHierarchy(
  categories: ReadonlyArray<CategoryLike>,
  categoryId: string,
  newParentId: string | null | undefined,
): { isValid: boolean; reason?: string } {
  if (!newParentId) return { isValid: true }

  if (categoryId === newParentId) {
    return { isValid: false, reason: 'A category can’t be its own parent.' }
  }

  const descendants = getCategoryDescendants(categories, categoryId)
  if (descendants.includes(newParentId)) {
    return { isValid: false, reason: 'You can’t move a category into its own sub-category.' }
  }

  const parentExists = categories.some((c) => c.category_id === newParentId)
  if (!parentExists) {
    return { isValid: false, reason: 'The chosen parent category doesn’t exist.' }
  }

  return { isValid: true }
}

// ============= SORT / FILTER / GROUP =============

/** Sort by level → position → name (stable, non-mutating). */
export function sortCategoriesHierarchically<T extends CategoryLike>(categories: ReadonlyArray<T>): T[] {
  if (!Array.isArray(categories)) return []

  return [...categories].sort((a, b) => {
    if ((a.level ?? 0) !== (b.level ?? 0)) return (a.level ?? 0) - (b.level ?? 0)
    if ((a.position ?? 0) !== (b.position ?? 0)) return (a.position ?? 0) - (b.position ?? 0)
    return (a.category ?? '').localeCompare(b.category ?? '')
  })
}

/** Client-side text filter across name / description / seo name. */
export function filterCategoriesBySearch<T extends CategoryLike>(
  categories: ReadonlyArray<T>,
  searchTerm: string,
): T[] {
  if (!Array.isArray(categories) || !searchTerm) return [...categories]

  const term = searchTerm.toLowerCase().trim()
  if (!term) return [...categories]

  return categories.filter(
    (category) =>
      (category.category ?? '').toLowerCase().includes(term) ||
      (category.description ?? '').toLowerCase().includes(term) ||
      (category.seo_name ?? '').toLowerCase().includes(term),
  )
}

/** Group categories by their `level`. */
export function groupCategoriesByLevel<T extends CategoryLike>(
  categories: ReadonlyArray<T>,
): Record<number, T[]> {
  if (!Array.isArray(categories)) return {}

  return categories.reduce<Record<number, T[]>>((groups, category) => {
    const level = category.level ?? 0
    if (!groups[level]) groups[level] = []
    groups[level].push(category)
    return groups
  }, {})
}

// ============= DISPLAY =============

/** Build a category URL from its SEO name (or id fallback). */
export function generateCategoryUrl(category: CategoryLike | null, baseUrl = '/categories'): string {
  if (!category) return baseUrl
  return `${baseUrl}/${category.seo_name || category.category_id}`
}

/**
 * Resolve the best available image url for a category, checking the dedicated
 * column first, then the legacy `main_pair` JSONB (icon / detailed variants).
 */
export function getCategoryImage(category: Pick<Category, 'category_image_url' | 'main_pair'>): string | null {
  if (category.category_image_url) return category.category_image_url

  const pair = (category.main_pair as CategoryMainPair | null) ?? null
  if (!pair) return null

  const detailed = pair.detailed ?? null
  return (
    detailed?.url ||
    detailed?.https_image_path ||
    detailed?.image_path ||
    detailed?.http_image_path ||
    pair.icon ||
    null
  )
}

/** Human-readable label for a status code. */
export function getCategoryStatusLabel(status: CategoryStatus): string {
  switch (status) {
    case CATEGORY_STATUS.ACTIVE:
      return 'Active'
    case CATEGORY_STATUS.DISABLED:
      return 'Disabled'
    case CATEGORY_STATUS.HIDDEN:
      return 'Hidden'
    default:
      return String(status)
  }
}

/** Extract SEO metadata for a category detail page. */
export function extractCategorySeoMeta(
  category: Category,
  options: { siteName?: string; baseUrl?: string } = {},
): CategorySeoMeta {
  const { siteName = 'SHEconomy', baseUrl = 'https://sheconomy.com' } = options
  const url = `${baseUrl}/categories/${category.seo_name || category.category_id}`

  return {
    title: category.page_title || category.meta_title || `${category.category} - ${siteName}`,
    description:
      category.meta_description ||
      category.description ||
      `Shop ${category.category} products on ${siteName}`,
    keywords: category.meta_keywords || category.category,
    canonical: url,
    openGraph: {
      title: category.page_title || category.meta_title || category.category,
      description: category.meta_description || category.description || '',
      type: 'website',
      url,
      image: category.og_image || getCategoryImage(category),
    },
  }
}

// ============= ACCESS (UI gate) =============

/**
 * UI-level gate: only admins manage any category; vendors may create/suggest.
 * The authoritative gate is Supabase RLS.
 */
export function canManageCategory(role: UserRole | null | undefined): boolean {
  return role === USER_ROLES.ADMIN
}

export function canCreateCategory(role: UserRole | null | undefined): boolean {
  return role === USER_ROLES.ADMIN || role === USER_ROLES.VENDOR
}
