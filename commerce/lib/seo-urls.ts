const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const GENERIC_SHOP_SLUG_RE = /^(my-)?shop-?\d+$/i
const GENERIC_LISTING_SLUG_RE = /^(listing|product|item)-?\d+$/i

export function isUuid(value: string) {
  return UUID_RE.test(value)
}

export function slugifyTitle(title: string, maxLength = 72): string {
  const slug = title
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')

  return slug.slice(0, maxLength).replace(/-$/, '')
}

export function isGenericShopSlug(slug?: string | null) {
  if (!slug?.trim()) return true
  const value = slug.trim().toLowerCase()
  return isUuid(value) || GENERIC_SHOP_SLUG_RE.test(value)
}

export function isGenericListingSlug(slug?: string | null) {
  if (!slug?.trim()) return true
  const value = slug.trim().toLowerCase()
  return isUuid(value) || GENERIC_LISTING_SLUG_RE.test(value)
}

export function getListingSlug(listing: {
  slug?: string | null
  id: string
  title?: string
}): string {
  const titleSlug = listing.title?.trim() ? slugifyTitle(listing.title) : ''

  if (listing.slug?.trim() && !isGenericListingSlug(listing.slug)) {
    return listing.slug.trim()
  }

  if (titleSlug) return titleSlug

  if (listing.slug?.trim()) return listing.slug.trim()

  return listing.id
}

export function getShopSlug(shop: {
  slug?: string | null
  id: string
  shop_name?: string
}): string {
  const nameSlug = shop.shop_name?.trim() ? slugifyTitle(shop.shop_name) : ''

  if (shop.slug?.trim() && !isGenericShopSlug(shop.slug)) {
    return shop.slug.trim()
  }

  if (nameSlug) return nameSlug

  if (shop.slug?.trim()) return shop.slug.trim()

  return shop.id
}

export function getCategorySlug(category: {
  seo_name?: string | null
  category_id: string
  category?: string
}): string {
  if (category.seo_name?.trim()) return category.seo_name.trim()
  if (category.category?.trim()) {
    const slug = slugifyTitle(category.category)
    if (slug) return slug
  }
  return category.category_id
}

export function listingSlugMatches(
  listing: { slug?: string | null; id: string; title?: string },
  routeSlug: string,
) {
  const normalized = routeSlug.trim().toLowerCase()
  if (!normalized) return false

  const candidates = new Set(
    [
      listing.slug,
      getListingSlug(listing),
      listing.id,
      listing.title ? slugifyTitle(listing.title) : null,
    ]
      .filter(Boolean)
      .map((value) => String(value).toLowerCase()),
  )

  if (candidates.has(normalized)) return true

  const idPrefix = normalized.split('-')[0]
  return isUuid(idPrefix) && listing.id.toLowerCase() === idPrefix
}

export function shopSlugMatches(
  shop: { slug?: string | null; id: string; shop_name?: string },
  routeSlug: string,
) {
  const normalized = routeSlug.trim().toLowerCase()
  if (!normalized) return false

  const candidates = new Set(
    [shop.slug, getShopSlug(shop), shop.id, shop.shop_name ? slugifyTitle(shop.shop_name) : null]
      .filter(Boolean)
      .map((value) => String(value).toLowerCase()),
  )

  return candidates.has(normalized) || (isUuid(normalized) && shop.id.toLowerCase() === normalized)
}
