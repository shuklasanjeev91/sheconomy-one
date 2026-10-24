export type ProductQuestion = { label: string; prompt: string }

const PRICE: ProductQuestion = { label: 'Price', prompt: 'What is the price of this product?' }
const STOCK: ProductQuestion = { label: 'In stock', prompt: 'Is this in stock?' }
const REVIEWS: ProductQuestion = { label: 'Reviews', prompt: 'What do buyers say about this?' }
const RETURNS: ProductQuestion = { label: 'Returns', prompt: 'What is the return window for this?' }
const ABOUT: ProductQuestion = { label: 'About this product', prompt: 'Tell me about this product' }
const MATERIAL: ProductQuestion = { label: 'Material', prompt: 'What is this made of?' }
const SIZES: ProductQuestion = { label: 'Sizes', prompt: 'What sizes does this come in?' }
const PACK: ProductQuestion = { label: 'Pack size', prompt: 'What pack sizes does this come in?' }
const INGREDIENTS: ProductQuestion = { label: 'Ingredients', prompt: 'What are the ingredients?' }

const APPAREL = [
  'fashion',
  'clothing',
  'apparel',
  'saree',
  'sari',
  'kurta',
  'kurti',
  'lehenga',
  'dress',
  'footwear',
  'shoe',
  'ethnic',
  'wear',
  'garment',
]

const INGESTIBLE = [
  'supplement',
  'herbal',
  'ayurvedic',
  'tablet',
  'capsule',
  'vitamin',
  'medicine',
  'health',
  'grocery',
  'food',
  'cream',
  'ointment',
  'balm',
  'skincare',
  'beauty',
  'cosmetic',
  'moisturiser',
  'moisturizer',
  'lotion',
]

const HOME = ['furniture', 'decor', 'clock', 'lamp', 'electronic', 'appliance', 'home', 'kitchen', 'bag']

function categoryHas(category: string, keywords: string[]): boolean {
  return keywords.some((keyword) => {
    const escaped = keyword.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    return new RegExp(`(?:^|[^a-z0-9])${escaped}s?(?=$|[^a-z0-9])`, 'i').test(category)
  })
}

/** Question chips for the open product. The category chooses them. */
export function productQuestionChips(category?: string | null): ProductQuestion[] {
  const value = (category ?? '').toLowerCase()
  if (categoryHas(value, APPAREL)) {
    return [PRICE, MATERIAL, SIZES, STOCK, REVIEWS, RETURNS, ABOUT]
  }
  if (categoryHas(value, INGESTIBLE)) {
    return [PRICE, INGREDIENTS, PACK, STOCK, REVIEWS, RETURNS, ABOUT]
  }
  if (categoryHas(value, HOME)) {
    return [PRICE, MATERIAL, STOCK, REVIEWS, RETURNS, ABOUT]
  }
  return [PRICE, STOCK, REVIEWS, RETURNS, ABOUT]
}
