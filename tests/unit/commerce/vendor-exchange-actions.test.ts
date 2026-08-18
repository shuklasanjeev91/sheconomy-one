import { describe, expect, it } from 'vitest'

import {
  getVendorIssueActions,
  isReturnAwaitingGoods,
  issueAttentionMessage,
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

  it('asks the vendor to confirm goods after an accepted exchange', () => {
    const issue = {
      issue_type: ORDER_ISSUE_TYPE.EXCHANGE_REQUEST,
      status: 'waiting_customer',
      resolution_action: 'accepted',
      order_item_id: 'item-1',
    }
    expect(isReturnAwaitingGoods(issue)).toBe(true)
    const actions = getVendorIssueActions(issue)
    expect(actions[0]?.kind).toBe('return-received')
    expect(actions[0]?.label).toMatch(/exchange/i)
    expect(issueAttentionMessage(issue)).toMatch(/Exchange approved/i)
  })

  it('stops asking for goods after exchange_ready_to_ship', () => {
    expect(
      isReturnAwaitingGoods({
        issue_type: ORDER_ISSUE_TYPE.EXCHANGE_REQUEST,
        status: 'resolved',
        resolution_action: 'exchange_ready_to_ship',
        order_item_id: 'item-1',
      }),
    ).toBe(false)
  })
})
