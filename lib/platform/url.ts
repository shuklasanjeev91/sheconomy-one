import { Platform } from 'react-native'

export function getWindowOrigin(): string {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    return window.location.origin
  }

  const configured =
    (typeof process !== 'undefined' && process.env?.EXPO_PUBLIC_WEB_APP_URL) ||
    (typeof import.meta !== 'undefined' && import.meta.env?.EXPO_PUBLIC_WEB_APP_URL)

  if (configured && typeof configured === 'string' && configured.length > 0) {
    return configured.replace(/\/$/, '')
  }

  return 'https://sheconomy-one-sanjeev-shuklas-projects.vercel.app'
}

export function getSearchParam(key: string): string | null {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return null
  return new URLSearchParams(window.location.search).get(key)
}

export function buildAbsoluteUrl(path: string): string {
  const normalized = path.startsWith('/') ? path : `/${path}`
  return `${getWindowOrigin()}${normalized}`
}
