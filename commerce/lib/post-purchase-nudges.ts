import type { CustomerOrderItem } from '~/commerce/lib/customer-orders'
import { evaluateReorderCandidates } from '~/commerce/lib/customer-order-lifecycle'
import { ORDER_STATUS } from '~/lib/orders/order.constants'

const MAX_SECTION_ITEMS = 4

export type PostPurchaseNudgeItem = {
  itemId: string
  listingId: string
  listingSlug: string | null
  title: string
  imageUrl: string | null
  quantity: number
  listingType: string | null
  source: 'reorder' | 'review' | 'care'
  label: string
  detail: string
}

export type PostPurchaseNudgeSection = {
  key: 'buy_again' | 'review_then_reorder' | 'care_tips'
  title: string
  subtitle: string
  items: PostPurchaseNudgeItem[]
  count: number
  actionLabel: string
  canBulkReorder: boolean
}

export type PostPurchaseNudgesResult = {
  sections: PostPurchaseNudgeSection[]
  counts: {
    buyAgain: number
    reviewThenReorder: number
    careTips: number
  }
}

function isDeliveredStatus(status: string | null | undefined) {
  return status === ORDER_STATUS.DELIVERED || status === ORDER_STATUS.COMPLETED
}

function section(
  key: PostPurchaseNudgeSection['key'],
  title: string,
  subtitle: string,
  items: PostPurchaseNudgeItem[],
  actionLabel: string,
  count = items.length,
): PostPurchaseNudgeSection {
  return {
    key,
    title,
    subtitle,
    items,
    count,
    actionLabel,
    canBulkReorder: key === 'buy_again' && items.length > 1,
  }
}

export function buildPostPurchaseNudges(input: {
  orderStatus: string | null | undefined
  items: CustomerOrderItem[]
}): PostPurchaseNudgesResult {
  const deliveredOrder = isDeliveredStatus(input.orderStatus)
  const candidates = evaluateReorderCandidates(input.items)

  const buyAgainPool = candidates.candidates.map((candidate) => ({
    itemId: candidate.item.id,
    listingId: candidate.item.listing_id,
    listingSlug: candidate.item.listing_slug,
    title: candidate.item.product_title,
    imageUrl: candidate.item.image_url,
    quantity: candidate.item.quantity,
    listingType: candidate.item.listing_type,
    source: 'reorder' as const,
    label: candidate.eligible ? 'Ready to reorder' : 'Reorder blocked',
    detail:
      candidate.reason ??
      (candidate.item.has_review
        ? 'You bought this before and can add it back to cart quickly.'
        : 'Loved it? Buy again with the same variant and quantity.'),
    eligible: candidate.eligible,
  }))

  const readyToReorder = buyAgainPool.filter((item) => item.eligible).slice(0, MAX_SECTION_ITEMS)
  const usedItemIds = new Set(readyToReorder.map((item) => item.itemId))

  const reviewThenReorderPool = input.items
    .filter((item) => !usedItemIds.has(item.id))
    .filter((item) => isDeliveredStatus(item.item_status) || deliveredOrder)
    .filter((item) => !item.has_review && !!item.listing_id)
    .map((item) => ({
      itemId: item.id,
      listingId: item.listing_id,
      listingSlug: item.listing_slug,
      title: item.product_title,
      imageUrl: item.image_url,
      quantity: item.quantity,
      listingType: item.listing_type,
      source: 'review' as const,
      label: 'Review then buy again',
      detail: 'A verified review helps other shoppers and makes this item easier to revisit later.',
    }))
  const reviewThenReorder = reviewThenReorderPool.slice(0, MAX_SECTION_ITEMS)
  for (const item of reviewThenReorder) usedItemIds.add(item.itemId)

  const careTipsPool = input.items
    .filter((item) => !usedItemIds.has(item.id))
    .filter((item) => isDeliveredStatus(item.item_status) || deliveredOrder)
    .map((item) => ({
      itemId: item.id,
      listingId: item.listing_id,
      listingSlug: item.listing_slug,
      title: item.product_title,
      imageUrl: item.image_url,
      quantity: item.quantity,
      listingType: item.listing_type,
      source: 'care' as const,
      label: item.listing_type === 'digital' ? 'Keep your download handy' : 'Care reminder',
      detail:
        item.listing_type === 'digital'
          ? 'Open the item page any time if you need the file details or want to purchase again.'
          : 'Check fit, finish, and packaging while the return window is still fresh in your mind.',
    }))
  const careTips = careTipsPool.slice(0, MAX_SECTION_ITEMS)

  const sections = [
    section(
      'buy_again',
      'Buy again',
      'Items you can quickly bring back into cart from this order.',
      readyToReorder.map(({ eligible: _eligible, ...item }) => item),
      'Reorder all',
      buyAgainPool.filter((item) => item.eligible).length,
    ),
    section(
      'review_then_reorder',
      'Review, then reorder',
      'Capture fresh feedback while the experience is still top of mind.',
      reviewThenReorder,
      'Write review',
      reviewThenReorderPool.length,
    ),
    section(
      'care_tips',
      'Care reminders',
      'Helpful follow-up guidance that keeps buyers confident after delivery.',
      careTips,
      'Open listing',
      careTipsPool.length,
    ),
  ].filter((current) => current.items.length > 0)

  return {
    sections,
    counts: {
      buyAgain: buyAgainPool.filter((item) => item.eligible).length,
      reviewThenReorder: reviewThenReorderPool.length,
      careTips: careTipsPool.length,
    },
  }
}
