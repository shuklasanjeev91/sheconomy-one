import { describe, expect, it } from 'vitest'

import {
  buildCustomerInsight,
  churnScore,
  customerMatchesJourney,
  intentScore,
  predictedClv,
  rfmFrequencyScore,
  rfmRecencyScore,
  rfmSegment,
} from '~/commerce/lib/customer-crm-scoring'
import { filterShopCustomers, type ShopCustomerCrmRow } from '~/commerce/lib/shop-customer-crm'

function row(overrides: Partial<ShopCustomerCrmRow> = {}): ShopCustomerCrmRow {
  return {
    customer_id: 'c1',
    display_name: 'Asha',
    username: 'asha',
    avatar_url: null,
    total_orders: 6,
    total_spent: 12000,
    average_order_value: 2000,
    first_order_at: '2025-01-01T00:00:00Z',
    last_order_at: '2026-09-01T00:00:00Z',
    days_since_last_order: 10,
    rfm_segment: 'champion',
    clv: 12000,
    predicted_clv: 15000,
    churn_score: 12,
    intent_score: 20,
    insight: 'ok',
    is_follower: true,
    open_cart_value: 0,
    wishlist_count: 0,
    recent_view_count: 0,
    refunded_orders: 0,
    tags: ['vip'],
    ...overrides,
  }
}

describe('CRM RFM and scores', () => {
  it('maps recent high-frequency buyers to champion', () => {
    expect(rfmRecencyScore(12)).toBe(5)
    expect(rfmFrequencyScore(8)).toBe(5)
    expect(rfmSegment(5, 5, 8, true)).toBe('champion')
  })

  it('treats followers with no orders as new', () => {
    expect(rfmSegment(1, 1, 0, true)).toBe('new')
    expect(rfmSegment(1, 1, 0, false)).toBe('hibernating')
  })

  it('raises churn after a long gap', () => {
    expect(churnScore(150, 3, 0)).toBeGreaterThanOrEqual(60)
    expect(churnScore(10, 3, 0)).toBeLessThan(20)
    expect(churnScore(null, 3, 0)).toBe(0)
  })

  it('scores purchase intent from cart and wishlist', () => {
    expect(
      intentScore({
        cartValue: 499,
        wishlistCount: 2,
        recentViews: 1,
        daysSinceLast: 5,
        abandoned: true,
      }),
    ).toBe(40 + 15 + 16 + 7 + 10)
  })

  it('predicts remaining CLV from AOV and churn', () => {
    const value = predictedClv(1000, 2, 60, 0)
    expect(value).toBeGreaterThan(1000)
    expect(predictedClv(0, 0, 30, 0)).toBe(0)
  })

  it('builds rule-based insights', () => {
    const text = buildCustomerInsight({
      rfmSegment: 'champion',
      churnScore: 80,
      intentScore: 55,
      totalOrders: 8,
      isFollower: true,
      openCartValue: 100,
    })
    expect(text).toContain('High churn risk')
    expect(text).toContain('Purchase intent')
    expect(text).toContain('Champion buyer')
  })

  it('matches journey audiences', () => {
    expect(customerMatchesJourney('champion', { churnScore: 10, intentScore: 10, rfmSegment: 'champion' })).toBe(
      true,
    )
    expect(customerMatchesJourney('churn_risk', { churnScore: 61, intentScore: 0, rfmSegment: 'at_risk' })).toBe(
      true,
    )
    expect(customerMatchesJourney('high_intent', { churnScore: 0, intentScore: 40, rfmSegment: 'loyal' })).toBe(
      false,
    )
  })
})

describe('CRM list filters', () => {
  it('filters by intent, churn, search, and tags', () => {
    const rows = [
      row(),
      row({
        customer_id: 'c2',
        display_name: 'Bina',
        rfm_segment: 'at_risk',
        churn_score: 70,
        intent_score: 10,
        tags: ['watch'],
      }),
      row({
        customer_id: 'c3',
        display_name: 'Cara',
        rfm_segment: 'new',
        intent_score: 80,
        tags: [],
      }),
    ]
    expect(filterShopCustomers(rows, '', 'high_intent').map((item) => item.customer_id)).toEqual(['c3'])
    expect(filterShopCustomers(rows, '', 'churn_risk').map((item) => item.customer_id)).toEqual(['c2'])
    expect(filterShopCustomers(rows, 'watch', 'all').map((item) => item.customer_id)).toEqual(['c2'])
    expect(filterShopCustomers(rows, 'asha', 'champion')).toHaveLength(1)
  })
})
