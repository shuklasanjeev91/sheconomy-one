import AsyncStorage from '@react-native-async-storage/async-storage'
import { useSyncExternalStore } from 'react'

const STORAGE_KEY = 'sheconomy:app-search-history'
const LEGACY_MARKETPLACE_KEY = 'sheconomy:marketplace-search-history'
const MAX_ITEMS = 12

let terms: string[] = []
let loaded = false
const listeners = new Set<() => void>()

function emit() {
  for (const listener of listeners) listener()
}

function normalizeList(parsed: unknown): string[] {
  if (!Array.isArray(parsed)) return []
  return parsed.filter((term): term is string => typeof term === 'string' && term.trim().length > 0)
}

async function ensureLoaded() {
  if (loaded) return
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY)
    let next = normalizeList(raw ? JSON.parse(raw) : [])
    if (!next.length) {
      const legacy = await AsyncStorage.getItem(LEGACY_MARKETPLACE_KEY)
      next = normalizeList(legacy ? JSON.parse(legacy) : [])
      if (next.length) {
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      }
    }
    terms = next.slice(0, MAX_ITEMS)
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
  // Keep marketplace key in sync for any leftover commerce-only callers.
  void AsyncStorage.setItem(LEGACY_MARKETPLACE_KEY, JSON.stringify(terms)).catch(() => {})
}

/** Record a unified app search (web + iOS + Android). */
export function recordAppSearchTerm(term: string) {
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

export function removeAppSearchTerm(term: string) {
  const normalized = term.trim().toLowerCase()
  persist(terms.filter((existing) => existing.trim().toLowerCase() !== normalized))
}

export function clearAppSearchHistory() {
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

export function getAppSearchHistorySnapshot(): string[] {
  return terms
}

export function useAppSearchHistory(): string[] {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}
