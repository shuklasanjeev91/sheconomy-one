import AsyncStorage from '@react-native-async-storage/async-storage'
import { Platform } from 'react-native'

import { readSessionValue, readSessionValueSync, writeSessionValue } from '~/lib/platform/storage'

import type { LatLng } from './types'

export const USER_GEO_STORAGE_KEY = 'sheconomy:user-geo'

export type StoredUserGeo = {
  latitude?: number | null
  longitude?: number | null
  city?: string | null
  state?: string | null
  country?: string | null
  postal_code?: string | null
  capturedAt?: string
}

export function readStoredUserGeoSync(): StoredUserGeo {
  try {
    const raw = readSessionValueSync(USER_GEO_STORAGE_KEY)
    if (!raw) return {}
    return JSON.parse(raw) as StoredUserGeo
  } catch {
    return {}
  }
}

export async function readStoredUserGeo(): Promise<StoredUserGeo> {
  try {
    const raw = await readSessionValue(USER_GEO_STORAGE_KEY)
    if (!raw) return {}
    return JSON.parse(raw) as StoredUserGeo
  } catch {
    return {}
  }
}

export async function writeStoredUserGeo(geo: StoredUserGeo): Promise<void> {
  const next = { ...geo, capturedAt: new Date().toISOString() }
  await writeSessionValue(USER_GEO_STORAGE_KEY, JSON.stringify(next))
}

export async function clearStoredUserGeo(): Promise<void> {
  try {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.sessionStorage.removeItem(USER_GEO_STORAGE_KEY)
      return
    }
    await AsyncStorage.removeItem(USER_GEO_STORAGE_KEY)
  } catch {
    // ignore
  }
}

export function coordsFromStoredGeo(geo: StoredUserGeo): LatLng | null {
  if (geo.latitude == null || geo.longitude == null) return null
  return { latitude: geo.latitude, longitude: geo.longitude }
}
