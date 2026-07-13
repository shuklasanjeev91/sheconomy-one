/**
 * Shared response + access helpers for the order service modules.
 *
 * Access model: an order item can be managed by the **vendor** who owns the
 * shop it belongs to (`shops.user_id`), or by an **admin**. These checks are a
 * UX convenience; Supabase RLS is the real gate on the row.
 */

import { supabase } from '~/lib/supabase'
import { USER_ROLES } from '~/lib/profile/profile.type'

import { toFriendlyOrderError } from './order.errors'
import type { OrderServiceResponse } from './vendor-orders.type'

export function ok<T>(data: T): OrderServiceResponse<T> {
  return { data, error: null, success: true }
}

export function fail<T>(error: unknown, fallback?: string): OrderServiceResponse<T> {
  return { data: null, error: toFriendlyOrderError(error, fallback), success: false }
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

export type VendorAccess = {
  success: boolean
  accessType: 'owner' | 'admin' | null
  error?: string
}

/**
 * Verify the user may manage the given vendor shop's orders: either they own
 * the shop, or they are an admin.
 */
export async function verifyVendorShopAccess(
  shopId: string,
  userId: string,
): Promise<VendorAccess> {
  const { data: shop } = await supabase
    .from('shops')
    .select('id, user_id')
    .eq('id', shopId)
    .maybeSingle()

  if (shop && shop.user_id === userId) return { success: true, accessType: 'owner' }
  if (await isAdminUser(userId)) return { success: true, accessType: 'admin' }
  return { success: false, accessType: null, error: 'Shop not found or access denied' }
}

export type OrderItemAccess = VendorAccess & {
  orderId: string | null
  itemStatus: string | null
}

/**
 * Verify the user may manage a specific order item: they own the vendor shop
 * the item belongs to, or they are an admin. Returns the parent order id and
 * current item status so callers avoid an extra round-trip.
 */
export async function verifyOrderItemAccess(
  orderItemId: string,
  userId: string,
): Promise<OrderItemAccess> {
  const { data: item } = await supabase
    .from('order_items')
    .select('id, order_id, item_status, shops!vendor_id(user_id)')
    .eq('id', orderItemId)
    .maybeSingle()

  if (!item) {
    return { success: false, accessType: null, orderId: null, itemStatus: null, error: 'Order item not found' }
  }

  const ownerId = (item.shops as { user_id: string } | null)?.user_id ?? null
  if (ownerId && ownerId === userId) {
    return { success: true, accessType: 'owner', orderId: item.order_id, itemStatus: item.item_status }
  }
  if (await isAdminUser(userId)) {
    return { success: true, accessType: 'admin', orderId: item.order_id, itemStatus: item.item_status }
  }
  return {
    success: false,
    accessType: null,
    orderId: null,
    itemStatus: null,
    error: 'Access denied to this order item',
  }
}
