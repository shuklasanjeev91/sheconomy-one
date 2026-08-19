import AsyncStorage from '@react-native-async-storage/async-storage'

import type { ListingSummary } from '~/lib/supabase/commerce'

const SAVED_FROM_CART_KEY = 'sheconomy:wishlist:saved-from-cart'
const MAX_ACTIONABLE_ITEMS = 4

export type WishlistReactivationItem = ListingSummary & {
  score: number
  source: 'saved_from_cart' | 'discount' | 'saved'
  discountAmount: number
  savedFromCartAt: number | null
}

export type WishlistReactivationSection = {
  key: 'ready_to_buy' | 'saved_from_cart' | 'price_wins' | 'more_saved'
  title: string
  subtitle: string
  items: WishlistReactivationItem[]
  actionLabel: string
  count: number
  canBulkMoveToCart: boolean
}

export type WishlistReactivationResult = {
  sections: WishlistReactivationSection[]
  counts: {
    total: number
    readyToBuy: number
    savedFromCart: number
    priceWins: number
  }
}

type SavedFromCartMap = Record<string, number>

function discountAmount(item: ListingSummary) {
  if (typeof item.mrp !== 'number' || item.mrp <= item.price) return 0
  return Math.max(0, item.mrp - item.price)
}

function toItem(item: ListingSummary, savedFromCartAt: number | null): WishlistReactivationItem {
  const discount = discountAmount(item)
  let score = 10
  if (savedFromCartAt) score += 80
  if (discount > 0) score += 40
  if (typeof item.average_rating === 'number' && item.average_rating >= 4) score += 10
  if (item.shop_verified) score += 5

  return {
    ...item,
    score,
    source: savedFromCartAt ? 'saved_from_cart' : discount > 0 ? 'discount' : 'saved',
    discountAmount: discount,
    savedFromCartAt,
  }
}

function section(
  key: WishlistReactivationSection['key'],
  title: string,
  subtitle: string,
  items: WishlistReactivationItem[],
  actionLabel: string,
): WishlistReactivationSection {
  return {
    key,
    title,
    subtitle,
    items,
    actionLabel,
    count: items.length,
    canBulkMoveToCart:
      key !== 'more_saved' && items.length > 1 && items.length <= MAX_ACTIONABLE_ITEMS,
  }
}

export function buildWishlistReactivation(input: {
  items: ListingSummary[]
  savedFromCart: SavedFromCartMap
}): WishlistReactivationResult {
  const enriched = input.items
    .map((item) => toItem(item, input.savedFromCart[item.id] ?? null))
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score
      if ((b.savedFromCartAt ?? 0) !== (a.savedFromCartAt ?? 0)) {
        return (b.savedFromCartAt ?? 0) - (a.savedFromCartAt ?? 0)
      }
      return b.discountAmount - a.discountAmount
    })

  const savedFromCart = enriched.filter((item) => item.savedFromCartAt).slice(0, MAX_ACTIONABLE_ITEMS)
  const remaining = enriched.filter((item) => !savedFromCart.some((candidate) => candidate.id === item.id))
  const readyToBuy = remaining.slice(0, MAX_ACTIONABLE_ITEMS)
  const priceWins = remaining
    .filter((item) => item.discountAmount > 0 && !readyToBuy.some((candidate) => candidate.id === item.id))
    .slice(0, MAX_ACTIONABLE_ITEMS)
  const usedIds = new Set([...savedFromCart, ...readyToBuy, ...priceWins].map((item) => item.id))
  const moreSaved = enriched.filter((item) => !usedIds.has(item.id))

  const sections = [
    section(
      'ready_to_buy',
      'Ready to buy',
      'Your strongest wishlist candidates to move back toward checkout.',
      readyToBuy,
      'Move all to cart',
    ),
    section(
      'saved_from_cart',
      'Saved from cart',
      'Items you intentionally moved out of checkout and may want to resume.',
      savedFromCart,
      'Move saved picks to cart',
    ),
    section(
      'price_wins',
      'Price wins',
      'Saved items with a visible markdown or lower-than-MRP signal.',
      priceWins,
      'Move discounted picks to cart',
    ),
    section(
      'more_saved',
      'More from this collection',
      'Everything else you’ve saved, organized for browsing and sharing.',
      moreSaved,
      'Share visible items',
    ),
  ].filter((current) => current.items.length > 0)

  return {
    sections,
    counts: {
      total: enriched.length,
      readyToBuy: readyToBuy.length,
      savedFromCart: savedFromCart.length,
      priceWins: enriched.filter((item) => item.discountAmount > 0).length,
    },
  }
}

export async function readSavedFromCartWishlistMap(): Promise<SavedFromCartMap> {
  try {
    const raw = await AsyncStorage.getItem(SAVED_FROM_CART_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {}
    const entries = Object.entries(parsed as Record<string, unknown>).filter(
      ([key, value]) => key && typeof value === 'number' && Number.isFinite(value),
    )
    return Object.fromEntries(entries)
  } catch {
    return {}
  }
}

async function writeSavedFromCartWishlistMap(value: SavedFromCartMap) {
  await AsyncStorage.setItem(SAVED_FROM_CART_KEY, JSON.stringify(value))
}

export async function markWishlistItemSavedFromCart(listingId: string) {
  if (!listingId) return
  const current = await readSavedFromCartWishlistMap()
  current[listingId] = Date.now()
  await writeSavedFromCartWishlistMap(current)
}

export async function clearWishlistSavedFromCartMarker(listingId: string) {
  if (!listingId) return
  const current = await readSavedFromCartWishlistMap()
  delete current[listingId]
  await writeSavedFromCartWishlistMap(current)
}

export async function clearWishlistSavedFromCartMarkers(listingIds: string[]) {
  if (!listingIds.length) return
  const current = await readSavedFromCartWishlistMap()
  for (const listingId of listingIds) delete current[listingId]
  await writeSavedFromCartWishlistMap(current)
}
