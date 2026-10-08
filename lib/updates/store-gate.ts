import AsyncStorage from '@react-native-async-storage/async-storage'

import {
  FORCE_UPDATE_AUTO_RETRY_MS,
  REMOTE_CONFIG_CACHE_KEY,
  STORE_UPDATE_DISMISSAL_KEY,
  STORE_UPDATE_REMIND_AFTER_MS,
} from '~/lib/updates/constants'
import { fetchRemoteUpdateConfig } from '~/lib/updates/remote-config'
import type { RemoteUpdateConfig, StoreUpdateDismissal } from '~/lib/updates/types'
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

/**
 * Newer store version the user may optionally install, or null when the
 * install is current or already blocked by the mandatory gate.
 */
export function availableStoreVersion(
  config: Pick<RemoteUpdateConfig, 'minimumSupportedVersion' | 'latestVersion'> | null,
  installedVersion: string,
): string | null {
  if (!config?.latestVersion) return null
  if (requiredStoreVersion(config, installedVersion)) return null
  return isVersionLessThan(installedVersion, config.latestVersion) ? config.latestVersion : null
}

export function shouldPromptStoreUpdate(
  latestVersion: string,
  dismissal: StoreUpdateDismissal | null,
  now: number,
): boolean {
  if (!dismissal || dismissal.version !== latestVersion) return true
  return now - dismissal.dismissedAt >= STORE_UPDATE_REMIND_AFTER_MS
}

export function shouldAutoAttemptMandatoryUpdate(
  lastAttemptAt: number | null,
  now: number,
  retryMs = FORCE_UPDATE_AUTO_RETRY_MS,
): boolean {
  return lastAttemptAt == null || now - lastAttemptAt >= retryMs
}

export async function readStoreUpdateDismissal(): Promise<StoreUpdateDismissal | null> {
  try {
    const raw = await AsyncStorage.getItem(STORE_UPDATE_DISMISSAL_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<StoreUpdateDismissal>
    if (typeof parsed.version !== 'string' || typeof parsed.dismissedAt !== 'number') return null
    return { version: parsed.version, dismissedAt: parsed.dismissedAt }
  } catch {
    return null
  }
}

export async function dismissStoreUpdate(version: string, now: number): Promise<void> {
  try {
    const value: StoreUpdateDismissal = { version, dismissedAt: now }
    await AsyncStorage.setItem(STORE_UPDATE_DISMISSAL_KEY, JSON.stringify(value))
  } catch {
    // Worst case the prompt shows again on next resume.
  }
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
