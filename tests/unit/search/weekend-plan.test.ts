import { describe, expect, it } from 'vitest'

import { answerForWeekendPlan, isTripListingText, weekendPlanAnswer } from '~/lib/search/weekend-plan'

describe('weekend plan search', () => {
  it('writes a 7-day plan instead of treating plan as a product', () => {
    const answer = weekendPlanAnswer('plan my 7 days weekend plan')
    expect(answer).toContain('7-day weekend plan')
    expect(answer).toContain('Day 1:')
    expect(answer).toContain('Day 7:')
    expect(answer.toLowerCase()).not.toContain('individual plan')
  })

  it('keeps a plan that SHERPA already wrote', () => {
    const ready = 'Here is a 7-day weekend plan. Day 1: Travel out and settle in.'
    expect(answerForWeekendPlan('plan my 7 days weekend plan', ready)).toBe(ready)
  })

  it('keeps tour packages and drops classes and pens', () => {
    expect(isTripListingText('Customizable leisure tour package')).toBe(true)
    expect(isTripListingText('Individual Plan live online classes for kids')).toBe(false)
    expect(isTripListingText('Recyclable plantable seed pens')).toBe(false)
  })
})
