import { useEffect, useState } from 'react'

import {
  inferCountryFromLocale,
  parseProfileLocation,
  type UserGeo,
} from '~/commerce/lib/marketplace-personalization'
import { useOptionalRegionPreferences } from '~/lib/locale/RegionPreferencesContext'
import {
  getCurrentPosition,
  readStoredUserGeo,
  readStoredUserGeoSync,
  writeStoredUserGeo,
} from '~/lib/location'

function sameGeo(a: UserGeo, b: UserGeo): boolean {
  return (
    a.latitude === b.latitude &&
    a.longitude === b.longitude &&
    a.city === b.city &&
    a.state === b.state &&
    a.country === b.country &&
    a.postal_code === b.postal_code
  )
}

/**
 * Session geo for marketplace personalization.
 * Merges region prefs, profile location, stored coords, and optional device capture.
 */
export function useUserGeo(profileLocation?: string | null) {
  const region = useOptionalRegionPreferences()
  const countryCode = region?.countryCode
  const [geo, setGeo] = useState<UserGeo>(() => ({
    country: inferCountryFromLocale(),
    ...readStoredUserGeoSync(),
    ...parseProfileLocation(profileLocation),
  }))

  useEffect(() => {
    void readStoredUserGeo().then((stored) => {
      if (!stored || Object.keys(stored).length === 0) return
      setGeo((current) => {
        const next = { ...current, ...stored }
        return sameGeo(current, next) ? current : next
      })
    })
  }, [])

  useEffect(() => {
    const fromProfile = parseProfileLocation(profileLocation)
    setGeo((current) => {
      const next: UserGeo = {
        ...fromProfile,
        ...current,
        country: countryCode ?? current.country ?? inferCountryFromLocale(),
      }
      return sameGeo(current, next) ? current : next
    })
  }, [profileLocation, countryCode])

  useEffect(() => {
    if (geo.latitude != null && geo.longitude != null) return

    let cancelled = false
    void (async () => {
      const position = await getCurrentPosition({ accuracy: 'approximate', persist: true })
      if (cancelled || !position.coords) return
      const next = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        country: geo.country ?? countryCode ?? inferCountryFromLocale(),
      }
      void writeStoredUserGeo(next)
      setGeo((current) => {
        const merged = { ...current, ...next }
        return sameGeo(current, merged) ? current : merged
      })
    })()

    return () => {
      cancelled = true
    }
  }, [geo.country, geo.latitude, geo.longitude, countryCode])

  return geo
}
