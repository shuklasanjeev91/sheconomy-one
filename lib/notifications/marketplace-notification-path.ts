import { commerceRoutes, vendorRoutes } from '~/lib/routes'

export type MarketplaceNotificationPathInput = {
  type?: string | null
  contextType?: string | null
  contextId?: string | null
  actionUrl?: string | null
}

function pathFromUrl(url: string | null | undefined): string | null {
  if (!url) return null
  const trimmed = url.trim()
  if (!trimmed) return null
  if (trimmed.startsWith('/')) return trimmed
  try {
    const parsed = new URL(trimmed)
    return `${parsed.pathname}${parsed.search}${parsed.hash}` || '/'
  } catch {
    return trimmed.startsWith('sheconomy://')
      ? trimmed.replace(/^sheconomy:\/\//, '/')
      : null
  }
}

/**
 * Deep-link targets for marketplace return / refund / review notifications.
 * Kept pure (no React Native imports) so unit tests can cover routing.
 */
export function resolveMarketplaceTrustNotificationPath(
  input: MarketplaceNotificationPathInput,
): string | null {
  const type = (input.type ?? '').toLowerCase()
  const contextType = (input.contextType ?? '').toLowerCase()
  const contextId = input.contextId?.trim() || null
  const fromUrl = pathFromUrl(input.actionUrl)

  if (
    type === 'order_return_requested_seller' ||
    type === 'order_return_tracking_seller' ||
    type === 'order_exchange_requested_seller' ||
    type === 'order_exchange_ready_seller' ||
    (type.includes('return_requested') && type.includes('seller')) ||
    (type.includes('return_tracking') && type.includes('seller')) ||
    (type.includes('exchange') && type.includes('seller'))
  ) {
    return fromUrl && fromUrl.startsWith('/vendor') ? fromUrl : vendorRoutes.orders
  }

  if (
    type === 'order_issue_resolved_buyer' ||
    type === 'order_refund_pending_buyer' ||
    type === 'order_return_pickup_assigned_buyer' ||
    type === 'order_return_rejected_buyer' ||
    type === 'order_rto_completed_buyer' ||
    type === 'order_refund_completed_buyer' ||
    type === 'order_exchange_pickup_assigned_buyer' ||
    type === 'order_exchange_ready_buyer' ||
    type === 'order_exchange_rejected_buyer' ||
    type === 'order_exchange_shipped_buyer' ||
    (type.includes('return') && type.includes('buyer')) ||
    (type.includes('refund') && type.includes('buyer') && !type.includes('seller')) ||
    (type.includes('rto') && type.includes('buyer')) ||
    (type.includes('exchange') && type.includes('buyer'))
  ) {
    if (fromUrl && fromUrl.startsWith('/orders')) return fromUrl
    if (contextId && (contextType === 'order' || type.includes('order'))) {
      return commerceRoutes.order(contextId)
    }
    return commerceRoutes.orders
  }

  if (type === 'listing_review_received_seller') {
    if (fromUrl && fromUrl.startsWith('/listing')) return fromUrl
    if (contextId) return commerceRoutes.listing(contextId)
  }

  // Delivery / courier auto-tracking (customer + vendor)
  if (
    type === 'order_shipped_customer' ||
    type === 'order_item_shipped_customer' ||
    type === 'order_out_for_delivery_customer' ||
    type === 'order_in_transit_customer' ||
    type === 'order_delivered_customer' ||
    type === 'delivery_failed_customer' ||
    type === 'order_review_prompt_customer' ||
    (type.includes('delivery') && type.includes('customer')) ||
    (type.includes('shipped') && type.includes('customer')) ||
    (type.includes('out_for_delivery') && type.includes('customer')) ||
    (type.includes('review_prompt') && type.includes('customer'))
  ) {
    if (fromUrl && fromUrl.startsWith('/orders')) return fromUrl
    if (contextId && (contextType === 'order' || contextType === 'order_delivery' || type.includes('order'))) {
      return commerceRoutes.order(contextId)
    }
    return commerceRoutes.orders
  }

  if (
    type === 'order_shipped_seller' ||
    type === 'order_item_shipped_seller' ||
    type === 'order_out_for_delivery_seller' ||
    type === 'order_in_transit_seller' ||
    type === 'order_delivered_seller' ||
    type === 'delivery_failed_seller' ||
    (type.includes('delivery') && type.includes('seller')) ||
    (type.includes('shipped') && type.includes('seller'))
  ) {
    return fromUrl && fromUrl.startsWith('/vendor') ? fromUrl : vendorRoutes.orders
  }

  return null
}
