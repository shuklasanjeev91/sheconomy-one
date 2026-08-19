import { fetchCustomerOrderHistory, type CustomerOrderHistoryRow } from '~/commerce/lib/buyer-account'
import { ORDER_STATUS } from '~/lib/orders/order.constants'
import { commerceRoutes } from '~/lib/routes'

export type BuyerInTransitHomeCard = {
  orderId: string
  orderNumber: string
  shopNames: string
  statusLabel: string
  detail: string
  href: string
}

const IN_TRANSIT_STATUSES = new Set<string>([
  ORDER_STATUS.PROCESSING,
  ORDER_STATUS.SHIPPED,
  ORDER_STATUS.PARTIALLY_SHIPPED,
  ORDER_STATUS.IN_TRANSIT,
  ORDER_STATUS.OUT_FOR_DELIVERY,
])

function orderStatusLabel(status: string | null) {
  switch (status) {
    case ORDER_STATUS.OUT_FOR_DELIVERY:
      return 'Out for delivery'
    case ORDER_STATUS.IN_TRANSIT:
      return 'In transit'
    case ORDER_STATUS.SHIPPED:
    case ORDER_STATUS.PARTIALLY_SHIPPED:
      return 'Shipped'
    case ORDER_STATUS.PROCESSING:
      return 'Processing'
    default:
      return 'On the way'
  }
}

function orderDetail(row: CustomerOrderHistoryRow) {
  if (row.tracking_numbers?.trim()) return `Tracking: ${row.tracking_numbers.trim()}`
  if (row.progress_percentage != null && row.progress_percentage > 0) {
    return `${row.progress_percentage}% delivered`
  }
  const count = row.item_count ?? 0
  if (count > 0) return `${count} item${count === 1 ? '' : 's'} from ${row.shop_names ?? 'your shop'}`
  return row.shop_names ?? 'Track your package'
}

export function buildBuyerInTransitHomeCards(
  orders: CustomerOrderHistoryRow[],
  limit = 4,
): BuyerInTransitHomeCard[] {
  return orders
    .filter((row) => row.order_status && IN_TRANSIT_STATUSES.has(row.order_status))
    .slice(0, limit)
    .map((row) => ({
      orderId: row.order_id,
      orderNumber: row.order_number?.trim() || row.order_id.slice(0, 8),
      shopNames: row.shop_names?.trim() || 'Your order',
      statusLabel: orderStatusLabel(row.order_status),
      detail: orderDetail(row),
      href: String(commerceRoutes.order(row.order_id)),
    }))
}

export async function fetchBuyerInTransitHomeCards(
  userId: string,
  limit = 4,
): Promise<{ cards: BuyerInTransitHomeCard[]; error: string | null }> {
  const result = await fetchCustomerOrderHistory(userId)
  if (result.error) return { cards: [], error: result.error }
  return {
    cards: buildBuyerInTransitHomeCards(result.orders, limit),
    error: null,
  }
}

export function buyerOrdersHref() {
  return commerceRoutes.orders
}
