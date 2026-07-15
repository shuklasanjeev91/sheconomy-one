import { Platform } from 'react-native'

import type { LocationAccuracyPreference, LocationPermissionStatus } from './types'

/**
 * Foreground location permission only — Phase 4 never requests background.
 * Web relies on the browser prompt at getCurrentPosition time.
 */
export async function getLocationPermissionStatus(): Promise<LocationPermissionStatus> {
  if (Platform.OS === 'web') {
    if (typeof navigator === 'undefined' || !navigator.geolocation) return 'unavailable'
    try {
      const permissions = (navigator as Navigator & { permissions?: Permissions }).permissions
      if (!permissions?.query) return 'undetermined'
      const result = await permissions.query({ name: 'geolocation' as PermissionName })
      if (result.state === 'granted') return 'granted'
      if (result.state === 'denied') return 'denied'
      return 'undetermined'
    } catch {
      return 'undetermined'
    }
  }

  try {
    const Location = await import('expo-location')
    const current = await Location.getForegroundPermissionsAsync()
    if (current.granted) return 'granted'
    if (current.canAskAgain === false) return 'denied'
    return 'undetermined'
  } catch {
    return 'unavailable'
  }
}

/** Request foreground location. Never asks for background. */
export async function requestForegroundLocationPermission(): Promise<LocationPermissionStatus> {
  if (Platform.OS === 'web') {
    // Browser prompts on getCurrentPosition; treat as undetermined until then.
    if (typeof navigator === 'undefined' || !navigator.geolocation) return 'unavailable'
    return 'undetermined'
  }

  try {
    const Location = await import('expo-location')
    const result = await Location.requestForegroundPermissionsAsync()
    return result.granted ? 'granted' : 'denied'
  } catch {
    return 'unavailable'
  }
}

/** Map preference → expo Accuracy (approximate first on iOS when requested). */
export function expoAccuracyForPreference(preference: LocationAccuracyPreference) {
  // Numbers match expo-location Accuracy enum; stub uses Balanced = 3.
  if (preference === 'precise') return 4 // High
  if (preference === 'approximate') return 2 // Low
  return 3 // Balanced
}

export function permissionDeniedMessage(status: LocationPermissionStatus): string | null {
  if (status === 'denied') {
    return Platform.OS === 'ios'
      ? 'Location access is off. Enable it in Settings → SHEconomy → Location.'
      : Platform.OS === 'android'
        ? 'Location permission was denied. Enable it in system settings to use this feature.'
        : 'Location permission was denied in this browser.'
  }
  if (status === 'unavailable') {
    return 'Location is not available on this device.'
  }
  return null
}
