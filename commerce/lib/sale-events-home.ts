import { fetchActiveSaleEvents, type SaleEventSummary } from '~/commerce/lib/sale-events'
import { commerceRoutes } from '~/lib/routes'

export type BuyerSaleEventHomeCard = {
  id: string
  title: string
  detail: string | null
  bannerImage: string | null
  href: string
}

/** Additional live sale events beyond the primary home banner (index 0). */
export function buildBuyerSaleEventHomeCards(
  events: SaleEventSummary[],
  limit = 3,
): BuyerSaleEventHomeCard[] {
  if (events.length < 2) return []

  return events.slice(1, 1 + limit).map((event) => ({
    id: event.id,
    title: event.eventName,
    detail: event.description,
    bannerImage: event.bannerImage,
    href: String(commerceRoutes.browse('featured')),
  }))
}

export async function fetchBuyerSaleEventHomeCards(
  limit = 3,
): Promise<{ cards: BuyerSaleEventHomeCard[]; error: string | null }> {
  const events = await fetchActiveSaleEvents()
  return {
    cards: buildBuyerSaleEventHomeCards(events, limit),
    error: null,
  }
}

export function buyerSaleEventsHomeHref() {
  return commerceRoutes.browse('featured')
}
