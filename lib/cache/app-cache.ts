import AsyncStorage from '@react-native-async-storage/async-storage'
import { Platform } from 'react-native'

import { markFeedFresh } from '~/lib/cache/feed-freshness'

const STORAGE_PREFIX = 'sheconomy:cache:v1:'

type CacheEnvelope<T> = {
  value: T
  cachedAt: string
}

export type AppCacheEntry<T> = {
  value: T
  cachedAt: number
  ageMs: number
}

const memory = new Map<string, unknown>()
const memoryMeta = new Map<string, number>()
const pending = new Map<string, Promise<unknown>>()

function storageKey(key: string) {
  return `${STORAGE_PREFIX}${key}`
}

function nowMs() {
  return Date.now()
}

export function peekAppCache<T>(key: string): T | null {
  const hit = memory.get(key)
  return hit === undefined ? null : (hit as T)
}

export function peekAppCacheAgeMs(key: string): number | null {
  const at = memoryMeta.get(key)
  if (at == null) return null
  return Math.max(0, nowMs() - at)
}

function rememberMemory<T>(key: string, value: T, cachedAtMs?: number) {
  memory.set(key, value)
  memoryMeta.set(key, cachedAtMs ?? nowMs())
}

export async function readAppCacheEntry<T>(key: string): Promise<AppCacheEntry<T> | null> {
  const mem = peekAppCache<T>(key)
  if (mem !== null) {
    const ageMs = peekAppCacheAgeMs(key) ?? 0
    return { value: mem, cachedAt: nowMs() - ageMs, ageMs }
  }

  try {
    const raw =
      Platform.OS === 'web' && typeof window !== 'undefined'
        ? window.localStorage.getItem(storageKey(key))
        : await AsyncStorage.getItem(storageKey(key))
    if (!raw) return null
    const parsed = JSON.parse(raw) as CacheEnvelope<T>
    if (parsed?.value === undefined) return null
    const cachedAt = Date.parse(parsed.cachedAt)
    const cachedAtMs = Number.isFinite(cachedAt) ? cachedAt : nowMs()
    rememberMemory(key, parsed.value, cachedAtMs)
    return {
      value: parsed.value,
      cachedAt: cachedAtMs,
      ageMs: Math.max(0, nowMs() - cachedAtMs),
    }
  } catch {
    return null
  }
}

export async function readAppCache<T>(key: string): Promise<T | null> {
  const entry = await readAppCacheEntry<T>(key)
  return entry?.value ?? null
}

/**
 * Synchronously hydrate memory from localStorage (web).
 * Call as early as possible so first paint can `peekAppCache`.
 */
export function hydrateAppCacheSync(keys: string[]): number {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return 0
  let hydrated = 0
  for (const key of keys) {
    if (memory.has(key)) continue
    try {
      const raw = window.localStorage.getItem(storageKey(key))
      if (!raw) continue
      const parsed = JSON.parse(raw) as CacheEnvelope<unknown>
      if (parsed?.value === undefined) continue
      const cachedAt = Date.parse(parsed.cachedAt)
      rememberMemory(key, parsed.value, Number.isFinite(cachedAt) ? cachedAt : nowMs())
      hydrated += 1
    } catch {
      // ignore corrupt rows
    }
  }
  return hydrated
}

/** Async hydrate memory from AsyncStorage / localStorage for the given keys. */
export async function hydrateAppCache(keys: string[]): Promise<number> {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    return hydrateAppCacheSync(keys)
  }
  let hydrated = 0
  await Promise.all(
    keys.map(async (key) => {
      if (memory.has(key)) return
      const entry = await readAppCacheEntry(key)
      if (entry) hydrated += 1
    }),
  )
  return hydrated
}

export async function writeAppCache<T>(key: string, value: T): Promise<void> {
  const cachedAtMs = nowMs()
  rememberMemory(key, value, cachedAtMs)
  markFeedFresh(key)
  try {
    const payload = JSON.stringify({
      value,
      cachedAt: new Date(cachedAtMs).toISOString(),
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
    memoryMeta.delete(key)
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
  memoryMeta.clear()
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

type GetOrFetchOptions = {
  /** Serve cache even when older than this; still refresh in background when stale. */
  maxAgeMs?: number
  /** When cache is fresher than this, skip network. Defaults to maxAgeMs. */
  freshAgeMs?: number
}

/**
 * Stale-while-revalidate: return disk/memory cache immediately when present,
 * refresh in background when older than `freshAgeMs`.
 */
export async function getOrFetchAppCache<T>(
  key: string,
  loader: () => Promise<T>,
  options: GetOrFetchOptions = {},
): Promise<T> {
  const entry = await readAppCacheEntry<T>(key)
  const freshAgeMs = options.freshAgeMs ?? options.maxAgeMs

  if (entry) {
    const isFresh = freshAgeMs == null || entry.ageMs <= freshAgeMs
    if (isFresh) return entry.value

    // Stale: refresh in background, return stale immediately.
    if (!pending.has(key)) {
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
    return entry.value
  }

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
