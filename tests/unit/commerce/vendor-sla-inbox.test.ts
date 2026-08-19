import { describe, expect, it } from 'vitest'

import {
  buildVendorSlaInboxData,
  canBulkAcknowledgeInboxRows,
  filterVendorSlaRows,
} from '~/commerce/lib/vendor-sla-inbox'
import { ISSUE_PRIORITY, ISSUE_STATUS, ORDER_STATUS, ORDER_ISSUE_TYPE } from '~/lib/orders/order.constants'
import type { EnrichedOrderIssue } from '~/lib/orders/order-issue.type'
import type { VendorOrderItem } from '~/lib/orders/vendor-orders.type'

function baseOrder(overrides: Partial<VendorOrderItem> = {}): VendorOrderItem {
  return {
    id: 'item-1',
    order_id: 'order-1',
    product_title: 'Silk Dress',
    item_status: ORDER_STATUS.PROCESSING,
    quantity: 1,
    total_price: 1200,
    created_at: '2026-08-16T10:00:00.000Z',
    orders: {
      id: 'order-1',
      order_number: '1001',
      order_status: ORDER_STATUS.PROCESSING,
      subtotal_amount: 1200,
      shipping_amount: 0,
      tax_amount: 0,
      discount_amount: 0,
      total_amount: 1200,
      currency: 'INR',
      customer_currency: 'INR',
      customer_country: 'IN',
      customer_notes: null,
      created_at: '2026-08-16T10:00:00.000Z',
      updated_at: '2026-08-16T10:00:00.000Z',
      profiles: { full_name: 'Asha', email: 'asha@example.com' },
    },
    order_delivery: null,
    ...overrides,
  } as VendorOrderItem
}

function baseIssue(overrides: Partial<EnrichedOrderIssue> = {}): EnrichedOrderIssue {
  return {
    id: 'issue-1',
    order_id: 'order-1',
    order_item_id: 'item-1',
    issue_type: ORDER_ISSUE_TYPE.RETURN_REQUEST,
    status: ISSUE_STATUS.OPEN,
    issue_priority: ISSUE_PRIORITY.NORMAL,
    created_at: '2026-08-16T10:00:00.000Z',
    resolution_action: null,
    issue_title: 'Return request',
    description: 'Please return this item.',
    evidence_urls: [],
    orders: {
      id: 'order-1',
      order_number: '1001',
      order_status: ORDER_STATUS.PROCESSING,
      total_amount: 1200,
      user_id: 'user-1',
      profiles: { full_name: 'Asha', email: 'asha@example.com' },
    },
    order_items: {
      id: 'item-1',
      product_title: 'Silk Dress',
      quantity: 1,
      total_price: 1200,
      vendor_id: 'shop-1',
    },
    ...overrides,
  } as EnrichedOrderIssue
}

describe('vendor SLA inbox', () => {
  it('prioritizes exchange blocks and pickup issues ahead of shipment risk', () => {
    const rows = buildVendorSlaInboxData({
      now: new Date('2026-08-19T10:00:00.000Z').getTime(),
      orders: [
        baseOrder(),
        baseOrder({
          id: 'replacement-item',
          exchanged_from_item_id: 'different-source',
          product_title: 'Replacement Dress',
          item_status: ORDER_STATUS.SHIPPED,
          order_delivery: { tracking_number: 'AWB-1' },
        }),
      ],
      issues: [
        baseIssue({
          id: 'issue-exchange',
          issue_type: ORDER_ISSUE_TYPE.EXCHANGE_REQUEST,
          resolution_action: 'exchange_ready_to_ship',
          order_item_id: 'item-missing-replacement',
          order_items: {
            id: 'item-missing-replacement',
            product_title: 'Exchange Saree',
            vendor_id: 'shop-1',
          },
        }),
        baseIssue({
          id: 'issue-pickup',
          resolution_action: 'accepted',
          created_at: '2026-08-17T00:00:00.000Z',
        }),
      ],
    }).rows

    expect(rows.map((row) => row.kind)).toEqual([
      'exchange_stock_blocked',
      'pickup_exception',
      'shipment_risk',
    ])
  })

  it('builds filter counts for shipping, returns, pickup, and exchange block lanes', () => {
    const inbox = buildVendorSlaInboxData({
      now: new Date('2026-08-19T10:00:00.000Z').getTime(),
      orders: [baseOrder()],
      issues: [
        baseIssue({ id: 'issue-return' }),
        baseIssue({
          id: 'issue-pickup',
          resolution_action: 'accepted',
          created_at: '2026-08-18T00:00:00.000Z',
        }),
        baseIssue({
          id: 'issue-exchange',
          issue_type: ORDER_ISSUE_TYPE.EXCHANGE_REQUEST,
          resolution_action: 'exchange_ready_to_ship',
          order_item_id: 'item-blocked',
          order_items: {
            id: 'item-blocked',
            product_title: 'Exchange Kurta',
            vendor_id: 'shop-1',
          },
        }),
      ],
    })

    expect(inbox.counts.ship_now).toBe(1)
    expect(inbox.counts.approve_returns).toBe(1)
    expect(inbox.counts.pickup_issues).toBe(1)
    expect(inbox.counts.exchange_blocked).toBe(1)
    expect(filterVendorSlaRows(inbox.rows, 'critical').every((row) => row.severity === 'critical')).toBe(true)
  })

  it('only allows bulk acknowledge for return-approval rows', () => {
    const inbox = buildVendorSlaInboxData({
      now: new Date('2026-08-19T10:00:00.000Z').getTime(),
      orders: [baseOrder()],
      issues: [baseIssue()],
    })

    const acknowledgeRows = filterVendorSlaRows(inbox.rows, 'approve_returns')
    expect(canBulkAcknowledgeInboxRows(acknowledgeRows)).toBe(true)
    expect(canBulkAcknowledgeInboxRows(inbox.rows)).toBe(false)
  })
})
