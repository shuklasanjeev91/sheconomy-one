/**
 * Shared response + access helpers for the category service.
 *
 * Keeping these in one place means every category function resolves identities,
 * verifies permissions and shapes responses identically — no duplication.
 *
 * Access model (ported from the legacy `checkCategoryPermissions`):
 *   - Admins may do everything (create / update / delete / move / assign).
 *   - Vendors may create categories (pending approval) and manage assignments
 *     for their own listings.
 *   - Everyone can read.
 * These checks are a UX convenience; Supabase RLS is the real gate on the row.
 */

import { supabase } from '~/lib/supabase'

// Reuse the generic identity helpers so we don't duplicate auth logic.
import { isAdminUser, resolveUserId } from './listing.access'
import { CATEGORY_ERROR_CODES, createCategoryError, toFriendlyCategoryError } from './listing-categories.errors'
import type { CategoryServiceResponse } from './listing-categories.type'

export { isAdminUser, resolveUserId }

export function ok<T>(data: T): CategoryServiceResponse<T> {
  return { data, error: null, success: true }
}

export function fail<T>(error: unknown, fallback?: string): CategoryServiceResponse<T> {
  return { data: null, error: toFriendlyCategoryError(error, fallback), success: false }
}

/** Category mutations that require elevated privileges. */
export type CategoryWriteOperation = 'create' | 'update' | 'delete' | 'move'

/**
 * Verify that `userId` may perform `operation`. Admins pass everything; vendors
 * are allowed to *create* (their categories land pending approval via RLS).
 * Returns a structured result so callers can branch without throwing.
 */
export async function checkCategoryPermission(
  userId: string | null,
  operation: CategoryWriteOperation,
): Promise<{ allowed: boolean; isAdmin: boolean; error?: string }> {
  if (!userId) {
    return { allowed: false, isAdmin: false, error: CATEGORY_ERROR_CODES.NOT_AUTHENTICATED }
  }

  const admin = await isAdminUser(userId)
  if (admin) return { allowed: true, isAdmin: true }

  if (operation === 'create') {
    const isVendor = await isVendorUser(userId)
    if (isVendor) return { allowed: true, isAdmin: false }
  }

  return { allowed: false, isAdmin: false, error: CATEGORY_ERROR_CODES.PERMISSION_DENIED }
}

/** Whether the given user has the vendor role on their profile. */
export async function isVendorUser(userId: string | null | undefined): Promise<boolean> {
  if (!userId) return false
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .maybeSingle()
    if (error) return false
    return data?.role === 'V'
  } catch {
    return false
  }
}

/**
 * Ensure a category can be safely deleted: it must have no active children and
 * no product assignments. Throws a typed `CategoryError` if not.
 */
export async function assertCategoryDeletable(categoryId: string): Promise<void> {
  const { data: children } = await supabase
    .from('categories')
    .select('category_id')
    .eq('parent_id', categoryId)
    .limit(1)

  if (children && children.length > 0) {
    throw createCategoryError(CATEGORY_ERROR_CODES.HAS_CHILDREN)
  }

  const { data: assignments } = await supabase
    .from('category_assignments')
    .select('id')
    .eq('category_id', categoryId)
    .limit(1)

  if (assignments && assignments.length > 0) {
    throw createCategoryError(CATEGORY_ERROR_CODES.HAS_ASSIGNMENTS)
  }
}

/**
 * Verify the user may attach categories to `listingId`: either they own the
 * shop the listing belongs to, or they are an admin.
 */
export async function verifyListingCategoryAccess(
  listingId: string,
  userId: string,
): Promise<{ allowed: boolean; error?: string }> {
  const { data: owned } = await supabase
    .from('listings')
    .select('id, shops!inner(user_id)')
    .eq('id', listingId)
    .eq('shops.user_id', userId)
    .maybeSingle()

  if (owned) return { allowed: true }
  if (await isAdminUser(userId)) return { allowed: true }
  return { allowed: false, error: CATEGORY_ERROR_CODES.ACCESS_DENIED }
}
