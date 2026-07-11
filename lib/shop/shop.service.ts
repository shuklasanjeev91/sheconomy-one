/**
 * Shop service — typed data-access layer for everything shop related.
 *
 * Ported from the legacy `shop-service.js` + `shopStore.js` and adapted to the
 * new schema. Shop creation, follows, dashboard stats and the public browse
 * feed are delegated to the existing commerce modules so nothing is duplicated:
 *
 *   - creation      → `~/commerce/lib/shops` (`seller_create_shop_with_points`)
 *   - follows       → `~/commerce/lib/shop-follows`
 *   - dashboard      → `~/commerce/lib/seller-dashboard`
 *   - browse feed   → `~/commerce/lib/commerce`
 *   - logo upload   → `~/lib/supabase/storage-upload`
 *
 * Every function returns a `ShopServiceResponse<T>` and routes failures through
 * the shared `shop.errors` module so messages are always user-friendly. The
 * functions are role-agnostic: normal users, vendors and admins all call the
 * same layer; row visibility / write permission is enforced by Supabase RLS.
 */

import { createSellerShop } from '~/commerce/lib/shops'
import {
  fetchShopFollowState,
  followShop as followShopCore,
  unfollowShop as unfollowShopCore,
} from '~/commerce/lib/shop-follows'
import { fetchShopDashboard, type ShopDashboardData } from '~/commerce/lib/seller-dashboard'
import { supabase } from '~/lib/supabase'
import { uploadShopLogoImage } from '~/lib/supabase/storage-upload'

import { toFriendlyShopError } from './shop.errors'
import {
  DEFAULT_SHOP_CURRENCY,
  SHOP_FOLLOW_STATUSES,
  type PlatformShopStats,
  type Shop,
  type ShopFollowStatus,
  type ShopFollowerSummary,
  type ShopFormData,
  type ShopImageUpload,
  type ShopListingsSummary,
  type ShopServiceResponse,
  type ShopStats,
  type ShopSummary,
  type ShopUpdate,
} from './shop.type'

// ============= RESPONSE HELPERS =============

function ok<T>(data: T): ShopServiceResponse<T> {
  return { data, error: null, success: true }
}

function fail<T>(error: unknown, fallback?: string): ShopServiceResponse<T> {
  return { data: null, error: toFriendlyShopError(error, fallback), success: false }
}

async function resolveUserId(userId?: string | null): Promise<string | null> {
  if (userId) return userId
  const { data } = await supabase.auth.getUser()
  return data.user?.id ?? null
}

/** Columns returned for the compact public browse shape (`ShopSummary`). */
const SHOP_SUMMARY_SELECT =
  'id, shop_name, slug, logo_url, shop_description, average_rating, total_reviews, verified, shop_currency'

export type PaginatedShops<T> = {
  items: T[]
  count: number
  hasMore: boolean
}

// ============= OWNER / MY SHOP =============

/** All shops owned by a user (newest first). */
export async function getMyShops(userId?: string | null): Promise<ShopServiceResponse<Shop[]>> {
  const id = await resolveUserId(userId)
  if (!id) return fail('User not authenticated')

  try {
    const { data, error } = await supabase
      .from('shops')
      .select('*')
      .eq('user_id', id)
      .order('created_at', { ascending: false })

    if (error) return fail(error)
    return ok(data ?? [])
  } catch (error) {
    return fail(error)
  }
}

/** The user's primary active shop, or `null` if they have none. */
export async function getMyShop(userId?: string | null): Promise<ShopServiceResponse<Shop | null>> {
  const id = await resolveUserId(userId)
  if (!id) return fail('User not authenticated')

  try {
    const { data, error } = await supabase
      .from('shops')
      .select('*')
      .eq('user_id', id)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error) return fail(error)
    return ok<Shop | null>(data ?? null)
  } catch (error) {
    return fail(error)
  }
}

/** Whether the user owns at least one active shop. */
export async function hasShop(userId?: string | null): Promise<ShopServiceResponse<boolean>> {
  const id = await resolveUserId(userId)
  if (!id) return ok(false)

  try {
    const { count, error } = await supabase
      .from('shops')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', id)
      .eq('is_active', true)

    if (error) return fail(error)
    return ok((count ?? 0) > 0)
  } catch (error) {
    return fail(error)
  }
}

// ============= READ =============

export async function getShopById(shopId: string): Promise<ShopServiceResponse<Shop | null>> {
  if (!shopId) return fail('Shop ID is required')

  try {
    const { data, error } = await supabase.from('shops').select('*').eq('id', shopId).maybeSingle()
    if (error) return fail(error)
    return ok<Shop | null>(data ?? null)
  } catch (error) {
    return fail(error)
  }
}

export async function getShopBySlug(slug: string): Promise<ShopServiceResponse<Shop | null>> {
  if (!slug) return fail('Shop slug is required')

  try {
    const { data, error } = await supabase.from('shops').select('*').eq('slug', slug).maybeSingle()
    if (error) return fail(error)
    return ok<Shop | null>(data ?? null)
  } catch (error) {
    return fail(error)
  }
}

/**
 * Public, verified + active shops with optional category/search filters,
 * sorting and pagination. Returns items + total count for infinite scroll.
 */
export async function getPublicShops(
  filters: { category?: string; search?: string; shopIds?: string[] } = {},
  pagination: { limit?: number; offset?: number; sortBy?: 'newest' | 'oldest' | 'name' | 'rating' } = {},
): Promise<ShopServiceResponse<PaginatedShops<ShopSummary>>> {
  try {
    let query = supabase
      .from('shops')
      .select(SHOP_SUMMARY_SELECT, { count: 'exact' })
      .eq('is_active', true)
      .eq('verified', true)

    if (filters.category && filters.category !== 'all') {
      query = query.contains('shop_categories', [filters.category])
    }
    if (filters.search) {
      query = query.or(
        `shop_name.ilike.%${filters.search}%,shop_description.ilike.%${filters.search}%`,
      )
    }
    if (filters.shopIds?.length) {
      query = query.in('id', filters.shopIds)
    }

    const sort = ((): { field: string; ascending: boolean } => {
      switch (pagination.sortBy) {
        case 'oldest':
          return { field: 'created_at', ascending: true }
        case 'name':
          return { field: 'shop_name', ascending: true }
        case 'rating':
          return { field: 'average_rating', ascending: false }
        case 'newest':
        default:
          return { field: 'created_at', ascending: false }
      }
    })()
    query = query.order(sort.field, { ascending: sort.ascending, nullsFirst: false })

    const offset = pagination.offset ?? 0
    if (pagination.limit) {
      query = query.range(offset, offset + pagination.limit - 1)
    }

    const { data, error, count } = await query
    if (error) return fail(error)

    const items = (data ?? []) as unknown as ShopSummary[]
    const total = count ?? 0
    return ok<PaginatedShops<ShopSummary>>({
      items,
      count: total,
      hasMore: offset + items.length < total,
    })
  } catch (error) {
    return fail(error)
  }
}

// ============= WRITE =============

/**
 * Create a shop. Delegates the atomic row + role + points work to the
 * `seller_create_shop_with_points` RPC, then persists any extra form fields
 * (contact, categories, hours, social links, logo) and returns the full row.
 */
export async function createShop(
  formData: Partial<ShopFormData>,
  userId?: string | null,
): Promise<ShopServiceResponse<Shop | null>> {
  const id = await resolveUserId(userId)
  if (!id) return fail('User not authenticated')

  const shopName = formData.shop_name?.trim() ?? ''
  if (shopName.length < 2) {
    return fail('Shop name must be at least 2 characters.')
  }

  try {
    const { shopId, error } = await createSellerShop({
      shopName,
      shopDescription: formData.shop_description?.trim() || undefined,
      shopCurrency: formData.shop_currency || DEFAULT_SHOP_CURRENCY,
    })

    if (error) return fail(error)
    if (!shopId) return fail('Shop creation did not return an id.')

    // Persist any additional fields the create form collected.
    const extras = buildExtraUpdate(formData)
    if (Object.keys(extras).length > 0) {
      const updateResult = await updateShop(shopId, extras)
      if (updateResult.success && updateResult.data) return ok<Shop | null>(updateResult.data)
    }

    return getShopById(shopId)
  } catch (error) {
    return fail(error)
  }
}

/** Pick the columns beyond name/description/currency that create can also set. */
function buildExtraUpdate(formData: Partial<ShopFormData>): ShopUpdate {
  const update: ShopUpdate = {}
  if (formData.logo_url) update.logo_url = formData.logo_url
  if (formData.website_url) update.website_url = formData.website_url
  if (formData.shop_phone_number) update.shop_phone_number = formData.shop_phone_number
  if (formData.shop_email) update.shop_email = formData.shop_email
  if (formData.shop_address_id) update.shop_address_id = formData.shop_address_id
  if (formData.shop_categories?.length) update.shop_categories = formData.shop_categories
  if (formData.shop_hours && Object.keys(formData.shop_hours).length) {
    update.shop_hours = formData.shop_hours
  }
  if (formData.social_links && Object.keys(formData.social_links).length) {
    update.social_links = formData.social_links
  }
  if (formData.shop_metadata && Object.keys(formData.shop_metadata).length) {
    update.shop_metadata = formData.shop_metadata as unknown as ShopUpdate['shop_metadata']
  }
  return update
}

export async function updateShop(
  shopId: string,
  updates: ShopUpdate,
): Promise<ShopServiceResponse<Shop>> {
  if (!shopId) return fail('Shop ID is required')

  try {
    const payload: ShopUpdate = { ...updates, updated_at: new Date().toISOString() }
    const { data, error } = await supabase
      .from('shops')
      .update(payload)
      .eq('id', shopId)
      .select('*')
      .single()

    if (error) return fail(error)
    return ok(data)
  } catch (error) {
    return fail(error)
  }
}

/** Soft-delete: mark the shop inactive rather than removing the row. */
export async function deleteShop(shopId: string): Promise<ShopServiceResponse<{ id: string }>> {
  if (!shopId) return fail('Shop ID is required')

  try {
    const { error } = await supabase
      .from('shops')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('id', shopId)

    if (error) return fail(error)
    return ok({ id: shopId })
  } catch (error) {
    return fail(error)
  }
}

/** Upload a new shop logo and persist the resulting public URL. */
export async function uploadShopLogo(
  userId: string,
  shopId: string,
  file: ShopImageUpload,
): Promise<ShopServiceResponse<{ logo_url: string }>> {
  if (!userId || !shopId) return fail('User and shop are required')

  try {
    const blob = file.blob instanceof ArrayBuffer ? new Blob([file.blob]) : file.blob
    const { data, error } = await uploadShopLogoImage(userId, shopId, {
      blob: blob as Blob,
      mimeType: file.mimeType,
      fileName: file.fileName,
    })

    if (error || !data) return fail(error ?? 'Upload failed.')

    const updateResult = await updateShop(shopId, { logo_url: data.publicUrl })
    if (!updateResult.success) return fail(updateResult.error)

    return ok({ logo_url: data.publicUrl })
  } catch (error) {
    return fail(error)
  }
}

// ============= STATS & DASHBOARD =============

/** Normalised stats derived from the `shop_listings_summary` view. */
export async function getShopStats(shopId: string): Promise<ShopServiceResponse<ShopStats>> {
  if (!shopId) return fail('Shop ID is required')

  try {
    const { data, error } = await supabase
      .from('shop_listings_summary')
      .select('*')
      .eq('shop_id', shopId)
      .maybeSingle()

    if (error) return fail(error)

    const stats: ShopStats = {
      totalListings: data?.total_active_listings ?? 0,
      activeListings: data?.active_listings ?? 0,
      physicalListings: data?.physical_listings ?? 0,
      digitalListings: data?.digital_listings ?? 0,
      serviceListings: data?.service_listings ?? 0,
      featuredListings: data?.featured_listings ?? 0,
      priceRange: {
        min: data?.min_price ?? 0,
        max: data?.max_price ?? 0,
        avg: data?.avg_price ?? 0,
      },
      latestListingDate: data?.latest_listing_date ?? null,
      isActive: data?.shop_active ?? false,
      isVerified: data?.shop_verified ?? false,
    }
    return ok(stats)
  } catch (error) {
    return fail(error)
  }
}

/** Raw summary-view row for a single shop. */
export async function getShopWithListingsSummary(
  shopId: string,
): Promise<ShopServiceResponse<ShopListingsSummary | null>> {
  if (!shopId) return fail('Shop ID is required')

  try {
    const { data, error } = await supabase
      .from('shop_listings_summary')
      .select('*')
      .eq('shop_id', shopId)
      .maybeSingle()

    if (error) return fail(error)
    return ok<ShopListingsSummary | null>(data ?? null)
  } catch (error) {
    return fail(error)
  }
}

/** Summary-view rows for many shops with optional filters. */
export async function getShopsWithSummaries(
  filters: { shopIds?: string[]; verified?: boolean; minListings?: number; hasFeatured?: boolean } = {},
): Promise<ShopServiceResponse<ShopListingsSummary[]>> {
  try {
    let query = supabase.from('shop_listings_summary').select('*').eq('shop_active', true)

    if (filters.shopIds?.length) query = query.in('shop_id', filters.shopIds)
    if (filters.verified !== undefined) query = query.eq('shop_verified', filters.verified)
    if (filters.minListings) query = query.gte('total_active_listings', filters.minListings)
    if (filters.hasFeatured) query = query.gt('featured_listings', 0)

    query = query.order('total_active_listings', { ascending: false, nullsFirst: false })

    const { data, error } = await query
    if (error) return fail(error)
    return ok(data ?? [])
  } catch (error) {
    return fail(error)
  }
}

/** Full seller dashboard bundle (summary + sales + stats). Reuses commerce lib. */
export async function getShopDashboard(
  shopId: string,
): Promise<ShopServiceResponse<ShopDashboardData>> {
  if (!shopId) return fail('Shop ID is required')

  try {
    const dashboard = await fetchShopDashboard(shopId)
    return ok(dashboard)
  } catch (error) {
    return fail(error)
  }
}

// ============= FOLLOWS =============

export async function checkIsFollowingShop(
  shopId: string,
  userId: string,
): Promise<ShopServiceResponse<boolean>> {
  const { isFollowing, error } = await fetchShopFollowState(userId, shopId)
  if (error) return fail(error)
  return ok(isFollowing)
}

export async function followShop(
  shopId: string,
  userId: string,
): Promise<ShopServiceResponse<{ shopId: string }>> {
  if (!shopId || !userId) return fail('Shop and user are required')

  try {
    // Prevent following your own shop.
    const { data: owner } = await supabase.from('shops').select('user_id').eq('id', shopId).maybeSingle()
    if (owner?.user_id === userId) return fail('You can’t follow your own shop.')

    const { error } = await followShopCore(userId, shopId)
    if (error) return fail(error)
    return ok({ shopId })
  } catch (error) {
    return fail(error)
  }
}

export async function unfollowShop(
  shopId: string,
  userId: string,
): Promise<ShopServiceResponse<{ shopId: string }>> {
  if (!shopId || !userId) return fail('Shop and user are required')

  const { error } = await unfollowShopCore(userId, shopId)
  if (error) return fail(error)
  return ok({ shopId })
}

export async function getShopFollowerCount(shopId: string): Promise<ShopServiceResponse<number>> {
  if (!shopId) return ok(0)

  try {
    const { count, error } = await supabase
      .from('shop_follows')
      .select('id', { count: 'exact', head: true })
      .eq('shop_id', shopId)
      .eq('status', 'active')

    if (error) return fail(error)
    return ok(count ?? 0)
  } catch (error) {
    return fail(error)
  }
}

export async function getShopFollowerCounts(
  shopIds: string[],
): Promise<ShopServiceResponse<Record<string, number>>> {
  const validIds = (shopIds ?? []).filter((id) => id && typeof id === 'string')
  if (!validIds.length) return ok({})

  try {
    const { data, error } = await supabase
      .from('shop_follows')
      .select('shop_id')
      .in('shop_id', validIds)
      .eq('status', 'active')

    if (error) return fail(error)

    const counts: Record<string, number> = {}
    for (const id of validIds) counts[id] = 0
    for (const row of data ?? []) counts[row.shop_id] = (counts[row.shop_id] ?? 0) + 1
    return ok(counts)
  } catch (error) {
    return fail(error)
  }
}

/** Shops a user follows, hydrated with basic shop info. */
export async function getFollowedShops(userId: string): Promise<ShopServiceResponse<Shop[]>> {
  if (!userId) return ok([])

  try {
    const { data, error } = await supabase
      .from('shop_follows')
      .select('created_at, shops(*)')
      .eq('user_id', userId)
      .eq('status', 'active')
      .order('created_at', { ascending: false })

    if (error) return fail(error)

    const shops = (data ?? [])
      .map((row) => (row as { shops: Shop | null }).shops)
      .filter((shop): shop is Shop => !!shop && shop.is_active)
    return ok(shops)
  } catch (error) {
    return fail(error)
  }
}

/** Followers of a shop with basic profile info + total count. */
export async function getShopFollowers(
  shopId: string,
  options: { limit?: number; offset?: number } = {},
): Promise<ShopServiceResponse<{ followers: ShopFollowerSummary[]; total: number }>> {
  if (!shopId) return ok({ followers: [], total: 0 })

  const { limit = 20, offset = 0 } = options

  try {
    const { count } = await supabase
      .from('shop_follows')
      .select('id', { count: 'exact', head: true })
      .eq('shop_id', shopId)
      .eq('status', 'active')

    const { data: follows, error } = await supabase
      .from('shop_follows')
      .select('user_id, created_at')
      .eq('shop_id', shopId)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) return fail(error)

    const rows = follows ?? []
    const userIds = rows.map((row) => row.user_id)

    // shop_follows.user_id references auth.users, so hydrate profiles separately.
    const profilesById = new Map<string, { full_name: string | null; username: string | null; avatar_url: string | null }>()
    if (userIds.length) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, username, avatar_url')
        .in('id', userIds)
      for (const profile of profiles ?? []) {
        profilesById.set(profile.id, {
          full_name: profile.full_name,
          username: profile.username,
          avatar_url: profile.avatar_url,
        })
      }
    }

    const followers: ShopFollowerSummary[] = rows.map((row) => {
      const profile = profilesById.get(row.user_id)
      return {
        id: row.user_id,
        full_name: profile?.full_name ?? null,
        username: profile?.username ?? null,
        avatar_url: profile?.avatar_url ?? null,
        followed_at: row.created_at,
      }
    })

    return ok({ followers, total: count ?? 0 })
  } catch (error) {
    return fail(error)
  }
}

/** Update a follow relationship's status (active / muted / blocked). */
export async function updateFollowStatus(
  shopId: string,
  userId: string,
  status: ShopFollowStatus,
): Promise<ShopServiceResponse<ShopFollowStatus>> {
  if (!shopId || !userId) return fail('Shop and user are required')
  if (!SHOP_FOLLOW_STATUSES.includes(status)) {
    return fail(`Invalid status. Must be one of: ${SHOP_FOLLOW_STATUSES.join(', ')}.`)
  }

  try {
    const { error } = await supabase
      .from('shop_follows')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('shop_id', shopId)
      .eq('user_id', userId)

    if (error) return fail(error)
    return ok(status)
  } catch (error) {
    return fail(error)
  }
}

// ============= ADMIN =============
//
// These are usable from an admin dashboard. They read/write across all shops
// (not just the caller's own); the actual authorisation is enforced by RLS /
// the `can_access_shop` policy on the server.

/** List every shop with admin filters + pagination (incl. unverified/inactive). */
export async function listAllShops(
  filters: {
    verified?: boolean
    isActive?: boolean
    search?: string
    category?: string
  } = {},
  pagination: { limit?: number; offset?: number } = {},
): Promise<ShopServiceResponse<PaginatedShops<Shop>>> {
  try {
    let query = supabase.from('shops').select('*', { count: 'exact' })

    if (filters.verified !== undefined) query = query.eq('verified', filters.verified)
    if (filters.isActive !== undefined) query = query.eq('is_active', filters.isActive)
    if (filters.category && filters.category !== 'all') {
      query = query.contains('shop_categories', [filters.category])
    }
    if (filters.search) {
      query = query.or(
        `shop_name.ilike.%${filters.search}%,shop_email.ilike.%${filters.search}%`,
      )
    }

    query = query.order('created_at', { ascending: false })

    const offset = pagination.offset ?? 0
    const limit = pagination.limit ?? 50
    query = query.range(offset, offset + limit - 1)

    const { data, error, count } = await query
    if (error) return fail(error)

    const items = data ?? []
    const total = count ?? 0
    return ok<PaginatedShops<Shop>>({ items, count: total, hasMore: offset + items.length < total })
  } catch (error) {
    return fail(error)
  }
}

/** Admin: verify / unverify a shop. */
export async function setShopVerified(
  shopId: string,
  verified: boolean,
): Promise<ShopServiceResponse<Shop>> {
  return updateShop(shopId, { verified })
}

/** Admin (or owner): toggle a shop's active state. */
export async function setShopActive(
  shopId: string,
  isActive: boolean,
): Promise<ShopServiceResponse<Shop>> {
  return updateShop(shopId, { is_active: isActive })
}

/** Admin: update any shop's fields (permission enforced server-side). */
export async function adminUpdateShop(
  shopId: string,
  updates: ShopUpdate,
): Promise<ShopServiceResponse<Shop>> {
  return updateShop(shopId, updates)
}

/** Admin dashboard: platform-wide shop counts. */
export async function getPlatformShopStats(): Promise<ShopServiceResponse<PlatformShopStats>> {
  try {
    const base = () => supabase.from('shops').select('id', { count: 'exact', head: true })

    const [totalRes, activeRes, verifiedRes, pendingRes] = await Promise.all([
      base(),
      base().eq('is_active', true),
      base().eq('verified', true),
      base().eq('is_active', true).eq('verified', false),
    ])

    const firstError =
      totalRes.error || activeRes.error || verifiedRes.error || pendingRes.error
    if (firstError) return fail(firstError)

    return ok<PlatformShopStats>({
      totalShops: totalRes.count ?? 0,
      activeShops: activeRes.count ?? 0,
      verifiedShops: verifiedRes.count ?? 0,
      pendingVerification: pendingRes.count ?? 0,
    })
  } catch (error) {
    return fail(error)
  }
}
