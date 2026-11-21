/**
 * Client keys and price fields for listing variations.
 * Photos point at `tempKey` until the variation row is saved and receives an id.
 */

export type VariationKeySource = {
  id?: string | null
  variation_metadata?: unknown
}

export type VariationImageLink = {
  variation_id?: string | null
  variant_temp_key?: string | null
}

function metadataRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return { ...(value as Record<string, unknown>) }
  }
  return {}
}

/** Stable key that links a variation row to its photos before and after save. */
export function readVariationTempKey(variation: VariationKeySource): string | null {
  const key = metadataRecord(variation.variation_metadata).tempKey
  if (typeof key === 'string' && key.trim()) return key.trim()
  const id = variation.id?.trim()
  return id || null
}

export function stampVariationTempKeys<T extends VariationKeySource>(variations: T[]): T[] {
  return variations.map((variation, index) => {
    const key = readVariationTempKey(variation) ?? `var-${index + 1}`
    return {
      ...variation,
      variation_metadata: { ...metadataRecord(variation.variation_metadata), tempKey: key },
    }
  })
}

export function newVariationDraft(name = 'Color') {
  return {
    variation_name: name,
    variation_value: '',
    price: null as number | null,
    mrp: null as number | null,
    sku: null as string | null,
    price_adjustment: 0,
    stock: 0,
    variation_metadata: {
      tempKey: `var-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    },
  }
}

/** Absolute variant price, plus the adjustment from the listing price for older readers. */
export function variationPriceFields(
  listingPrice: unknown,
  raw: string,
): { price: number | null; price_adjustment: number } {
  const trimmed = raw.trim()
  if (!trimmed) return { price: null, price_adjustment: 0 }
  const price = Number(trimmed)
  if (!Number.isFinite(price)) return { price: null, price_adjustment: 0 }
  const base = Number(listingPrice)
  const adjustment = Number.isFinite(base) ? Math.round((price - base) * 100) / 100 : 0
  return { price, price_adjustment: adjustment }
}

export function namedListingVariations<T extends { variation_value?: string | null }>(
  variations: readonly T[] | null | undefined,
): T[] {
  return (variations ?? []).filter((row) => Boolean(row.variation_value?.trim()))
}

/** A named option owns the price. The listing price tab stays hidden. */
export function listingUsesVariantPricing(
  variations: readonly { variation_value?: string | null }[] | null | undefined,
): boolean {
  return namedListingVariations(variations).length > 0
}

/**
 * The first named option is the default buyers see. Its selling price and MRP
 * become the listing price so checkout still has one number.
 */
export function withVariantListingPrice<
  T extends {
    price?: string | number | null
    mrp?: string | number | null
    variations?: Array<{
      variation_value?: string | null
      price?: string | number | null
      mrp?: string | number | null
    }> | null
  },
>(form: T): T {
  const first = namedListingVariations(form.variations)[0]
  if (!first || first.price == null || String(first.price).trim() === '') return form
  const mrp =
    first.mrp == null || String(first.mrp).trim() === '' ? '' : String(first.mrp)
  return { ...form, price: String(first.price), mrp }
}

export function variationOptionLabel(variation: {
  variation_name?: string | null
  variation_value?: string | null
}): string {
  const name = variation.variation_name?.trim() || 'Option'
  const value = variation.variation_value?.trim()
  return value ? `${name}: ${value}` : name
}

export function linkImagesToVariationKeys<T extends VariationImageLink>(
  images: T[],
  variations: VariationKeySource[],
): T[] {
  return images.map((image) => {
    if (image.variant_temp_key) return image
    if (!image.variation_id) return image
    const match = variations.find(
      (variation) =>
        variation.id === image.variation_id || readVariationTempKey(variation) === image.variation_id,
    )
    const key = match ? readVariationTempKey(match) : null
    return key ? { ...image, variant_temp_key: key } : image
  })
}
