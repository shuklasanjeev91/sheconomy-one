import { getDefaultCountryCode, resolveCountryCode } from './data'
import { geoPartsFromAddressFields } from './format'
import { validatePostalCode } from './postal'
import type { GeoLocationParts } from './types'

export type ValidateGeoOptions = {
  requirePostal?: boolean
  requireState?: boolean
}

export function createDefaultGeoLocation(): GeoLocationParts {
  return {
    countryCode: getDefaultCountryCode(),
    stateName: '',
    city: '',
    postalCode: '',
  }
}

export function validateGeoLocationParts(
  parts: GeoLocationParts,
  options: ValidateGeoOptions = {},
): string | null {
  const { requirePostal = true, requireState = true } = options

  if (!parts.city?.trim() || parts.city.trim().length < 2) {
    return 'Select or enter a valid city.'
  }

  if (requireState && (!parts.stateName?.trim() || parts.stateName.trim().length < 2)) {
    return 'Select or enter a valid state or region.'
  }

  const countryCode = resolveCountryCode(parts.countryCode)
  if (!countryCode) {
    return 'Select a country.'
  }

  if (requirePostal) {
    const postalError = validatePostalCode(countryCode, parts.postalCode ?? '')
    if (postalError) return postalError
  }

  return null
}

export function geoPartsToShopAddress(parts: GeoLocationParts) {
  return {
    city: parts.city.trim(),
    state: parts.stateName.trim(),
    country: resolveCountryCode(parts.countryCode),
    postal_code: parts.postalCode?.trim() ?? '',
  }
}

export function shopAddressToGeoParts(address: {
  city?: string | null
  state?: string | null
  country?: string | null
  postal_code?: string | null
}): GeoLocationParts {
  return geoPartsFromAddressFields({
    city: address.city ?? '',
    state: address.state ?? '',
    country: address.country ?? '',
    postal_code: address.postal_code ?? '',
  })
}
