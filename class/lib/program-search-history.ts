import AsyncStorage from '@react-native-async-storage/async-storage'
import { useSyncExternalStore } from 'react'

const STORAGE_KEY = 'sheconomy:class-search-history'
const MAX_ITEMS = 10

let terms: string[] = []
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
      terms = parsed.filter((term): term is string => typeof term === 'string' && term.trim().length > 0)
    }
  } catch {
    terms = []
  }
  loaded = true
  emit()
}

void ensureLoaded()

function persist(next: string[]) {
  terms = next
  emit()
  void AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(terms)).catch(() => {})
}

export function recordProgramSearchTerm(term: string) {
  const trimmed = term.trim()
  if (!trimmed) return
  const normalized = trimmed.toLowerCase()
  const next = [
    trimmed,
    ...terms.filter((existing) => existing.trim().toLowerCase() !== normalized),
  ].slice(0, MAX_ITEMS)
  if (next.length === terms.length && next.every((value, index) => value === terms[index])) return
  persist(next)
}

export function clearProgramSearchHistory() {
  persist([])
}

function subscribe(callback: () => void) {
  listeners.add(callback)
  return () => {
    listeners.delete(callback)
  }
}

function getSnapshot() {
  return terms
}

export function useProgramSearchHistory(): string[] {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}
