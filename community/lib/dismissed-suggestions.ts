import AsyncStorage from '@react-native-async-storage/async-storage'
import { useSyncExternalStore } from 'react'

const STORAGE_KEY = 'sheconomy:dismissed-network-suggestions'
const MAX_ITEMS = 80

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

/** Hide a “People you may know” suggestion locally (all platforms). */
export function dismissNetworkSuggestion(userId: string) {
  if (!userId || ids.includes(userId)) return
  persist([userId, ...ids].slice(0, MAX_ITEMS))
}

export function clearDismissedNetworkSuggestions() {
  persist([])
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

export function useDismissedNetworkSuggestions(): string[] {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}
