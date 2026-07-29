import { USER_ROLES, type UserRole } from '~/lib/profile/profile.type'

import {
  COMMON_SHOP_CATEGORIES,
  DEFAULT_SHOP_CURRENCY,
  SUPPORTED_CURRENCIES,
  VALID_SOCIAL_PLATFORMS,
  type Shop,
  type ShopFormData,
  type SocialPlatform,
} from '~/lib/shop/shop.type'

// Currency helpers live in current-shop-utils (vendor panel source of truth).
export {
  type CurrentShopUtils,
  type FormatVendorCurrencyOptions,
  type VendorCurrencyInfo,
  formatShopCurrency,
  getCurrencyDisplayOptions,
  getCurrencyName,
  getCurrencySymbol,
  getCurrentShopUtils,
  isValidCurrency,
  resolveVendorCurrency,
  toCurrencyInfo,
} from './current-shop-utils'

// ============= SLUG =============

/** URL-friendly slug from a shop name. */
export function generateShopSlug(shopName: string | null | undefined): string {
  if (!shopName) return ''
  return shopName
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

// ============= OWNERSHIP & ROLES =============

/** Whether the given user owns the shop. */
export function isShopOwner(
  shop: Pick<Shop, 'user_id'> | null | undefined,
  userId: string | null | undefined,
): boolean {
  if (!shop || !userId) return false
  return shop.user_id === userId
}

export function isAdminRole(role: string | null | undefined): boolean {
  return role === USER_ROLES.ADMIN
}

export function isVendorRole(role: string | null | undefined): boolean {
  return role === USER_ROLES.VENDOR
}

/**
 * Whether a user may edit / manage a shop: the owner, or an admin.
 * `role` is the viewer's `profiles.role` (A / V / U).
 */
export function canManageShop(
  shop: Pick<Shop, 'user_id'> | null | undefined,
  userId: string | null | undefined,
  role?: UserRole | string | null,
): boolean {
  if (isAdminRole(role)) return true
  return isShopOwner(shop, userId)
}

// ============= HOURS =============

const DAYS_OF_WEEK = [
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
] as const

/** Normalise a shop-hours object into an ordered, display-ready array. */
export function formatShopHours(
  hours: Record<string, string> | null | undefined,
): { day: string; hours: string; isOpen: boolean }[] {
  if (!hours || typeof hours !== 'object') return []
  const ordered = DAYS_OF_WEEK.slice(1).concat(DAYS_OF_WEEK[0]) // Mon → Sun
  return ordered.map((day) => ({
    day: day.charAt(0).toUpperCase() + day.slice(1),
    hours: hours[day] || 'Closed',
    isOpen: Boolean(hours[day]) && hours[day] !== 'Closed',
  }))
}

/** Whether the shop is currently open, based on its hours map (`"09:00-17:00"`). */
export function isShopOpen(
  hours: Record<string, string> | null | undefined,
  now: Date = new Date(),
): { isOpen: boolean; message: string } {
  if (!hours || typeof hours !== 'object') {
    return { isOpen: false, message: 'Shop hours not available' }
  }

  const today = DAYS_OF_WEEK[now.getDay()]
  const todayHours = hours[today]
  if (!todayHours || todayHours === 'Closed') {
    return { isOpen: false, message: 'Closed today' }
  }

  const match = todayHours.match(/(\d{1,2}):(\d{2})-(\d{1,2}):(\d{2})/)
  if (!match) return { isOpen: false, message: 'Invalid hours format' }

  const [, openHour, openMinute, closeHour, closeMinute] = match
  const current = now.getHours() * 60 + now.getMinutes()
  const open = Number(openHour) * 60 + Number(openMinute)
  const close = Number(closeHour) * 60 + Number(closeMinute)
  const isOpen = current >= open && current <= close

  return {
    isOpen,
    message: isOpen ? 'Open now' : `Opens at ${openHour}:${openMinute}`,
  }
}

// ============= SOCIAL LINKS =============

/** Keep only recognised platforms and ensure each URL has an https scheme. */
export function validateSocialLinks(
  socialLinks: Record<string, string> | null | undefined,
): Partial<Record<SocialPlatform, string>> {
  if (!socialLinks || typeof socialLinks !== 'object') return {}

  const formatted: Partial<Record<SocialPlatform, string>> = {}
  for (const [platform, rawUrl] of Object.entries(socialLinks)) {
    const key = platform.toLowerCase() as SocialPlatform
    if (!VALID_SOCIAL_PLATFORMS.includes(key)) continue
    if (!rawUrl || !rawUrl.trim()) continue

    let url = rawUrl.trim()
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = `https://${url}`
    }
    formatted[key] = url
  }
  return formatted
}

// ============= FILTER / SEARCH / SORT (pure, client-side) =============

type CategorisedShop = Pick<Shop, 'shop_categories'>

function shopCategories(shop: { shop_categories?: unknown }): string[] {
  return Array.isArray(shop.shop_categories) ? (shop.shop_categories as string[]) : []
}

export function filterShopsByCategories<T extends CategorisedShop>(
  shops: T[],
  categories: string[],
): T[] {
  if (!Array.isArray(shops) || !categories?.length) return shops
  return shops.filter((shop) => {
    const shopCats = shopCategories(shop)
    return categories.some((category) => shopCats.includes(category))
  })
}

export function searchShops<
  T extends { shop_name?: string | null; shop_description?: string | null; shop_categories?: unknown },
>(shops: T[], searchTerm: string): T[] {
  if (!Array.isArray(shops) || !searchTerm?.trim()) return shops
  const term = searchTerm.toLowerCase().trim()
  return shops.filter((shop) => {
    const name = shop.shop_name?.toLowerCase() ?? ''
    const description = shop.shop_description?.toLowerCase() ?? ''
    const categories = shopCategories(shop).join(' ').toLowerCase()
    return name.includes(term) || description.includes(term) || categories.includes(term)
  })
}

export function sortShops<T extends Partial<Shop>>(
  shops: T[],
  sortBy: 'name' | 'created_at' | 'verified' = 'created_at',
  order: 'asc' | 'desc' = 'desc',
): T[] {
  if (!Array.isArray(shops)) return shops
  const direction = order === 'asc' ? 1 : -1

  return [...shops].sort((a, b) => {
    let aValue: string | number = 0
    let bValue: string | number = 0

    if (sortBy === 'name') {
      aValue = a.shop_name?.toLowerCase() ?? ''
      bValue = b.shop_name?.toLowerCase() ?? ''
    } else if (sortBy === 'created_at') {
      aValue = new Date(a.created_at ?? 0).getTime()
      bValue = new Date(b.created_at ?? 0).getTime()
    } else if (sortBy === 'verified') {
      aValue = a.verified ? 1 : 0
      bValue = b.verified ? 1 : 0
    }

    if (aValue < bValue) return -1 * direction
    if (aValue > bValue) return 1 * direction
    return 0
  })
}

// ============= COMPLETION =============

/** Weighted completion percentage (0–100) for a shop profile. */
export function getShopCompletionPercentage(shop: Partial<Shop> | null | undefined): number {
  if (!shop) return 0

  const fields: {
    key: keyof Shop
    weight: number
    kind: 'string' | 'array' | 'object'
  }[] = [
    { key: 'shop_name', weight: 20, kind: 'string' },
    { key: 'shop_description', weight: 15, kind: 'string' },
    { key: 'shop_email', weight: 10, kind: 'string' },
    { key: 'shop_phone_number', weight: 10, kind: 'string' },
    { key: 'logo_url', weight: 15, kind: 'string' },
    { key: 'shop_categories', weight: 10, kind: 'array' },
    { key: 'website_url', weight: 5, kind: 'string' },
    { key: 'social_links', weight: 5, kind: 'object' },
    { key: 'shop_hours', weight: 5, kind: 'object' },
    { key: 'shop_address_id', weight: 5, kind: 'string' },
  ]

  let total = 0
  let completed = 0

  for (const field of fields) {
    total += field.weight
    const value = shop[field.key]

    if (field.kind === 'array' && Array.isArray(value) && value.length > 0) {
      completed += field.weight
    } else if (
      field.kind === 'object' &&
      value &&
      typeof value === 'object' &&
      Object.keys(value as object).length > 0
    ) {
      completed += field.weight
    } else if (field.kind === 'string' && typeof value === 'string' && value.trim()) {
      completed += field.weight
    }
  }

  return total > 0 ? Math.round((completed / total) * 100) : 0
}

// ============= DISPLAY =============

export type ShopDisplay = {
  id: string
  userId: string
  name: string
  description: string | null
  logoUrl: string | null
  websiteUrl: string | null
  phoneNumber: string | null
  email: string | null
  categories: string[]
  hours: Record<string, string>
  socialLinks: Record<string, string>
  currency: string
  isActive: boolean
  verified: boolean
  createdAt: string
  updatedAt: string
}

/** Camel-cased projection of a shop row for view components. */
export function formatShopForDisplay(shop: Shop | null | undefined): ShopDisplay | null {
  if (!shop) return null
  return {
    id: shop.id,
    userId: shop.user_id,
    name: shop.shop_name,
    description: shop.shop_description,
    logoUrl: shop.logo_url,
    websiteUrl: shop.website_url,
    phoneNumber: shop.shop_phone_number,
    email: shop.shop_email,
    categories: shopCategories(shop),
    hours: (shop.shop_hours as Record<string, string>) ?? {},
    socialLinks: (shop.social_links as Record<string, string>) ?? {},
    currency: shop.shop_currency || DEFAULT_SHOP_CURRENCY,
    isActive: shop.is_active,
    verified: shop.verified,
    createdAt: shop.created_at,
    updatedAt: shop.updated_at,
  }
}

export function formatCategoryName(category: string | null | undefined): string {
  return category?.trim() ?? ''
}

/** Icon name for a category (resolved to a component by the UI layer). */
export function getCategoryIcon(category: string): string {
  const iconMap: Record<string, string> = {
    'Fashion & Clothing': 'shirt',
    'Beauty & Cosmetics': 'sparkles',
    'Jewelry & Accessories': 'gem',
    'Home & Garden': 'home',
    'Health & Wellness': 'heart',
    'Arts & Crafts': 'palette',
    'Food & Beverages': 'coffee',
    'Electronics & Gadgets': 'laptop',
    'Books & Education': 'book',
    'Baby & Kids': 'baby',
    'Sports & Fitness': 'dumbbell',
    'Travel & Tourism': 'plane',
    'Services & Consulting': 'briefcase',
    'Digital Products': 'download',
    Photography: 'camera',
    'Event Planning': 'calendar',
    'Pet Care & Supplies': 'paw-print',
    Automotive: 'car',
    'Music & Entertainment': 'music',
  }
  return iconMap[category] ?? 'tag'
}

/** Re-export category list for convenience. */
export { COMMON_SHOP_CATEGORIES, SUPPORTED_CURRENCIES }

/** Convert a full shop row into the editable form-data shape. */
export function shopToFormData(shop: Shop): ShopFormData {
  return {
    shop_name: shop.shop_name ?? '',
    shop_description: shop.shop_description ?? '',
    logo_url: shop.logo_url ?? '',
    website_url: shop.website_url ?? '',
    shop_phone_number: shop.shop_phone_number ?? '',
    shop_email: shop.shop_email ?? '',
    shop_address_id: shop.shop_address_id ?? null,
    shop_categories: shopCategories(shop),
    shop_hours: (shop.shop_hours as Record<string, string>) ?? {},
    social_links: (shop.social_links as Record<string, string>) ?? {},
    shop_currency: shop.shop_currency || DEFAULT_SHOP_CURRENCY,
    shop_metadata: (shop.shop_metadata as Record<string, unknown>) ?? {},
  }
}
