import { describe, expect, it } from 'vitest'

import {
  buildCustomerOrderTimeline,
  evaluateReorderCandidates,
  findOpenCancellationRequest,
  getCustomerOrderActionEligibility,
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
      issues: [],
    })
    expect(eligible.canCancel).toBe(true)

    const blocked = getCustomerOrderActionEligibility({
      orderStatus: ORDER_STATUS.SHIPPED,
      issues: [],
    })
    expect(blocked.canCancel).toBe(false)

    const duplicate = getCustomerOrderActionEligibility({
      orderStatus: ORDER_STATUS.CONFIRMED,
      issues: [{ issue_type: ORDER_ISSUE_TYPE.CANCELLATION_REQUEST, status: 'open' }],
    })
    expect(duplicate.canCancel).toBe(false)
    expect(duplicate.hasOpenCancellationRequest).toBe(true)
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
    })
    const parsed = parsePendingOrderSuccess(raw)
    expect(parsed?.orderIds).toEqual(['a', 'b'])
    expect(parsed?.awaitingExternalPayment).toBe(true)

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
