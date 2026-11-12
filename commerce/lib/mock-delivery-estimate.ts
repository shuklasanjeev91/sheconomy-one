/**
 * Client-only mock delivery estimate from a postal / ZIP code.
 * No network calls — used by the Ships to you widget on PDP and cart.
 */

export type MockDeliveryEstimate = {
  zip: string
  /** e.g. "Get it by Thu, 6 Nov – Sat, 8 Nov" */
  label: string
  earliestBusinessDays: number
  latestBusinessDays: number
  freeShippingEligible: boolean
}

const ZIP_RE = /^[A-Za-z0-9][A-Za-z0-9\s-]{2,11}$/

export function normalizeZip(raw: string): string {
  return String(raw ?? '')
    .trim()
    .replace(/\s+/g, '')
    .toUpperCase()
}

export function isValidZip(raw: string): boolean {
  const zip = normalizeZip(raw)
  if (zip.length < 4 || zip.length > 10) return false
  return ZIP_RE.test(zip)
}

function hashZip(zip: string): number {
  let h = 0
  for (let i = 0; i < zip.length; i += 1) {
    h = (h * 31 + zip.charCodeAt(i)) >>> 0
  }
  return h
}

function addBusinessDays(from: Date, days: number): Date {
  const d = new Date(from.getFullYear(), from.getMonth(), from.getDate())
  let remaining = Math.max(0, days)
  while (remaining > 0) {
    d.setDate(d.getDate() + 1)
    const dow = d.getDay()
    if (dow !== 0 && dow !== 6) remaining -= 1
  }
  return d
}

function formatDay(d: Date): string {
  return d.toLocaleDateString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })
}

/**
 * Deterministic mock ETA from ZIP digits/chars — same ZIP always yields same window.
 */
export function mockDeliveryEstimateFromZip(raw: string): MockDeliveryEstimate | null {
  const zip = normalizeZip(raw)
  if (!isValidZip(zip)) return null

  const h = hashZip(zip)
  const earliestBusinessDays = 2 + (h % 3) // 2–4
  const latestBusinessDays = earliestBusinessDays + 1 + (h % 2) // +1 or +2
  const freeShippingEligible = h % 5 !== 0

  const today = new Date()
  const start = addBusinessDays(today, earliestBusinessDays)
  const end = addBusinessDays(today, latestBusinessDays)
  const sameDay = start.getTime() === end.getTime()
  const label = sameDay
    ? `Get it by ${formatDay(start)}`
    : `Get it by ${formatDay(start)} – ${formatDay(end)}`

  return {
    zip,
    label,
    earliestBusinessDays,
    latestBusinessDays,
    freeShippingEligible,
  }
}
