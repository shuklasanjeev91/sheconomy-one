import { useMemo } from 'react'

import {
  inferCountryFromLocale,
  parseProfileLocation,
  type UserGeo,
} from '~/commerce/lib/marketplace-personalization'
import { useOptionalRegionPreferences } from '~/lib/locale/RegionPreferencesContext'
import { useOptionalUserLocation } from '~/lib/location'

/**
 * Session geo for marketplace personalization / search.
 * Prefers the shared UserLocationProvider snapshot; falls back to profile + locale.
 */
export function useUserGeo(profileLocation?: string | null): UserGeo {
  const region = useOptionalRegionPreferences()
  const location = useOptionalUserLocation()
  const fromProfile = useMemo(() => parseProfileLocation(profileLocation), [profileLocation])

  return useMemo(() => {
    const country =
      location?.country ??
      region?.countryCode ??
      fromProfile.country ??
      inferCountryFromLocale()

    return {
      latitude: location?.latitude ?? fromProfile.latitude ?? null,
      longitude: location?.longitude ?? fromProfile.longitude ?? null,
      city: location?.city ?? fromProfile.city ?? null,
      state: location?.state ?? fromProfile.state ?? null,
      country,
      postal_code: location?.postal_code ?? fromProfile.postal_code ?? null,
    }
  }, [location, region?.countryCode, fromProfile])
}
