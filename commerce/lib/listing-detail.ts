import type { Json } from '~/lib/supabase'
import { whatIsItLabel, whenMadeLabel, whoMadeLabel } from '~/lib/listing/product-catalog'
import {
  axisGroupsFromChildSkus,
  getChildMrp,
  getChildPriceIncludesTax,
  getChildStock,
  getChildUnitPrice,
  isChildSkuMode,
  readChildSkuMeta,
  resolveChildSku,
  resolveChildTaxPercent,
  type ChildSkuLike,
} from '~/commerce/lib/listing-variant-skus'

export type ListingVariation = {
  id: string
  variation_name: string
  variation_value: string
  price_adjustment: number | null
  price?: number | null
  mrp?: number | null
  tax_percent?: number | null
  price_includes_tax?: boolean | null
  hsn_code?: string | null
  weight?: number | null
  stock: number | null
  sku: string | null
  is_available: boolean
  is_visible?: boolean | null
  display_order: number
  variation_metadata?: Json | null
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
  /** For child-SKU mode, option.id is the axis value; for legacy it is the variation row id. */
  options: ListingVariation[]
  mode: 'child_sku' | 'legacy'
}

type DimensionsJson = {
  width?: number | null
  height?: number | null
  length?: number | null
  unit?: string | null
}

export function groupListingVariations(variations: ListingVariation[]): VariationGroup[] {
  const visible = variations.filter((variation) => variation.is_visible !== false)
  if (isChildSkuMode(visible as ChildSkuLike[])) {
    const axes = axisGroupsFromChildSkus(visible as ChildSkuLike[])
    return axes.map((axis) => ({
      name: axis.name,
      mode: 'child_sku' as const,
      options: axis.values.map((value, index) => ({
        id: value,
        variation_name: axis.name,
        variation_value: value,
        price_adjustment: null,
        stock: null,
        sku: null,
        is_available: true,
        display_order: index,
      })),
    }))
  }

  const groups = new Map<string, ListingVariation[]>()

  for (const variation of [...visible].sort((a, b) => a.display_order - b.display_order)) {
    if (variation.is_available === false) continue
    if (!variation.variation_value?.trim()) continue

    const options = groups.get(variation.variation_name) ?? []
    options.push(variation)
    groups.set(variation.variation_name, options)
  }

  return [...groups.entries()].map(([name, options]) => ({
    name,
    options,
    mode: 'legacy' as const,
  }))
}

export function getDefaultVariantSelection(groups: VariationGroup[]): Record<string, string> {
  const selection: Record<string, string> = {}

  for (const group of groups) {
    const firstAvailable =
      group.options.find((option) => option.is_available !== false) ?? group.options[0]
    if (firstAvailable) selection[group.name] = firstAvailable.id
  }

  return selection
}

export function getSelectedVariations(
  variations: ListingVariation[],
  selection: Record<string, string>,
): ListingVariation[] {
  const visible = variations.filter((variation) => variation.is_visible !== false)
  if (isChildSkuMode(visible as ChildSkuLike[])) {
    const child = resolveChildSku(visible as ChildSkuLike[], selection)
    return child ? [child as ListingVariation] : []
  }

  const byId = new Map(variations.map((variation) => [variation.id, variation]))
  return Object.values(selection)
    .map((id) => byId.get(id))
    .filter((variation): variation is ListingVariation => !!variation)
}

export function getResolvedChildSku(
  variations: ListingVariation[],
  selection: Record<string, string>,
): ListingVariation | null {
  const selected = getSelectedVariations(variations, selection)
  return selected[0] ?? null
}

export function getVariantPrice(
  basePrice: number,
  selected: ListingVariation[],
): number {
  if (selected.length === 1 && selected[0]?.price != null) {
    return getChildUnitPrice(basePrice, selected[0])
  }
  const adjustment = selected.reduce((sum, variation) => sum + (variation.price_adjustment ?? 0), 0)
  return basePrice + adjustment
}

export function getVariantStock(
  listingStock: number | null | undefined,
  selected: ListingVariation[],
): number | null {
  if (!selected.length) return listingStock ?? null

  if (selected.length === 1) {
    return getChildStock(listingStock, selected[0])
  }

  const stocks = selected
    .map((variation) => variation.stock)
    .filter((stock): stock is number => stock != null)

  if (!stocks.length) return listingStock ?? null
  return Math.min(...stocks)
}

export function getVariantMrp(
  listingMrp: number | null | undefined,
  selected: ListingVariation[],
): number | null {
  if (selected.length === 1) return getChildMrp(listingMrp, selected[0])
  return listingMrp ?? null
}

export function getVariantTaxPercent(
  listingTax: number | null | undefined,
  selected: ListingVariation[],
  countryCode?: string | null,
): number | null {
  if (selected.length === 1) {
    return resolveChildTaxPercent(selected[0], countryCode, listingTax)
  }
  return listingTax ?? null
}

export function getVariantPriceIncludesTax(
  listingFlag: boolean | null | undefined,
  selected: ListingVariation[],
): boolean {
  if (selected.length === 1) return getChildPriceIncludesTax(listingFlag, selected[0])
  return Boolean(listingFlag)
}

export function filterImagesForVariant<T extends { variation_id?: string | null }>(
  images: T[],
  variantId: string | null,
): T[] {
  if (!variantId) {
    return images.filter((image) => !image.variation_id)
  }
  const childImages = images.filter((image) => image.variation_id === variantId)
  if (childImages.length) return childImages
  return images.filter((image) => !image.variation_id)
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
  whoMade?: string | null
  whenMade?: string | null
  whatIsIt?: string | null
  materials?: string | null
  personalization?: string | null
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

  add('Who made it', whoMadeLabel(input.whoMade))
  add('When made', whenMadeLabel(input.whenMade))
  add('What is it', whatIsItLabel(input.whatIsIt))
  add('Materials', input.materials)
  add('Personalization', input.personalization)

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

export { readChildSkuMeta, isChildSkuMode }
