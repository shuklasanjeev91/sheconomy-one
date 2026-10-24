const DAY_BEATS = [
  'Travel out and settle in.',
  'Walk the neighbourhood and visit a local market.',
  'Take one scenic day trip and be back by evening.',
  'Keep the morning slow, then go out for dinner.',
  'Join a short class, trail, or workshop.',
  'Shop for one thing to take home.',
  'Pack in the morning and head back.',
]

/** “Plan my 7 days weekend” asks for an itinerary. “Plan” is not the product. */
export function isWeekendPlanQuery(message: string): boolean {
  const lower = message.toLowerCase()
  const asks =
    /\b(plan|itinerary|schedule)\b/.test(lower) &&
    /\b(weekend|weekends|day|days|trip|holiday|vacation|getaway|itinerary)\b/.test(lower)
  return asks
}

export function weekendPlanAnswer(message: string): string {
  const lower = message.toLowerCase()
  const count = lower.match(/\b(\d+)\s*days?\b/)
  const weekend = /\bweekends?\b/.test(lower)
  let days = count ? Number(count[1]) : weekend ? 2 : 3
  if (!Number.isFinite(days)) days = 7
  days = Math.max(1, Math.min(14, days))
  const label = weekend ? 'weekend' : 'trip'
  const lines = Array.from({ length: days }, (_, index) => {
    const beat = DAY_BEATS[index] ?? 'Keep the day open for whatever you enjoyed most.'
    return `Day ${index + 1}: ${beat}`
  })
  return `Here is a ${days}-day ${label} plan. ${lines.join(' ')}`
}

export function isTripListingText(text: string): boolean {
  const haystack = text.toLowerCase()
  const travel =
    /\b(tour|tours|trip|trips|holiday|holidays|weekend|getaway|package|packages|travel|resort|homestay|itinerary)\b/.test(
      haystack,
    )
  const other =
    /\b(class|classes|education|course|software|erp|pen|pencil|journal|diary|template|folder|seed|tablet|capsule)\b/.test(
      haystack,
    )
  return travel && !other
}

export function answerForWeekendPlan(message: string, answer: string): string {
  if (!isWeekendPlanQuery(message)) return answer
  if (answer.includes('Day 1:')) return answer
  return weekendPlanAnswer(message)
}
