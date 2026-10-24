import { getCategorySlug, getListingSlug, getShopSlug } from '~/commerce/lib/seo-urls'

export const SITEMAP_ORIGIN = 'https://www.sheconomy.in'

/** Paths search engines should not list. Matches public/robots.txt plus private screens. */
const PRIVATE_PREFIXES = [
  '/cart',
  '/checkout',
  '/orders',
  '/admin',
  '/auth',
  '/chat',
  '/settings',
  '/favorites',
  '/api',
  '/payment-methods',
  '/addresses',
  '/vendor',
  '/notifications',
  '/ui-kit',
  '/co-work/meeting',
  '/co-work/meetings',
  '/co-work/join',
  '/co-work/schedule',
  '/co-work/recording',
]

export const STATIC_SITEMAP_PATHS = [
  '/',
  '/browse',
  '/shops',
  '/community',
  '/help',
  '/legal/terms',
  '/legal/privacy',
  '/legal/cookies',
  '/legal/ads',
]

export type SitemapEntry = {
  path: string
  lastmod?: string | null
}

export type SitemapListing = {
  id: string
  slug?: string | null
  title?: string | null
  updated_at?: string | null
}

export type SitemapShop = {
  id: string
  slug?: string | null
  shop_name?: string | null
  updated_at?: string | null
  robots_index?: boolean | null
}

export type SitemapCategory = {
  category_id: string
  category?: string | null
  seo_name?: string | null
  updated_at?: string | null
}

export type SitemapCmsRow = {
  path?: string | null
  last_modified?: string | null
}

export function isPrivateSitemapPath(path: string): boolean {
  return PRIVATE_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`))
}

export function normalizeSitemapPath(value: string | null | undefined): string | null {
  if (!value) return null
  let path = value.trim()
  if (!path) return null
  if (path.includes('://')) {
    try {
      const url = new URL(path)
      path = url.pathname
    } catch {
      return null
    }
  }
  path = path.split('?')[0]?.split('#')[0] ?? ''
  if (!path.startsWith('/')) path = `/${path}`
  if (path.length > 1 && path.endsWith('/')) path = path.slice(0, -1)
  if (!path.startsWith('/') || path.includes('..')) return null
  return path
}

export function sitemapLastmod(value: string | null | undefined): string | null {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return date.toISOString().slice(0, 10)
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

export function entriesFromCatalog(input: {
  listings?: SitemapListing[]
  shops?: SitemapShop[]
  categories?: SitemapCategory[]
  cms?: SitemapCmsRow[]
}): SitemapEntry[] {
  const entries: SitemapEntry[] = STATIC_SITEMAP_PATHS.map((path) => ({ path }))

  for (const listing of input.listings ?? []) {
    const slug = getListingSlug({
      id: listing.id,
      slug: listing.slug,
      title: listing.title ?? undefined,
    })
    if (!slug) continue
    entries.push({
      path: `/listing/${encodeURIComponent(slug)}`,
      lastmod: listing.updated_at,
    })
  }

  for (const shop of input.shops ?? []) {
    if (shop.robots_index === false) continue
    const slug = getShopSlug({
      id: shop.id,
      slug: shop.slug,
      shop_name: shop.shop_name ?? undefined,
    })
    if (!slug) continue
    entries.push({
      path: `/shop/${encodeURIComponent(slug)}`,
      lastmod: shop.updated_at,
    })
  }

  for (const category of input.categories ?? []) {
    const slug = getCategorySlug({
      category_id: category.category_id,
      seo_name: category.seo_name,
      category: category.category ?? undefined,
    })
    if (!slug) continue
    entries.push({
      path: `/category/${encodeURIComponent(slug)}`,
      lastmod: category.updated_at,
    })
  }

  for (const row of input.cms ?? []) {
    const path = normalizeSitemapPath(row.path)
    if (!path) continue
    entries.push({ path, lastmod: row.last_modified })
  }

  return entries
}

export function buildSitemapXml(entries: SitemapEntry[], origin = SITEMAP_ORIGIN): string {
  const seen = new Set<string>()
  const urls: string[] = []

  for (const entry of entries) {
    const path = normalizeSitemapPath(entry.path)
    if (!path || isPrivateSitemapPath(path) || seen.has(path)) continue
    seen.add(path)
    const loc = `${origin}${path}`
    const lastmod = sitemapLastmod(entry.lastmod)
    urls.push(
      `  <url><loc>${escapeXml(loc)}</loc>${lastmod ? `<lastmod>${lastmod}</lastmod>` : ''}</url>`,
    )
  }

  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`
}
