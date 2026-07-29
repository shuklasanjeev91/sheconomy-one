/**
 * Category service — typed Supabase data-access for the category taxonomy.
 *
 * Ported directly from the legacy `categories-service.js` + `categoriesStore.js`
 * and adapted to the new schema. Functions are role-aware:
 *   - anyone can read (browse / search / hierarchy / breadcrumb),
 *   - admins can create / update / delete / move / re-status any category,
 *   - vendors can create (pending approval) and assign categories to listings
 *     they own.
 * Row visibility / write permission is ultimately enforced by Supabase RLS;
 * the checks here give fast, friendly UX feedback.
 *
 * Every function returns a `CategoryServiceResponse<T>` and routes failures
 * through `listing-categories.errors`.
 */

import { supabase } from '~/lib/supabase'
import type { Json } from '~/lib/supabase'

import type { Listing } from '~/lib/listing/listing.type'
import {
  assertCategoryDeletable,
  checkCategoryPermission,
  fail,
  isAdminUser,
  ok,
  resolveUserId,
  verifyListingCategoryAccess,
} from '~/lib/listing/listing-categories.access'
import { CATEGORY_ERROR_CODES, createCategoryError } from '~/lib/listing/listing-categories.errors'
import {
  CATEGORY_PAGE_SIZE,
  CATEGORY_STATUS,
  type Category,
  type CategoryChildRow,
  type CategoryFilters,
  type CategoryFormData,
  type CategoryInsert,
  type CategoryMoveInput,
  type CategoryPathRow,
  type CategoryServiceResponse,
  type CategoryStatistics,
  type CategoryStatus,
  type CategoryTreeCountRow,
  type CategoryUpdate,
  type ListingCategoryAssignmentInput,
} from '~/lib/listing/listing-categories.type'
import {
  validateCategoryOperation,
  transformCategoryData,
  type CategoryOperation,
} from '~/lib/listing/listing-categories.validation'

// ============= DERIVED SHAPES =============

export type PaginatedCategories = {
  items: Category[]
  count: number
  hasMore: boolean
}

export type PaginatedCategoryListings = {
  items: Listing[]
  count: number
  hasMore: boolean
}

/** A category with its immediate parent + active children (detail view). */
export type CategoryWithRelations = Category & {
  parent: Pick<Category, 'category_id' | 'category' | 'seo_name'> | null
  children: Array<Pick<Category, 'category_id' | 'category' | 'product_count' | 'status'>>
}

/** One category assigned to a listing (for a listing's category chips). */
export type ListingCategoryRow = {
  category_id: string
  is_primary: boolean
  category: Pick<Category, 'category_id' | 'category' | 'seo_name' | 'level'> | null
}

// ============= INTERNAL HELPERS =============

/** Compute an inclusive Supabase `.range()` window from offset + limit. */
function pageRange(offset: number, limit: number): [number, number] {
  const from = Math.max(0, offset)
  return [from, from + Math.max(1, limit) - 1]
}

/** Map validated create/update input onto a `categories` insert payload. */
function toCategoryInsert(data: Record<string, unknown>): CategoryInsert {
  const prepared = transformCategoryData(data)
  const insert: CategoryInsert = {
    category: String(prepared.category ?? '').trim(),
    parent_id: (prepared.parent_id as string | null) ?? null,
    description: (prepared.description as string | null) ?? null,
    status: (prepared.status as CategoryStatus | undefined) ?? CATEGORY_STATUS.ACTIVE,
    position: (prepared.position as number | undefined) ?? 0,
    lang_code: (prepared.lang_code as string | undefined) ?? 'en',
    seo_name: (prepared.seo_name as string | null) ?? null,
    meta_keywords: (prepared.meta_keywords as string | null) ?? null,
    meta_description: (prepared.meta_description as string | null) ?? null,
    meta_title: (prepared.meta_title as string | null) ?? null,
    page_title: (prepared.page_title as string | null) ?? null,
    category_image_url: (prepared.category_image_url as string | null) ?? null,
    category_icon: (prepared.category_icon as string | null) ?? null,
    og_image: (prepared.og_image as string | null) ?? null,
    main_pair: prepared.main_pair as Json,
    category_meta: prepared.category_meta as Json,
    timestamp: prepared.timestamp,
  }
  return insert
}

// ============= READS (public) =============

/**
 * Paginated categories with optional filters. Defaults to **active** only —
 * pass `status: null` (via the admin helper) to include every status.
 */
export async function getCategories(
  filters: CategoryFilters = {},
): Promise<CategoryServiceResponse<PaginatedCategories>> {
  try {
    const limit = filters.limit ?? CATEGORY_PAGE_SIZE
    const offset = filters.offset ?? 0

    let query = supabase.from('categories').select('*', { count: 'exact' })

    if (filters.parent_id === null) query = query.is('parent_id', null)
    else if (filters.parent_id !== undefined) query = query.eq('parent_id', filters.parent_id)

    // Default to active unless an explicit status (including null) was provided.
    if (filters.status) query = query.eq('status', filters.status)
    else if (filters.status === undefined) query = query.eq('status', CATEGORY_STATUS.ACTIVE)

    if (filters.level === null) query = query.is('level', null)
    else if (filters.level !== undefined && filters.level !== null) query = query.eq('level', filters.level)

    if (filters.lang_code) query = query.eq('lang_code', filters.lang_code)

    if (filters.search_term) {
      const term = filters.search_term.trim()
      query = query.or(`category.ilike.%${term}%,description.ilike.%${term}%`)
    }

    const [from, to] = pageRange(offset, limit)
    query = query.order('position', { ascending: true }).order('category', { ascending: true }).range(from, to)

    const { data, error, count } = await query
    if (error) throw error

    const items = (data ?? []) as Category[]
    const total = count ?? items.length
    return ok({ items, count: total, hasMore: offset + items.length < total })
  } catch (error) {
    return fail(error, 'Failed to load categories.')
  }
}

/** Full category detail with immediate parent + active children. */
export async function getCategoryById(
  categoryId: string,
): Promise<CategoryServiceResponse<CategoryWithRelations>> {
  try {
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .eq('category_id', categoryId)
      .maybeSingle()

    if (error) throw error
    if (!data) throw createCategoryError(CATEGORY_ERROR_CODES.NOT_FOUND)

    const category = data as Category

    const [{ data: parent }, { data: children }] = await Promise.all([
      category.parent_id
        ? supabase
            .from('categories')
            .select('category_id, category, seo_name')
            .eq('category_id', category.parent_id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      supabase
        .from('categories')
        .select('category_id, category, product_count, status')
        .eq('parent_id', categoryId)
        .order('position', { ascending: true }),
    ])

    return ok({
      ...category,
      parent: (parent as CategoryWithRelations['parent']) ?? null,
      children: (children as CategoryWithRelations['children']) ?? [],
    })
  } catch (error) {
    return fail(error, 'Failed to load category.')
  }
}

/** One hierarchy level of children (with `has_children`) via the RPC. */
export async function getCategoryHierarchy(
  parentId: string | null = null,
): Promise<CategoryServiceResponse<CategoryChildRow[]>> {
  try {
    const { data, error } = await supabase.rpc('get_category_children', {
      p_parent_id: parentId ?? undefined,
    })
    if (error) throw error
    return ok((data ?? []) as CategoryChildRow[])
  } catch (error) {
    return fail(error, 'Failed to load category hierarchy.')
  }
}

/** Breadcrumb ancestry (root → current) via the RPC. */
export async function getCategoryPath(
  categoryId: string,
): Promise<CategoryServiceResponse<CategoryPathRow[]>> {
  try {
    const { data, error } = await supabase.rpc('get_category_path', { p_category_id: categoryId })
    if (error) throw error
    return ok((data ?? []) as CategoryPathRow[])
  } catch (error) {
    return fail(error, 'Failed to load category path.')
  }
}

/** Full category tree with direct + rolled-up product counts via the RPC. */
export async function getCategoryTreeWithCounts(options: {
  rootId?: string | null
  maxDepth?: number
  langCode?: string
} = {}): Promise<CategoryServiceResponse<CategoryTreeCountRow[]>> {
  try {
    const { data, error } = await supabase.rpc('get_category_tree_with_counts', {
      p_root_id: options.rootId ?? undefined,
      p_max_depth: options.maxDepth ?? undefined,
      p_lang_code: options.langCode ?? undefined,
    })
    if (error) throw error
    return ok((data ?? []) as CategoryTreeCountRow[])
  } catch (error) {
    return fail(error, 'Failed to load category tree.')
  }
}

/** Name/description search (min 2 chars), ordered by product popularity. */
export async function searchCategories(
  searchTerm: string,
  options: { limit?: number; level?: number } = {},
): Promise<CategoryServiceResponse<Category[]>> {
  try {
    if (!searchTerm || searchTerm.trim().length < 2) return ok([])

    const term = searchTerm.trim()
    let query = supabase
      .from('categories')
      .select('*')
      .or(`category.ilike.%${term}%,description.ilike.%${term}%`)
      .eq('status', CATEGORY_STATUS.ACTIVE)
      .order('product_count', { ascending: false })
      .limit(options.limit ?? CATEGORY_PAGE_SIZE)

    if (options.level !== undefined) query = query.eq('level', options.level)

    const { data, error } = await query
    if (error) throw error
    return ok((data ?? []) as Category[])
  } catch (error) {
    return fail(error, 'Failed to search categories.')
  }
}

/** Popular active categories (with products), ordered by product count. */
export async function getPopularCategories(
  limit = 10,
): Promise<CategoryServiceResponse<Category[]>> {
  try {
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .eq('status', CATEGORY_STATUS.ACTIVE)
      .gt('product_count', 0)
      .order('product_count', { ascending: false })
      .limit(limit)

    if (error) throw error
    return ok((data ?? []) as Category[])
  } catch (error) {
    return fail(error, 'Failed to load popular categories.')
  }
}

/** Categories assigned to a listing (for category chips on a listing). */
export async function getListingCategories(
  listingId: string,
): Promise<CategoryServiceResponse<ListingCategoryRow[]>> {
  try {
    const { data, error } = await supabase
      .from('category_assignments')
      .select('category_id, is_primary, category:category_id(category_id, category, seo_name, level)')
      .eq('listing_id', listingId)

    if (error) throw error
    return ok((data ?? []) as unknown as ListingCategoryRow[])
  } catch (error) {
    return fail(error, 'Failed to load listing categories.')
  }
}

/** Active listings assigned to a category (paginated). */
export async function getCategoryListings(
  categoryId: string,
  options: { limit?: number; offset?: number } = {},
): Promise<CategoryServiceResponse<PaginatedCategoryListings>> {
  try {
    const limit = options.limit ?? CATEGORY_PAGE_SIZE
    const offset = options.offset ?? 0
    const [from, to] = pageRange(offset, limit)

    const { data: assignments, error, count } = await supabase
      .from('category_assignments')
      .select('listing_id', { count: 'exact' })
      .eq('category_id', categoryId)
      .range(from, to)

    if (error) throw error

    const listingIds = (assignments ?? []).map((a) => a.listing_id)
    if (listingIds.length === 0) {
      return ok({ items: [], count: count ?? 0, hasMore: false })
    }

    const { data: listings, error: listingsError } = await supabase
      .from('listings')
      .select('*')
      .in('id', listingIds)
      .eq('is_active', true)

    if (listingsError) throw listingsError

    const items = (listings ?? []) as Listing[]
    const total = count ?? items.length
    return ok({ items, count: total, hasMore: offset + listingIds.length < total })
  } catch (error) {
    return fail(error, 'Failed to load category listings.')
  }
}

// ============= WRITES (admin / vendor) =============

/** Create a category. Admins always; vendors create pending approval. */
export async function createCategory(
  formData: Partial<CategoryFormData>,
  userId?: string,
): Promise<CategoryServiceResponse<Category>> {
  try {
    const uid = await resolveUserId(userId)
    if (!uid) throw createCategoryError(CATEGORY_ERROR_CODES.NOT_AUTHENTICATED)

    const validation = validateCategoryOperation(formData, 'create')
    if (!validation.isValid || !validation.data) {
      throw createCategoryError(CATEGORY_ERROR_CODES.INVALID_INPUT, Object.values(validation.errors)[0])
    }

    const permission = await checkCategoryPermission(uid, 'create')
    if (!permission.allowed) {
      throw createCategoryError(
        permission.error === CATEGORY_ERROR_CODES.NOT_AUTHENTICATED
          ? CATEGORY_ERROR_CODES.NOT_AUTHENTICATED
          : CATEGORY_ERROR_CODES.PERMISSION_DENIED,
      )
    }

    const { data, error } = await supabase
      .from('categories')
      .insert(toCategoryInsert(validation.data as Record<string, unknown>))
      .select('*')
      .single()

    if (error) throw error
    return ok(data as Category)
  } catch (error) {
    return fail(error, 'Failed to create category.')
  }
}

/** Update a category (admin only). */
export async function updateCategory(
  categoryId: string,
  updates: Partial<CategoryFormData>,
  userId?: string,
): Promise<CategoryServiceResponse<Category>> {
  try {
    const uid = await resolveUserId(userId)
    if (!uid) throw createCategoryError(CATEGORY_ERROR_CODES.NOT_AUTHENTICATED)

    const validation = validateCategoryOperation({ category_id: categoryId, ...updates }, 'update')
    if (!validation.isValid || !validation.data) {
      throw createCategoryError(CATEGORY_ERROR_CODES.INVALID_INPUT, Object.values(validation.errors)[0])
    }

    const permission = await checkCategoryPermission(uid, 'update')
    if (!permission.allowed) throw createCategoryError(CATEGORY_ERROR_CODES.PERMISSION_DENIED)

    const { category_id: _omit, ...rest } = validation.data as Record<string, unknown>
    const insert = toCategoryInsert(rest)
    const { timestamp: _t, ...patch } = insert as CategoryUpdate & { timestamp?: number }

    const { data, error } = await supabase
      .from('categories')
      .update(patch as CategoryUpdate)
      .eq('category_id', categoryId)
      .select('*')
      .maybeSingle()

    if (error) throw error
    if (!data) throw createCategoryError(CATEGORY_ERROR_CODES.NOT_FOUND)
    return ok(data as Category)
  } catch (error) {
    return fail(error, 'Failed to update category.')
  }
}

/** Delete a category (admin only). Blocked if it has children or assignments. */
export async function deleteCategory(
  categoryId: string,
  userId?: string,
): Promise<CategoryServiceResponse<string>> {
  try {
    const uid = await resolveUserId(userId)
    if (!uid) throw createCategoryError(CATEGORY_ERROR_CODES.NOT_AUTHENTICATED)

    const permission = await checkCategoryPermission(uid, 'delete')
    if (!permission.allowed) throw createCategoryError(CATEGORY_ERROR_CODES.PERMISSION_DENIED)

    await assertCategoryDeletable(categoryId)

    const { error } = await supabase.from('categories').delete().eq('category_id', categoryId)
    if (error) throw error
    return ok(categoryId)
  } catch (error) {
    return fail(error, 'Failed to delete category.')
  }
}

/** Move a category to a new parent / position (admin only). */
export async function moveCategory(
  categoryId: string,
  moveInput: CategoryMoveInput,
  userId?: string,
): Promise<CategoryServiceResponse<Category>> {
  try {
    const uid = await resolveUserId(userId)
    if (!uid) throw createCategoryError(CATEGORY_ERROR_CODES.NOT_AUTHENTICATED)

    const permission = await checkCategoryPermission(uid, 'move')
    if (!permission.allowed) throw createCategoryError(CATEGORY_ERROR_CODES.PERMISSION_DENIED)

    const newParentId = moveInput.new_parent_id ?? null
    if (newParentId) {
      if (newParentId === categoryId) throw createCategoryError(CATEGORY_ERROR_CODES.SELF_REFERENCE)

      // Guard against circular references using the live ancestry of the target.
      const { data: path } = await supabase.rpc('get_category_path', { p_category_id: newParentId })
      const isCircular = (path ?? []).some((row) => row.category_id === categoryId)
      if (isCircular) throw createCategoryError(CATEGORY_ERROR_CODES.CIRCULAR_REFERENCE)
    }

    const patch: CategoryUpdate = { parent_id: newParentId }
    if (moveInput.new_position !== undefined && moveInput.new_position !== null) {
      patch.position = moveInput.new_position
    }

    const { data, error } = await supabase
      .from('categories')
      .update(patch)
      .eq('category_id', categoryId)
      .select('*')
      .maybeSingle()

    if (error) throw error
    if (!data) throw createCategoryError(CATEGORY_ERROR_CODES.NOT_FOUND)
    return ok(data as Category)
  } catch (error) {
    return fail(error, 'Failed to move category.')
  }
}

/** Assign categories to a listing (owner or admin) via the atomic RPC. */
export async function assignCategoriesToListing(
  listingId: string,
  categories: ListingCategoryAssignmentInput[],
  userId?: string,
): Promise<CategoryServiceResponse<ListingCategoryRow[]>> {
  try {
    const uid = await resolveUserId(userId)
    if (!uid) throw createCategoryError(CATEGORY_ERROR_CODES.NOT_AUTHENTICATED)

    const validation = validateCategoryOperation({ listing_id: listingId, categories }, 'bulk-assignment')
    if (!validation.isValid || !validation.data) {
      throw createCategoryError(CATEGORY_ERROR_CODES.INVALID_INPUT, Object.values(validation.errors)[0])
    }

    const access = await verifyListingCategoryAccess(listingId, uid)
    if (!access.allowed) throw createCategoryError(CATEGORY_ERROR_CODES.ACCESS_DENIED)

    const { error } = await supabase.rpc('assign_categories_to_listing', {
      p_listing_id: listingId,
      p_categories: categories as unknown as Json,
      p_user_id: uid,
    })
    if (error) throw error

    const refreshed = await getListingCategories(listingId)
    if (!refreshed.success) throw new Error(refreshed.error ?? 'Failed to reload assignments.')
    return ok(refreshed.data ?? [])
  } catch (error) {
    return fail(error, 'Failed to assign categories.')
  }
}

// ============= ADMIN =============

/**
 * Admin listing of categories across **all** statuses (not just active).
 * Supports the same filters as `getCategories` but never forces `status = 'A'`.
 */
export async function getAllCategoriesForAdmin(
  filters: CategoryFilters = {},
): Promise<CategoryServiceResponse<PaginatedCategories>> {
  // `status: null` short-circuits the "default active" branch in getCategories.
  return getCategories({ ...filters, status: filters.status ?? null })
}

/** Aggregate platform category statistics (admin dashboards). */
export async function getCategoryStatistics(
  userId?: string,
): Promise<CategoryServiceResponse<CategoryStatistics | null>> {
  try {
    const uid = await resolveUserId(userId)
    if (!uid) throw createCategoryError(CATEGORY_ERROR_CODES.NOT_AUTHENTICATED)
    if (!(await isAdminUser(uid))) throw createCategoryError(CATEGORY_ERROR_CODES.PERMISSION_DENIED)

    const { data, error } = await supabase.rpc('get_category_statistics')
    if (error) throw error
    const stats = (data ?? [])[0] as CategoryStatistics | undefined
    return ok(stats ?? null)
  } catch (error) {
    return fail(error, 'Failed to load category statistics.')
  }
}

/** Change a category's status (admin only) — used to enable/disable/hide. */
export async function setCategoryStatus(
  categoryId: string,
  status: CategoryStatus,
  userId?: string,
): Promise<CategoryServiceResponse<Category>> {
  try {
    const uid = await resolveUserId(userId)
    if (!uid) throw createCategoryError(CATEGORY_ERROR_CODES.NOT_AUTHENTICATED)
    if (!(await isAdminUser(uid))) throw createCategoryError(CATEGORY_ERROR_CODES.PERMISSION_DENIED)

    const { data, error } = await supabase
      .from('categories')
      .update({ status })
      .eq('category_id', categoryId)
      .select('*')
      .maybeSingle()

    if (error) throw error
    if (!data) throw createCategoryError(CATEGORY_ERROR_CODES.NOT_FOUND)
    return ok(data as Category)
  } catch (error) {
    return fail(error, 'Failed to update category status.')
  }
}

export type { CategoryOperation }
