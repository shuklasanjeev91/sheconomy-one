import { describe, expect, it } from 'vitest'

import { resolveMarketplaceTrustNotificationPath } from '~/lib/notifications/marketplace-notification-path'
import { commerceRoutes, vendorRoutes } from '~/lib/routes'

describe('marketplace trust notification deep links', () => {
  it('routes seller return requests to vendor orders', () => {
    expect(
      resolveMarketplaceTrustNotificationPath({
        type: 'order_return_requested_seller',
        contextType: 'order',
        contextId: '11111111-1111-1111-1111-111111111111',
      }),
    ).toBe(vendorRoutes.orders)
  })

  it('routes buyer issue resolution to the exact order detail', () => {
    const orderId = '22222222-2222-2222-2222-222222222222'
    expect(
      resolveMarketplaceTrustNotificationPath({
        type: 'order_issue_resolved_buyer',
        contextType: 'order',
        contextId: orderId,
      }),
    ).toBe(commerceRoutes.order(orderId))
  })

  it('prefers action_url for pending refund notices', () => {
    const orderId = '33333333-3333-3333-3333-333333333333'
    expect(
      resolveMarketplaceTrustNotificationPath({
        type: 'order_refund_pending_buyer',
        contextType: 'order',
        contextId: orderId,
        actionUrl: `https://sheconomy.in/orders/${orderId}`,
      }),
    ).toBe(`/orders/${orderId}`)
  })

  it('routes listing review notices to the listing', () => {
    const listingId = '44444444-4444-4444-4444-444444444444'
    expect(
      resolveMarketplaceTrustNotificationPath({
        type: 'listing_review_received_seller',
        contextType: 'listing',
        contextId: listingId,
      }),
    ).toBe(commerceRoutes.listing(listingId))
  })

  it('ignores unrelated notification types', () => {
    expect(
      resolveMarketplaceTrustNotificationPath({
        type: 'new_order',
        contextType: 'order',
        contextId: '55555555-5555-5555-5555-555555555555',
      }),
    ).toBeNull()
  })

  it('routes customer shipment updates to order detail', () => {
    const orderId = '66666666-6666-6666-6666-666666666666'
    expect(
      resolveMarketplaceTrustNotificationPath({
        type: 'order_shipped_customer',
        contextType: 'order',
        contextId: orderId,
      }),
    ).toBe(commerceRoutes.order(orderId))
    expect(
      resolveMarketplaceTrustNotificationPath({
        type: 'delivery_failed_customer',
        contextType: 'order',
        contextId: orderId,
        actionUrl: `/orders/${orderId}`,
      }),
    ).toBe(`/orders/${orderId}`)
  })

  it('routes seller delivery updates to vendor orders', () => {
    expect(
      resolveMarketplaceTrustNotificationPath({
        type: 'order_delivered_seller',
        contextType: 'order_delivery',
        contextId: '77777777-7777-7777-7777-777777777777',
      }),
    ).toBe(vendorRoutes.orders)
  })
})
