import { addDays, format } from 'date-fns'

/**
 * Buyer-facing estimated arrival window (marketplace, informational).
 * Returns e.g. "Est. arrival Jul 16 – Jul 20".
 */
export function deliveryEstimateLabel(minDays = 3, maxDays = 7): string {
  const now = new Date()
  const from = format(addDays(now, minDays), 'MMM d')
  const to = format(addDays(now, maxDays), 'MMM d')
  return `Est. arrival ${from} – ${to}`
}
