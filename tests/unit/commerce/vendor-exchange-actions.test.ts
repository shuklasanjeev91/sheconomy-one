import { describe, expect, it } from 'vitest'

import {
  getVendorIssueActions,
  isReturnAwaitingGoods,
  issueAttentionMessage,
  vendorIssueBadge,
} from '~/commerce/components/vendor/vendor-issue-actions'
import { ORDER_ISSUE_TYPE } from '~/lib/orders/order.constants'

describe('vendor exchange issue actions', () => {
  it('offers accept/reject for an open exchange request', () => {
    const actions = getVendorIssueActions({
      issue_type: ORDER_ISSUE_TYPE.EXCHANGE_REQUEST,
      status: 'open',
      order_item_id: 'item-1',
    })
    expect(actions.map((a) => a.key)).toEqual(['accept', 'reject'])
  })

  it('labels approve as "book pickup" for returns and exchanges', () => {
    const returnAccept = getVendorIssueActions({
      issue_type: ORDER_ISSUE_TYPE.RETURN_REQUEST,
      status: 'open',
      order_item_id: 'item-1',
    }).find((a) => a.key === 'accept')
    expect(returnAccept?.label).toMatch(/book pickup/i)

    const exchangeAccept = getVendorIssueActions({
      issue_type: ORDER_ISSUE_TYPE.EXCHANGE_REQUEST,
      status: 'open',
      order_item_id: 'item-1',
    }).find((a) => a.key === 'accept')
    expect(exchangeAccept?.label).toMatch(/book pickup/i)
  })

  it('hides the manual pickup fallback once an AWB exists (auto-booked)', () => {
    const autoBooked = {
      issue_type: ORDER_ISSUE_TYPE.RETURN_REQUEST,
      status: 'waiting_customer',
      resolution_action: 'accepted',
      order_item_id: 'item-1',
      return_tracking_number: 'AWB-AUTO',
      return_shipping_mode: 'auto',
    }
    const kinds = getVendorIssueActions(autoBooked).map((a) => a.kind)
    expect(kinds).not.toContain('assign-return-tracking')
    expect(kinds).toContain('return-received')
  })

  it('asks the vendor to arrange pickup then confirm after an accepted exchange', () => {
    const issue = {
      issue_type: ORDER_ISSUE_TYPE.EXCHANGE_REQUEST,
      status: 'waiting_customer',
      resolution_action: 'accepted',
      order_item_id: 'item-1',
    }
    expect(isReturnAwaitingGoods(issue)).toBe(true)
    const actions = getVendorIssueActions(issue)
    expect(actions.map((a) => a.kind)).toEqual(['assign-return-tracking', 'return-received'])
    expect(actions[0]?.label).toMatch(/pickup/i)
    expect(issueAttentionMessage(issue)).toMatch(/arrange it manually/i)
    expect(vendorIssueBadge(issue)).toBe('Needs pickup')
  })

  it('asks to confirm received when AWB is already present', () => {
    const issue = {
      issue_type: ORDER_ISSUE_TYPE.RETURN_REQUEST,
      status: 'waiting_customer',
      resolution_action: 'accepted',
      order_item_id: 'item-1',
      return_tracking_number: 'AWB123',
    }
    const actions = getVendorIssueActions(issue)
    expect(actions.map((a) => a.kind)).toEqual(['return-received'])
    expect(vendorIssueBadge(issue)).toBe('Confirm received')
  })

  it('offers ship-replacement after exchange_ready_to_ship', () => {
    const issue = {
      issue_type: ORDER_ISSUE_TYPE.EXCHANGE_REQUEST,
      status: 'resolved',
      resolution_action: 'exchange_ready_to_ship',
      order_item_id: 'item-1',
    }
    expect(isReturnAwaitingGoods(issue)).toBe(false)
    const actions = getVendorIssueActions(issue)
    expect(actions.map((a) => a.kind)).toEqual(['ship-replacement'])
    expect(vendorIssueBadge(issue)).toBe('Ship replacement')
  })
})
