/**
 * Vendor Order Service
 *
 * Vendor-specific order management, migrated from the legacy
 * `vendorOrderService`. Every function resolves the acting user and verifies
 * access (shop **owner** or **admin**) before touching data; results come back
 * in the shared `OrderServiceResponse` envelope with friendly errors.
 *
 * Improvements over the legacy service:
 *  - Owner **or** admin access (admins can operate on any shop's orders).
 *  - No manual "sync main order status" write — the DB trigger
 *    `sync_order_status_from_items` handles that (and logs it) automatically.
 *  - No console/logger noise; strict typing throughout.
 */

import { supabase } from '~/lib/supabase'
import { USER_ROLES } from '~/lib/profile/profile.type'

import {
  fail,
  isAdminUser,
  ok,
  resolveUserId,
  verifyOrderItemAccess,
  verifyVendorShopAccess,
} from '~/lib/orders/order.access'
import { ORDER_DEFAULTS, VENDOR_EDITABLE_ITEM_FIELDS, type OrderStatus } from '~/lib/orders/order.constants'
import { validateStatusTransition } from '~/lib/orders/order.utils'
import { transformVendorOrderItems } from '~/lib/orders/vendor-orders.utils'
import type {
  OrderServiceResponse,
  PaginatedVendorOrders,
  VendorOrderAnalytics,
  VendorOrderFilters,
  VendorOrderItem,
  VendorOrderPagination,
  VendorOrderSearchParams,
  VendorOrderSummary,
  VendorTopProduct,
} from '~/lib/orders/vendor-orders.type'

/** Last 7 UTC days of distinct order counts (index 0 = 6 days ago … 6 = today). */
function buildEngagementSeries(
  rows: Array<{
    created_at?: string | null
    orders: { id: string; created_at?: string | null } | null
  }>,
): number[] {
  const dayCounts = [0, 0, 0, 0, 0, 0, 0]
  const seenOrderDay = new Set<string>()
  const today = new Date()
  today.setUTCHours(0, 0, 0, 0)
  for (const row of rows) {
    const orderId = row.orders?.id
    const raw = row.orders?.created_at ?? row.created_at
    if (!orderId || !raw) continue
    const created = new Date(raw)
    created.setUTCHours(0, 0, 0, 0)
    const diffDays = Math.round((today.getTime() - created.getTime()) / 86_400_000)
    if (diffDays < 0 || diffDays > 6) continue
    const key = `${orderId}:${diffDays}`
    if (seenOrderDay.has(key)) continue
    seenOrderDay.add(key)
    dayCounts[6 - diffDays] += 1
  }
  return dayCounts
}

// A rich select shared by list + detail reads.
const ORDER_DELIVERY_SELECT = `
  tracking_number,
  delivery_address,
  delivery_status,
  estimated_delivery_date,
  actual_delivery_date,
  delivery_mode,
  carrier_name,
  carrier_tracking_url,
  courier_service_name,
  awb_code,
  label_url,
  invoice_url,
  manifest_url,
  shipped_at,
  delivered_at,
  delivery_instructions
`

const VENDOR_ORDER_SELECT = `
  *,
  orders!inner (
    id,
    order_number,
    order_status,
    subtotal_amount,
    shipping_amount,
    tax_amount,
    discount_amount,
    total_amount,
    currency,
    customer_currency,
    customer_country,
    customer_notes,
    created_at,
    updated_at,
    billing_address:addresses!billing_address_id (
      address_line_1, address_line_2, city, state, country, postal_code, address_label
    ),
    shipping_address:addresses!shipping_address_id (
      address_line_1, address_line_2, city, state, country, postal_code, address_label
    ),
    profiles!user_id ( full_name, phone, email )
  ),
  listings (
    id,
    title,
    listing_images ( id, image_url, is_primary, display_order, image_metadata )
  ),
  order_delivery ( ${ORDER_DELIVERY_SELECT} )
`

function paginationMeta(page: number, limit: number, total: number) {
  return { page, limit, total, total_pages: Math.ceil(total / limit) }
}

// ============= READS =============

/** Paginated, filterable order items for one vendor shop (owner or admin). */
export async function getVendorOrders(
  vendorId: string,
  filters: VendorOrderFilters = {},
  pagination: VendorOrderPagination = {},
  userId?: string | null,
): Promise<OrderServiceResponse<PaginatedVendorOrders>> {
  const id = await resolveUserId(userId)
  if (!id) return fail('User not authenticated')
  if (!vendorId) return fail('A shop is required.')

  try {
    const access = await verifyVendorShopAccess(vendorId, id)
    if (!access.success) return fail(access.error)

    const page = pagination.page ?? ORDER_DEFAULTS.PAGE
    const limit = pagination.limit ?? ORDER_DEFAULTS.PAGE_SIZE
    const orderBy = pagination.order_by ?? 'created_at'
    const ascending = pagination.order_direction === 'asc'
    const offset = (page - 1) * limit

    let query = supabase
      .from('order_items')
      .select(VENDOR_ORDER_SELECT, { count: 'exact' })
      .eq('vendor_id', vendorId)

    if (filters.status) query = query.eq('item_status', filters.status)
    if (filters.order_number) query = query.ilike('orders.order_number', `%${filters.order_number}%`)
    if (filters.date_from) query = query.gte('orders.created_at', filters.date_from)
    if (filters.date_to) query = query.lte('orders.created_at', filters.date_to)

    const { data, error, count } = await query
      .order(orderBy, { ascending })
      .range(offset, offset + limit - 1)

    if (error) return fail(error)

    return ok({
      items: transformVendorOrderItems(data as unknown as VendorOrderItem[]),
      pagination: paginationMeta(page, limit, count ?? 0),
    })
  } catch (error) {
    return fail(error)
  }
}

/** Full detail for a single order item (owner or admin). */
export async function getVendorOrderItem(
  orderItemId: string,
  userId?: string | null,
): Promise<OrderServiceResponse<VendorOrderItem>> {
  const id = await resolveUserId(userId)
  if (!id) return fail('User not authenticated')

  try {
    const access = await verifyOrderItemAccess(orderItemId, id)
    if (!access.success) return fail(access.error)

    const { data, error } = await supabase
      .from('order_items')
      .select(
        `
        *,
        orders!inner (
          id, order_number, order_status,
          subtotal_amount, shipping_amount, tax_amount, discount_amount,
          total_amount, currency, customer_currency, customer_country,
          created_at, updated_at,
          customer_notes, special_instructions,
          billing_address:addresses!billing_address_id (*),
          shipping_address:addresses!shipping_address_id (*),
          profiles!user_id ( full_name, email, phone ),
          order_status_logs ( * )
        ),
        listings ( id, title, description, listing_images ( id, image_url, is_primary, display_order, image_metadata ) ),
        shops!vendor_id ( id, shop_name, user_id ),
        order_delivery ( ${ORDER_DELIVERY_SELECT} )
      `,
      )
      .eq('id', orderItemId)
      .single()

    if (error) return fail(error)

    const [item] = transformVendorOrderItems([data as unknown as VendorOrderItem])
    return ok(item)
  } catch (error) {
    return fail(error)
  }
}

// ============= STATUS MUTATIONS =============

/**
 * Best-effort audit log for an item-level status change. Never throws — a
 * logging failure must not fail the primary update. (The DB trigger separately
 * logs order-level unification.)
 */
async function logOrderStatusChange(
  orderId: string,
  fromStatus: OrderStatus | null,
  toStatus: OrderStatus,
  changedBy: string,
  note?: string | null,
): Promise<void> {
  try {
    await supabase.from('order_status_logs').insert({
      order_id: orderId,
      from_status: fromStatus,
      to_status: toStatus,
      changed_by: changedBy,
      note: note ?? null,
      system_generated: false,
    })
  } catch {
    // Swallow — audit logging is non-critical.
  }
}

/** Update a single order item's status (validates the transition first). */
export async function updateOrderItemStatus(
  orderItemId: string,
  newStatus: OrderStatus,
  note?: string | null,
  userId?: string | null,
): Promise<OrderServiceResponse<VendorOrderItem>> {
  const id = await resolveUserId(userId)
  if (!id) return fail('User not authenticated')

  try {
    const access = await verifyOrderItemAccess(orderItemId, id)
    if (!access.success) return fail(access.error)

    const role = access.accessType === 'admin' ? USER_ROLES.ADMIN : USER_ROLES.VENDOR
    const transition = validateStatusTransition(access.itemStatus, newStatus, role)
    if (!transition.isValid) return fail(transition.error ?? 'Invalid status transition.')

    const { data, error } = await supabase
      .from('order_items')
      .update({ item_status: newStatus, updated_at: new Date().toISOString() })
      .eq('id', orderItemId)
      .select('*')
      .single()

    if (error) return fail(error)

    // The `sync_order_status_from_items` DB trigger updates the parent order
    // status automatically; we only add an item-level audit note.
    if (access.orderId) {
      await logOrderStatusChange(access.orderId, access.itemStatus as OrderStatus, newStatus, id, note)
    }

    return ok(data as unknown as VendorOrderItem)
  } catch (error) {
    return fail(error)
  }
}

/** Update many items to the same status at once (all must be owner/admin). */
export async function bulkUpdateOrderItemStatus(
  orderItemIds: string[],
  newStatus: OrderStatus,
  note?: string | null,
  userId?: string | null,
): Promise<OrderServiceResponse<VendorOrderItem[]>> {
  const id = await resolveUserId(userId)
  if (!id) return fail('User not authenticated')
  if (!Array.isArray(orderItemIds) || orderItemIds.length === 0) {
    return fail('Select at least one order item.')
  }

  try {
    const admin = await isAdminUser(id)

    // Verify ownership of every item in a single query (admins skip the check).
    const { data: items, error: itemsError } = await supabase
      .from('order_items')
      .select('id, item_status, order_id, shops!vendor_id(user_id)')
      .in('id', orderItemIds)

    if (itemsError) return fail(itemsError)
    if (!items || items.length === 0) return fail('Order items not found')

    if (!admin) {
      const unauthorized = items.some(
        (item) => (item.shops as { user_id: string } | null)?.user_id !== id,
      )
      if (unauthorized) return fail('Access denied to some order items')
    }

    const { data, error } = await supabase
      .from('order_items')
      .update({ item_status: newStatus, updated_at: new Date().toISOString() })
      .in('id', orderItemIds)
      .select('*')

    if (error) return fail(error)

    // Best-effort audit per affected order.
    const orderIds = [...new Set(items.map((item) => item.order_id))]
    await Promise.all(
      orderIds.map((orderId) => logOrderStatusChange(orderId, null, newStatus, id, note)),
    )

    return ok(data as unknown as VendorOrderItem[])
  } catch (error) {
    return fail(error)
  }
}

/** Update vendor-editable fields on an order item (status / digital delivery). */
export async function updateVendorOrderItem(
  orderItemId: string,
  updates: Record<string, unknown>,
  userId?: string | null,
): Promise<OrderServiceResponse<VendorOrderItem>> {
  const id = await resolveUserId(userId)
  if (!id) return fail('User not authenticated')

  try {
    const access = await verifyOrderItemAccess(orderItemId, id)
    if (!access.success) return fail(access.error)

    const allowed: (typeof VENDOR_EDITABLE_ITEM_FIELDS)[number][] = [...VENDOR_EDITABLE_ITEM_FIELDS]
    const filtered = Object.fromEntries(
      Object.entries(updates).filter(([key]) => allowed.includes(key as never)),
    )
    if (Object.keys(filtered).length === 0) return fail('No valid vendor fields to update.')

    // If the status is changing, enforce the transition rules.
    if (typeof filtered.item_status === 'string' && filtered.item_status !== access.itemStatus) {
      const role = access.accessType === 'admin' ? USER_ROLES.ADMIN : USER_ROLES.VENDOR
      const transition = validateStatusTransition(
        access.itemStatus,
        filtered.item_status as OrderStatus,
        role,
      )
      if (!transition.isValid) return fail(transition.error ?? 'Invalid status transition.')
    }

    const { data, error } = await supabase
      .from('order_items')
      .update({ ...filtered, updated_at: new Date().toISOString() })
      .eq('id', orderItemId)
      .select(
        `*, orders ( id, order_number, order_status ), listings ( id, title, listing_images ( id, image_url, is_primary, display_order, image_metadata ) )`,
      )
      .single()

    if (error) return fail(error)

    const [item] = transformVendorOrderItems([data as unknown as VendorOrderItem])
    return ok(item)
  } catch (error) {
    return fail(error)
  }
}

// ============= ANALYTICS / SUMMARY =============

function windowRange(days: number, from?: string | null, to?: string | null) {
  return {
    from: from ?? new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString(),
    to: to ?? new Date().toISOString(),
  }
}

/** Aggregate revenue / counts / status distribution for a shop over a window. */
export async function getVendorOrderAnalytics(
  vendorId: string,
  filters: { date_from?: string; date_to?: string } = {},
  userId?: string | null,
): Promise<OrderServiceResponse<VendorOrderAnalytics>> {
  const id = await resolveUserId(userId)
  if (!id) return fail('User not authenticated')

  try {
    const access = await verifyVendorShopAccess(vendorId, id)
    if (!access.success) return fail(access.error)

    const period = windowRange(ORDER_DEFAULTS.ANALYTICS_WINDOW_DAYS, filters.date_from, filters.date_to)

    const { data, error } = await supabase
      .from('order_items')
      .select(
        `id, quantity, total_price, item_status, created_at, orders!inner ( id, order_status, created_at )`,
      )
      .eq('vendor_id', vendorId)
      .gte('orders.created_at', period.from)
      .lte('orders.created_at', period.to)

    if (error) return fail(error)

    const rows = (data ?? []) as unknown as {
      quantity: number
      total_price: number
      created_at?: string | null
      orders: { id: string; order_status: OrderStatus; created_at?: string | null } | null
    }[]

    const totalOrders = new Set(rows.map((r) => r.orders?.id).filter(Boolean)).size
    const totalRevenue = rows.reduce((sum, r) => sum + (Number(r.total_price) || 0), 0)
    const totalItems = rows.reduce((sum, r) => sum + (Number(r.quantity) || 0), 0)
    const statusDistribution = rows.reduce<Record<string, number>>((acc, r) => {
      const status = r.orders?.order_status
      if (status) acc[status] = (acc[status] ?? 0) + 1
      return acc
    }, {})

    const engagement_series = buildEngagementSeries(rows)

    return ok({
      total_orders: totalOrders,
      total_revenue: totalRevenue,
      total_items: totalItems,
      average_order_value: totalOrders > 0 ? totalRevenue / totalOrders : 0,
      status_distribution: statusDistribution,
      engagement_series,
      period,
    })
  } catch (error) {
    return fail(error)
  }
}

/** Richer dashboard summary: metrics, distributions, top products, recent orders. */
export async function getVendorOrderSummary(
  vendorId: string,
  options: { date_from?: string; date_to?: string } = {},
  userId?: string | null,
): Promise<OrderServiceResponse<VendorOrderSummary>> {
  const id = await resolveUserId(userId)
  if (!id) return fail('User not authenticated')

  try {
    const access = await verifyVendorShopAccess(vendorId, id)
    if (!access.success) return fail(access.error)

    const period = windowRange(ORDER_DEFAULTS.SUMMARY_WINDOW_DAYS, options.date_from, options.date_to)

    const { data, error } = await supabase
      .from('order_items')
      .select(
        `
        id, quantity, total_price, item_status, created_at,
        orders!inner ( id, order_number, order_status, total_amount, created_at, profiles!user_id ( full_name ) ),
        listings ( id, title, listing_type )
        `,
      )
      .eq('vendor_id', vendorId)
      .gte('orders.created_at', period.from)
      .lte('orders.created_at', period.to)
      .order('created_at', { ascending: false })

    if (error) return fail(error)

    const rows = (data ?? []) as unknown as {
      quantity: number
      total_price: number
      item_status: OrderStatus
      orders: {
        id: string
        order_number: string | null
        order_status: OrderStatus
        created_at: string | null
        profiles?: { full_name?: string | null } | null
      } | null
      listings: { id: string; title: string } | null
    }[]

    const totalOrders = new Set(rows.map((r) => r.orders?.id).filter(Boolean)).size
    const totalRevenue = rows.reduce((sum, r) => sum + (Number(r.total_price) || 0), 0)
    const totalItems = rows.reduce((sum, r) => sum + (Number(r.quantity) || 0), 0)

    const orderStatusDistribution = rows.reduce<Record<string, number>>((acc, r) => {
      const status = r.orders?.order_status
      if (status) acc[status] = (acc[status] ?? 0) + 1
      return acc
    }, {})
    const itemStatusDistribution = rows.reduce<Record<string, number>>((acc, r) => {
      if (r.item_status) acc[r.item_status] = (acc[r.item_status] ?? 0) + 1
      return acc
    }, {})

    const productSales = new Map<string, VendorTopProduct>()
    for (const r of rows) {
      const listing = r.listings
      if (!listing) continue
      const existing = productSales.get(listing.id) ?? {
        id: listing.id,
        title: listing.title,
        quantity_sold: 0,
        revenue: 0,
      }
      existing.quantity_sold += Number(r.quantity) || 0
      existing.revenue += Number(r.total_price) || 0
      productSales.set(listing.id, existing)
    }
    const topProducts = [...productSales.values()].sort((a, b) => b.revenue - a.revenue).slice(0, 5)

    const recentOrders = rows.slice(0, 10).map((r) => ({
      order_id: r.orders?.id ?? '',
      order_number: r.orders?.order_number ?? null,
      customer_name: r.orders?.profiles?.full_name ?? null,
      amount: Number(r.total_price) || 0,
      status: r.orders?.order_status ?? null,
      created_at: r.orders?.created_at ?? null,
    }))

    return ok({
      summary: {
        total_orders: totalOrders,
        total_revenue: totalRevenue,
        total_items: totalItems,
        average_order_value: totalOrders > 0 ? totalRevenue / totalOrders : 0,
      },
      status_distribution: { orders: orderStatusDistribution, items: itemStatusDistribution },
      top_products: topProducts,
      recent_orders: recentOrders,
      period,
    })
  } catch (error) {
    return fail(error)
  }
}

/** Search a vendor's order items across common criteria. */
export async function searchVendorOrders(
  vendorId: string,
  params: VendorOrderSearchParams = {},
  userId?: string | null,
): Promise<OrderServiceResponse<PaginatedVendorOrders>> {
  const id = await resolveUserId(userId)
  if (!id) return fail('User not authenticated')

  try {
    const access = await verifyVendorShopAccess(vendorId, id)
    if (!access.success) return fail(access.error)

    const page = params.page ?? ORDER_DEFAULTS.PAGE
    const limit = params.limit ?? ORDER_DEFAULTS.PAGE_SIZE
    const offset = (page - 1) * limit

    let query = supabase
      .from('order_items')
      .select(
        `
        *,
        orders!inner ( id, order_number, order_status, total_amount, created_at, profiles!user_id ( full_name, email ) ),
        listings ( id, title, listing_images ( id, image_url, is_primary, display_order, image_metadata ) )
        `,
        { count: 'exact' },
      )
      .eq('vendor_id', vendorId)

    if (params.status) query = query.eq('orders.order_status', params.status)
    if (params.date_from) query = query.gte('orders.created_at', params.date_from)
    if (params.date_to) query = query.lte('orders.created_at', params.date_to)
    if (params.min_amount !== undefined) query = query.gte('total_price', params.min_amount)
    if (params.max_amount !== undefined) query = query.lte('total_price', params.max_amount)
    if (params.order_number) query = query.ilike('orders.order_number', `%${params.order_number}%`)
    if (params.product_name) query = query.ilike('product_title', `%${params.product_name}%`)
    if (params.query) query = query.ilike('product_title', `%${params.query}%`)

    const { data, error, count } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) return fail(error)

    return ok({
      items: transformVendorOrderItems(data as unknown as VendorOrderItem[]),
      pagination: paginationMeta(page, limit, count ?? 0),
    })
  } catch (error) {
    return fail(error)
  }
}

// ============= ADMIN =============
//
// Platform-wide reads for an admin dashboard. These span every vendor; access
// is gated by the admin role here and enforced by RLS on the server.

/** All order items across the platform (admin only), filterable + paginated. */
export async function getAllOrderItemsForAdmin(
  params: VendorOrderSearchParams = {},
  userId?: string | null,
): Promise<OrderServiceResponse<PaginatedVendorOrders>> {
  const id = await resolveUserId(userId)
  if (!id) return fail('User not authenticated')

  try {
    if (!(await isAdminUser(id))) return fail('Access denied for admin operations')

    const page = params.page ?? ORDER_DEFAULTS.PAGE
    const limit = params.limit ?? ORDER_DEFAULTS.PAGE_SIZE
    const offset = (page - 1) * limit

    let query = supabase
      .from('order_items')
      .select(VENDOR_ORDER_SELECT, { count: 'exact' })

    if (params.status) query = query.eq('item_status', params.status)
    if (params.date_from) query = query.gte('orders.created_at', params.date_from)
    if (params.date_to) query = query.lte('orders.created_at', params.date_to)
    if (params.order_number) query = query.ilike('orders.order_number', `%${params.order_number}%`)
    if (params.product_name) query = query.ilike('product_title', `%${params.product_name}%`)

    const { data, error, count } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) return fail(error)

    return ok({
      items: transformVendorOrderItems(data as unknown as VendorOrderItem[]),
      pagination: paginationMeta(page, limit, count ?? 0),
    })
  } catch (error) {
    return fail(error)
  }
}

/** Platform-wide order analytics (admin only), across all vendors. */
export async function getPlatformOrderAnalytics(
  filters: { date_from?: string; date_to?: string } = {},
  userId?: string | null,
): Promise<OrderServiceResponse<VendorOrderAnalytics>> {
  const id = await resolveUserId(userId)
  if (!id) return fail('User not authenticated')

  try {
    if (!(await isAdminUser(id))) return fail('Access denied for admin operations')

    const period = windowRange(ORDER_DEFAULTS.ANALYTICS_WINDOW_DAYS, filters.date_from, filters.date_to)

    const { data, error } = await supabase
      .from('order_items')
      .select(`id, quantity, total_price, orders!inner ( id, order_status, created_at )`)
      .gte('orders.created_at', period.from)
      .lte('orders.created_at', period.to)

    if (error) return fail(error)

    const rows = (data ?? []) as unknown as {
      quantity: number
      total_price: number
      orders: { id: string; order_status: OrderStatus; created_at?: string | null } | null
    }[]

    const totalOrders = new Set(rows.map((r) => r.orders?.id).filter(Boolean)).size
    const totalRevenue = rows.reduce((sum, r) => sum + (Number(r.total_price) || 0), 0)
    const totalItems = rows.reduce((sum, r) => sum + (Number(r.quantity) || 0), 0)
    const statusDistribution = rows.reduce<Record<string, number>>((acc, r) => {
      const status = r.orders?.order_status
      if (status) acc[status] = (acc[status] ?? 0) + 1
      return acc
    }, {})

    return ok({
      total_orders: totalOrders,
      total_revenue: totalRevenue,
      total_items: totalItems,
      average_order_value: totalOrders > 0 ? totalRevenue / totalOrders : 0,
      status_distribution: statusDistribution,
      engagement_series: buildEngagementSeries(rows),
      period,
    })
  } catch (error) {
    return fail(error)
  }
}
