import AsyncStorage from '@react-native-async-storage/async-storage'
import { useSyncExternalStore } from 'react'

const STORAGE_KEY = 'sheconomy:price-watches'
const MAX_WATCHES = 20

export type PriceWatch = {
  listingId: string
  targetPrice: number
  currency: string
  title: string
}

let watches: PriceWatch[] = []
let loaded = false
const listeners = new Set<() => void>()

function emit() {
  for (const listener of listeners) listener()
}

function isWatch(value: unknown): value is PriceWatch {
  if (!value || typeof value !== 'object') return false
  const row = value as Partial<PriceWatch>
  return (
    typeof row.listingId === 'string' &&
    row.listingId.length > 0 &&
    typeof row.targetPrice === 'number' &&
    Number.isFinite(row.targetPrice) &&
    row.targetPrice > 0 &&
    typeof row.currency === 'string' &&
    typeof row.title === 'string'
  )
}

async function ensureLoaded() {
  if (loaded) return
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY)
    const parsed = raw ? (JSON.parse(raw) as unknown) : []
    watches = Array.isArray(parsed) ? parsed.filter(isWatch).slice(0, MAX_WATCHES) : []
  } catch {
    watches = []
  }
  loaded = true
  emit()
}

void ensureLoaded()

function persist() {
  void AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(watches)).catch(() => {})
}

/** Keep a positive amount with currency-style cents. */
export function normalizeTargetPrice(value: number): number | null {
  if (!Number.isFinite(value) || value <= 0) return null
  const rounded = Math.round(value * 100) / 100
  return rounded > 0 ? rounded : null
}

/** A watch is a hit when the live price is at or under the buyer's target. */
export function priceWatchHit(
  targetPrice: number,
  currentPrice: number | null | undefined,
): boolean {
  if (currentPrice == null || !Number.isFinite(currentPrice)) return false
  return currentPrice <= targetPrice
}

export function savePriceWatch(watch: PriceWatch) {
  const targetPrice = normalizeTargetPrice(watch.targetPrice)
  if (!watch.listingId || targetPrice == null) return
  const next: PriceWatch = {
    listingId: watch.listingId,
    targetPrice,
    currency: watch.currency || 'INR',
    title: watch.title.trim() || 'Listing',
  }
  watches = [next, ...watches.filter((row) => row.listingId !== next.listingId)].slice(0, MAX_WATCHES)
  emit()
  persist()
}

export function removePriceWatch(listingId: string) {
  const next = watches.filter((row) => row.listingId !== listingId)
  if (next.length === watches.length) return
  watches = next
  emit()
  persist()
}

function subscribe(callback: () => void) {
  listeners.add(callback)
  return () => {
    listeners.delete(callback)
  }
}

function getSnapshot() {
  return watches
}

export function usePriceWatches(): PriceWatch[] {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}

export function priceWatchFor(listingId: string, rows: PriceWatch[]): PriceWatch | null {
  return rows.find((row) => row.listingId === listingId) ?? null
}
