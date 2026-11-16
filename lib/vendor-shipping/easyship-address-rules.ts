/**
 * Pure EasyShip address completeness rules (shared with Edge behavior).
 * Edge resolvers live in supabase/functions/_shared/easyship-addresses.ts.
 */

export const EASYSHIP_SELLER_ORIGIN_SETUP_PATH = '/vendor/settings?section=connect'

export type ShipAddressErrorCode =
  | 'seller_origin_incomplete'
  | 'buyer_destination_incomplete'

export class ShipAddressError extends Error {
  code: ShipAddressErrorCode
  setupPath?: string

  constructor(code: ShipAddressErrorCode, message: string, setupPath?: string) {
    super(message)
    this.name = 'ShipAddressError'
    this.code = code
    this.setupPath = setupPath
  }
}

function trimStr(value: unknown, fallback = ''): string {
  if (value == null) return fallback
  const s = String(value).trim()
  return s || fallback
}

export function countryAlpha2(raw: unknown, fallback = ''): string {
  const code = trimStr(raw, fallback).toUpperCase()
  if (code === 'IND' || code === 'INDIA') return 'IN'
  if (code === 'USA' || code === 'UNITED STATES') return 'US'
  const sliced = code.slice(0, 2)
  return /^[A-Z]{2}$/.test(sliced) ? sliced : fallback || ''
}

export type ShipAddressLike = {
  line_1?: string | null
  city?: string | null
  postal_code?: string | null
  country_alpha2?: string | null
}

/** Same completeness rules as Edge assertShipAddressComplete. */
export function assertShipAddressComplete(
  address: ShipAddressLike,
  kind: 'origin' | 'destination',
): void {
  const line1 = trimStr(address.line_1)
  const city = trimStr(address.city)
  const postal = trimStr(address.postal_code)
  const country = countryAlpha2(address.country_alpha2)

  const missing: string[] = []
  if (!line1 || /^(warehouse|address)$/i.test(line1)) missing.push('street')
  if (!city || /^city$/i.test(city)) missing.push('city')
  if (!postal || /^0+$/.test(postal)) missing.push('postal_code')
  if (!country || country.length !== 2) missing.push('country')

  if (!missing.length) return

  if (kind === 'origin') {
    throw new ShipAddressError(
      'seller_origin_incomplete',
      `Seller fulfillment address is incomplete (missing ${missing.join(', ')}). Update Connect → Address / warehouse.`,
      EASYSHIP_SELLER_ORIGIN_SETUP_PATH,
    )
  }
  throw new ShipAddressError(
    'buyer_destination_incomplete',
    `Buyer delivery address is incomplete (missing ${missing.join(', ')}).`,
  )
}

export function isPlaceholderShipStreet(value: unknown): boolean {
  const line1 = trimStr(value)
  return !line1 || /^(warehouse|address)$/i.test(line1)
}
