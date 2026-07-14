import AsyncStorage from '@react-native-async-storage/async-storage'
import { useSyncExternalStore } from 'react'

const STORAGE_KEY = 'sheconomy:recently-viewed'
const MAX_ITEMS = 20

let ids: string[] = []
let loaded = false
const listeners = new Set<() => void>()

function emit() {
  for (const listener of listeners) listener()
}

async function ensureLoaded() {
  if (loaded) return
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY)
    const parsed = raw ? (JSON.parse(raw) as unknown) : []
    if (Array.isArray(parsed)) {
      ids = parsed.filter((id): id is string => typeof id === 'string')
    }
  } catch {
    ids = []
  }
  loaded = true
  emit()
}

void ensureLoaded()

/** Record that the user viewed a listing (most-recent first, de-duplicated). */
export function recordListingView(listingId: string) {
  if (!listingId) return
  const next = [listingId, ...ids.filter((id) => id !== listingId)].slice(0, MAX_ITEMS)
  // Bail if nothing actually changed to keep the snapshot stable.
  if (next.length === ids.length && next.every((id, index) => id === ids[index])) return
  ids = next
  emit()
  void AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(ids)).catch(() => {})
}

/** Clear recently viewed history on web, iOS, and Android. */
export function clearRecentlyViewed() {
  ids = []
  emit()
  void AsyncStorage.removeItem(STORAGE_KEY).catch(() => {})
}

function subscribe(callback: () => void) {
  listeners.add(callback)
  return () => {
    listeners.delete(callback)
  }
}

function getSnapshot() {
  return ids
}

/**
 * Recently-viewed listing ids (most recent first), optionally excluding some
 * (e.g. items already in the cart). Backed by a module store + AsyncStorage so
 * it works across web/native.
 */
export function useRecentlyViewed(excludeIds: string[] = []): string[] {
  const all = useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
  if (excludeIds.length === 0) return all
  const exclude = new Set(excludeIds)
  return all.filter((id) => !exclude.has(id))
}
