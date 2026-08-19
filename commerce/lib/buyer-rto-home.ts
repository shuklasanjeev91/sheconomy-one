import { DELIVERY_STATUS } from '~/lib/orders/order.constants'
import { supabase } from '~/lib/supabase/client'

export type BuyerRtoHomeCard = {
  orderId: string
  orderNumber: string
  deliveryId: string
  itemTitle: string
  label: string
  detail: string
  trackingNumber: string | null
  trackingUrl: string | null
  kind: 'rto' | 'return_shipment'
}

type DeliveryRow = {
  id: string
  delivery_status: string | null
  delivery_mode: string | null
  tracking_number: string | null
  carrier_tracking_url: string | null
  updated_at: string | null
  orders: {
    id: string
    order_number: string
  } | null
  order_items: {
    product_title: string | null
  } | null
}

const RETURN_TRANSIT_STATUSES = new Set<string>([
  DELIVERY_STATUS.SHIPPED,
  DELIVERY_STATUS.IN_TRANSIT,
  DELIVERY_STATUS.OUT_FOR_DELIVERY,
])

export function buildBuyerRtoHomeCards(rows: DeliveryRow[], limit = 4): BuyerRtoHomeCard[] {
  const cards: BuyerRtoHomeCard[] = []

  for (const row of rows) {
    const status = row.delivery_status ?? ''
    const mode = row.delivery_mode ?? 'forward'
    const orderId = row.orders?.id
    if (!orderId) continue

    const itemTitle = row.order_items?.product_title?.trim() || 'Your order item'
    const trackingNumber = row.tracking_number?.trim() || null
    const trackingUrl = row.carrier_tracking_url?.trim() || null
    const orderNumber = row.orders?.order_number ?? orderId

    if (mode === 'return' && RETURN_TRANSIT_STATUSES.has(status)) {
      cards.push({
        orderId,
        orderNumber,
        deliveryId: row.id,
        itemTitle,
        kind: 'return_shipment',
        label: 'Return in transit',
        detail: trackingNumber
          ? `Pickup AWB ${trackingNumber} is on the way back to the shop.`
          : 'Your return shipment is moving back to the shop.',
        trackingNumber,
        trackingUrl,
      })
      continue
    }

    if (mode !== 'return' && status === DELIVERY_STATUS.RETURNED_TO_SENDER) {
      cards.push({
        orderId,
        orderNumber,
        deliveryId: row.id,
        itemTitle,
        kind: 'rto',
        label: 'Package returning to seller',
        detail: trackingNumber
          ? `Courier marked RTO on AWB ${trackingNumber}. Refund processing may follow.`
          : 'The courier could not deliver your package and is returning it to the seller.',
        trackingNumber,
        trackingUrl,
      })
    }
  }

  return cards.slice(0, limit)
}

export async function fetchBuyerRtoHomeCards(
  userId: string,
  limit = 4,
): Promise<{ cards: BuyerRtoHomeCard[]; error: string | null }> {
  const { data, error } = await supabase
    .from('order_delivery')
    .select(
      `
      id,
      delivery_status,
      delivery_mode,
      tracking_number,
      carrier_tracking_url,
      updated_at,
      orders!inner ( id, order_number, user_id ),
      order_items ( product_title )
    `,
    )
    .eq('orders.user_id', userId)
    .in('delivery_status', [
      DELIVERY_STATUS.SHIPPED,
      DELIVERY_STATUS.IN_TRANSIT,
      DELIVERY_STATUS.OUT_FOR_DELIVERY,
      DELIVERY_STATUS.RETURNED_TO_SENDER,
    ])
    .order('updated_at', { ascending: false })
    .limit(24)

  if (error) return { cards: [], error: error.message }

  return {
    cards: buildBuyerRtoHomeCards((data ?? []) as DeliveryRow[], limit),
    error: null,
  }
}
