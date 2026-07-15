import AsyncStorage from '@react-native-async-storage/async-storage'
import { useSyncExternalStore } from 'react'

const STORAGE_KEY = 'sheconomy:recently-viewed-programs'
const MAX_ITEMS = 16

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

/** Persist a program view for Continue Learning (web + iOS + Android). */
export function recordProgramLocalView(programId: string) {
  if (!programId) return
  const next = [programId, ...ids.filter((id) => id !== programId)].slice(0, MAX_ITEMS)
  if (next.length === ids.length && next.every((id, index) => id === ids[index])) return
  ids = next
  emit()
  void AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(ids)).catch(() => {})
}

/** Clear Continue Learning history on all platforms. */
export function clearRecentlyViewedPrograms() {
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

export function useRecentlyViewedPrograms(): string[] {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}
