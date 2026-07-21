import type { StoredUserGeo } from '~/lib/location/geo-storage'
import type { LatLng, LocationPermissionStatus } from '~/lib/location/types'

/** Soft GPS cache TTL — refresh after this age. */
export const USER_LOCATION_FRESHNESS_MS = 1000 * 60 * 45

export type UserLocationSource = 'gps' | 'stored' | 'profile' | 'manual' | 'none'

export type UserLocationStatus = 'idle' | 'loading' | 'ready' | 'denied' | 'unavailable'

export type UserLocationSnapshot = {
  latitude: number | null
  longitude: number | null
  city: string | null
  state: string | null
  country: string | null
  postal_code: string | null
  label: string | null
  permission: LocationPermissionStatus
  status: UserLocationStatus
  error: string | null
  source: UserLocationSource
  capturedAt: string | null
}

export const EMPTY_USER_LOCATION: UserLocationSnapshot = {
  latitude: null,
  longitude: null,
  city: null,
  state: null,
  country: null,
  postal_code: null,
  label: null,
  permission: 'undetermined',
  status: 'idle',
  error: null,
  source: 'none',
  capturedAt: null,
}

export function coordsFromSnapshot(snapshot: UserLocationSnapshot): LatLng | null {
  if (snapshot.latitude == null || snapshot.longitude == null) return null
  if (!Number.isFinite(snapshot.latitude) || !Number.isFinite(snapshot.longitude)) return null
  return { latitude: snapshot.latitude, longitude: snapshot.longitude }
}

export function buildLocationLabel(input: {
  city?: string | null
  state?: string | null
  country?: string | null
  postal_code?: string | null
}): string | null {
  const parts = [input.city, input.state, input.country].map((part) => part?.trim()).filter(Boolean)
  if (parts.length) return parts.join(', ')
  if (input.postal_code?.trim()) return input.postal_code.trim()
  return null
}

export function isStoredGeoFresh(
  geo: Pick<StoredUserGeo, 'capturedAt' | 'latitude' | 'longitude'>,
  now = Date.now(),
  ttlMs = USER_LOCATION_FRESHNESS_MS,
): boolean {
  if (geo.latitude == null || geo.longitude == null) return false
  if (!geo.capturedAt) return false
  const captured = Date.parse(geo.capturedAt)
  if (!Number.isFinite(captured)) return false
  return now - captured < ttlMs
}

export function needsReverseGeocode(geo: {
  latitude?: number | null
  longitude?: number | null
  city?: string | null
  country?: string | null
}): boolean {
  if (geo.latitude == null || geo.longitude == null) return false
  return !geo.city?.trim() || !geo.country?.trim()
}

export function mergeUserGeo(
  base: UserLocationSnapshot,
  patch: Partial<UserLocationSnapshot>,
): UserLocationSnapshot {
  const next: UserLocationSnapshot = {
    ...base,
    ...patch,
    latitude: patch.latitude !== undefined ? patch.latitude : base.latitude,
    longitude: patch.longitude !== undefined ? patch.longitude : base.longitude,
    city: patch.city !== undefined ? patch.city : base.city,
    state: patch.state !== undefined ? patch.state : base.state,
    country: patch.country !== undefined ? patch.country : base.country,
    postal_code: patch.postal_code !== undefined ? patch.postal_code : base.postal_code,
    permission: patch.permission ?? base.permission,
    status: patch.status ?? base.status,
    error: patch.error !== undefined ? patch.error : base.error,
    source: patch.source ?? base.source,
    capturedAt: patch.capturedAt !== undefined ? patch.capturedAt : base.capturedAt,
  }
  next.label =
    patch.label !== undefined
      ? patch.label
      : buildLocationLabel(next) ?? next.label
  return next
}

export function snapshotFromStored(
  stored: StoredUserGeo,
  extras?: Partial<UserLocationSnapshot>,
): UserLocationSnapshot {
  return mergeUserGeo(EMPTY_USER_LOCATION, {
    latitude: stored.latitude ?? null,
    longitude: stored.longitude ?? null,
    city: stored.city ?? null,
    state: stored.state ?? null,
    country: stored.country ?? null,
    postal_code: stored.postal_code ?? null,
    capturedAt: stored.capturedAt ?? null,
    source: 'stored',
    status:
      stored.latitude != null && stored.longitude != null ? 'ready' : 'idle',
    ...extras,
  })
}

/** Normalize places country (ISO2 or name) to uppercase ISO2 when possible. */
export function normalizeCountryCode(value: string | null | undefined): string | null {
  if (!value?.trim()) return null
  const trimmed = value.trim()
  if (/^[A-Za-z]{2}$/.test(trimmed)) return trimmed.toUpperCase()
  return trimmed
}
