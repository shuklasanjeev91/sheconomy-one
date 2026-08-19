import {
  fetchBuyerReturnHomeCards,
  type BuyerReturnHomeCard,
} from '~/commerce/lib/buyer-return-home'
import {
  fetchBuyerRtoHomeCards,
  type BuyerRtoHomeCard,
} from '~/commerce/lib/buyer-rto-home'

export type BuyerOrderAttentionKind = 'return' | 'exchange' | 'rto' | 'return_shipment'

export type BuyerOrderAttentionItem = {
  id: string
  orderId: string
  orderNumber: string
  itemTitle: string
  headline: string
  detail: string | null
  kind: BuyerOrderAttentionKind
  priority: number
  trackingUrl: string | null
}

function returnPriority(card: BuyerReturnHomeCard): number {
  if (card.category === 'needs_action') return card.issueKind === 'exchange' ? 0 : 1
  if (card.returnTrackingUrl) return 2
  return 3
}

function rtoPriority(card: BuyerRtoHomeCard): number {
  return card.kind === 'return_shipment' ? 4 : 5
}

export function mergeBuyerOrderAttentionItems(
  returnCards: BuyerReturnHomeCard[],
  rtoCards: BuyerRtoHomeCard[],
  limit = 5,
): BuyerOrderAttentionItem[] {
  const items: BuyerOrderAttentionItem[] = [
    ...returnCards.map((card) => ({
      id: `issue-${card.issueId}`,
      orderId: card.orderId,
      orderNumber: card.orderNumber,
      itemTitle: card.itemTitle,
      headline: card.actionLabel,
      detail: card.actionDetail,
      kind: card.issueKind,
      priority: returnPriority(card),
      trackingUrl: card.returnTrackingUrl,
    })),
    ...rtoCards.map((card) => ({
      id: `delivery-${card.deliveryId}`,
      orderId: card.orderId,
      orderNumber: card.orderNumber,
      itemTitle: card.itemTitle,
      headline: card.label,
      detail: card.detail,
      kind: card.kind,
      priority: rtoPriority(card),
      trackingUrl: card.trackingUrl,
    })),
  ]

  items.sort((a, b) => a.priority - b.priority || a.orderNumber.localeCompare(b.orderNumber))

  const seenOrders = new Set<string>()
  const merged: BuyerOrderAttentionItem[] = []

  for (const item of items) {
    if (seenOrders.has(item.orderId)) continue
    seenOrders.add(item.orderId)
    merged.push(item)
    if (merged.length >= limit) break
  }

  return merged
}

export async function fetchBuyerOrderAttentionItems(
  userId: string,
  limit = 5,
): Promise<{ items: BuyerOrderAttentionItem[]; error: string | null }> {
  const [returns, rto] = await Promise.all([
    fetchBuyerReturnHomeCards(userId, limit),
    fetchBuyerRtoHomeCards(userId, limit),
  ])

  const error = returns.error ?? rto.error
  return {
    items: mergeBuyerOrderAttentionItems(returns.cards, rto.cards, limit),
    error,
  }
}
