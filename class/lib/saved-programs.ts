import AsyncStorage from '@react-native-async-storage/async-storage'
import { useSyncExternalStore } from 'react'

const STORAGE_KEY = 'sheconomy:saved-programs'
const MAX_ITEMS = 40

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

function persist(next: string[]) {
  ids = next
  emit()
  void AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(ids)).catch(() => {})
}

export function isProgramSaved(programId: string) {
  return ids.includes(programId)
}

export function toggleSavedProgram(programId: string): boolean {
  if (!programId) return false
  if (ids.includes(programId)) {
    persist(ids.filter((id) => id !== programId))
    return false
  }
  persist([programId, ...ids.filter((id) => id !== programId)].slice(0, MAX_ITEMS))
  return true
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

/** Saved program ids for offline Continue / Saved rails (all platforms). */
export function useSavedPrograms(): string[] {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}
