import { describe, expect, it } from 'vitest'

import { FULFILLMENT_STATUS } from '~/lib/orders/order.constants'
import {
  canExportFulfillmentShipList,
  fulfillmentsToShipListCsv,
  getFulfillmentControlRow,
  summarizeFulfillmentControlLanes,
} from '~/lib/orders/fulfillment.utils'

function fulfillment(overrides: Record<string, unknown> = {}) {
  return {
    id: 'fulfillment-1',
    fulfillment_number: 'FUL-1001',
    fulfillment_status: FULFILLMENT_STATUS.READY_TO_SHIP,
    priority_level: 2,
    tracking_number: 'TRACK123',
    estimated_ship_date: '2026-08-20T00:00:00.000Z',
    estimated_delivery_date: '2026-08-24T00:00:00.000Z',
    quantity_to_fulfill: 2,
    quantity_fulfilled: 2,
    created_at: '2026-08-18T00:00:00.000Z',
    order_items: {
      product_title: 'Handwoven Tote',
      orders: { order_number: '1001' },
    },
    ...overrides,
  }
}

describe('fulfillment control tower helpers', () => {
  it('classifies ready-to-ship rows and keeps export eligibility when tracking exists', () => {
    const row = getFulfillmentControlRow(fulfillment())
    expect(row.lane).toBe('ready_to_ship')
    expect(row.isBatchEligible).toBe(true)
    expect(row.blockers).toEqual([])
  })

  it('flags missing tracking and overdue shipments as blockers', () => {
    const row = getFulfillmentControlRow(
      fulfillment({
        tracking_number: null,
        estimated_ship_date: '2026-08-10T00:00:00.000Z',
      }),
      new Date('2026-08-19T00:00:00.000Z').getTime(),
    )

    expect(row.blockers.map((blocker) => blocker.id)).toEqual(['overdue', 'missing_tracking'])
    expect(row.isBatchEligible).toBe(false)
    expect(row.needsAttention).toBe(true)
  })

  it('summarizes lanes and exports a ship-list csv for eligible rows', () => {
    const rows = [
      fulfillment(),
      fulfillment({
        id: 'fulfillment-2',
        fulfillment_number: 'FUL-1002',
        fulfillment_status: FULFILLMENT_STATUS.PROCESSING,
        tracking_number: null,
      }),
      fulfillment({
        id: 'fulfillment-3',
        fulfillment_number: 'FUL-1003',
        fulfillment_status: FULFILLMENT_STATUS.EXCEPTION,
        tracking_number: null,
        last_failure_reason: 'Address mismatch',
      }),
    ]

    expect(summarizeFulfillmentControlLanes(rows)).toMatchObject({
      ready_to_ship: 1,
      pack_now: 1,
      exception: 1,
    })
    expect(canExportFulfillmentShipList([rows[0]])).toBe(true)
    expect(canExportFulfillmentShipList([rows[1]])).toBe(false)
    expect(fulfillmentsToShipListCsv([rows[0]])).toContain('FUL-1001')
  })
})
