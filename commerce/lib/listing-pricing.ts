import { formatCurrency } from '~/lib/format'

export type ListingPriceInput = {
  /** Current selling price (what the buyer pays). */
  price: number
  /** Maximum Retail Price — shown struck when higher than selling price. */
  mrp?: number | null
  currency?: string | null
  /** Default true — marketplace prices are tax-inclusive. */
  priceIncludesTax?: boolean | null
  /** Declared GST/tax % for disclosure (optional). */
  taxPercent?: number | null
}

export type ListingPriceDisplay = {
  price: number
  mrp: number | null
  currency: string
  priceIncludesTax: boolean
  taxPercent: number | null
  /** Positive % off MRP when MRP > selling price. */
  discountPercent: number | null
  youSave: number | null
  priceLabel: string
  mrpLabel: string | null
  taxLabel: string
  discountLabel: string | null
  saveLabel: string | null
}

function toFiniteNumber(value: unknown): number | null {
  if (value == null || value === '') return null
  const n = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(n) ? n : null
}

/** Normalize listing pricing for cards, PDP, and sticky buy bars. */
export function resolveListingPrice(input: ListingPriceInput): ListingPriceDisplay {
  const price = Math.max(0, toFiniteNumber(input.price) ?? 0)
  const mrp = toFiniteNumber(input.mrp)
  const showMrp = mrp != null && mrp > price + 0.009
  const currency = (input.currency || 'INR').toUpperCase()
  const priceIncludesTax = input.priceIncludesTax !== false
  const taxPercent = toFiniteNumber(input.taxPercent)
  const youSave = showMrp && mrp != null ? Math.max(0, mrp - price) : null
  const discountPercent =
    showMrp && mrp != null && mrp > 0 ? Math.round(((mrp - price) / mrp) * 100) : null

  const taxLabel = priceIncludesTax
    ? taxPercent != null && taxPercent > 0
      ? `Inclusive of all taxes (GST ${taxPercent}%)`
      : 'Inclusive of all taxes'
    : taxPercent != null && taxPercent > 0
      ? `Exclusive of taxes (GST ${taxPercent}% extra)`
      : 'Exclusive of taxes'

  return {
    price,
    mrp: showMrp ? mrp : null,
    currency,
    priceIncludesTax,
    taxPercent,
    discountPercent,
    youSave,
    priceLabel: formatCurrency(price, currency),
    mrpLabel: showMrp && mrp != null ? formatCurrency(mrp, currency) : null,
    taxLabel,
    discountLabel: discountPercent != null && discountPercent > 0 ? `${discountPercent}% off` : null,
    saveLabel:
      youSave != null && youSave > 0 ? `You save ${formatCurrency(youSave, currency)}` : null,
  }
}

/** Read MRP / tax fields from a listing row (supports snake_case DB columns). */
export function listingPriceFieldsFromRow(row: {
  price?: number | null
  mrp?: number | null
  price_includes_tax?: boolean | null
  tax_percent?: number | null
  currency?: string | null
}): ListingPriceInput {
  return {
    price: row.price ?? 0,
    mrp: row.mrp,
    currency: row.currency,
    priceIncludesTax: row.price_includes_tax,
    taxPercent: row.tax_percent,
  }
}
