import AsyncStorage from '@react-native-async-storage/async-storage'

import type { FollowedShopSummary } from '~/commerce/lib/shop-follows'
import { fetchActiveListingCards, fetchListingsByIds } from '~/commerce/lib/commerce'
import type { ListingSummary } from '~/lib/supabase/commerce'

const PRICE_BASELINE_KEY = 'sheconomy:followed-shop-digest:price-baseline'
const MAX_SECTION_ITEMS = 4
const MAX_SHOPS_TO_SCAN = 8
const MAX_FAVORITE_ITEMS = 24
const NEW_ARRIVAL_WINDOW_MS = 1000 * 60 * 60 * 24 * 14

type PriceBaselineMap = Record<string, number>

export type FollowedShopDigestItem = ListingSummary & {
  score: number
  source: 'new_arrival' | 'price_drop' | 'saved_overlap'
  shopSlug: string | null
  shopFollowedAt: string | null
  freshnessDays: number | null
  previousPrice: number | null
  priceDropAmount: number
  isFavorite: boolean
}

export type FollowedShopDigestSection = {
  key: 'new_arrivals' | 'price_drops' | 'saved_overlap'
  title: string
  subtitle: string
  items: FollowedShopDigestItem[]
  count: number
  actionLabel: string
  canBulkMoveToCart: boolean
}

export type FollowedShopDigestResult = {
  sections: FollowedShopDigestSection[]
  counts: {
    followedShops: number
    newArrivals: number
    priceDrops: number
    savedOverlap: number
  }
  hasActivity: boolean
}

function toCreatedAtMs(value: string | null | undefined) {
  if (!value) return null
  const parsed = Date.parse(value)
  return Number.isFinite(parsed) ? parsed : null
}

function daysSince(createdAt: string | null | undefined, nowMs: number) {
  const createdAtMs = toCreatedAtMs(createdAt)
  if (!createdAtMs) return null
  return Math.max(0, Math.floor((nowMs - createdAtMs) / (1000 * 60 * 60 * 24)))
}

function dedupeListings(items: ListingSummary[]) {
  const seen = new Set<string>()
  return items.filter((item) => {
    if (!item.id || seen.has(item.id)) return false
    seen.add(item.id)
    return true
  })
}

function section(
  key: FollowedShopDigestSection['key'],
  title: string,
  subtitle: string,
  items: FollowedShopDigestItem[],
  actionLabel: string,
  count = items.length,
): FollowedShopDigestSection {
  return {
    key,
    title,
    subtitle,
    items,
    count,
    actionLabel,
    canBulkMoveToCart: items.length > 1 && items.length <= MAX_SECTION_ITEMS,
  }
}

function sortByScore(items: FollowedShopDigestItem[]) {
  return [...items].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score
    if (b.priceDropAmount !== a.priceDropAmount) return b.priceDropAmount - a.priceDropAmount
    return (toCreatedAtMs(b.created_at) ?? 0) - (toCreatedAtMs(a.created_at) ?? 0)
  })
}

export function buildFollowedShopDigest(input: {
  followedShops: FollowedShopSummary[]
  recentListings: ListingSummary[]
  favoriteListings: ListingSummary[]
  priceBaseline: PriceBaselineMap
  nowMs?: number
}): FollowedShopDigestResult {
  const nowMs = input.nowMs ?? Date.now()
  const followedShopById = new Map(input.followedShops.map((shop) => [shop.id, shop]))
  const followedAtByShopId = new Map(input.followedShops.map((shop) => [shop.id, shop.followed_at ?? null]))
  const followedShopIds = new Set(input.followedShops.map((shop) => shop.id))
  const favoriteIds = new Set(input.favoriteListings.map((item) => item.id))
  const allListings = dedupeListings([...input.recentListings, ...input.favoriteListings]).filter(
    (item) => item.shop_id && followedShopIds.has(item.shop_id),
  )

  const recentItems = dedupeListings(input.recentListings)
    .filter((item) => item.shop_id && followedShopIds.has(item.shop_id))
    .map((item) => {
      const previousPrice = input.priceBaseline[item.id] ?? null
      const priceDropAmount = previousPrice && previousPrice > item.price ? previousPrice - item.price : 0
      const freshnessDays = daysSince(item.created_at, nowMs)
      let score = 60
      if (freshnessDays != null) score += Math.max(0, 14 - Math.min(freshnessDays, 14))
      if (priceDropAmount > 0) score += Math.min(40, Math.round(priceDropAmount / 10))
      if (favoriteIds.has(item.id)) score += 20
      if (item.shop_verified) score += 5

      return {
        ...item,
        score,
        source: 'new_arrival' as const,
        shopSlug: followedShopById.get(item.shop_id ?? '')?.slug ?? null,
        shopFollowedAt: followedAtByShopId.get(item.shop_id ?? '') ?? null,
        freshnessDays,
        previousPrice,
        priceDropAmount,
        isFavorite: favoriteIds.has(item.id),
      }
    })
    .filter((item) => item.freshnessDays == null || item.freshnessDays <= NEW_ARRIVAL_WINDOW_MS / (1000 * 60 * 60 * 24))

  const priceDropCandidates = allListings
    .map((item) => {
      const previousPrice = input.priceBaseline[item.id] ?? null
      const priceDropAmount = previousPrice && previousPrice > item.price ? previousPrice - item.price : 0
      if (priceDropAmount <= 0) return null
      const freshnessDays = daysSince(item.created_at, nowMs)
      let score = 70 + Math.min(50, Math.round(priceDropAmount / 10))
      if (favoriteIds.has(item.id)) score += 20
      if (freshnessDays != null) score += Math.max(0, 7 - Math.min(freshnessDays, 7))
      return {
        ...item,
        score,
        source: 'price_drop' as const,
        shopSlug: followedShopById.get(item.shop_id ?? '')?.slug ?? null,
        shopFollowedAt: followedAtByShopId.get(item.shop_id ?? '') ?? null,
        freshnessDays,
        previousPrice,
        priceDropAmount,
        isFavorite: favoriteIds.has(item.id),
      }
    })
    .filter((item): item is FollowedShopDigestItem => !!item)

  const savedOverlapCandidates = dedupeListings(input.favoriteListings)
    .filter((item) => item.shop_id && followedShopIds.has(item.shop_id))
    .map((item) => {
      const previousPrice = input.priceBaseline[item.id] ?? null
      const priceDropAmount = previousPrice && previousPrice > item.price ? previousPrice - item.price : 0
      const freshnessDays = daysSince(item.created_at, nowMs)
      let score = 50
      if (priceDropAmount > 0) score += Math.min(40, Math.round(priceDropAmount / 10))
      if (typeof item.average_rating === 'number' && item.average_rating >= 4.2) score += 10
      if (item.shop_verified) score += 5
      if (freshnessDays != null) score += Math.max(0, 7 - Math.min(freshnessDays, 7))
      return {
        ...item,
        score,
        source: 'saved_overlap' as const,
        shopSlug: followedShopById.get(item.shop_id ?? '')?.slug ?? null,
        shopFollowedAt: followedAtByShopId.get(item.shop_id ?? '') ?? null,
        freshnessDays,
        previousPrice,
        priceDropAmount,
        isFavorite: true,
      }
    })

  const prioritizedPriceDropIds = new Set(priceDropCandidates.map((item) => item.id))
  const newArrivals = sortByScore(recentItems)
    .filter((item) => !prioritizedPriceDropIds.has(item.id))
    .slice(0, MAX_SECTION_ITEMS)
  const usedIds = new Set(newArrivals.map((item) => item.id))
  const priceDrops = sortByScore(priceDropCandidates)
    .filter((item) => !usedIds.has(item.id))
    .slice(0, MAX_SECTION_ITEMS)
  for (const item of priceDrops) usedIds.add(item.id)
  const savedOverlap = sortByScore(savedOverlapCandidates)
    .filter((item) => !usedIds.has(item.id))
    .slice(0, MAX_SECTION_ITEMS)

  const sections = [
    section(
      'new_arrivals',
      'New from shops you follow',
      'Fresh listings from sellers you already chose to keep tabs on.',
      newArrivals,
      'Move new picks to cart',
      recentItems.length,
    ),
    section(
      'price_drops',
      'Price drops from followed shops',
      'Items that got cheaper since your last followed-shop digest refresh.',
      priceDrops,
      'Move price drops to cart',
      priceDropCandidates.length,
    ),
    section(
      'saved_overlap',
      'Saved items from followed shops',
      'Wishlist picks that overlap with your followed sellers and deserve another look.',
      savedOverlap,
      'Move saved picks to cart',
      savedOverlapCandidates.length,
    ),
  ].filter((current) => current.items.length > 0)

  return {
    sections,
    counts: {
      followedShops: input.followedShops.length,
      newArrivals: recentItems.length,
      priceDrops: priceDropCandidates.length,
      savedOverlap: savedOverlapCandidates.length,
    },
    hasActivity: sections.length > 0,
  }
}

export async function readFollowedShopDigestPriceBaseline(): Promise<PriceBaselineMap> {
  try {
    const raw = await AsyncStorage.getItem(PRICE_BASELINE_KEY)
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

async function writeFollowedShopDigestPriceBaseline(value: PriceBaselineMap) {
  await AsyncStorage.setItem(PRICE_BASELINE_KEY, JSON.stringify(value))
}

export async function persistFollowedShopDigestPriceBaseline(items: ListingSummary[]) {
  if (!items.length) return
  const current = await readFollowedShopDigestPriceBaseline()
  for (const item of items) current[item.id] = item.price
  await writeFollowedShopDigestPriceBaseline(current)
}

export async function loadFollowedShopDigest(input: {
  followedShops: FollowedShopSummary[]
  favoriteIds: string[]
}): Promise<FollowedShopDigestResult> {
  if (!input.followedShops.length) {
    return {
      sections: [],
      counts: {
        followedShops: 0,
        newArrivals: 0,
        priceDrops: 0,
        savedOverlap: 0,
      },
      hasActivity: false,
    }
  }

  const favoriteIds = [...new Set(input.favoriteIds.filter(Boolean))].slice(0, MAX_FAVORITE_ITEMS)
  const scannedShops = input.followedShops.slice(0, MAX_SHOPS_TO_SCAN)
  const [recentByShop, favoriteListings, baseline] = await Promise.all([
    Promise.all(
      scannedShops.map((shop) =>
        fetchActiveListingCards({
          shopId: shop.id,
          limit: MAX_SECTION_ITEMS,
          orderBy: 'created_at',
        }),
      ),
    ),
    favoriteIds.length ? fetchListingsByIds(favoriteIds) : Promise.resolve([]),
    readFollowedShopDigestPriceBaseline(),
  ])

  const recentListings = dedupeListings(recentByShop.flat())
  const result = buildFollowedShopDigest({
    followedShops: input.followedShops,
    recentListings,
    favoriteListings,
    priceBaseline: baseline,
  })

  await persistFollowedShopDigestPriceBaseline([...recentListings, ...favoriteListings])
  return result
}
