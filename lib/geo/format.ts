import { getCountryName, getStateByName, resolveCountryCode } from '~/lib/geo/data'
import type { GeoLocationParts } from '~/lib/geo/types'

export function formatGeoLocation(parts: Partial<GeoLocationParts>): string {
  const countryCode = parts.countryCode ? resolveCountryCode(parts.countryCode) : ''
  const countryName = countryCode ? getCountryName(countryCode) : ''
  return [parts.city?.trim(), parts.stateName?.trim(), countryName]
    .filter((part): part is string => !!part)
    .join(', ')
}

export function formatGeoLocationShort(parts: Partial<GeoLocationParts>): string {
  return [parts.city?.trim(), parts.stateName?.trim()].filter((part): part is string => !!part).join(', ')
}

/** Best-effort parse of "City, State, Country" free text into structured parts. */
export function parseGeoLocationText(value: string | null | undefined): Partial<GeoLocationParts> {
  const raw = value?.trim()
  if (!raw) return {}

  const segments = raw
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)

  if (segments.length === 0) return {}
  if (segments.length === 1) {
    return { city: segments[0] }
  }

  const countrySegment = segments[segments.length - 1]
  const countryCode = resolveCountryCode(countrySegment)
  const countryName = getCountryName(countryCode, countrySegment)
  const usedCountry = countryName.toLowerCase() === countrySegment.toLowerCase() || countryCode.length === 2

  if (segments.length === 2) {
    if (usedCountry) {
      // "X, Country" is ambiguous — X may be a lone city OR a lone state (when
      // no city has been chosen yet). Prefer state when X is a known state of
      // the country, otherwise treat it as a city.
      const stateMatch = getStateByName(countryCode, segments[0])
      if (stateMatch) {
        return { stateName: stateMatch.name, countryCode }
      }
      return { city: segments[0], countryCode }
    }
    return { city: segments[0], stateName: segments[1] }
  }

  const city = segments[0]
  const stateName = segments[segments.length - 2]
  if (usedCountry) {
    return { city, stateName, countryCode }
  }

  return { city, stateName: segments.slice(1).join(', ') }
}

export function geoPartsFromAddressFields(input: {
  country?: string | null
  state?: string | null
  city?: string | null
  postal_code?: string | null
}): GeoLocationParts {
  return {
    countryCode: resolveCountryCode(input.country),
    stateName: input.state?.trim() ?? '',
    city: input.city?.trim() ?? '',
    postalCode: input.postal_code?.trim() ?? '',
  }
}

export function matchStateName(countryCode: string, stateName: string): string {
  const trimmed = stateName.trim()
  if (!trimmed) return ''
  const match = getStateByName(countryCode, trimmed)
  return match?.name ?? trimmed
}
