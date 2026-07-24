import { useSyncExternalStore } from 'react'

import type { CartItemRow, CartRow } from './cart'

/**
 * Per-item cart selection. We persist the *deselected* ids at module scope so
 * any newly added cart line defaults to selected, and the choice survives
 * navigation between the cart and checkout screens.
 */
let deselected = new Set<string>()
let selectionRevision = 0
const listeners = new Set<() => void>()

function emit() {
  selectionRevision += 1
  for (const listener of listeners) listener()
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

function getSnapshot() {
  return deselected
}

export function toggleCartItemSelected(id: string) {
  const next = new Set(deselected)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  deselected = next
  emit()
}

export function setCartItemsSelected(ids: string[], selected: boolean) {
  if (selected) {
    if (deselected.size === 0) return
    deselected = new Set()
  } else {
    deselected = new Set(ids)
  }
  emit()
}

export function useCartSelection(availableIds: string[]) {
  const deselectedSet = useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
  const selectedIds = availableIds.filter((id) => !deselectedSet.has(id))
  return {
    isSelected: (id: string) => !deselectedSet.has(id),
    selectedIds,
    selectedCount: selectedIds.length,
    allSelected: availableIds.length > 0 && selectedIds.length === availableIds.length,
    noneSelected: selectedIds.length === 0,
  }
}

/** Subscribe to cart line checkbox changes (cart ↔ checkout selection). */
export function useCartSelectionRevision(): number {
  return useSyncExternalStore(
    subscribe,
    () => selectionRevision,
    () => selectionRevision,
  )
}

/** Lines the shopper has checked for checkout (shared cart ↔ checkout selection). */
export function filterSelectedCartItems<T extends { id: string }>(items: T[]): T[] {
  return items.filter((item) => !deselected.has(item.id))
}

function round2(value: number) {
  return Math.round(value * 100) / 100
}

export type SelectedTotals = {
  selectedItems: CartItemRow[]
  subtotal: number
  unitCount: number
  discount: number
  total: number
}

/**
 * Totals for the currently-selected cart lines. A cart-level coupon is applied
 * proportionally to the selected subtotal so partial selections stay accurate.
 */
export function computeSelectedTotals(
  cart: CartRow | null,
  items: CartItemRow[],
  isSelected: (id: string) => boolean,
): SelectedTotals {
  const selectedItems = items.filter((item) => isSelected(item.id))
  const subtotal = selectedItems.reduce((sum, item) => sum + item.unit_price * item.quantity, 0)
  const unitCount = selectedItems.reduce((sum, item) => sum + item.quantity, 0)

  const fullSubtotal =
    cart?.items_subtotal ?? items.reduce((sum, item) => sum + item.unit_price * item.quantity, 0)
  const fullDiscount = cart?.discount_amount ?? 0
  const discount = fullSubtotal > 0 ? round2((fullDiscount * subtotal) / fullSubtotal) : 0
  const total = Math.max(0, round2(subtotal - discount))

  return { selectedItems, subtotal, unitCount, discount, total }
}
