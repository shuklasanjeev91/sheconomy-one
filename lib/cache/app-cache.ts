import AsyncStorage from '@react-native-async-storage/async-storage'
import { Platform } from 'react-native'

const STORAGE_PREFIX = 'sheconomy:cache:v1:'

type CacheEnvelope<T> = {
  value: T
  cachedAt: string
}

const memory = new Map<string, unknown>()
const pending = new Map<string, Promise<unknown>>()

function storageKey(key: string) {
  return `${STORAGE_PREFIX}${key}`
}

export function peekAppCache<T>(key: string): T | null {
  const hit = memory.get(key)
  return hit === undefined ? null : (hit as T)
}

export async function readAppCache<T>(key: string): Promise<T | null> {
  const mem = peekAppCache<T>(key)
  if (mem !== null) return mem

  try {
    const raw =
      Platform.OS === 'web' && typeof window !== 'undefined'
        ? window.localStorage.getItem(storageKey(key))
        : await AsyncStorage.getItem(storageKey(key))
    if (!raw) return null
    const parsed = JSON.parse(raw) as CacheEnvelope<T>
    if (parsed?.value === undefined) return null
    memory.set(key, parsed.value)
    return parsed.value
  } catch {
    return null
  }
}

export async function writeAppCache<T>(key: string, value: T): Promise<void> {
  memory.set(key, value)
  try {
    const payload = JSON.stringify({
      value,
      cachedAt: new Date().toISOString(),
    } satisfies CacheEnvelope<T>)
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.localStorage.setItem(storageKey(key), payload)
      return
    }
    await AsyncStorage.setItem(storageKey(key), payload)
  } catch {
    // ignore quota / private mode
  }
}

export async function clearAppCache(key?: string): Promise<void> {
  if (key) {
    memory.delete(key)
    pending.delete(key)
    try {
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        window.localStorage.removeItem(storageKey(key))
        return
      }
      await AsyncStorage.removeItem(storageKey(key))
    } catch {
      // ignore
    }
    return
  }

  memory.clear()
  pending.clear()
}

/** Fire-and-forget fetch that populates memory + disk cache. */
export function prefetchAppCache<T>(key: string, loader: () => Promise<T>): void {
  if (pending.has(key) || memory.has(key)) return
  const task = loader()
    .then(async (value) => {
      await writeAppCache(key, value)
      return value
    })
    .finally(() => {
      pending.delete(key)
    })
  pending.set(key, task)
  void task.catch(() => {})
}

export async function getOrFetchAppCache<T>(
  key: string,
  loader: () => Promise<T>,
): Promise<T> {
  const cached = await readAppCache<T>(key)
  if (cached !== null) return cached

  const inflight = pending.get(key) as Promise<T> | undefined
  if (inflight) return inflight

  const task = loader().then(async (value) => {
    await writeAppCache(key, value)
    return value
  })
  pending.set(key, task)
  try {
    return await task
  } finally {
    pending.delete(key)
  }
}
