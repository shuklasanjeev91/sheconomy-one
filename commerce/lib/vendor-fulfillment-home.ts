import type { EnrichedFulfillment } from '~/lib/orders/fulfillment.type'
import { getVendorFulfillments } from '~/lib/orders/fulfillment.service'
import {
  getFulfillmentControlRow,
  isOverdueFulfillment,
  needsVendorAction,
  sortFulfillmentsByUrgency,
} from '~/lib/orders/fulfillment.utils'
import { vendorRoutes } from '~/lib/routes'

export type VendorFulfillmentHomeCard = {
  id: string
  title: string
  badge: string
  detail: string
  severity: 'critical' | 'high' | 'medium' | 'low'
  href: string
}

function fulfillmentCardTitle(fulfillment: EnrichedFulfillment) {
  const product = fulfillment.order_items?.product_title?.trim()
  if (product) return product
  const number = fulfillment.fulfillment_number?.trim()
  if (number) return `Fulfilment ${number}`
  return 'Open fulfilment'
}

function fulfillmentCardSeverity(fulfillment: EnrichedFulfillment, now = Date.now()) {
  const control = getFulfillmentControlRow(fulfillment, now)
  if (control.lane === 'exception' || isOverdueFulfillment(fulfillment, now)) return 'critical'
  if (control.lane === 'ready_to_ship') return 'high'
  if (control.lane === 'pack_now' || control.lane === 'pick_now') return 'medium'
  return 'low'
}

function fulfillmentCardDetail(fulfillment: EnrichedFulfillment, now = Date.now()) {
  const control = getFulfillmentControlRow(fulfillment, now)
  const blocker = control.blockers[0]?.label
  if (blocker) return blocker
  const orderNumber = fulfillment.order_items?.orders?.order_number?.trim()
  if (orderNumber) return `Order ${orderNumber}`
  return control.readinessLabel
}

export function buildVendorFulfillmentHomeCards(
  fulfillments: EnrichedFulfillment[],
  limit = 5,
  now = Date.now(),
): VendorFulfillmentHomeCard[] {
  const actionable = sortFulfillmentsByUrgency(
    fulfillments.filter((fulfillment) => needsVendorAction(fulfillment)),
    now,
  )

  return actionable.slice(0, limit).map((fulfillment) => {
    const control = getFulfillmentControlRow(fulfillment, now)
    return {
      id: fulfillment.id,
      title: fulfillmentCardTitle(fulfillment),
      badge: control.laneLabel,
      detail: fulfillmentCardDetail(fulfillment, now),
      severity: fulfillmentCardSeverity(fulfillment, now),
      href: vendorRoutes.ordersSection('fulfillments'),
    }
  })
}

export async function fetchVendorFulfillmentHomeCards(
  shopId: string,
  userId: string,
  limit = 5,
): Promise<{ cards: VendorFulfillmentHomeCard[]; error: string | null }> {
  const result = await getVendorFulfillments(
    shopId,
    { page: 1, limit: 60, sort_by: 'created_at', sort_order: 'asc' },
    userId,
  )

  if (result.error) return { cards: [], error: result.error }

  return {
    cards: buildVendorFulfillmentHomeCards(result.data?.fulfillments ?? [], limit),
    error: null,
  }
}

export function vendorFulfillmentHomeHref() {
  return vendorRoutes.ordersSection('fulfillments')
}
