import AsyncStorage from '@react-native-async-storage/async-storage'
import { useSyncExternalStore } from 'react'

const STORAGE_KEY = 'sheconomy:recent-meeting-codes'
const MAX_ITEMS = 8

let codes: string[] = []
let loaded = false
const listeners = new Set<() => void>()

function emit() {
  for (const listener of listeners) listener()
}

function normalizeCode(code: string) {
  return code.replace(/[^a-zA-Z0-9]/g, '').toUpperCase()
}

async function ensureLoaded() {
  if (loaded) return
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY)
    const parsed = raw ? (JSON.parse(raw) as unknown) : []
    if (Array.isArray(parsed)) {
      codes = parsed
        .filter((value): value is string => typeof value === 'string')
        .map(normalizeCode)
        .filter(Boolean)
    }
  } catch {
    codes = []
  }
  loaded = true
  emit()
}

void ensureLoaded()

function persist(next: string[]) {
  codes = next
  emit()
  void AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(codes)).catch(() => {})
}

/** Remember a joined/scheduled meeting code for quick rejoin. */
export function recordMeetingCode(code: string) {
  const normalized = normalizeCode(code)
  if (!normalized) return
  const next = [normalized, ...codes.filter((existing) => existing !== normalized)].slice(0, MAX_ITEMS)
  if (next.length === codes.length && next.every((value, index) => value === codes[index])) return
  persist(next)
}

export function clearRecentMeetingCodes() {
  persist([])
}

function subscribe(callback: () => void) {
  listeners.add(callback)
  return () => {
    listeners.delete(callback)
  }
}

function getSnapshot() {
  return codes
}

export function useRecentMeetingCodes(): string[] {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}
