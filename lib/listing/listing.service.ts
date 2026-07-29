/**
 * Listing service — typed data-access layer for everything listing related.
 *
 * Ported from the legacy `listing-service.js` + `listingsStore.js` and adapted
 * to the new schema. Public browse / search / category feeds are delegated to
 * the existing commerce modules so nothing is duplicated:
 *
 *   - browse feed / search / by-ids → `~/commerce/lib/commerce`
 *   - child rows (images/variations/attributes/materials) → sibling services
 *   - storage upload + moderation   → `./listing-images.service`
 *
 * Every function returns a `ListingServiceResponse<T>` and routes failures
 * through `listing.errors`. Functions are role-agnostic: normal users browse,
 * vendors manage their own catalogue, and admins manage any listing — the row
 * visibility / write permission is enforced by Supabase RLS.
 */

import { INVALIDATION_TOPICS, invalidateCache } from '~/lib/cache/invalidation'
import { supabase } from '~/lib/supabase'
import type { Database } from '~/lib/supabase'

import { fail, isAdminUser, ok, resolveUserId, verifyListingManageAccess, verifyShopManageAccess } from '~/lib/listing/listing.access'
import { prepareListingDataForSubmission } from '~/lib/listing/listing.utils'
import { validateCategoryData } from '~/lib/listing/listing.validation'
import { addImage, uploadAndAttachImage } from '~/lib/listing/listing-images.service'
import { replaceAttributes } from '~/lib/listing/listing-attributes.service'
import { replaceMaterials } from '~/lib/listing/listing-materials.service'
import { replaceVariations } from '~/lib/listing/listing-variations.service'
import {
  LISTING_PAGE_SIZE,
  LISTING_STATUS,
  LISTING_TYPES,
  type CategoryAssignment,
  type Listing,
  type ListingCategoryInput,
  type ListingDetailsView,
  type ListingFilters,
  type ListingFormData,
  type ListingPagination,
  type ListingServiceResponse,
  type ListingStatus,
  type ListingType,
  type ListingUpdate,
  type PlatformListingStats,
  type PublicListing,
} from '~/lib/listing/listing.type'

// ============= DERIVED VIEW / RPC ROW TYPES =============

type Fn = Database['public']['Functions']
export type ShopListingRow = Fn['get_shop_listings']['Returns'][number] & {
  /** Present when loaded via direct table query (not returned by RPC). */
  sku?: string | null
}
export type AdminListingRow = Fn['admin_search_listings']['Returns'][number]
export type PopularTag = Fn['get_popular_tags']['Returns'][number]
export type RecommendedListing = Fn['get_listing_recommendations']['Returns'][number]
export type ShopSectionWithCounts = Fn['get_shop_sections_with_counts']['Returns'][number]

export type { PublicListing }

export type PaginatedListings<T> = {
  items: T[]
  count: number
  hasMore: boolean
}

const VALID_LISTING_TYPES: readonly ListingType[] = [
  LISTING_TYPES.PHYSICAL,
  LISTING_TYPES.DIGITAL,
  LISTING_TYPES.SERVICE,
]

/** Detail row plus the category assignments that live outside the view. */
export type ListingDetails = ListingDetailsView & {
  category_assignments: Pick<CategoryAssignment, 'category_id' | 'is_primary'>[]
}

// ============= SHOP CATALOGUE (owner / admin) =============

export type ShopListingQuery = {
  listingType?: ListingType | null
  listingStatus?: ListingStatus | null
  isActive?: boolean | null
  isOnline?: boolean | null
  search?: string | null
  minPrice?: number | null
  maxPrice?: number | null
  limit?: number
  offset?: number
}

type ListingCatalogRow = Pick<
  Listing,
  | 'id'
  | 'title'
  | 'slug'
  | 'description'
  | 'price'
  | 'quantity'
  | 'listing_type'
  | 'listing_status'
  | 'is_active'
  | 'is_featured'
  | 'is_online'
  | 'created_at'
  | 'updated_at'
  | 'sku'
> & {
  listing_images: Array<{
    image_url: string
    is_primary: boolean
    display_order: number
  }> | null
}

function pickPrimaryImageUrl(
  images: ListingCatalogRow['listing_images'],
): string {
  if (!images?.length) return ''
  const sorted = [...images].sort((a, b) => {
    if (a.is_primary !== b.is_primary) return a.is_primary ? -1 : 1
    return (a.display_order ?? 0) - (b.display_order ?? 0)
  })
  return sorted[0]?.image_url ?? ''
}

function mapCatalogRowToShopListing(row: ListingCatalogRow): ShopListingRow {
  return {
    id: row.id,
    title: row.title,
    slug: row.slug ?? '',
    description: row.description ?? '',
    price: row.price,
    quantity: row.quantity ?? 0,
    listing_type: row.listing_type,
    listing_status: row.listing_status,
    is_active: row.is_active,
    is_featured: row.is_featured,
    is_online: row.is_online ?? false,
    created_at: row.created_at,
    updated_at: row.updated_at,
    primary_image_url: pickPrimaryImageUrl(row.listing_images),
    similarity_score: 0,
    sku: row.sku ?? null,
  }
}

/**
 * Listings for a single shop (owner/admin view — all statuses, including
 * draft / paused / archived). Queries the `listings` table directly so
 * nothing is hidden by RPC defaults. Access enforced by RLS.
 */
export async function getShopListings(
  shopId: string,
  query: ShopListingQuery = {},
): Promise<ListingServiceResponse<ShopListingRow[]>> {
  if (!shopId) return fail('Shop ID is required')

  const limit = query.limit ?? 50
  const offset = query.offset ?? 0

  try {
    let request = supabase
      .from('listings')
      .select(
        `
        id, title, slug, description, price, quantity, listing_type, listing_status,
        is_active, is_featured, is_online, created_at, updated_at, sku,
        listing_images ( image_url, is_primary, display_order )
      `,
      )
      .eq('shop_id', shopId)
      .order('updated_at', { ascending: false })

    if (query.listingType) request = request.eq('listing_type', query.listingType)
    if (query.listingStatus) request = request.eq('listing_status', query.listingStatus)
    if (query.isActive != null) request = request.eq('is_active', query.isActive)
    if (query.isOnline != null) request = request.eq('is_online', query.isOnline)
    if (query.minPrice != null) request = request.gte('price', query.minPrice)
    if (query.maxPrice != null) request = request.lte('price', query.maxPrice)

    const search = query.search?.trim()
    if (search) {
      const term = search.replace(/[%_]/g, '')
      request = request.or(`title.ilike.%${term}%,sku.ilike.%${term}%`)
    }

    request = request.range(offset, offset + limit - 1)

    const { data, error } = await request
    if (error) return fail(error)

    const rows = (data ?? []) as ListingCatalogRow[]
    return ok(rows.map(mapCatalogRowToShopListing))
  } catch (error) {
    return fail(error)
  }
}

/** All listings across the current user's shops (owner dashboard). */
export async function getMyListings(
  query: ShopListingQuery = {},
  userId?: string | null,
): Promise<ListingServiceResponse<Listing[]>> {
  const id = await resolveUserId(userId)
  if (!id) return fail('User not authenticated')

  try {
    const { data: shops, error: shopsError } = await supabase
      .from('shops')
      .select('id')
      .eq('user_id', id)
    if (shopsError) return fail(shopsError)

    const shopIds = (shops ?? []).map((shop) => shop.id)
    if (!shopIds.length) return ok([])

    let request = supabase
      .from('listings')
      .select('*')
      .in('shop_id', shopIds)
      .order('created_at', { ascending: false })

    if (query.listingType) request = request.eq('listing_type', query.listingType)
    if (query.listingStatus) request = request.eq('listing_status', query.listingStatus)
    if (query.isActive != null) request = request.eq('is_active', query.isActive)

    const limit = query.limit ?? 50
    const offset = query.offset ?? 0
    request = request.range(offset, offset + limit - 1)

    const { data, error } = await request
    if (error) return fail(error)
    return ok(data ?? [])
  } catch (error) {
    return fail(error)
  }
}

// ============= PUBLIC BROWSE =============

/**
 * Public, paginated, filterable browse feed. Migrated 1:1 from the old
 * `listingService.getPublicListings`: when a search term is present (and at
 * most one shop is targeted) it routes through the `search_listings` RPC,
 * otherwise it queries `active_listings_view` with the requested filters.
 */
export async function getPublicListings(
  filters: ListingFilters = {},
  pagination: ListingPagination = {},
): Promise<ListingServiceResponse<PaginatedListings<PublicListing>>> {
  const limit = pagination.limit ?? LISTING_PAGE_SIZE
  const offset = pagination.offset ?? 0

  try {
    const normalizedShopIds = (filters.shopIds ?? []).filter(Boolean)
    const resolvedShopId =
      filters.shopId ?? (normalizedShopIds.length === 1 ? normalizedShopIds[0] : undefined)
    const shouldUseSearchRpc = !!filters.search && normalizedShopIds.length <= 1

    if (shouldUseSearchRpc) {
      const { data, error } = await supabase.rpc('search_listings', {
        p_search_term: filters.search as string,
        p_listing_type: filters.listingType,
        p_shop_id: resolvedShopId,
        p_min_price: filters.minPrice,
        p_max_price: filters.maxPrice,
        p_tags: filters.tags,
        p_is_featured: filters.isFeatured,
        p_limit: limit,
        p_offset: offset,
      })
      if (error) return fail(error)
      // `search_listings` returns a strict subset of `active_listings_view` columns.
      const rows = (data ?? []) as unknown as PublicListing[]
      return ok({ items: rows, count: rows.length, hasMore: rows.length === limit })
    }

    let query = supabase.from('active_listings_view').select('*', { count: 'exact' })

    if (filters.search) {
      const like = `%${filters.search}%`
      query = query.or(`title.ilike.${like},description.ilike.${like}`)
    }
    if (filters.listingType) query = query.eq('listing_type', filters.listingType)
    if (normalizedShopIds.length > 1) query = query.in('shop_id', normalizedShopIds)
    else if (resolvedShopId) query = query.eq('shop_id', resolvedShopId)
    if (filters.minPrice != null) query = query.gte('price', filters.minPrice)
    if (filters.maxPrice != null) query = query.lte('price', filters.maxPrice)
    if (filters.isFeatured != null) query = query.eq('is_featured', filters.isFeatured)
    if (filters.tags?.length) query = query.overlaps('tags', filters.tags)

    const ascending = pagination.sortOrder === 'asc'
    if (pagination.sortBy === 'price') {
      query = query.order('price', { ascending })
    } else if (pagination.sortBy === 'title') {
      query = query.order('title', { ascending })
    } else if (pagination.sortBy === 'oldest') {
      query = query.order('created_at', { ascending: true })
    } else {
      query = query.order('is_featured', { ascending: false }).order('created_at', { ascending: false })
    }

    query = query.range(offset, offset + limit - 1)

    const { data, error, count } = await query
    if (error) return fail(error)

    const rows = data ?? []
    const total = count ?? rows.length
    return ok({ items: rows, count: total, hasMore: offset + rows.length < total })
  } catch (error) {
    return fail(error)
  }
}

/** Full-text public search — thin wrapper over {@link getPublicListings}. */
export async function searchPublicListings(
  query: string,
  filters: Omit<ListingFilters, 'search'> = {},
  pagination: ListingPagination = {},
): Promise<ListingServiceResponse<PaginatedListings<PublicListing>>> {
  return getPublicListings({ ...filters, search: query }, pagination)
}

/** Public listings of a single type. Adapts the old type-specific views to `active_listings_view`. */
export async function getListingsByType(
  listingType: ListingType,
  limit = 20,
  offset = 0,
): Promise<ListingServiceResponse<PaginatedListings<PublicListing>>> {
  if (!VALID_LISTING_TYPES.includes(listingType)) {
    return fail('Invalid listing type. Must be physical, digital, or service')
  }
  return getPublicListings({ listingType }, { limit, offset })
}

/**
 * Public listings within a category. Migrated from the old
 * `getCategoryListingCards` tag-based primary path (`category_<id>`).
 */
export async function getCategoryListings(
  categoryId: string,
  pagination: ListingPagination = {},
): Promise<ListingServiceResponse<PaginatedListings<PublicListing>>> {
  if (!categoryId) return fail('Category id is required')
  return getPublicListings({ tags: [`category_${categoryId}`] }, pagination)
}

/**
 * Hydrate a set of listing ids. Migrated 1:1 from the old
 * `getListingsByIds`: reads from `active_listings_view` first, then falls
 * back to the `listings` table for any ids that are inactive/draft.
 */
export async function getListingsByIds(
  ids: string[],
): Promise<ListingServiceResponse<PublicListing[]>> {
  if (!ids?.length) return ok([])

  try {
    const { data: activeRows, error } = await supabase
      .from('active_listings_view')
      .select('*')
      .in('id', ids)
    if (error) return fail(error)

    const foundIds = new Set((activeRows ?? []).map((row) => String(row.id)))
    const missingIds = ids.filter((id) => !foundIds.has(String(id)))

    let fallbackRows: PublicListing[] = []
    if (missingIds.length > 0) {
      const { data: fallbackData } = await supabase.from('listings').select('*').in('id', missingIds)
      fallbackRows = (fallbackData ?? []) as unknown as PublicListing[]
    }

    return ok([...(activeRows ?? []), ...fallbackRows])
  } catch (error) {
    return fail(error)
  }
}

/**
 * Featured listings — the recommended browse feed. The old
 * `featured_listings_view` does not exist in the current schema, so this
 * reads `active_listings_view` filtered by `is_featured`.
 */
export async function getFeaturedListings(
  limit = 12,
): Promise<ListingServiceResponse<PublicListing[]>> {
  try {
    const { data, error } = await supabase
      .from('active_listings_view')
      .select('*')
      .eq('is_featured', true)
      .order('created_at', { ascending: false })
      .limit(limit)
    if (error) return fail(error)
    return ok(data ?? [])
  } catch (error) {
    return fail(error)
  }
}

// ============= DETAIL =============

/** Full listing detail from `listing_details_view` plus category assignments. */
export async function getListingDetails(
  identifier: { listingId?: string; slug?: string },
): Promise<ListingServiceResponse<ListingDetails | null>> {
  const { listingId, slug } = identifier
  if (!listingId && !slug) return fail('Either a listing id or slug is required')

  try {
    let query = supabase.from('listing_details_view').select('*')
    query = listingId ? query.eq('id', listingId) : query.eq('slug', slug as string)

    const { data: listing, error } = await query.maybeSingle()
    if (error) return fail(error)
    if (!listing) return ok<ListingDetails | null>(null)

    const { data: categories } = await supabase
      .from('category_assignments')
      .select('category_id, is_primary')
      .eq('listing_id', listing.id as string)

    return ok<ListingDetails | null>({
      ...(listing as ListingDetailsView),
      category_assignments: categories ?? [],
    })
  } catch (error) {
    return fail(error)
  }
}

// ============= RPC HELPERS =============

/** Popular tags across the marketplace (RPC with a table fallback). */
export async function getPopularTags(limit = 20): Promise<ListingServiceResponse<PopularTag[]>> {
  try {
    const { data, error } = await supabase.rpc('get_popular_tags', { p_limit: limit })
    if (!error && Array.isArray(data)) return ok(data)

    // Fallback: aggregate from listing_tags.
    const { data: tagRows, error: tagError } = await supabase
      .from('listing_tags')
      .select('tag_name')
      .limit(2000)
    if (tagError) return fail(tagError)

    const counts = new Map<string, number>()
    for (const row of tagRows ?? []) {
      const name = (row.tag_name ?? '').trim()
      if (name) counts.set(name, (counts.get(name) ?? 0) + 1)
    }
    const tags = [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([tag_name, usage_count]) => ({ tag_name, usage_count }))
    return ok(tags)
  } catch (error) {
    return fail(error)
  }
}

/** Related-listing recommendations for a given listing. */
export async function getRecommendations(
  listingId: string,
  limit = 6,
): Promise<ListingServiceResponse<RecommendedListing[]>> {
  if (!listingId) return fail('Listing ID is required')

  try {
    const { data, error } = await supabase.rpc('get_listing_recommendations', {
      p_listing_id: listingId,
      p_limit: limit,
    })
    if (error) return fail(error)
    return ok(data ?? [])
  } catch (error) {
    return fail(error)
  }
}

/** Shop sections with per-section listing counts (seller dashboard). */
export async function getShopSectionsWithCounts(
  shopId: string,
): Promise<ListingServiceResponse<ShopSectionWithCounts[]>> {
  if (!shopId) return fail('Shop ID is required')

  try {
    const { data, error } = await supabase.rpc('get_shop_sections_with_counts', {
      p_shop_id: shopId,
    })
    if (error) return fail(error)
    return ok(data ?? [])
  } catch (error) {
    return fail(error)
  }
}

/**
 * Adjust stock for a listing (or a specific variation) via the atomic
 * `update_listing_stock` RPC. `quantityChange` is signed (negative to sell).
 */
export async function updateStock(
  listingId: string,
  quantityChange: number,
  variationId?: string | null,
): Promise<ListingServiceResponse<unknown>> {
  if (!listingId) return fail('Listing ID is required')

  try {
    const { data, error } = await supabase.rpc('update_listing_stock', {
      p_listing_id: listingId,
      p_quantity_change: quantityChange,
      p_variation_id: variationId ?? undefined,
    })
    if (error) return fail(error)

    const result = typeof data === 'string' ? JSON.parse(data) : data
    if (result && typeof result === 'object' && 'success' in result && !result.success) {
      return fail((result as { error?: string }).error ?? 'Stock update failed.')
    }
    return ok(result)
  } catch (error) {
    return fail(error)
  }
}

// ============= CATEGORIES =============

/** Replace a listing's category assignments (atomic RPC, direct-insert fallback). */
export async function assignCategories(
  listingId: string,
  categories: ListingCategoryInput[],
  userId?: string | null,
): Promise<ListingServiceResponse<{ assigned: number }>> {
  const id = await resolveUserId(userId)
  if (!id) return fail('User not authenticated')

  const normalized = validateCategoryData(categories)
  if (!normalized.isValid) return fail(normalized.error ?? 'Invalid categories.')

  try {
    // Clear existing assignments first (idempotent replace).
    await supabase.from('category_assignments').delete().eq('listing_id', listingId)

    if (!normalized.data.length) return ok({ assigned: 0 })

    const { error: rpcError } = await supabase.rpc('assign_categories_to_listing', {
      p_listing_id: listingId,
      p_categories: normalized.data,
      p_user_id: id,
    })

    if (!rpcError) return ok({ assigned: normalized.data.length })

    // Fallback: direct insert.
    const rows = normalized.data.map((cat) => ({
      listing_id: listingId,
      category_id: cat.category_id,
      is_primary: cat.is_primary,
      assigned_by: id,
    }))
    const { data, error } = await supabase.from('category_assignments').insert(rows).select('id')
    if (error) return fail(error)
    return ok({ assigned: data?.length ?? 0 })
  } catch (error) {
    return fail(error)
  }
}

// ============= CREATE =============

/** Persist the child collections referenced by a form after the main row exists. */
async function persistListingChildren(
  listingId: string,
  formData: Partial<ListingFormData>,
  userId: string,
): Promise<void> {
  if (Array.isArray(formData.variations)) await replaceVariations(listingId, formData.variations)
  if (Array.isArray(formData.attributes)) await replaceAttributes(listingId, formData.attributes)
  if (Array.isArray(formData.materials)) await replaceMaterials(listingId, formData.materials)
  if (Array.isArray(formData.categories) && formData.categories.length) {
    await assignCategories(listingId, formData.categories, userId)
  }
  if (Array.isArray(formData.images)) {
    for (const [index, image] of formData.images.entries()) {
      if (image.blob && image.mimeType) {
        await uploadAndAttachImage(
          listingId,
          { blob: image.blob, mimeType: image.mimeType, fileName: image.fileName },
          { alt_text: image.alt_text ?? null, is_primary: image.is_primary ?? index === 0, display_order: image.display_order ?? index },
          userId,
        )
      } else if (image.image_url) {
        await addImage(
          listingId,
          {
            image_url: image.image_url,
            alt_text: image.alt_text ?? null,
            is_primary: image.is_primary ?? index === 0,
            display_order: image.display_order ?? index,
            width: image.width ?? null,
            height: image.height ?? null,
            file_size: image.file_size ?? null,
            image_type: image.image_type ?? null,
          },
          userId,
        )
      }
    }
  }
}

/**
 * Create a listing and all provided child rows. The main row is inserted from
 * the cleaned form payload; images/variations/attributes/materials/categories
 * are then persisted through their dedicated services.
 */
export async function createListing(
  formData: Partial<ListingFormData>,
  userId?: string | null,
): Promise<ListingServiceResponse<Listing | null>> {
  const id = await resolveUserId(userId)
  if (!id) return fail('User not authenticated')

  const shopId = formData.shop_id
  if (!shopId) return fail('A shop is required to create a listing.')

  try {
    const access = await verifyShopManageAccess(shopId, id)
    if (!access.success) return fail(access.error)

    const payload = prepareListingDataForSubmission({ ...formData, shop_id: shopId })
    // A newly published listing gets a timestamp; drafts do not.
    if (payload.listing_status === LISTING_STATUS.ACTIVE && !payload.published_at) {
      payload.published_at = new Date().toISOString()
    }

    const { data: listing, error } = await supabase
      .from('listings')
      .insert(payload)
      .select('*')
      .single()
    if (error || !listing) return fail(error ?? 'Could not create listing.')

    await persistListingChildren(listing.id, formData, id)

    invalidateListingCaches()

    return ok<Listing | null>(listing)
  } catch (error) {
    return fail(error)
  }
}

/** Refresh every browse/category/shop feed that can show this listing. */
function invalidateListingCaches() {
  invalidateCache(
    'feed:categories',
    'feed:shops',
    'route:shops-browse',
    'route:home',
    INVALIDATION_TOPICS.commerceListings,
  )
}

// ============= UPDATE =============

/** Update the main listing row only (no child collections). Owner/admin. */
export async function updateListing(
  listingId: string,
  updates: ListingUpdate,
  userId?: string | null,
): Promise<ListingServiceResponse<Listing>> {
  const id = await resolveUserId(userId)
  if (!id) return fail('User not authenticated')

  try {
    const access = await verifyListingManageAccess(listingId, id)
    if (!access.success) return fail(access.error)

    const clean = Object.fromEntries(
      Object.entries(updates).filter(([, value]) => value !== undefined),
    )

    const { data, error } = await supabase
      .from('listings')
      .update({ ...clean, updated_at: new Date().toISOString() })
      .eq('id', listingId)
      .select('*')
      .single()

    if (error) return fail(error)
    invalidateListingCaches()
    return ok(data)
  } catch (error) {
    return fail(error)
  }
}

/**
 * Comprehensive update: main row + any provided child collections. Only the
 * collections present on `formData` are touched (each is a full replace).
 */
export async function updateListingWithDetails(
  listingId: string,
  formData: Partial<ListingFormData>,
  userId?: string | null,
): Promise<ListingServiceResponse<Listing | null>> {
  const id = await resolveUserId(userId)
  if (!id) return fail('User not authenticated')

  try {
    const access = await verifyListingManageAccess(listingId, id)
    if (!access.success) return fail(access.error)

    const payload = prepareListingDataForSubmission(formData) as ListingUpdate
    delete (payload as { shop_id?: string }).shop_id

    let updated: Listing | null = null
    if (Object.keys(payload).length > 0) {
      const { data, error } = await supabase
        .from('listings')
        .update({ ...payload, updated_at: new Date().toISOString() })
        .eq('id', listingId)
        .select('*')
        .single()
      if (error) return fail(error)
      updated = data
    }

    await persistListingChildren(listingId, formData, id)

    if (!updated) {
      const { data } = await supabase.from('listings').select('*').eq('id', listingId).maybeSingle()
      updated = data ?? null
    }
    invalidateListingCaches()
    return ok<Listing | null>(updated)
  } catch (error) {
    return fail(error)
  }
}

/** Convenience: change listing status (also syncs `is_active`/`published_at`). */
export async function setListingStatus(
  listingId: string,
  status: ListingStatus,
  userId?: string | null,
): Promise<ListingServiceResponse<Listing>> {
  return updateListing(
    listingId,
    {
      listing_status: status,
      is_active: status === LISTING_STATUS.ACTIVE,
      published_at: status === LISTING_STATUS.ACTIVE ? new Date().toISOString() : null,
    },
    userId,
  )
}

export async function setListingActive(
  listingId: string,
  isActive: boolean,
  userId?: string | null,
): Promise<ListingServiceResponse<Listing>> {
  return updateListing(listingId, { is_active: isActive }, userId)
}

export async function setListingFeatured(
  listingId: string,
  isFeatured: boolean,
  userId?: string | null,
): Promise<ListingServiceResponse<Listing>> {
  return updateListing(listingId, { is_featured: isFeatured }, userId)
}

// ============= DELETE =============

/** Hard-delete a listing (child rows cascade in the DB). Owner/admin. */
export async function deleteListing(
  listingId: string,
  userId?: string | null,
): Promise<ListingServiceResponse<{ id: string }>> {
  const id = await resolveUserId(userId)
  if (!id) return fail('User not authenticated')

  try {
    const access = await verifyListingManageAccess(listingId, id)
    if (!access.success) return fail(access.error)

    const { error } = await supabase.from('listings').delete().eq('id', listingId)
    if (error) return fail(error)
    invalidateListingCaches()
    return ok({ id: listingId })
  } catch (error) {
    return fail(error)
  }
}

// ============= ADMIN =============
//
// Usable from an admin dashboard. They read/write across all listings (not just
// the caller's own); authorisation is enforced by RLS on the server.

export type AdminListingQuery = {
  search?: string
  listingType?: ListingType
  status?: string
  shopId?: string
  minPrice?: number
  maxPrice?: number
  isFeatured?: boolean
  tags?: string[]
  limit?: number
  offset?: number
}

/** Admin catalogue search across every shop (`admin_search_listings` RPC). */
export async function adminSearchListings(
  query: AdminListingQuery = {},
): Promise<ListingServiceResponse<AdminListingRow[]>> {
  try {
    const { data, error } = await supabase.rpc('admin_search_listings', {
      p_search_term: query.search ?? undefined,
      p_listing_type: query.listingType ?? undefined,
      p_status: query.status ?? undefined,
      p_shop_id: query.shopId ?? undefined,
      p_min_price: query.minPrice ?? undefined,
      p_max_price: query.maxPrice ?? undefined,
      p_is_featured: query.isFeatured ?? undefined,
      p_tags: query.tags ?? undefined,
      p_limit: query.limit ?? 50,
      p_offset: query.offset ?? 0,
    })
    if (error) return fail(error)
    return ok(data ?? [])
  } catch (error) {
    return fail(error)
  }
}

/** Admin: update any listing's fields (permission enforced server-side). */
export async function adminUpdateListing(
  listingId: string,
  updates: ListingUpdate,
  userId?: string | null,
): Promise<ListingServiceResponse<Listing>> {
  return updateListing(listingId, updates, userId)
}

/** Admin: feature / unfeature any listing. */
export async function adminSetFeatured(
  listingId: string,
  isFeatured: boolean,
  userId?: string | null,
): Promise<ListingServiceResponse<Listing>> {
  return setListingFeatured(listingId, isFeatured, userId)
}

/** Admin dashboard: platform-wide listing counts. */
export async function getPlatformListingStats(
  userId?: string | null,
): Promise<ListingServiceResponse<PlatformListingStats>> {
  const id = await resolveUserId(userId)
  if (!id) return fail('User not authenticated')
  if (!(await isAdminUser(id))) return fail('Admin access required')

  try {
    const base = () => supabase.from('listings').select('id', { count: 'exact', head: true })

    const [total, active, draft, featured, physical, digital, service] = await Promise.all([
      base(),
      base().eq('is_active', true).eq('listing_status', LISTING_STATUS.ACTIVE),
      base().eq('listing_status', LISTING_STATUS.DRAFT),
      base().eq('is_featured', true),
      base().eq('listing_type', LISTING_TYPES.PHYSICAL),
      base().eq('listing_type', LISTING_TYPES.DIGITAL),
      base().eq('listing_type', LISTING_TYPES.SERVICE),
    ])

    const firstError =
      total.error || active.error || draft.error || featured.error || physical.error || digital.error || service.error
    if (firstError) return fail(firstError)

    return ok<PlatformListingStats>({
      totalListings: total.count ?? 0,
      activeListings: active.count ?? 0,
      draftListings: draft.count ?? 0,
      featuredListings: featured.count ?? 0,
      physicalListings: physical.count ?? 0,
      digitalListings: digital.count ?? 0,
      serviceListings: service.count ?? 0,
    })
  } catch (error) {
    return fail(error)
  }
}
