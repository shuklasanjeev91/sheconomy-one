/**
 * ETA window from buyer location ↔ seller warehouse (no carrier API required).
 * Used on PDP "Ships to you" / Get it by chip; EasyShip can refine when available.
 */

export type DeliveryGeoPoint = {
  city?: string | null
  state?: string | null
  country?: string | null
  postalCode?: string | null
  latitude?: number | null
  longitude?: number | null
}

export type LocationDeliveryWindow = {
  earliestDays: number
  latestDays: number
  /** e.g. "Get it by Thu 19 Nov – Mon 23 Nov" */
  label: string
  /** Same city / same state / national / international / distance */
  band: 'local' | 'regional' | 'national' | 'international' | 'distance'
}

function normalizeCountry(raw?: string | null): string {
  const code = String(raw ?? '')
    .trim()
    .toUpperCase()
  if (code === 'IND' || code === 'INDIA') return 'IN'
  return code.slice(0, 2)
}

function normalizeText(raw?: string | null): string {
  return String(raw ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
}

function normalizePostal(raw?: string | null): string {
  return String(raw ?? '')
    .trim()
    .replace(/\s+/g, '')
    .toUpperCase()
}

function haversineKm(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number },
): number {
  const toRad = (d: number) => (d * Math.PI) / 180
  const R = 6371
  const dLat = toRad(b.latitude - a.latitude)
  const dLon = toRad(b.longitude - a.longitude)
  const lat1 = toRad(a.latitude)
  const lat2 = toRad(b.latitude)
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)))
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

export function formatGetItByLabel(earliestDays: number, latestDays: number): string {
  const today = new Date()
  const start = addBusinessDays(today, Math.max(1, earliestDays))
  const end = addBusinessDays(today, Math.max(earliestDays, latestDays))
  if (start.getTime() === end.getTime()) {
    return `Get it by ${formatDay(start)}`
  }
  return `Get it by ${formatDay(start)} – ${formatDay(end)}`
}

/**
 * Transit business-day window between warehouse and buyer.
 * Prefer lat/lng distance; else city/state/country/pin affinity.
 */
export function transitDaysFromLocations(
  origin: DeliveryGeoPoint | null | undefined,
  destination: DeliveryGeoPoint,
  processingDays = 0,
): LocationDeliveryWindow {
  const destCountry = normalizeCountry(destination.country) || 'IN'
  const originCountry = normalizeCountry(origin?.country) || destCountry
  const processing = Math.max(0, Math.floor(processingDays))

  const oLat = Number(origin?.latitude)
  const oLng = Number(origin?.longitude)
  const dLat = Number(destination.latitude)
  const dLng = Number(destination.longitude)
  const hasCoords =
    Number.isFinite(oLat) &&
    Number.isFinite(oLng) &&
    Number.isFinite(dLat) &&
    Number.isFinite(dLng)

  let min = 3
  let max = 5
  let band: LocationDeliveryWindow['band'] = 'national'

  if (originCountry && destCountry && originCountry !== destCountry) {
    min = 7
    max = 12
    band = 'international'
  } else if (hasCoords) {
    const km = haversineKm(
      { latitude: oLat, longitude: oLng },
      { latitude: dLat, longitude: dLng },
    )
    band = 'distance'
    if (km <= 40) {
      min = 1
      max = 2
      band = 'local'
    } else if (km <= 200) {
      min = 2
      max = 4
      band = 'regional'
    } else if (km <= 800) {
      min = 3
      max = 5
      band = 'national'
    } else {
      min = 4
      max = 7
      band = 'national'
    }
  } else {
    const oCity = normalizeText(origin?.city)
    const dCity = normalizeText(destination.city)
    const oState = normalizeText(origin?.state)
    const dState = normalizeText(destination.state)
    const oPin = normalizePostal(origin?.postalCode)
    const dPin = normalizePostal(destination.postalCode)

    if (oCity && dCity && oCity === dCity) {
      min = 1
      max = 2
      band = 'local'
    } else if (oState && dState && oState === dState) {
      min = 2
      max = 4
      band = 'regional'
    } else if (
      oPin.length >= 3 &&
      dPin.length >= 3 &&
      oPin.slice(0, 2) === dPin.slice(0, 2)
    ) {
      // Same India postal circle (first 2 digits) ≈ regional
      min = 2
      max = 4
      band = 'regional'
    } else if (
      oPin.length >= 3 &&
      dPin.length >= 3 &&
      oPin.slice(0, 1) === dPin.slice(0, 1)
    ) {
      min = 3
      max = 5
      band = 'national'
    } else {
      min = 3
      max = 6
      band = 'national'
    }
  }

  const earliestDays = processing + min
  const latestDays = processing + max
  return {
    earliestDays,
    latestDays,
    label: formatGetItByLabel(earliestDays, latestDays),
    band,
  }
}

export function shipsFromDetail(
  origin: DeliveryGeoPoint | null | undefined,
  destinationPostal?: string | null,
): string {
  const city = origin?.city?.trim()
  const state = origin?.state?.trim()
  const from = city || state
  const pin = normalizePostal(destinationPostal)
  if (from && pin) return `From ${from} to your pin ${pin}.`
  if (from) return `Ships from ${from}.`
  if (pin) return `Estimate for pin ${pin} based on your location.`
  return 'Estimate based on your location and the seller warehouse.'
}
