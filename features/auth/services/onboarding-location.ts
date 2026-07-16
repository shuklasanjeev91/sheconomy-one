import { getCountryName, getDefaultCountryCode } from '~/lib/geo/data'
import { inferCountryFromLocale } from '~/commerce/lib/infer-country-from-locale'
import { getCurrentPosition } from '~/lib/location/current-position'

export type OnboardingLocationResult = {
  latitude: number | null
  longitude: number | null
  countryCode: string | null
  /** Human-readable location label for profiles.location */
  locationLabel: string | null
  error: string | null
}

/**
 * Soft location request for onboarding. Never throws; failures return empty fields.
 * Web uses geolocation API; native uses expo-location foreground permission.
 */
export async function requestOnboardingLocation(): Promise<OnboardingLocationResult> {
  const localeCountry = inferCountryFromLocale() ?? getDefaultCountryCode()
  const result = await getCurrentPosition({ accuracy: 'approximate', persist: true })

  return {
    latitude: result.coords?.latitude ?? null,
    longitude: result.coords?.longitude ?? null,
    countryCode: localeCountry,
    locationLabel: getCountryName(localeCountry),
    error: result.error,
  }
}
