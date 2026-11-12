/**
 * Vendor-orders specific helpers: normalising the joined query rows into the
 * shape the UI expects, plus pure client-side aggregations over the loaded set.
 */

import { ORDER_STATUS, type OrderStatus } from '~/lib/orders/order.constants'
import type {
  OrderAddressSummary,
  OrderDeliverySummary,
  OrderListingSummary,
  VendorOrderItem,
  VendorOrderStats,
} from '~/lib/orders/vendor-orders.type'

// Re-export the shared status helpers so the vendor module is a one-stop import.
export {
  formatOrderAmount,
  formatOrderDate,
  getOrderStatusDisplay,
  getOrderProgress,
  getNextPossibleStatuses,
  isValidStatusTransition,
  validateStatusTransition,
} from '~/lib/orders/order.utils'

/** Pick the primary image URL from a listing's images (is_primary, else lowest order). */
export function resolvePrimaryImage(listing: OrderListingSummary | null | undefined): string | null {
  if (!listing) return null
  const images = Array.isArray(listing.listing_images) ? listing.listing_images : []
  if (images.length === 0) return listing.main_image_url ?? null
  const primary =
    images.find((img) => img.is_primary) ??
    [...images].sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0))[0]
  return primary?.image_url ?? listing.main_image_url ?? null
}

function firstDelivery(
  delivery: VendorOrderItem['order_delivery'],
): OrderDeliverySummary | null {
  if (!delivery) return null
  return Array.isArray(delivery) ? delivery[0] ?? null : delivery
}

/** Coerce delivery JSON / address rows into a consistent address summary. */
export function normalizeOrderAddress(value: unknown): OrderAddressSummary | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const raw = value as Record<string, unknown>
  const pick = (key: string): string | null => {
    const v = raw[key]
    if (typeof v !== 'string') return null
    const trimmed = v.trim()
    return trimmed.length > 0 ? trimmed : null
  }
  const address: OrderAddressSummary = {
    address_line_1: pick('address_line_1'),
    address_line_2: pick('address_line_2'),
    city: pick('city'),
    state: pick('state'),
    country: pick('country'),
    postal_code: pick('postal_code'),
    address_label: pick('address_label'),
  }
  const hasContent = Object.values(address).some(Boolean)
  return hasContent ? address : null
}

/**
 * Prefer the delivery snapshot, then the order shipping address row, then billing.
 * Vendors need the ship-to address even when payment is still pending.
 */
export function resolveVendorShippingAddress(item: VendorOrderItem): OrderAddressSummary | null {
  const delivery = firstDelivery(item.order_delivery)
  return (
    normalizeOrderAddress(delivery?.delivery_address) ??
    normalizeOrderAddress(item.shipping_address) ??
    normalizeOrderAddress(item.orders?.shipping_address) ??
    normalizeOrderAddress(item.billing_address) ??
    normalizeOrderAddress(item.orders?.billing_address)
  )
}

export function resolveVendorOrderDelivery(
  item: VendorOrderItem,
): OrderDeliverySummary | null {
  return firstDelivery(item.order_delivery)
}

/**
 * Normalise a raw joined order item: attach the primary image, and surface
 * `shipping_address` (from delivery / order) and `billing_address` (from the order) as
 * top-level convenience fields.
 */
export function transformVendorOrderItem(item: VendorOrderItem): VendorOrderItem {
  const listing = item.listings ?? item.listing ?? null
  const mainImageUrl = resolvePrimaryImage(listing)
  const enrichedListing: OrderListingSummary | null = listing
    ? { ...listing, main_image_url: mainImageUrl ?? listing.main_image_url ?? null }
    : null

  const delivery = firstDelivery(item.order_delivery)
  const shippingAddress =
    normalizeOrderAddress(delivery?.delivery_address) ??
    normalizeOrderAddress(item.orders?.shipping_address) ??
    null

  return {
    ...item,
    listings: enrichedListing,
    listing: enrichedListing,
    shipping_address: shippingAddress,
    billing_address: normalizeOrderAddress(item.orders?.billing_address),
  }
}

export function transformVendorOrderItems(items: VendorOrderItem[] | null | undefined): VendorOrderItem[] {
  if (!Array.isArray(items)) return []
  return items.map(transformVendorOrderItem)
}

// ============= CLIENT-SIDE AGGREGATIONS =============

// 'awaiting_payment' is intentionally excluded: online payment orders in that
// state have not been paid yet and should not be visible/actionable by vendors.
// Paid marketplace orders auto-accept into processing; COD stays pending until Accept.
const PENDING_STATUSES: OrderStatus[] = [
  ORDER_STATUS.PENDING,    // COD orders — payment on delivery, actionable immediately
  ORDER_STATUS.CONFIRMED,  // Legacy online path
  ORDER_STATUS.PROCESSING, // Paid marketplace — ready to create shipping label
]

export function getVendorOrdersByStatus(
  items: VendorOrderItem[],
  status: OrderStatus,
): VendorOrderItem[] {
  return items.filter((item) => item.orders?.order_status === status)
}

export function getPendingVendorOrders(items: VendorOrderItem[]): VendorOrderItem[] {
  return items.filter(
    (item) => item.orders?.order_status && PENDING_STATUSES.includes(item.orders.order_status),
  )
}

export function getRecentVendorOrders(items: VendorOrderItem[], limit = 10): VendorOrderItem[] {
  return [...items]
    .sort((a, b) => {
      const aTime = new Date(a.orders?.created_at ?? 0).getTime()
      const bTime = new Date(b.orders?.created_at ?? 0).getTime()
      return bTime - aTime
    })
    .slice(0, limit)
}

export function getVendorTotalRevenue(items: VendorOrderItem[]): number {
  return items.reduce((total, item) => total + (Number(item.total_price) || 0), 0)
}

/** Tally the loaded items by parent order status. */
export function computeVendorOrderStats(items: VendorOrderItem[]): VendorOrderStats {
  const stats: VendorOrderStats = {
    total: items.length,
    pending: 0,
    processing: 0,
    shipped: 0,
    delivered: 0,
    cancelled: 0,
  }

  for (const item of items) {
    const status = item.orders?.order_status
    if (status && status in stats) {
      stats[status as keyof Omit<VendorOrderStats, 'total'>] += 1
    }
  }

  return stats
}
