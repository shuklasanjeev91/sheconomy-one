export const CRM_RFM_SEGMENTS = [
  'champion',
  'loyal',
  'promising',
  'new',
  'at_risk',
  'hibernating',
  'lost',
] as const

export type CrmRfmSegment = (typeof CRM_RFM_SEGMENTS)[number]

export const CRM_JOURNEY_SEGMENTS = ['churn_risk', 'high_intent', 'champion', 'at_risk', 'new'] as const

export type CrmJourneySegment = (typeof CRM_JOURNEY_SEGMENTS)[number]

export const CRM_PRESET_TAGS = ['vip', 'wholesale', 'influencer', 'gift', 'watch'] as const

export function rfmRecencyScore(daysSinceLast: number | null | undefined): number {
  if (daysSinceLast == null) return 1
  if (daysSinceLast <= 30) return 5
  if (daysSinceLast <= 60) return 4
  if (daysSinceLast <= 90) return 3
  if (daysSinceLast <= 180) return 2
  return 1
}

export function rfmFrequencyScore(orderCount: number): number {
  if (orderCount >= 8) return 5
  if (orderCount >= 5) return 4
  if (orderCount >= 3) return 3
  if (orderCount >= 2) return 2
  return 1
}

export function rfmMonetaryScore(totalSpent: number): number {
  if (totalSpent >= 20000) return 5
  if (totalSpent >= 8000) return 4
  if (totalSpent >= 3000) return 3
  if (totalSpent >= 1000) return 2
  return 1
}

export function rfmSegment(
  recency: number,
  frequency: number,
  orderCount: number,
  isFollower: boolean,
): CrmRfmSegment {
  if (orderCount <= 0) return isFollower ? 'new' : 'hibernating'
  if (recency >= 4 && frequency >= 4) return 'champion'
  if (recency >= 3 && frequency >= 3) return 'loyal'
  if (recency >= 4 && frequency <= 2 && orderCount <= 1) return 'new'
  if (recency >= 4 && frequency <= 2) return 'promising'
  if (recency <= 2 && frequency >= 3) return 'at_risk'
  if (recency === 1) return 'lost'
  if (recency <= 2) return 'hibernating'
  return 'promising'
}

export function churnScore(
  daysSinceLast: number | null | undefined,
  orderCount: number,
  refundedOrders: number,
): number {
  if (orderCount <= 0 || daysSinceLast == null) return 0
  const recencyPart = Math.min(70, (daysSinceLast / 120) * 70)
  const refundPart = Math.min(20, (refundedOrders / orderCount) * 40)
  const oneAndDone = orderCount === 1 && daysSinceLast > 45 ? 15 : 0
  return Math.min(100, Math.round(recencyPart + refundPart + oneAndDone))
}

export function intentScore(input: {
  cartValue: number
  wishlistCount: number
  recentViews: number
  daysSinceLast: number | null | undefined
  abandoned: boolean
}): number {
  let score = 0
  if (input.cartValue > 0) score += 40
  if (input.abandoned) score += 15
  score += Math.min(20, input.wishlistCount * 8)
  score += Math.min(20, input.recentViews * 7)
  if (input.daysSinceLast != null && input.daysSinceLast <= 14 && input.cartValue > 0) {
    score += 10
  }
  return Math.min(100, score)
}

export function predictedClv(
  totalSpent: number,
  orderCount: number,
  daysSinceFirst: number | null | undefined,
  churn: number,
): number {
  if (orderCount <= 0) return 0
  const aov = totalSpent / orderCount
  const months = Math.max(1, (daysSinceFirst ?? 30) / 30)
  const ordersPerMonth = orderCount / months
  const remainingMonths = 6 * (1 - churn / 100)
  return Math.round((totalSpent + aov * ordersPerMonth * remainingMonths) * 100) / 100
}

export function buildCustomerInsight(input: {
  rfmSegment: CrmRfmSegment
  churnScore: number
  intentScore: number
  totalOrders: number
  isFollower: boolean
  openCartValue: number
}): string {
  const parts: string[] = []
  if (input.churnScore >= 70) {
    parts.push('High churn risk — they have not bought recently relative to a healthy repeat cycle.')
  } else if (input.churnScore >= 45) {
    parts.push('Softening — a reminder or offer could bring them back.')
  }
  if (input.intentScore >= 50) {
    parts.push('Purchase intent is elevated from cart, wishlist, or recent browsing.')
  }
  if (input.rfmSegment === 'champion') {
    parts.push('Champion buyer — high recency, frequency, and spend.')
  }
  if (input.rfmSegment === 'new' && input.totalOrders <= 1) {
    parts.push('New to this shop — a second-order nudge can lift lifetime value.')
  }
  if (input.isFollower && input.totalOrders === 0) {
    parts.push('Follows the shop but has not purchased yet.')
  }
  if (input.openCartValue > 0) {
    parts.push('Open cart currently holds items from this shop.')
  }
  if (!parts.length) {
    return 'Stable customer with no strong risk or intent signals right now.'
  }
  return parts.slice(0, 3).join(' ')
}

export function customerMatchesJourney(
  segment: CrmJourneySegment,
  row: { churnScore: number; intentScore: number; rfmSegment: string },
): boolean {
  if (segment === 'churn_risk') return row.churnScore >= 60
  if (segment === 'high_intent') return row.intentScore >= 50
  if (segment === 'champion') return row.rfmSegment === 'champion'
  if (segment === 'at_risk') return row.rfmSegment === 'at_risk'
  return row.rfmSegment === 'new'
}

export function rfmSegmentLabel(segment: string): string {
  if (segment === 'champion') return 'Champion'
  if (segment === 'loyal') return 'Loyal'
  if (segment === 'promising') return 'Promising'
  if (segment === 'new') return 'New'
  if (segment === 'at_risk') return 'At risk'
  if (segment === 'lost') return 'Lost'
  return 'Hibernating'
}
