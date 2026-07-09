import { useEffect, useState } from 'react'
import { Platform } from 'react-native'

import {
  inferCountryFromLocale,
  parseProfileLocation,
  type UserGeo,
} from '~/commerce/lib/marketplace-personalization'
import { readSessionValue, readSessionValueSync, writeSessionValue } from '~/lib/platform/storage'

const GEO_STORAGE_KEY = 'sheconomy:user-geo'

type StoredGeo = UserGeo & { capturedAt?: string }

function readStoredGeo(): UserGeo {
  try {
    const raw = readSessionValueSync(GEO_STORAGE_KEY)
    if (!raw) return {}
    return JSON.parse(raw) as StoredGeo
  } catch {
    return {}
  }
}

export function useUserGeo(profileLocation?: string | null) {
  const [geo, setGeo] = useState<UserGeo>(() => ({
    country: inferCountryFromLocale(),
    ...readStoredGeo(),
    ...parseProfileLocation(profileLocation),
  }))

  useEffect(() => {
    void readSessionValue(GEO_STORAGE_KEY).then((raw) => {
      if (!raw) return
      try {
        const stored = JSON.parse(raw) as StoredGeo
        setGeo((current) => ({ ...current, ...stored }))
      } catch {
        // ignore parse errors
      }
    })
  }, [])

  useEffect(() => {
    setGeo((current) => ({
      country: current.country ?? inferCountryFromLocale(),
      ...parseProfileLocation(profileLocation),
      ...current,
    }))
  }, [profileLocation])

  useEffect(() => {
    if (geo.latitude != null && geo.longitude != null) return

    if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const next = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            country: geo.country ?? inferCountryFromLocale(),
          }
          void writeSessionValue(GEO_STORAGE_KEY, JSON.stringify({ ...next, capturedAt: new Date().toISOString() }))
          setGeo((current) => ({ ...current, ...next }))
        },
        () => undefined,
        { maximumAge: 15 * 60 * 1000, timeout: 8000 },
      )
      return
    }

    if (Platform.OS !== 'web') {
      let cancelled = false

      void (async () => {
        try {
          const Location = await import('expo-location')
          const permission = await Location.requestForegroundPermissionsAsync()
          if (!permission.granted || cancelled) return

          const position = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          })

          if (cancelled) return

          const next = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            country: geo.country ?? inferCountryFromLocale(),
          }
          void writeSessionValue(GEO_STORAGE_KEY, JSON.stringify({ ...next, capturedAt: new Date().toISOString() }))
          setGeo((current) => ({ ...current, ...next }))
        } catch {
          // location unavailable — locale fallback remains
        }
      })()

      return () => {
        cancelled = true
      }
    }
  }, [geo.country, geo.latitude, geo.longitude])

  return geo
}
