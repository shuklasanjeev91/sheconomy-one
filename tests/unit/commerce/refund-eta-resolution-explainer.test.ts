import { describe, expect, it } from 'vitest'

import {
  buildBuyerRefundProgress,
  buildBuyerRefundSummary,
  getBuyerReturnHubEntries,
} from '~/commerce/lib/customer-order-lifecycle'
import { ORDER_ISSUE_TYPE } from '~/lib/orders/order.constants'

describe('refund eta and resolution explainer', () => {
  it('builds pre-receipt and processing refund explainers', () => {
    expect(
      buildBuyerRefundProgress({
        refund_status: 'requested',
        approved_at: '2026-08-19T00:00:00.000Z',
      }),
    ).toMatchObject({
      etaLabel: 'Refund starts after the shop receives your return',
    })

    expect(
      buildBuyerRefundProgress({
        refund_status: 'processing',
        return_received_at: '2026-08-19T00:00:00.000Z',
      }),
    ).toMatchObject({
      etaLabel: 'Most banks reflect this within 3-5 business days',
      nextStep: 'Next, your bank or wallet posts the refund to the original payment method.',
    })
  })

  it('flags delayed refunds after the usual processing window', () => {
    const progress = buildBuyerRefundProgress(
      {
        refund_status: 'processing',
        return_received_at: '2026-08-01T00:00:00.000Z',
      },
      new Date('2026-08-19T00:00:00.000Z').getTime(),
    )
    expect(progress?.delayedWarning).toContain('taking longer than usual')
  })

  it('threads refund progress into return hub entries and summary', () => {
    const entries = getBuyerReturnHubEntries({
      items: [{ id: 'item-1', product_title: 'Handmade Kurta' }],
      issues: [
        {
          id: 'issue-1',
          order_item_id: 'item-1',
          issue_type: ORDER_ISSUE_TYPE.RETURN_REQUEST,
          status: 'open',
          resolution_action: 'return_received',
          created_at: '2026-08-10T00:00:00.000Z',
        },
      ],
      refunds: [
        {
          order_item_id: 'item-1',
          refund_status: 'processing',
          refund_amount: 1200,
          return_received_at: '2026-08-11T00:00:00.000Z',
          approved_at: '2026-08-12T00:00:00.000Z',
          created_at: '2026-08-10T00:00:00.000Z',
          updated_at: '2026-08-12T00:00:00.000Z',
        },
      ],
      currency: 'INR',
    })

    expect(entries[0]?.refundProgress?.status).toBe('processing')
    const summary = buildBuyerRefundSummary(entries)
    expect(summary?.headline).toBe('1 refund in progress')
  })
})
