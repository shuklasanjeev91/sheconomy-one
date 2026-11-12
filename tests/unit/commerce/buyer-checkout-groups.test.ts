import { describe, expect, it } from 'vitest'

import {
  buyerGroupOverallStatusLabel,
  deriveBuyerGroupOverallStatus,
  settlementStatusLabel,
} from '~/commerce/lib/buyer-checkout-groups'

describe('deriveBuyerGroupOverallStatus', () => {
  it('returns cancelled when every child is cancelled', () => {
    expect(deriveBuyerGroupOverallStatus(['cancelled', 'cancelled'])).toBe('cancelled')
  })

  it('returns partially_delivered when some shops delivered', () => {
    expect(
      deriveBuyerGroupOverallStatus(['delivered', 'shipped', 'processing']),
    ).toBe('partially_delivered')
  })

  it('returns delivered when all active shops delivered', () => {
    expect(deriveBuyerGroupOverallStatus(['delivered', 'completed'])).toBe('delivered')
  })

  it('returns partially_refunded for mixed refund + active', () => {
    expect(
      deriveBuyerGroupOverallStatus(['refunded', 'processing']),
    ).toBe('partially_refunded')
  })

  it('ignores cancelled siblings when deriving delivery progress', () => {
    expect(
      deriveBuyerGroupOverallStatus(['cancelled', 'delivered', 'delivered']),
    ).toBe('delivered')
  })

  it('returns shipped when any active shop is in transit', () => {
    expect(
      deriveBuyerGroupOverallStatus(['confirmed', 'in_transit']),
    ).toBe('shipped')
  })
})

describe('labels', () => {
  it('labels overall statuses for buyers', () => {
    expect(buyerGroupOverallStatusLabel('partially_delivered')).toBe('Partially delivered')
    expect(buyerGroupOverallStatusLabel('partially_refunded')).toBe('Partially refunded')
  })

  it('labels settlement holds', () => {
    expect(settlementStatusLabel('pending', 'awaiting_delivery')).toBe(
      'Held until delivery',
    )
    expect(settlementStatusLabel('released', null)).toBe('Settled')
  })
})
