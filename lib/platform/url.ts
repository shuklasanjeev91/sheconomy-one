import { Platform } from 'react-native'

export function getWindowOrigin(): string {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    return window.location.origin
  }
  return 'https://sheconomy.one'
}

export function getSearchParam(key: string): string | null {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return null
  return new URLSearchParams(window.location.search).get(key)
}

export function buildAbsoluteUrl(path: string): string {
  const normalized = path.startsWith('/') ? path : `/${path}`
  return `${getWindowOrigin()}${normalized}`
}
