import AsyncStorage from '@react-native-async-storage/async-storage'
import { Platform } from 'react-native'

import type { Profile } from '~/hooks/useProfile'

/** Bumped when avatar_url caching semantics change (invalidate stale empty avatars). */
const PROFILE_CACHE_KEY = 'sheconomy:profile-cache-v2'

type CachedProfileEntry = {
  userId: string
  profile: Profile
  cachedAt: string
}

let memoryCache: CachedProfileEntry | null = null

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
 * for a network round-trip.
 */
export async function patchCachedProfile(
  userId: string,
  patch: Partial<Profile>,
): Promise<void> {
  if (!userId) return
  const current = (await readCachedProfile(userId)) ?? memoryCache?.profile
  if (!current || current.id !== userId) {
    return
  }
  await writeCachedProfile(userId, { ...current, ...patch })
}
