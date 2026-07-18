import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

import { useOptionalRegionPreferences } from '~/lib/locale/RegionPreferencesContext'
import { getCurrentPosition } from '~/lib/location/current-position'
import {
  clearStoredUserGeo,
  readStoredUserGeo,
  readStoredUserGeoSync,
  writeStoredUserGeo,
  type StoredUserGeo,
} from '~/lib/location/geo-storage'
import { reverseGeocode } from '~/lib/location/places-client'
import {
  requestForegroundLocationPermission,
  getLocationPermissionStatus,
} from '~/lib/location/permissions'
import type { LatLng, LocationPermissionStatus } from '~/lib/location/types'
import {
  EMPTY_USER_LOCATION,
  coordsFromSnapshot,
  isStoredGeoFresh,
  mergeUserGeo,
  needsReverseGeocode,
  normalizeCountryCode,
  snapshotFromStored,
  type UserLocationSnapshot,
  type UserLocationSource,
} from '~/lib/location/user-location-utils'

type ManualGeoInput = {
  latitude: number
  longitude: number
  city?: string | null
  state?: string | null
  country?: string | null
  postal_code?: string | null
  label?: string | null
}

type UserLocationContextValue = UserLocationSnapshot & {
  coords: LatLng | null
  ready: boolean
  refresh: () => Promise<void>
  clear: () => Promise<void>
  setManualGeo: (input: ManualGeoInput) => Promise<void>
  requestPermission: () => Promise<LocationPermissionStatus>
}

const UserLocationContext = createContext<UserLocationContextValue | null>(null)

/** Single in-flight soft locate across remounts / multiple consumers. */
let inflightLocate: Promise<UserLocationSnapshot> | null = null
let regionAssistCountry: string | null = null

function toStored(snapshot: UserLocationSnapshot): StoredUserGeo {
  return {
    latitude: snapshot.latitude,
    longitude: snapshot.longitude,
    city: snapshot.city,
    state: snapshot.state,
    country: snapshot.country,
    postal_code: snapshot.postal_code,
    capturedAt: snapshot.capturedAt ?? undefined,
  }
}

async function enrichWithReverseGeocode(
  snapshot: UserLocationSnapshot,
): Promise<UserLocationSnapshot> {
  const coords = coordsFromSnapshot(snapshot)
  if (!coords || !needsReverseGeocode(snapshot)) return snapshot

  try {
    const resolved = await Promise.race([
      reverseGeocode(coords),
      new Promise<{ data: null; error: string }>((resolve) =>
        setTimeout(() => resolve({ data: null, error: 'Reverse geocode timed out' }), 8_000),
      ),
    ])
    if (!resolved.data) return snapshot

    const address = resolved.data
    const shortLabel =
      [address.city, address.state].filter(Boolean).join(', ') ||
      address.formatted ||
      snapshot.label
    return mergeUserGeo(snapshot, {
      city: address.city || snapshot.city,
      state: address.state || snapshot.state,
      country: normalizeCountryCode(address.country) ?? snapshot.country,
      postal_code: address.postal_code || snapshot.postal_code,
      label: shortLabel,
      source: snapshot.source === 'none' ? 'gps' : snapshot.source,
      status: 'ready',
    })
  } catch {
    return snapshot
  }
}

async function locateOnce(force: boolean): Promise<UserLocationSnapshot> {
  if (!force && inflightLocate) return inflightLocate

  inflightLocate = (async () => {
    const stored = await readStoredUserGeo()
    let snapshot = snapshotFromStored(stored)

    if (!force && isStoredGeoFresh(stored)) {
      const enriched = await enrichWithReverseGeocode(snapshot)
      if (
        enriched.city !== snapshot.city ||
        enriched.country !== snapshot.country ||
        enriched.state !== snapshot.state ||
        enriched.postal_code !== snapshot.postal_code
      ) {
        await writeStoredUserGeo(toStored(enriched))
      }
      return enriched
    }

    const position = await getCurrentPosition({
      accuracy: 'approximate',
      persist: false,
      timeoutMs: 10_000,
    })

    if (!position.coords) {
      if (snapshot.latitude != null && snapshot.longitude != null) {
        return mergeUserGeo(snapshot, {
          permission: position.permission,
          error: position.error,
          status: 'ready',
          source: 'stored',
        })
      }
      return mergeUserGeo(EMPTY_USER_LOCATION, {
        permission: position.permission,
        error: position.error,
        status:
          position.permission === 'unavailable'
            ? 'unavailable'
            : position.permission === 'denied'
              ? 'denied'
              : 'idle',
        source: 'none',
      })
    }

    snapshot = mergeUserGeo(snapshot, {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      permission: position.permission,
      error: null,
      status: 'ready',
      source: 'gps',
      capturedAt: new Date().toISOString(),
    })

    snapshot = await enrichWithReverseGeocode(snapshot)
    await writeStoredUserGeo(toStored(snapshot))
    return snapshot
  })()

  try {
    return await inflightLocate
  } finally {
    inflightLocate = null
  }
}

export function UserLocationProvider({ children }: { children: ReactNode }) {
  const region = useOptionalRegionPreferences()
  const [snapshot, setSnapshot] = useState<UserLocationSnapshot>(() =>
    snapshotFromStored(readStoredUserGeoSync()),
  )

  const applySnapshot = useCallback((next: UserLocationSnapshot) => {
    setSnapshot((current) => mergeUserGeo(current, next))
  }, [])

  useEffect(() => {
    let cancelled = false

    void (async () => {
      setSnapshot((current) => {
        // Keep showing stored coords while refreshing; only mark loading when empty.
        if (current.latitude != null && current.longitude != null) {
          return mergeUserGeo(current, { error: null })
        }
        return mergeUserGeo(current, { status: 'loading', error: null })
      })
      try {
        const next = await locateOnce(false)
        if (cancelled) return
        applySnapshot(next)
      } catch (error) {
        if (cancelled) return
        applySnapshot(
          mergeUserGeo(EMPTY_USER_LOCATION, {
            permission: 'undetermined',
            status: 'idle',
            error: error instanceof Error ? error.message : 'Could not read location.',
            source: 'none',
          }),
        )
      }
    })()

    return () => {
      cancelled = true
    }
  }, [applySnapshot])

  // Soft-fill region country from GPS only when prefs were auto-detected.
  useEffect(() => {
    if (!region || region.userSet || !region.ready) return
    const country = normalizeCountryCode(snapshot.country)
    if (!country || country.length !== 2) return
    if (country === region.countryCode) return
    if (regionAssistCountry === country) return
    regionAssistCountry = country
    void region.setCountry(country)
  }, [region, snapshot.country])

  const refresh = useCallback(async () => {
    setSnapshot((current) => mergeUserGeo(current, { status: 'loading', error: null }))
    try {
      const next = await locateOnce(true)
      applySnapshot(next)
    } catch (error) {
      applySnapshot(
        mergeUserGeo(snapshot, {
          status: snapshot.latitude != null ? 'ready' : 'idle',
          error: error instanceof Error ? error.message : 'Could not refresh location.',
        }),
      )
    }
  }, [applySnapshot, snapshot])

  const clear = useCallback(async () => {
    await clearStoredUserGeo()
    regionAssistCountry = null
    applySnapshot({ ...EMPTY_USER_LOCATION, status: 'idle', permission: 'undetermined' })
  }, [applySnapshot])

  const setManualGeo = useCallback(
    async (input: ManualGeoInput) => {
      let next = mergeUserGeo(snapshot, {
        latitude: input.latitude,
        longitude: input.longitude,
        city: input.city ?? null,
        state: input.state ?? null,
        country: normalizeCountryCode(input.country) ?? null,
        postal_code: input.postal_code ?? null,
        label: input.label ?? null,
        source: 'manual' as UserLocationSource,
        status: 'ready',
        error: null,
        permission: 'granted',
        capturedAt: new Date().toISOString(),
      })
      next = await enrichWithReverseGeocode(next)
      await writeStoredUserGeo(toStored(next))
      applySnapshot(next)
    },
    [applySnapshot, snapshot],
  )

  const requestPermission = useCallback(async () => {
    const status = await requestForegroundLocationPermission()
    applySnapshot(mergeUserGeo(snapshot, { permission: status }))
    if (status === 'granted' || status === 'undetermined') {
      await refresh()
    }
    return status
  }, [applySnapshot, refresh, snapshot])

  const value = useMemo<UserLocationContextValue>(() => {
    const coords = coordsFromSnapshot(snapshot)
    return {
      ...snapshot,
      coords,
      ready: snapshot.status === 'ready' || Boolean(coords),
      refresh,
      clear,
      setManualGeo,
      requestPermission,
    }
  }, [snapshot, refresh, clear, setManualGeo, requestPermission])

  return (
    <UserLocationContext.Provider value={value}>{children}</UserLocationContext.Provider>
  )
}

export function useUserLocation() {
  const ctx = useContext(UserLocationContext)
  if (!ctx) {
    throw new Error('useUserLocation must be used within UserLocationProvider')
  }
  return ctx
}

export function useOptionalUserLocation() {
  return useContext(UserLocationContext)
}

/** Test helper — reset module in-flight + region assist guards. */
export function resetUserLocationGuardsForTests() {
  inflightLocate = null
  regionAssistCountry = null
}

export async function locateUserLocationForTests(force = false) {
  return locateOnce(force)
}

// Keep permission helper reachable for consumers that only need status.
export { getLocationPermissionStatus }
