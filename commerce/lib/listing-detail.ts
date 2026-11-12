import type { Json } from '~/lib/supabase'

export type ListingVariation = {
  id: string
  variation_name: string
  variation_value: string
  price_adjustment: number | null
  stock: number | null
  sku: string | null
  is_available: boolean
  display_order: number
}

export type ListingAttribute = {
  id: string
  attribute_name: string
  attribute_value: string
  display_order: number
}

export type ListingSpecification = {
  label: string
  value: string
}

export type VariationGroup = {
  name: string
  options: ListingVariation[]
}

type DimensionsJson = {
  width?: number | null
  height?: number | null
  length?: number | null
  unit?: string | null
}

export function groupListingVariations(variations: ListingVariation[]): VariationGroup[] {
  const groups = new Map<string, ListingVariation[]>()

  for (const variation of [...variations].sort((a, b) => a.display_order - b.display_order)) {
    if (!variation.is_available) continue

    const options = groups.get(variation.variation_name) ?? []
    options.push(variation)
    groups.set(variation.variation_name, options)
  }

  return [...groups.entries()].map(([name, options]) => ({ name, options }))
}

export function getDefaultVariantSelection(groups: VariationGroup[]): Record<string, string> {
  const selection: Record<string, string> = {}

  for (const group of groups) {
    const firstAvailable = group.options.find((option) => option.is_available)
    if (firstAvailable) selection[group.name] = firstAvailable.id
  }

  return selection
}

export function getSelectedVariations(
  variations: ListingVariation[],
  selection: Record<string, string>,
): ListingVariation[] {
  const byId = new Map(variations.map((variation) => [variation.id, variation]))
  return Object.values(selection)
    .map((id) => byId.get(id))
    .filter((variation): variation is ListingVariation => !!variation)
}

export function getVariantPrice(
  basePrice: number,
  selected: ListingVariation[],
): number {
  const adjustment = selected.reduce((sum, variation) => sum + (variation.price_adjustment ?? 0), 0)
  return basePrice + adjustment
}

export function getVariantStock(
  listingStock: number | null | undefined,
  selected: ListingVariation[],
): number | null {
  if (!selected.length) return listingStock ?? null

  const stocks = selected
    .map((variation) => variation.stock)
    .filter((stock): stock is number => stock != null)

  if (!stocks.length) return listingStock ?? null
  return Math.min(...stocks)
}

export function buildListingSpecifications(input: {
  sku?: string | null
  weight?: number | null
  dimensions?: Json | null
  category?: string | null
  listingType?: string | null
  attributes?: ListingAttribute[]
  tags?: string[] | null
  /** Extra manufacturing / legal rows (brand, origin, HSN, etc.). */
  productInfoSpecs?: ListingSpecification[]
}): ListingSpecification[] {
  const specs: ListingSpecification[] = []
  const seen = new Set<string>()

  function add(label: string, value: string | null | undefined) {
    const trimmed = value?.trim()
    if (!trimmed) return

    const key = `${label}:${trimmed}`
    if (seen.has(key)) return

    seen.add(key)
    specs.push({ label, value: trimmed })
  }

  for (const attribute of [...(input.attributes ?? [])].sort(
    (a, b) => a.display_order - b.display_order,
  )) {
    add(attribute.attribute_name, attribute.attribute_value)
  }

  for (const extra of input.productInfoSpecs ?? []) {
    add(extra.label, extra.value)
  }

  add('SKU', input.sku)
  add('Category', input.category)

  if (input.weight != null) {
    add('Weight', `${input.weight} kg`)
  }

  const dimensions = input.dimensions as DimensionsJson | null
  if (dimensions && (dimensions.width || dimensions.height || dimensions.length)) {
    const unit = dimensions.unit ?? 'cm'
    const parts = [dimensions.length, dimensions.width, dimensions.height]
      .filter((value) => value != null)
      .map((value) => String(value))

    if (parts.length) {
      add('Dimensions', `${parts.join(' × ')} ${unit}`)
    }
  }

  if (input.listingType) {
    add('Listing type', input.listingType === 'digital' ? 'Instant delivery' : 'Physical goods')
  }

  if (input.tags?.length) {
    add('Tags', input.tags.slice(0, 8).join(', '))
  }

  return specs
}
