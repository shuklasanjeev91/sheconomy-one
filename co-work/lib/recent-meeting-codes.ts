import AsyncStorage from '@react-native-async-storage/async-storage'
import { useSyncExternalStore } from 'react'

const LEGACY_STORAGE_KEY = 'sheconomy:recent-meeting-codes'
const MAX_ITEMS = 8

let activeUserId: string | null = null
let codes: string[] = []
let loaded = false
const listeners = new Set<() => void>()

function emit() {
  for (const listener of listeners) listener()
}

function normalizeCode(code: string) {
  return code.replace(/[^a-zA-Z0-9]/g, '').toUpperCase()
}

function storageKeyFor(userId: string | null) {
  return userId
    ? `${LEGACY_STORAGE_KEY}:${userId}`
    : LEGACY_STORAGE_KEY
}

async function readCodes(userId: string | null): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(storageKeyFor(userId))
    // One-time migrate legacy unscoped list into the first signed-in user's bucket.
    if (!raw && userId) {
      const legacy = await AsyncStorage.getItem(LEGACY_STORAGE_KEY)
      if (legacy) {
        await AsyncStorage.setItem(storageKeyFor(userId), legacy)
        await AsyncStorage.removeItem(LEGACY_STORAGE_KEY)
        const parsed = JSON.parse(legacy) as unknown
        if (Array.isArray(parsed)) {
          return parsed
            .filter((value): value is string => typeof value === 'string')
            .map(normalizeCode)
            .filter(Boolean)
        }
      }
      return []
    }
    const parsed = raw ? (JSON.parse(raw) as unknown) : []
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter((value): value is string => typeof value === 'string')
      .map(normalizeCode)
      .filter(Boolean)
  } catch {
    return []
  }
}

async function ensureLoaded() {
  if (loaded) return
  codes = await readCodes(activeUserId)
  loaded = true
  emit()
}

void ensureLoaded()

function persist(next: string[]) {
  codes = next
  emit()
  void AsyncStorage.setItem(storageKeyFor(activeUserId), JSON.stringify(codes)).catch(() => {})
}

/**
 * Bind recent-code history to the signed-in user so web/iPad/account switches
 * don't mix another profile's rejoin chips.
 */
export async function bindRecentMeetingCodesUser(userId: string | null): Promise<void> {
  const nextId = userId?.trim() || null
  if (nextId === activeUserId && loaded) return
  activeUserId = nextId
  loaded = false
  codes = []
  emit()
  codes = await readCodes(activeUserId)
  loaded = true
  emit()
}

/** Remember a joined/scheduled meeting code for quick rejoin. */
export function recordMeetingCode(code: string) {
  const normalized = normalizeCode(code)
  if (!normalized) return
  void ensureLoaded().then(() => {
    const next = [normalized, ...codes.filter((existing) => existing !== normalized)].slice(
      0,
      MAX_ITEMS,
    )
    if (next.length === codes.length && next.every((value, index) => value === codes[index])) {
      return
    }
    persist(next)
  })
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
