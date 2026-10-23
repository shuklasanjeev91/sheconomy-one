import { Platform } from 'react-native'

import { commerceRoutes } from '~/lib/routes'

const DEFAULT_SHEAI_ORIGIN = 'http://18.138.34.238:8000'

export type SheaiRecommendItem = {
  title: string
  slug: string | null
  href: string
  category: string | null
  shopName: string | null
  logoUrl: string | null
  imageUrl: string | null
  price: number | null
  priceTier: string | null
  score: number
}

export type SheaiRecommendResult = {
  query: string
  results: SheaiRecommendItem[]
}

export const SHEAI_LANGUAGES = [
  'English',
  'हिंदी',
  'বাংলা',
  'தமிழ்',
  'తెలుగు',
  'ਪੰਜਾਬੀ',
] as const

export const SHEAI_PROMPT_CHIPS: Array<{ label: string; query: string }> = [
  { label: 'Wedding day look', query: "something beautiful for my best friend's wedding day as a bride" },
  { label: 'माँ के लिए तोहफ़ा', query: 'मेरी माँ की शादी की सालगिरह के लिए कुछ खास' },
  { label: 'Gentle skincare', query: 'gentle skincare for sensitive skin natural no chemicals' },
  { label: 'Festive earrings', query: 'handcrafted earrings that feel traditional yet modern festive' },
  { label: 'হস্তনির্মিত ঘর সাজানো', query: 'আমার বাড়ির জন্য হস্তনির্মিত সুন্দর কিছু' },
  { label: 'Peaceful wall art', query: 'a painting that brings calm and peace to my living room wall' },
  { label: 'Daily wellness', query: 'natural immunity and energy boost ayurvedic daily routine' },
  { label: 'ਧੀ ਲਈ ਤੋਹਫ਼ਾ', query: 'ਮੇਰੀ ਧੀ ਦੇ ਜਨਮਦਿਨ ਲਈ ਕੁਝ ਖਾਸ ਤੋਹਫ਼ਾ' },
]

export function buildSheaiSearchHref(query?: string): string {
  const params = new URLSearchParams()
  const q = query?.trim()
  if (q) params.set('q', q)
  params.set('mode', 'sheai')
  params.set('scope', 'listings')
  return `/search?${params.toString()}`
}

function sheaiDirectOrigin(): string {
  return (process.env.EXPO_PUBLIC_SHEAI_API_URL?.trim() || DEFAULT_SHEAI_ORIGIN).replace(/\/$/, '')
}

export function sheaiRecommendEndpoint(): string {
  return sheaiRecommendEndpoints()[0] ?? `${sheaiDirectOrigin()}/recommend/rich`
}

export function sheaiRecommendEndpoints(): string[] {
  const direct = `${sheaiDirectOrigin()}/recommend/rich`
  const webOrigin = process.env.EXPO_PUBLIC_WEB_APP_URL?.trim()
  const proxy = webOrigin ? `${webOrigin.replace(/\/$/, '')}/api/sheai` : '/api/sheai'
  // Same-origin proxy first on web so CORS / mixed-content cannot hide cards.
  if (Platform.OS === 'web') return [proxy, direct]
  return webOrigin ? [proxy, direct] : [direct]
}

export function parseSheaiListingsFromAnswer(answer: string): SheaiRecommendItem[] {
  const text = answer.trim()
  if (!text) return []

  const results: SheaiRecommendItem[] = []
  const seen = new Set<string>()
  const named =
    /(?:^|[;,]|\n)\s*([^→\n|;]{3,160}?)\s*(?:\(₹\s*([\d,]+(?:\.\d+)?)\))?\s*→\s*\/listing\/([a-z0-9-]+)/gi

  for (const match of text.matchAll(named)) {
    const slug = (match[3] ?? '').trim().toLowerCase()
    if (!slug || seen.has(slug)) continue
    seen.add(slug)
    const priceRaw = asNumber((match[2] ?? '').replace(/,/g, ''))
    const rawTitle = (match[1] ?? '').replace(/^[^A-Za-z\u0900-\u0A7F]+/, '').trim()
    const title =
      (rawTitle.includes(':') ? rawTitle.slice(rawTitle.lastIndexOf(':') + 1).trim() : rawTitle) ||
      slug.replace(/-/g, ' ')
    results.push({
      title,
      slug,
      href: listingHrefFromSheai(slug, null),
      category: null,
      shopName: null,
      logoUrl: null,
      imageUrl: null,
      price: priceRaw != null && priceRaw > 0 ? priceRaw : null,
      priceTier: null,
      score: 0,
    })
  }

  const bare = text.matchAll(/\/listing\/([a-z0-9-]+)/gi)
  for (const match of bare) {
    const slug = (match[1] ?? '').trim().toLowerCase()
    if (!slug || seen.has(slug)) continue
    seen.add(slug)
    results.push({
      title: slug.replace(/-/g, ' '),
      slug,
      href: listingHrefFromSheai(slug, null),
      category: null,
      shopName: null,
      logoUrl: null,
      imageUrl: null,
      price: null,
      priceTier: null,
      score: 0,
    })
  }

  return results
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function asNumber(value: unknown): number | null {
  const n = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN
  return Number.isFinite(n) ? n : null
}

export function listingHrefFromSheai(slug: string | null, productUrl: string | null): string {
  if (slug) return String(commerceRoutes.listing(slug))
  if (productUrl) {
    try {
      const url = new URL(productUrl)
      const match = url.pathname.match(/\/listing\/([^/]+)/)
      if (match?.[1]) return String(commerceRoutes.listing(decodeURIComponent(match[1])))
    } catch {
      // fall through
    }
  }
  return '/search?scope=listings'
}

export function parseSheaiRecommendPayload(
  payload: unknown,
  fallbackQuery: string,
): SheaiRecommendResult {
  const data = asRecord(payload)
  const query = asString(data?.query) || fallbackQuery
  const raw = Array.isArray(data?.results) ? data.results : []
  const results: SheaiRecommendItem[] = []

  for (const entry of raw) {
    const item = asRecord(entry)
    if (!item) continue
    const title = asString(item.title) || 'Untitled product'
    const slug = asString(item.slug) || null
    const productUrl = asString(item.product_url) || null
    const price = asNumber(item.price)
    const scoreRaw = asNumber(item.score) ?? 0
    const score = Math.max(0, Math.min(100, Math.round(scoreRaw <= 1 ? scoreRaw * 100 : scoreRaw)))

    results.push({
      title,
      slug,
      href: listingHrefFromSheai(slug, productUrl),
      category: asString(item.category) || null,
      shopName: asString(item.shop_name) || null,
      logoUrl: asString(item.logo_url) || null,
      imageUrl: asString(item.primary_image_url) || null,
      price: price != null && price > 0 ? price : null,
      priceTier: asString(item.price_tier) || null,
      score,
    })
  }

  return { query, results }
}

export async function recommendWithSheai(
  searchQuery: string,
  options?: { topK?: number; signal?: AbortSignal },
): Promise<SheaiRecommendResult> {
  const trimmed = searchQuery.trim()
  if (!trimmed) {
    return { query: '', results: [] }
  }

  const body = JSON.stringify({ search_query: trimmed, top_k: options?.topK ?? 10 })
  let lastError: Error | null = null

  for (const endpoint of sheaiRecommendEndpoints()) {
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        signal: options?.signal,
      })
      const contentType = response.headers.get('content-type') || ''
      const raw = await response.text()
      const looksJson = contentType.includes('json') || raw.trim().startsWith('{')
      if (!looksJson) {
        lastError = new Error(`SHEai is unavailable (${response.status})`)
        continue
      }
      const payload = JSON.parse(raw) as unknown
      if (!response.ok) {
        const err = asRecord(payload)
        lastError = new Error(
          typeof err?.detail === 'string' && err.detail.trim()
            ? err.detail.trim()
            : `SHEai is unavailable (${response.status})`,
        )
        continue
      }
      return parseSheaiRecommendPayload(payload, trimmed)
    } catch (error) {
      if (options?.signal?.aborted) throw error
      lastError = error instanceof Error ? error : new Error('Unable to reach SHEai')
    }
  }

  throw lastError ?? new Error('Unable to reach SHEai')
}
