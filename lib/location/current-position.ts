import { Platform } from 'react-native'

import { inferCountryFromLocale } from '~/commerce/lib/infer-country-from-locale'
import { getCountryName, getDefaultCountryCode } from '~/lib/geo/data'

import { writeStoredUserGeo } from './geo-storage'
import {
  expoAccuracyForPreference,
  getLocationPermissionStatus,
  permissionDeniedMessage,
  requestForegroundLocationPermission,
} from './permissions'
import type {
  CurrentPositionResult,
  LocationAccuracyPreference,
  LocationPermissionStatus,
} from './types'

type GetCurrentPositionOptions = {
  accuracy?: LocationAccuracyPreference
  /** Persist coords to session storage when successful. */
  persist?: boolean
  maximumAgeMs?: number
  timeoutMs?: number
}

function geolocationErrorMessage(error: unknown): {
  message: string
  permission: LocationPermissionStatus
} {
  // Browser GeolocationPositionError is not an instanceof Error.
  const code =
    error && typeof error === 'object' && 'code' in error
      ? Number((error as { code?: number }).code)
      : null
  const rawMessage =
    error instanceof Error
      ? error.message
      : error && typeof error === 'object' && 'message' in error
        ? String((error as { message?: unknown }).message ?? '')
        : ''

  // 1 PERMISSION_DENIED, 2 POSITION_UNAVAILABLE, 3 TIMEOUT
  if (code === 1) {
    return {
      message:
        permissionDeniedMessage('denied') ??
        'Location permission was denied. Allow location for this site and try again.',
      permission: 'denied',
    }
  }
  if (code === 2) {
    return {
      message: 'Location is temporarily unavailable. Try again or enter your address manually.',
      permission: 'granted',
    }
  }
  if (code === 3 || /timeout/i.test(rawMessage)) {
    return {
      message: 'Location request timed out. Try again, or choose your address on the map.',
      permission: 'undetermined',
    }
  }
  if (rawMessage.trim()) {
    return { message: rawMessage.trim(), permission: 'denied' }
  }
  return { message: 'Could not read location.', permission: 'denied' }
}

/**
 * Soft current-position request for web + native.
 * Never throws; never requests background location.
 */
export async function getCurrentPosition(
  options: GetCurrentPositionOptions = {},
): Promise<CurrentPositionResult> {
  const accuracy = options.accuracy ?? 'balanced'
  const persist = options.persist !== false
  const maximumAge = options.maximumAgeMs ?? 15 * 60 * 1000
  const timeout = options.timeoutMs ?? 12_000

  try {
    if (Platform.OS === 'web') {
      if (typeof navigator === 'undefined' || !navigator.geolocation) {
        return {
          coords: null,
          accuracy: null,
          permission: 'unavailable',
          error: 'Location is not available in this browser.',
        }
      }

      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          maximumAge,
          timeout,
          enableHighAccuracy: accuracy === 'precise',
        })
      })

      const coords = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      }

      if (persist) {
        void writeStoredUserGeo({
          ...coords,
          country: inferCountryFromLocale() ?? getDefaultCountryCode(),
        })
      }

      return {
        coords,
        accuracy: position.coords.accuracy ?? null,
        permission: 'granted',
        error: null,
      }
    }

    let permission = await getLocationPermissionStatus()
    if (permission !== 'granted') {
      permission = await requestForegroundLocationPermission()
    }
    if (permission !== 'granted') {
      return {
        coords: null,
        accuracy: null,
        permission,
        error: permissionDeniedMessage(permission) ?? 'Location permission was denied.',
      }
    }

    const Location = await import('expo-location')
    const position = await Location.getCurrentPositionAsync({
      accuracy: expoAccuracyForPreference(accuracy) as never,
    })

    const coords = {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
    }

    if (persist) {
      void writeStoredUserGeo({
        ...coords,
        country: inferCountryFromLocale() ?? getDefaultCountryCode(),
      })
    }

    return {
      coords,
      accuracy: position.coords.accuracy ?? null,
      permission: 'granted',
      error: null,
    }
  } catch (error) {
    const mapped = geolocationErrorMessage(error)
    return {
      coords: null,
      accuracy: null,
      permission: mapped.permission,
      error: mapped.message,
    }
  }
}

/** Onboarding-friendly wrapper used by profile prefs. */
export async function requestOnboardingLocationCompat(): Promise<{
  latitude: number | null
  longitude: number | null
  countryCode: string | null
  locationLabel: string | null
  error: string | null
  permission: LocationPermissionStatus
}> {
  const localeCountry = inferCountryFromLocale() ?? getDefaultCountryCode()
  const result = await getCurrentPosition({ accuracy: 'approximate', persist: true })

  return {
    latitude: result.coords?.latitude ?? null,
    longitude: result.coords?.longitude ?? null,
    countryCode: localeCountry,
    locationLabel: getCountryName(localeCountry),
    error: result.error,
    permission: result.permission,
  }
}
