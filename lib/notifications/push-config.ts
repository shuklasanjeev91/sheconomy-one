/** Shared push config for web / iOS / Android clients. */
import { Platform } from 'react-native'

export type PushPlatform = 'web' | 'ios' | 'android'

export function getOneSignalAppId(): string | null {
  const value =
    (typeof process !== 'undefined' ? process.env.EXPO_PUBLIC_ONESIGNAL_APP_ID : undefined) ??
    undefined
  const trimmed = typeof value === 'string' ? value.trim() : ''
  return trimmed.length > 0 ? trimmed : null
}

export function resolvePushPlatform(): PushPlatform {
  if (Platform.OS === 'ios') return 'ios'
  if (Platform.OS === 'android') return 'android'
  return 'web'
}

/** Convert absolute/relative action URLs into in-app paths. */
export function pathFromNotificationUrl(url: string | null | undefined): string | null {
  if (!url) return null
  const trimmed = url.trim()
  if (!trimmed) return null
  if (trimmed.startsWith('/')) return trimmed
  try {
    const parsed = new URL(trimmed)
    return `${parsed.pathname}${parsed.search}${parsed.hash}` || '/'
  } catch {
    return trimmed.startsWith('sheconomy://')
      ? trimmed.replace(/^sheconomy:\/\//, '/')
      : null
  }
}
