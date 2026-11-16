/**
 * Amazon-style parent/child listing SKUs.
 * Child rows live in listing_variations with variation_metadata.mode = 'child_sku'.
 */
import type { Json } from '~/lib/supabase'

export const CHILD_SKU_MODE = 'child_sku' as const
export const MAX_CHILD_SKUS = 100

export type VariationAxis = {
  name: string
  values: string[]
}

export type ChildSkuOptions = Record<string, string>

export type ChildSkuMeta = {
  mode: typeof CHILD_SKU_MODE
  options: ChildSkuOptions
  /** Client-only key before the row is persisted. */
  tempKey?: string
}

export type ChildSkuLike = {
  id?: string | null
  variation_name?: string | null
  variation_value?: string | null
  price?: number | null
  price_adjustment?: number | null
  mrp?: number | null
  tax_percent?: number | null
  price_includes_tax?: boolean | null
  hsn_code?: string | null
  weight?: number | null
  stock?: number | null
  sku?: string | null
  is_available?: boolean | null
  display_order?: number | null
  variation_metadata?: Json | null
}

export function normalizeAxisName(name: string): string {
  return name.trim().replace(/\s+/g, ' ')
}

export function normalizeAxisValue(value: string): string {
  return value.trim().replace(/\s+/g, ' ')
}

export function parseVariationAxes(metadata: unknown): VariationAxis[] {
  if (!metadata || typeof metadata !== 'object') return []
  const raw = (metadata as Record<string, unknown>).variation_axes
  if (!Array.isArray(raw)) return []
  return raw
    .map((entry) => {
      if (!entry || typeof entry !== 'object') return null
      const name = normalizeAxisName(String((entry as { name?: unknown }).name ?? ''))
      const valuesRaw = (entry as { values?: unknown }).values
      const values = Array.isArray(valuesRaw)
        ? [...new Set(valuesRaw.map((v) => normalizeAxisValue(String(v))).filter(Boolean))]
        : []
      if (!name || !values.length) return null
      return { name, values }
    })
    .filter((axis): axis is VariationAxis => Boolean(axis))
}

export function withVariationAxes(
  metadata: Record<string, unknown> | null | undefined,
  axes: VariationAxis[],
): Record<string, unknown> {
  const next = { ...(metadata ?? {}) }
  const cleaned = axes
    .map((axis) => ({
      name: normalizeAxisName(axis.name),
      values: [...new Set(axis.values.map(normalizeAxisValue).filter(Boolean))],
    }))
    .filter((axis) => axis.name && axis.values.length)
  if (cleaned.length) next.variation_axes = cleaned
  else delete next.variation_axes
  return next
}

/** Cartesian product of axis values. Returns [] if any axis empty. Caps at MAX_CHILD_SKUS. */
export function cartesianAxes(axes: VariationAxis[]): {
  combinations: ChildSkuOptions[]
  truncated: boolean
  error: string | null
} {
  const cleaned = axes
    .map((axis) => ({
      name: normalizeAxisName(axis.name),
      values: [...new Set(axis.values.map(normalizeAxisValue).filter(Boolean))],
    }))
    .filter((axis) => axis.name && axis.values.length)

  if (!cleaned.length) return { combinations: [], truncated: false, error: null }

  let combos: ChildSkuOptions[] = [{}]
  for (const axis of cleaned) {
    const next: ChildSkuOptions[] = []
    for (const prev of combos) {
      for (const value of axis.values) {
        next.push({ ...prev, [axis.name]: value })
      }
    }
    combos = next
    if (combos.length > MAX_CHILD_SKUS) {
      return {
        combinations: combos.slice(0, MAX_CHILD_SKUS),
        truncated: true,
        error: `Too many combinations (max ${MAX_CHILD_SKUS}). Remove an axis value.`,
      }
    }
  }

  return { combinations: combos, truncated: false, error: null }
}

export function childSkuTempKey(options: ChildSkuOptions): string {
  return Object.keys(options)
    .sort()
    .map((key) => `${key}=${options[key]}`)
    .join('|')
}

export function childSkuLabels(options: ChildSkuOptions): {
  variation_name: string
  variation_value: string
} {
  const keys = Object.keys(options).sort()
  return {
    variation_name: keys.join(' / ') || 'Variant',
    variation_value: keys.map((key) => options[key]).join(' / ') || 'Default',
  }
}

export function readChildSkuMeta(metadata: Json | null | undefined): ChildSkuMeta | null {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return null
  const row = metadata as Record<string, unknown>
  if (row.mode !== CHILD_SKU_MODE) return null
  const optionsRaw = row.options
  if (!optionsRaw || typeof optionsRaw !== 'object' || Array.isArray(optionsRaw)) return null
  const options: ChildSkuOptions = {}
  for (const [key, value] of Object.entries(optionsRaw as Record<string, unknown>)) {
    const name = normalizeAxisName(key)
    const val = normalizeAxisValue(String(value ?? ''))
    if (name && val) options[name] = val
  }
  if (!Object.keys(options).length) return null
  return {
    mode: CHILD_SKU_MODE,
    options,
    tempKey: typeof row.tempKey === 'string' ? row.tempKey : undefined,
  }
}

export function buildChildSkuMetadata(options: ChildSkuOptions, tempKey?: string): ChildSkuMeta {
  return {
    mode: CHILD_SKU_MODE,
    options,
    ...(tempKey ? { tempKey } : {}),
  }
}

export function isChildSkuMode(variations: ChildSkuLike[]): boolean {
  return variations.some((row) => Boolean(readChildSkuMeta(row.variation_metadata)))
}

export function axisGroupsFromChildSkus(variations: ChildSkuLike[]): Array<{
  name: string
  values: string[]
}> {
  const map = new Map<string, Set<string>>()
  for (const row of variations) {
    const meta = readChildSkuMeta(row.variation_metadata)
    if (!meta) continue
    for (const [name, value] of Object.entries(meta.options)) {
      const set = map.get(name) ?? new Set<string>()
      set.add(value)
      map.set(name, set)
    }
  }
  return [...map.entries()].map(([name, values]) => ({
    name,
    values: [...values],
  }))
}

/** Selection is axis name → option value (not variation id). */
export function resolveChildSku<T extends ChildSkuLike>(
  variations: T[],
  selectionByAxis: Record<string, string>,
): T | null {
  const wanted = Object.fromEntries(
    Object.entries(selectionByAxis)
      .map(([k, v]) => [normalizeAxisName(k), normalizeAxisValue(v)])
      .filter(([k, v]) => k && v),
  )
  const keys = Object.keys(wanted)
  if (!keys.length) return null

  for (const row of variations) {
    const meta = readChildSkuMeta(row.variation_metadata)
    if (!meta) continue
    if (keys.every((key) => meta.options[key] === wanted[key])) return row
  }
  return null
}

export function getChildUnitPrice(
  listingBasePrice: number,
  child: ChildSkuLike | null | undefined,
): number {
  if (child?.price != null && Number.isFinite(Number(child.price))) {
    return Number(child.price)
  }
  return listingBasePrice + Number(child?.price_adjustment ?? 0)
}

export function getChildMrp(
  listingMrp: number | null | undefined,
  child: ChildSkuLike | null | undefined,
): number | null {
  if (child?.mrp != null && Number.isFinite(Number(child.mrp))) return Number(child.mrp)
  return listingMrp ?? null
}

export function getChildTaxPercent(
  listingTax: number | null | undefined,
  child: ChildSkuLike | null | undefined,
): number | null {
  if (child?.tax_percent != null && Number.isFinite(Number(child.tax_percent))) {
    return Number(child.tax_percent)
  }
  return listingTax ?? null
}

export function getChildPriceIncludesTax(
  listingFlag: boolean | null | undefined,
  child: ChildSkuLike | null | undefined,
): boolean {
  if (typeof child?.price_includes_tax === 'boolean') return child.price_includes_tax
  return Boolean(listingFlag)
}

export function getChildHsn(
  listingHsn: string | null | undefined,
  child: ChildSkuLike | null | undefined,
): string | null {
  const fromChild = child?.hsn_code?.trim()
  if (fromChild) return fromChild
  return listingHsn?.trim() || null
}

export function getChildStock(
  listingStock: number | null | undefined,
  child: ChildSkuLike | null | undefined,
): number | null {
  if (child?.stock != null && Number.isFinite(Number(child.stock))) return Number(child.stock)
  return listingStock ?? null
}

/** Keep checkout (listing + adjustment) aligned with absolute child price. */
export function adjustmentFromAbsolutePrice(
  listingBasePrice: number,
  absolutePrice: number,
): number {
  return absolutePrice - listingBasePrice
}
