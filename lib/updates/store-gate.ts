import AsyncStorage from '@react-native-async-storage/async-storage'

import { REMOTE_CONFIG_CACHE_KEY } from '~/lib/updates/constants'
import { fetchRemoteUpdateConfig } from '~/lib/updates/remote-config'
import type { RemoteUpdateConfig } from '~/lib/updates/types'
import { isVersionLessThan } from '~/lib/updates/version'

/**
 * Store version the installed binary must reach, or null when it is allowed.
 * Pure so the gate can be decided from a cached config before any network.
 */
export function requiredStoreVersion(
  config: Pick<RemoteUpdateConfig, 'minimumSupportedVersion'> | null,
  installedVersion: string,
): string | null {
  if (!config?.minimumSupportedVersion) return null
  return isVersionLessThan(installedVersion, config.minimumSupportedVersion)
    ? config.minimumSupportedVersion
    : null
}

export async function readCachedRemoteConfig(): Promise<RemoteUpdateConfig | null> {
  try {
    const raw = await AsyncStorage.getItem(REMOTE_CONFIG_CACHE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<RemoteUpdateConfig>
    if (typeof parsed.minimumSupportedVersion !== 'string') return null
    return parsed as RemoteUpdateConfig
  } catch {
    return null
  }
}

export async function cacheRemoteConfig(config: RemoteUpdateConfig): Promise<void> {
  try {
    await AsyncStorage.setItem(REMOTE_CONFIG_CACHE_KEY, JSON.stringify(config))
  } catch {
    // Best effort — the next successful fetch will retry.
  }
}

/** Fetch the latest policy and persist it; null when offline / unreachable. */
export async function refreshRemoteConfig(): Promise<RemoteUpdateConfig | null> {
  const fresh = await fetchRemoteUpdateConfig()
  if (fresh) await cacheRemoteConfig(fresh)
  return fresh
}
