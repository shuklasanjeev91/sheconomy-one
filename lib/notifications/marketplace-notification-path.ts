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
    (type.includes('return_requested') && type.includes('seller'))
  ) {
    return fromUrl && fromUrl.startsWith('/vendor') ? fromUrl : vendorRoutes.orders
  }

  if (
    type === 'order_issue_resolved_buyer' ||
    type === 'order_refund_pending_buyer'
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

  return null
}
