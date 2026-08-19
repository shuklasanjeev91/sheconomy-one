import AsyncStorage from '@react-native-async-storage/async-storage'
import { Platform } from 'react-native'

import type { SessionProfile as Profile } from '~/lib/profile/session-profile'

/**
 * Bump to invalidate every stored profile at once. v3 drops rows cached before
 * the gender-gate fix so pre-verification caches can no longer paint stale
 * access; the next load fetches a fresh server row instead.
 */
const PROFILE_CACHE_KEY = 'sheconomy:profile-cache-v3'
const LEGACY_PROFILE_CACHE_KEYS = ['sheconomy:profile-cache-v2', 'sheconomy:profile-cache']

type CachedProfileEntry = {
  userId: string
  profile: Profile
  cachedAt: string
}

let memoryCache: CachedProfileEntry | null = null

/** One-time cleanup of superseded cache keys so stale rows can't be read back. */
function purgeLegacyCaches(): void {
  try {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      for (const key of LEGACY_PROFILE_CACHE_KEYS) window.localStorage.removeItem(key)
      return
    }
    void AsyncStorage.multiRemove(LEGACY_PROFILE_CACHE_KEYS).catch(() => {})
  } catch {
    // Best-effort — the new key is already the only one we read.
  }
}

purgeLegacyCaches()

/** Sync peek — lets useProfile skip the access-gate spinner on warm starts. */
export function peekCachedProfile(userId: string): Profile | null {
  if (!userId) return null
  if (memoryCache?.userId === userId) return memoryCache.profile
  // Web can read localStorage synchronously; native stays async via readCachedProfile.
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    try {
      const raw = window.localStorage.getItem(PROFILE_CACHE_KEY)
      if (!raw) return null
      const parsed = JSON.parse(raw) as CachedProfileEntry
      if (parsed?.userId !== userId || !parsed.profile?.id) return null
      memoryCache = parsed
      return parsed.profile
    } catch {
      return null
    }
  }
  return null
}

export async function readCachedProfile(userId: string): Promise<Profile | null> {
  if (!userId) return null
  if (memoryCache?.userId === userId) return memoryCache.profile
  try {
    const raw =
      Platform.OS === 'web' && typeof window !== 'undefined'
        ? window.localStorage.getItem(PROFILE_CACHE_KEY)
        : await AsyncStorage.getItem(PROFILE_CACHE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as CachedProfileEntry
    if (parsed?.userId !== userId || !parsed.profile?.id) return null
    memoryCache = parsed
    return parsed.profile
  } catch {
    return null
  }
}

export async function writeCachedProfile(userId: string, profile: Profile | null): Promise<void> {
  if (!userId || !profile) return
  try {
    const payload = JSON.stringify({
      userId,
      profile,
      cachedAt: new Date().toISOString(),
    } satisfies CachedProfileEntry)
    memoryCache = { userId, profile, cachedAt: new Date().toISOString() }
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.localStorage.setItem(PROFILE_CACHE_KEY, payload)
      return
    }
    await AsyncStorage.setItem(PROFILE_CACHE_KEY, payload)
  } catch {
    // ignore quota errors
  }
}

export async function clearCachedProfile(): Promise<void> {
  memoryCache = null
  try {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.localStorage.removeItem(PROFILE_CACHE_KEY)
      return
    }
    await AsyncStorage.removeItem(PROFILE_CACHE_KEY)
  } catch {
    // ignore
  }
}

/**
 * Merge fields into the cached profile (e.g. after avatar upload) without waiting
 * for a network round-trip. Updates memory immediately so `refreshProfiles()`
 * subscribers (tab bar, composer, etc.) pick up the new photo in-session.
 */
export async function patchCachedProfile(
  userId: string,
  patch: Partial<Profile>,
): Promise<void> {
  if (!userId) return

  // Synchronous memory update first — refreshProfiles() readers must see the new
  // avatar/cover before any await below (avoids a race with AsyncStorage).
  if (memoryCache?.userId === userId && memoryCache.profile?.id === userId) {
    memoryCache = {
      userId,
      profile: { ...memoryCache.profile, ...patch },
      cachedAt: new Date().toISOString(),
    }
  }

  const current = (await readCachedProfile(userId)) ?? memoryCache?.profile
  if (!current || current.id !== userId) {
    return
  }
  await writeCachedProfile(userId, { ...current, ...patch })
}
