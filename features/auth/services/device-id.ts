import AsyncStorage from '@react-native-async-storage/async-storage'
import { Platform } from 'react-native'

const STORAGE_KEY = 'sheconomy.auth.device_id'

function randomId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return `dev_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`
}

let cachedDeviceId: string | null = null

/** Stable per-install device id used for multi-device session sync. */
export async function getOrCreateDeviceId(): Promise<string> {
  if (cachedDeviceId) {
    return cachedDeviceId
  }

  try {
    // 1. Web: prioritize synchronous localStorage for instant, rock-solid persistence
    if (Platform.OS === 'web' && typeof window !== 'undefined' && window.localStorage) {
      try {
        const existing = window.localStorage.getItem(STORAGE_KEY)
        if (existing) {
          cachedDeviceId = existing
          return existing
        }
        const next = randomId()
        window.localStorage.setItem(STORAGE_KEY, next)
        cachedDeviceId = next
        // Best-effort sync to AsyncStorage
        void AsyncStorage.setItem(STORAGE_KEY, next).catch(() => {})
        return next
      } catch {
        // Fall through to AsyncStorage if localStorage throws (e.g. private browsing quota)
      }
    }

    // 2. Native: use SecureStore when available
    if (Platform.OS !== 'web') {
      try {
        const SecureStore = await import('expo-secure-store')
        const existing = await SecureStore.getItemAsync(STORAGE_KEY)
        if (existing) {
          cachedDeviceId = existing
          return existing
        }
        const next = randomId()
        await SecureStore.setItemAsync(STORAGE_KEY, next)
        cachedDeviceId = next
        return next
      } catch {
        // Fall through to AsyncStorage.
      }
    }

    // 3. Fallback: AsyncStorage
    const existing = await AsyncStorage.getItem(STORAGE_KEY)
    if (existing) {
      cachedDeviceId = existing
      return existing
    }
    const next = randomId()
    await AsyncStorage.setItem(STORAGE_KEY, next)
    cachedDeviceId = next
    return next
  } catch {
    if (!cachedDeviceId) {
      cachedDeviceId = randomId()
    }
    return cachedDeviceId
  }
}

export function getDevicePlatform(): 'web' | 'ios' | 'android' {
  if (Platform.OS === 'ios') return 'ios'
  if (Platform.OS === 'android') return 'android'
  return 'web'
}

export function getDefaultDeviceLabel(): string {
  if (Platform.OS === 'ios') return 'iPhone / iPad'
  if (Platform.OS === 'android') return 'Android device'
  if (typeof navigator !== 'undefined') {
    const ua = navigator.userAgent
    if (/Macintosh/i.test(ua)) return 'Mac browser'
    if (/Windows/i.test(ua)) return 'Windows browser'
    if (/Linux/i.test(ua)) return 'Linux browser'
  }
  return 'Web browser'
}

export function getUserAgent(): string | null {
  if (typeof navigator !== 'undefined' && navigator.userAgent) return navigator.userAgent
  return `${Platform.OS}/${Platform.Version ?? 'unknown'}`
}
