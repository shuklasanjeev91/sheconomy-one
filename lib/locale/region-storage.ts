import AsyncStorage from '@react-native-async-storage/async-storage'
import { Platform } from 'react-native'

export const REGION_PREFS_STORAGE_KEY = 'sheconomy:region-preferences'

export type StoredRegionPreferences = {
  countryCode: string
  languageCode: string
  currencyCode: string
  /** True once the user explicitly saved preferences (skip re-auto-detect overwrite). */
  userSet: boolean
  updatedAt: string
}

export async function readStoredRegionPreferences(): Promise<StoredRegionPreferences | null> {
  try {
    let raw: string | null = null
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      raw = window.localStorage.getItem(REGION_PREFS_STORAGE_KEY)
    } else {
      raw = await AsyncStorage.getItem(REGION_PREFS_STORAGE_KEY)
    }
    if (!raw) return null
    const parsed = JSON.parse(raw) as StoredRegionPreferences
    if (!parsed?.countryCode || !parsed?.languageCode || !parsed?.currencyCode) return null
    return parsed
  } catch {
    return null
  }
}

export async function writeStoredRegionPreferences(prefs: StoredRegionPreferences): Promise<void> {
  try {
    const payload = JSON.stringify(prefs)
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.localStorage.setItem(REGION_PREFS_STORAGE_KEY, payload)
      return
    }
    await AsyncStorage.setItem(REGION_PREFS_STORAGE_KEY, payload)
  } catch {
    // ignore quota / private mode
  }
}
