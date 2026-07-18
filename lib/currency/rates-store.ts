import type { ExchangeRateTable } from '~/lib/currency/exchange-rate-math'

type Listener = () => void

let memoryTable: ExchangeRateTable | null = null
let snapshotVersion = 0
const listeners = new Set<Listener>()

function notify() {
  snapshotVersion += 1
  for (const listener of listeners) listener()
}

export function subscribeExchangeRates(listener: Listener) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function getExchangeRatesVersion() {
  return snapshotVersion
}

export function getExchangeRateTable(): ExchangeRateTable | null {
  return memoryTable
}

export function setExchangeRateTableMemory(table: ExchangeRateTable | null) {
  memoryTable = table
  notify()
}

export function seedExchangeRatesForTests(table: ExchangeRateTable | null) {
  setExchangeRateTableMemory(table)
}
