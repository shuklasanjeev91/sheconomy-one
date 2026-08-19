import { fetchCustomerOrderHistory, type CustomerOrderHistoryRow } from '~/commerce/lib/buyer-account'
import { ORDER_STATUS } from '~/lib/orders/order.constants'
import { commerceRoutes } from '~/lib/routes'

export type BuyerPendingPaymentHomeCard = {
  orderId: string
  orderNumber: string
  shopNames: string
  amountLabel: string
  href: string
}

function formatAmount(amount: number | null, currency: string | null) {
  if (amount == null) return 'Payment pending'
  const code = currency?.trim() || 'INR'
  if (code === 'INR') return `₹${amount.toLocaleString('en-IN')}`
  return `${code} ${amount.toLocaleString()}`
}

export function buildBuyerPendingPaymentHomeCards(
  orders: CustomerOrderHistoryRow[],
  limit = 3,
): BuyerPendingPaymentHomeCard[] {
  return orders
    .filter(
      (row) =>
        row.order_status === ORDER_STATUS.AWAITING_PAYMENT ||
        row.order_status === ORDER_STATUS.PAYMENT_FAILED,
    )
    .slice(0, limit)
    .map((row) => ({
      orderId: row.order_id,
      orderNumber: row.order_number?.trim() || row.order_id.slice(0, 8),
      shopNames: row.shop_names?.trim() || 'Your order',
      amountLabel: formatAmount(row.total_amount, row.currency),
      href: String(commerceRoutes.order(row.order_id)),
    }))
}

export async function fetchBuyerPendingPaymentHomeCards(
  userId: string,
  limit = 3,
): Promise<{ cards: BuyerPendingPaymentHomeCard[]; error: string | null }> {
  const result = await fetchCustomerOrderHistory(userId)
  if (result.error) return { cards: [], error: result.error }
  return {
    cards: buildBuyerPendingPaymentHomeCards(result.orders, limit),
    error: null,
  }
}

export function buyerPendingPaymentHref() {
  return commerceRoutes.orders
}
