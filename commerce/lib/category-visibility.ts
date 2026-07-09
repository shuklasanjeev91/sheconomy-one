/** Categories excluded from storefront browse (chips, filters, category pages). */
const HIDDEN_STOREFRONT_CATEGORY_IDS = new Set([
  '220', // Diyas, Candles
])

const HIDDEN_STOREFRONT_CATEGORY_PATTERN = /without category/i

type CategoryIdentity = {
  category_id: string
  category?: string | null
}

export function isStorefrontCategoryVisible(category: CategoryIdentity): boolean {
  if (HIDDEN_STOREFRONT_CATEGORY_IDS.has(category.category_id)) return false
  if (category.category && HIDDEN_STOREFRONT_CATEGORY_PATTERN.test(category.category)) return false
  return true
}
