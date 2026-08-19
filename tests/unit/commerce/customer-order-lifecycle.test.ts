import { describe, expect, it } from 'vitest'

import {
  buildCustomerOrderTimeline,
  canAssignReturnTracking,
  canCancelReturnOrExchange,
  evaluateReorderCandidates,
  findOpenCancellationRequest,
  getBuyerReturnHubEntries,
  getCustomerOrderActionEligibility,
  getReturnExchangeTimeline,
  getReturnWindowLabel,
  isPendingOrderSuccessExpired,
  parsePendingOrderSuccess,
  PENDING_ORDER_SUCCESS_TTL_MS,
  sanitizeCarrierTrackingUrl,
  serializePendingOrderSuccess,
  type ReorderItemLike,
} from '~/commerce/lib/customer-order-lifecycle'
import { ORDER_ISSUE_TYPE, ORDER_STATUS } from '~/lib/orders/order.constants'

describe('sanitizeCarrierTrackingUrl', () => {
  it('accepts https carrier urls', () => {
    expect(sanitizeCarrierTrackingUrl('https://track.example.com/abc')).toBe(
      'https://track.example.com/abc',
    )
  })

  it('rejects non-http schemes and junk', () => {
    expect(sanitizeCarrierTrackingUrl('javascript:alert(1)')).toBeNull()
    expect(sanitizeCarrierTrackingUrl('not a url')).toBeNull()
    expect(sanitizeCarrierTrackingUrl('')).toBeNull()
  })
})

describe('getCustomerOrderActionEligibility', () => {
  it('allows cancel only pre-shipment without open request', () => {
    const eligible = getCustomerOrderActionEligibility({
      orderStatus: ORDER_STATUS.PROCESSING,
      paymentStatus: 'completed',
      issues: [],
    })
    expect(eligible.canCancel).toBe(true)
    expect(eligible.canRequestCancel).toBe(true)
    expect(eligible.canInstantCancel).toBe(false)

    const blocked = getCustomerOrderActionEligibility({
      orderStatus: ORDER_STATUS.SHIPPED,
      issues: [],
    })
    expect(blocked.canCancel).toBe(false)

    const duplicate = getCustomerOrderActionEligibility({
      orderStatus: ORDER_STATUS.CONFIRMED,
      paymentStatus: 'completed',
      issues: [{ issue_type: ORDER_ISSUE_TYPE.CANCELLATION_REQUEST, status: 'open' }],
    })
    expect(duplicate.canCancel).toBe(false)
    expect(duplicate.hasOpenCancellationRequest).toBe(true)
  })

  it('offers instant cancel for unpaid awaiting_payment orders', () => {
    const unpaid = getCustomerOrderActionEligibility({
      orderStatus: ORDER_STATUS.AWAITING_PAYMENT,
      paymentStatus: 'pending',
      issues: [],
    })
    expect(unpaid.canInstantCancel).toBe(true)
    expect(unpaid.canRequestCancel).toBe(false)
    expect(unpaid.canCancel).toBe(true)
  })

  it('offers request cancel for paid pre-shipment orders', () => {
    const paid = getCustomerOrderActionEligibility({
      orderStatus: ORDER_STATUS.CONFIRMED,
      paymentStatus: 'completed',
      issues: [],
    })
    expect(paid.canInstantCancel).toBe(false)
    expect(paid.canRequestCancel).toBe(true)
  })
})

describe('findOpenCancellationRequest', () => {
  it('finds only open cancellation issues', () => {
    expect(
      findOpenCancellationRequest([
        { issue_type: ORDER_ISSUE_TYPE.OTHER, status: 'open' },
        { issue_type: ORDER_ISSUE_TYPE.CANCELLATION_REQUEST, status: 'closed' },
      ]),
    ).toBeNull()

    expect(
      findOpenCancellationRequest([
        { issue_type: ORDER_ISSUE_TYPE.CANCELLATION_REQUEST, status: 'in_progress' },
      ]),
    ).not.toBeNull()
  })
})

describe('buildCustomerOrderTimeline', () => {
  it('orders events chronologically and marks the latest current', () => {
    const events = buildCustomerOrderTimeline({
      orderStatus: ORDER_STATUS.SHIPPED,
      createdAt: '2026-07-01T10:00:00.000Z',
      statusLogs: [
        {
          id: 'log-1',
          to_status: ORDER_STATUS.CONFIRMED,
          changed_at: '2026-07-01T11:00:00.000Z',
        },
        {
          id: 'log-2',
          to_status: ORDER_STATUS.SHIPPED,
          changed_at: '2026-07-02T09:00:00.000Z',
          note: 'Handed to courier',
        },
      ],
      deliveries: [
        {
          id: 'del-1',
          delivery_status: 'in_transit',
          updated_at: '2026-07-02T12:00:00.000Z',
          tracking_number: 'TRK1',
          carrier_name: 'DemoPost',
        },
      ],
    })

    expect(events[0]?.label).toBe('Order placed')
    expect(events[events.length - 1]?.isCurrent).toBe(true)
    expect(events.some((event) => event.description.includes('TRK1'))).toBe(true)
  })
})

describe('pending order success snapshot', () => {
  it('round-trips and expires', () => {
    const raw = serializePendingOrderSuccess({
      orderIds: ['a', 'b'],
      orderNumbers: ['100', '101'],
      createdAt: Date.now(),
      awaitingExternalPayment: true,
      checkoutGroupId: 'grp-1',
      checkoutUrl: 'https://pay.example/resume',
    })
    const parsed = parsePendingOrderSuccess(raw)
    expect(parsed?.orderIds).toEqual(['a', 'b'])
    expect(parsed?.awaitingExternalPayment).toBe(true)
    expect(parsed?.checkoutGroupId).toBe('grp-1')
    expect(parsed?.checkoutUrl).toBe('https://pay.example/resume')

    expect(
      parsePendingOrderSuccess(
        serializePendingOrderSuccess({
          orderIds: ['a'],
          orderNumbers: [],
          createdAt: Date.now() - PENDING_ORDER_SUCCESS_TTL_MS - 1,
        }),
      ),
    ).toBeNull()

    expect(
      isPendingOrderSuccessExpired({
        orderIds: ['a'],
        orderNumbers: [],
        createdAt: Date.now() - PENDING_ORDER_SUCCESS_TTL_MS - 5,
      }),
    ).toBe(true)
  })
})

describe('evaluateReorderCandidates', () => {
  const base = (overrides: Partial<ReorderItemLike> = {}): ReorderItemLike => ({
    id: 'item-1',
    listing_id: 'listing-1',
    quantity: 2,
    available_stock: 5,
    listing_active: true,
    ...overrides,
  })

  it('skips unavailable listings and adjusts quantity when stock is low', () => {
    const { eligible, skipped } = evaluateReorderCandidates([
      base(),
      base({ id: 'item-2', listing_active: false }),
      base({ id: 'item-3', available_stock: 1, quantity: 3 }),
    ])

    expect(eligible).toHaveLength(2)
    expect(eligible.find((item) => item.id === 'item-3')?.quantity).toBe(1)
    expect(skipped).toHaveLength(1)
    expect(skipped[0]?.reason).toMatch(/unavailable/i)
  })
})

describe('return / exchange lifecycle helpers', () => {
  it('allows vendor assign only when accepted and no AWB yet', () => {
    expect(
      canAssignReturnTracking({
        issue_type: ORDER_ISSUE_TYPE.RETURN_REQUEST,
        resolution_action: 'accepted',
        order_item_id: 'item-1',
      }),
    ).toBe(true)
    expect(
      canAssignReturnTracking({
        issue_type: ORDER_ISSUE_TYPE.RETURN_REQUEST,
        resolution_action: 'accepted',
        order_item_id: 'item-1',
        return_tracking_number: 'AWB',
      }),
    ).toBe(false)
  })

  it('allows buyer cancel before AWB and blocks after', () => {
    expect(
      canCancelReturnOrExchange({
        issue_type: ORDER_ISSUE_TYPE.EXCHANGE_REQUEST,
        status: 'open',
      }),
    ).toBe(true)
    expect(
      canCancelReturnOrExchange({
        issue_type: ORDER_ISSUE_TYPE.RETURN_REQUEST,
        status: 'waiting_customer',
        resolution_action: 'accepted',
      }),
    ).toBe(true)
    expect(
      canCancelReturnOrExchange({
        issue_type: ORDER_ISSUE_TYPE.RETURN_REQUEST,
        status: 'waiting_customer',
        resolution_action: 'accepted',
        return_tracking_number: 'AWB',
      }),
    ).toBe(false)
  })

  it('builds return timeline steps through refund', () => {
    const steps = getReturnExchangeTimeline({
      issue: {
        issue_type: ORDER_ISSUE_TYPE.RETURN_REQUEST,
        resolution_action: 'accepted',
        return_tracking_number: 'AWB1',
        return_shipping_mode: 'vendor_arranged',
      },
      refund: { refund_status: 'processing' },
    })
    expect(steps.map((s) => s.id)).toEqual(['requested', 'decision', 'shipped', 'received', 'refund'])
    expect(steps.find((s) => s.id === 'shipped')?.done).toBe(true)
    expect(steps.find((s) => s.id === 'shipped')?.detail).toMatch(/arranged by the shop/i)
  })

  it('reads the shipped step as shop-arranged even for auto-booked pickups', () => {
    const steps = getReturnExchangeTimeline({
      issue: {
        issue_type: ORDER_ISSUE_TYPE.RETURN_REQUEST,
        resolution_action: 'accepted',
        return_tracking_number: 'AWB-AUTO',
        return_shipping_mode: 'auto',
      },
      refund: { refund_status: 'processing' },
    })
    expect(steps.find((s) => s.id === 'shipped')?.detail).toMatch(/arranged by the shop/i)
  })

  it('shows structured reject reason on decision step', () => {
    const steps = getReturnExchangeTimeline({
      issue: {
        issue_type: ORDER_ISSUE_TYPE.RETURN_REQUEST,
        resolution_action: 'rejected',
        reject_reason_code: 'out_of_window',
      },
    })
    expect(steps.find((s) => s.id === 'decision')?.label).toMatch(/Outside return window/i)
  })

  it('builds buyer return hub entries with evidence and pickup actions', () => {
    const entries = getBuyerReturnHubEntries({
      items: [{ id: 'item-1', product_title: 'Silk Kurta' }],
      issues: [
        {
          id: 'issue-1',
          order_item_id: 'item-1',
          issue_type: ORDER_ISSUE_TYPE.RETURN_REQUEST,
          status: 'open',
          evidence_urls: [],
        },
        {
          id: 'issue-2',
          order_item_id: 'item-1',
          issue_type: ORDER_ISSUE_TYPE.EXCHANGE_REQUEST,
          status: 'in_progress',
          resolution_action: 'accepted',
          evidence_urls: ['https://img.example/1.jpg'],
        },
      ],
    })

    expect(entries[0]).toMatchObject({
      issueId: 'issue-1',
      category: 'needs_action',
      action: 'upload_evidence',
      actionLabel: 'Add photos if helpful',
      evidenceLabel: 'No photos attached yet',
    })
    expect(entries[1]).toMatchObject({
      issueId: 'issue-2',
      category: 'in_progress',
      action: 'wait_for_pickup',
      actionLabel: 'Pickup being arranged',
      evidenceCount: 1,
    })
  })

  it('builds buyer return hub entries for tracking, refund completion, and declines', () => {
    const entries = getBuyerReturnHubEntries({
      items: [
        { id: 'item-track', product_title: 'Handbag' },
        { id: 'item-refund', product_title: 'Handbag' },
        { id: 'item-declined', product_title: 'Handbag' },
      ],
      issues: [
        {
          id: 'issue-track',
          order_item_id: 'item-track',
          issue_type: ORDER_ISSUE_TYPE.RETURN_REQUEST,
          status: 'in_progress',
          resolution_action: 'accepted',
          return_tracking_number: 'AWB-1',
          return_tracking_url: 'https://track.example/awb-1',
        },
        {
          id: 'issue-refund',
          order_item_id: 'item-refund',
          issue_type: ORDER_ISSUE_TYPE.RETURN_REQUEST,
          status: 'resolved',
          resolution_action: 'return_received',
        },
        {
          id: 'issue-declined',
          order_item_id: 'item-declined',
          issue_type: ORDER_ISSUE_TYPE.EXCHANGE_REQUEST,
          status: 'closed',
          resolution_action: 'rejected',
          reject_reason_code: 'out_of_window',
          resolution_note: 'The request was filed too late.',
        },
      ],
      refunds: [
        {
          order_item_id: 'item-refund',
          refund_status: 'completed',
          return_received_at: '2026-08-19T10:00:00.000Z',
        },
      ],
    })

    expect(entries.find((entry) => entry.issueId === 'issue-track')).toMatchObject({
      action: 'track_return',
      actionLabel: 'Track return',
      returnTrackingUrl: 'https://track.example/awb-1',
    })
    expect(entries.find((entry) => entry.issueId === 'issue-refund')).toMatchObject({
      category: 'resolved',
      action: 'view_refund_progress',
      actionLabel: 'Refund completed',
      refundLabel: 'Refund Completed',
    })
    expect(entries.find((entry) => entry.issueId === 'issue-declined')).toMatchObject({
      category: 'declined',
      action: 'view_decline_reason',
      rejectReason: 'Outside return window',
    })
  })

  it('labels the return window countdown', () => {
    const deliveredAt = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()
    const label = getReturnWindowLabel(deliveredAt, 30)
    expect(label).toMatch(/Returns until/i)
    expect(label).toMatch(/days left/i)
  })
})
