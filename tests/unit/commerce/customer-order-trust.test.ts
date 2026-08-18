import { describe, expect, it } from 'vitest'

import {
  findOpenReturnRequest,
  getCustomerItemTrustEligibility,
  isDigitalListingType,
  isDownloadUrlSafe,
  isReturnIssueType,
  isWithinReturnWindow,
  refundStatusLabel,
  RETURN_WINDOW_DAYS,
} from '~/commerce/lib/customer-order-lifecycle'
import { ORDER_ISSUE_TYPE, ORDER_STATUS } from '~/lib/orders/order.constants'

describe('isReturnIssueType', () => {
  it('recognizes return and refund request types', () => {
    expect(isReturnIssueType(ORDER_ISSUE_TYPE.RETURN_REQUEST)).toBe(true)
    expect(isReturnIssueType(ORDER_ISSUE_TYPE.REFUND_REQUEST)).toBe(true)
    expect(isReturnIssueType(ORDER_ISSUE_TYPE.CANCELLATION_REQUEST)).toBe(false)
  })
})

describe('findOpenReturnRequest', () => {
  it('scopes open return issues to an item when provided', () => {
    const issues = [
      {
        issue_type: ORDER_ISSUE_TYPE.RETURN_REQUEST,
        status: 'open',
        order_item_id: 'item-a',
      },
      {
        issue_type: ORDER_ISSUE_TYPE.RETURN_REQUEST,
        status: 'closed',
        order_item_id: 'item-b',
      },
    ]
    expect(findOpenReturnRequest(issues, 'item-a')).not.toBeNull()
    expect(findOpenReturnRequest(issues, 'item-b')).toBeNull()
  })
})

describe('getCustomerItemTrustEligibility', () => {
  const base = {
    orderStatus: ORDER_STATUS.DELIVERED,
    itemStatus: ORDER_STATUS.DELIVERED,
    orderItemId: 'item-1',
    deliveredAt: new Date().toISOString(),
    issues: [] as Array<{ issue_type?: string | null; status?: string | null; order_item_id?: string | null }>,
    refunds: [] as Array<{ order_item_id?: string | null; refund_status?: string | null }>,
  }

  it('allows review and return for delivered physical items', () => {
    const eligibility = getCustomerItemTrustEligibility({
      ...base,
      listingType: 'physical',
      hasReview: false,
    })
    expect(eligibility.canReview).toBe(true)
    expect(eligibility.canReturn).toBe(true)
    expect(eligibility.canDownload).toBe(false)
  })

  it('blocks duplicate reviews and open returns', () => {
    const reviewed = getCustomerItemTrustEligibility({
      ...base,
      hasReview: true,
    })
    expect(reviewed.canReview).toBe(false)

    const openReturn = getCustomerItemTrustEligibility({
      ...base,
      issues: [
        {
          issue_type: ORDER_ISSUE_TYPE.RETURN_REQUEST,
          status: 'open',
          order_item_id: 'item-1',
        },
      ],
    })
    expect(openReturn.canReturn).toBe(false)
    expect(openReturn.hasOpenReturnRequest).toBe(true)
  })

  it('blocks returns for digital purchases and enables safe downloads', () => {
    const digital = getCustomerItemTrustEligibility({
      ...base,
      listingType: 'digital',
      digitalDownloadUrl: 'https://cdn.example.com/file.zip',
    })
    expect(digital.canReturn).toBe(false)
    expect(digital.canDownload).toBe(true)

    const unsafe = getCustomerItemTrustEligibility({
      ...base,
      listingType: 'digital',
      digitalDownloadUrl: 'javascript:alert(1)',
    })
    expect(unsafe.canDownload).toBe(false)
  })

  it('blocks downloads after expiry or cancellation', () => {
    const expired = getCustomerItemTrustEligibility({
      ...base,
      listingType: 'digital',
      digitalDownloadUrl: 'https://cdn.example.com/file.zip',
      downloadExpiresAt: '2020-01-01T00:00:00.000Z',
    })
    expect(expired.canDownload).toBe(false)

    const cancelled = getCustomerItemTrustEligibility({
      ...base,
      orderStatus: ORDER_STATUS.CANCELLED,
      itemStatus: ORDER_STATUS.CANCELLED,
      listingType: 'digital',
      digitalDownloadUrl: 'https://cdn.example.com/file.zip',
    })
    expect(cancelled.canDownload).toBe(false)
  })

  it('enforces the return window', () => {
    const stale = getCustomerItemTrustEligibility({
      ...base,
      deliveredAt: new Date(Date.now() - (RETURN_WINDOW_DAYS + 2) * 86400000).toISOString(),
    })
    expect(stale.canReturn).toBe(false)
  })

  it('allows exchange for delivered physical items and blocks when a return is open', () => {
    const eligibility = getCustomerItemTrustEligibility({
      ...base,
      listingType: 'physical',
      acceptsExchanges: true,
    })
    expect(eligibility.canExchange).toBe(true)

    const blocked = getCustomerItemTrustEligibility({
      ...base,
      listingType: 'physical',
      issues: [
        {
          issue_type: ORDER_ISSUE_TYPE.RETURN_REQUEST,
          status: 'open',
          order_item_id: 'item-1',
        },
      ],
    })
    expect(blocked.canExchange).toBe(false)
  })

  it('allows return tracking after an accepted return without an AWB', () => {
    const eligibility = getCustomerItemTrustEligibility({
      ...base,
      listingType: 'physical',
      issues: [
        {
          issue_type: ORDER_ISSUE_TYPE.RETURN_REQUEST,
          status: 'waiting_customer',
          resolution_action: 'accepted',
          order_item_id: 'item-1',
          return_tracking_number: null,
        },
      ],
    })
    expect(eligibility.canSubmitReturnTracking).toBe(true)
    expect(eligibility.canReturn).toBe(false)
  })
})

describe('helpers', () => {
  it('classifies digital listing types and safe download urls', () => {
    expect(isDigitalListingType('digital')).toBe(true)
    expect(isDigitalListingType('service')).toBe(true)
    expect(isDigitalListingType('physical')).toBe(false)
    expect(isDownloadUrlSafe('https://files.example.com/a')).toBe(true)
    expect(isDownloadUrlSafe('ftp://files.example.com/a')).toBe(false)
  })

  it('checks return windows and labels refund statuses', () => {
    expect(isWithinReturnWindow(new Date().toISOString())).toBe(true)
    expect(isWithinReturnWindow(null)).toBe(false)
    expect(refundStatusLabel('requested')).toBe('Requested')
    expect(refundStatusLabel('return_received')).toBe('Return Received')
  })
})
