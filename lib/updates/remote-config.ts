import { ANDROID_PLAY_STORE_URL, IOS_APP_STORE_URL } from '~/lib/platform/open-in-app'
import { DEFAULT_REMOTE_UPDATE_CONFIG } from '~/lib/updates/constants'
import { logUpdate } from '~/lib/updates/logging'
import type { RemoteUpdateConfig } from '~/lib/updates/types'

export const DEFAULT_UPDATE_CONFIG_URL = 'https://www.sheconomy.in/update-config.json'

function clean(value: string | undefined): string | null {
  const trimmed = typeof value === 'string' ? value.trim() : ''
  return trimmed.length > 0 ? trimmed : null
}

// EXPO_PUBLIC_* values are only inlined into release bundles when read as
// literal `process.env.EXPO_PUBLIC_X` member expressions.
export function getUpdateConfigUrl(): string | null {
  return clean(process.env.EXPO_PUBLIC_UPDATE_CONFIG_URL) ?? DEFAULT_UPDATE_CONFIG_URL
}

export function getAppEnv(): string {
  return clean(process.env.EXPO_PUBLIC_APP_ENV) ?? clean(process.env.NODE_ENV) ?? 'development'
}

export function getIosStoreUrl(): string | null {
  return clean(process.env.EXPO_PUBLIC_IOS_APP_STORE_URL) ?? IOS_APP_STORE_URL
}

export function getAndroidPlayStoreUrl(): string | null {
  return clean(process.env.EXPO_PUBLIC_ANDROID_PLAY_STORE_URL) ?? ANDROID_PLAY_STORE_URL
}

function isRemoteUpdateConfig(value: unknown): value is RemoteUpdateConfig {
  if (!value || typeof value !== 'object') return false
  const row = value as Record<string, unknown>
  return (
    typeof row.minimumSupportedVersion === 'string' &&
    typeof row.latestVersion === 'string' &&
    typeof row.critical === 'boolean' &&
    typeof row.maintenanceMode === 'boolean'
  )
}

/**
 * Fetch remote update / maintenance policy.
 * Never throws — returns null when URL is unset or request fails.
 */
export async function fetchRemoteUpdateConfig(
  signal?: AbortSignal,
): Promise<RemoteUpdateConfig | null> {
  const url = getUpdateConfigUrl()
  if (!url) return null

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal,
    })
    if (!response.ok) {
      logUpdate('warn', `Remote update config HTTP ${response.status}`)
      return null
    }
    const json: unknown = await response.json()
    if (!isRemoteUpdateConfig(json)) {
      logUpdate('warn', 'Remote update config shape invalid')
      return null
    }
    return {
      ...DEFAULT_REMOTE_UPDATE_CONFIG,
      ...json,
      maintenanceMessage:
        typeof json.maintenanceMessage === 'string' ? json.maintenanceMessage : undefined,
    }
  } catch (error) {
    logUpdate('warn', 'Remote update config fetch failed', error)
    return null
  }
}
