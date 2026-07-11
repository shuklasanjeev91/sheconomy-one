/**
 * Shared response + access helpers for every listing service module.
 *
 * Keeping these in one place means the main service and the child services
 * (images / variations / attributes / materials) all resolve identities,
 * verify ownership and shape responses identically — no duplication.
 *
 * Access model: a listing can be managed by the shop owner **or** an admin.
 * These checks are a UX convenience; Supabase RLS is the real gate on the row.
 */

import { supabase } from '~/lib/supabase'
import { USER_ROLES } from '~/lib/profile/profile.type'

import { toFriendlyListingError } from './listing.errors'
import type { ListingServiceResponse } from './listing.type'

export function ok<T>(data: T): ListingServiceResponse<T> {
  return { data, error: null, success: true }
}

export function fail<T>(error: unknown, fallback?: string): ListingServiceResponse<T> {
  return { data: null, error: toFriendlyListingError(error, fallback), success: false }
}

/** Resolve the acting user id, falling back to the authenticated session. */
export async function resolveUserId(userId?: string | null): Promise<string | null> {
  if (userId) return userId
  const { data } = await supabase.auth.getUser()
  return data.user?.id ?? null
}

/** Whether the given user has the admin role on their profile. */
export async function isAdminUser(userId: string | null | undefined): Promise<boolean> {
  if (!userId) return false
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .maybeSingle()
    if (error) return false
    return data?.role === USER_ROLES.ADMIN
  } catch {
    return false
  }
}

export type ListingAccess = {
  success: boolean
  listingId: string
  shopId: string | null
  accessType: 'owner' | 'admin' | null
  error?: string
}

/**
 * Verify that `userId` may manage `listingId`: either they own the shop the
 * listing belongs to, or they are an admin. Returns a structured result so
 * callers can branch without throwing.
 */
export async function verifyListingManageAccess(
  listingId: string,
  userId: string,
): Promise<ListingAccess> {
  // Owner path: join to shops and match the owner in a single query.
  const { data: owned } = await supabase
    .from('listings')
    .select('id, shop_id, shops!inner(user_id)')
    .eq('id', listingId)
    .eq('shops.user_id', userId)
    .maybeSingle()

  if (owned) {
    return { success: true, listingId, shopId: owned.shop_id, accessType: 'owner' }
  }

  // Admin path: any existing listing is manageable.
  if (await isAdminUser(userId)) {
    const { data: listing } = await supabase
      .from('listings')
      .select('id, shop_id')
      .eq('id', listingId)
      .maybeSingle()

    if (listing) {
      return { success: true, listingId, shopId: listing.shop_id, accessType: 'admin' }
    }
    return { success: false, listingId, shopId: null, accessType: null, error: 'Listing not found' }
  }

  return {
    success: false,
    listingId,
    shopId: null,
    accessType: null,
    error: 'Listing not found or access denied',
  }
}

/** Verify the user owns (or admins) the shop that a mutation targets. */
export async function verifyShopManageAccess(
  shopId: string,
  userId: string,
): Promise<{ success: boolean; accessType: 'owner' | 'admin' | null; error?: string }> {
  const { data: shop } = await supabase
    .from('shops')
    .select('id, user_id')
    .eq('id', shopId)
    .maybeSingle()

  if (shop && shop.user_id === userId) return { success: true, accessType: 'owner' }
  if (await isAdminUser(userId)) return { success: true, accessType: 'admin' }
  return { success: false, accessType: null, error: 'Shop not found or access denied' }
}
