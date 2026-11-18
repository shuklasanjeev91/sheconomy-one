/**
 * Marketplace parent/child listing SKUs.
 * Child rows live in listing_variations with variation_metadata.mode = 'child_sku'.
 */
import type { Json } from '~/lib/supabase'

export const CHILD_SKU_MODE = 'child_sku' as const
export const MAX_CHILD_SKUS = 100
export const MAX_TAX_COUNTRIES = 8
export const DEFAULT_TAX_COUNTRY = 'IN'

export type VariationAxis = {
  name: string
  values: string[]
}

export type ChildSkuOptions = Record<string, string>

/** ISO2 country code → tax percent. */
export type TaxByCountry = Record<string, number>

export type ChildSkuMeta = {
  mode: typeof CHILD_SKU_MODE
  options: ChildSkuOptions
  /** Client-only key before the row is persisted. */
  tempKey?: string
  /** Country-wise tax rates for display / invoice metadata. */
  tax_by_country?: TaxByCountry
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

/** Uppercase alphanumeric slug fragment for SKU parts. */
export function slugSkuPart(value: string, maxLen = 12): string {
  const cleaned = String(value ?? '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '')
  return cleaned.slice(0, maxLen)
}

/** Client-side parent SKU from title (plus short random suffix for uniqueness). */
export function buildParentSkuFromTitle(title: string | null | undefined): string {
  const base = slugSkuPart(title ?? '', 8) || 'SKU'
  const suffix = Date.now().toString(36).toUpperCase().slice(-4)
  return `${base}${suffix}`.slice(0, 16)
}

/**
 * Child SKU = parent + option values, e.g. ASHWA1A2B-30TABLETS / ASHWA1A2B-60TABLETS.
 * Keeps hyphens for readability (variation.sku is not constrained like listing.sku).
 */
export function buildChildSku(
  parentSku: string | null | undefined,
  options: ChildSkuOptions,
): string {
  const parent = slugSkuPart(parentSku ?? '', 12) || 'SKU'
  const keys = Object.keys(options).sort()
  const parts = keys.map((key) => slugSkuPart(options[key] ?? '', 10)).filter(Boolean)
  const joined = [parent, ...parts].join('-')
  return joined.slice(0, 48)
}

/** Prefer existing parent SKU; otherwise build from title. */
export function ensureParentSku(
  existingSku: string | null | undefined,
  title: string | null | undefined,
): string {
  const cleaned = String(existingSku ?? '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9-]/g, '')
  if (cleaned) return cleaned.slice(0, 16)
  return buildParentSkuFromTitle(title)
}

export function normalizeCountryCode(code: string | null | undefined): string {
  return String(code ?? '')
    .trim()
    .toUpperCase()
    .slice(0, 2)
}

export function normalizeTaxByCountry(raw: unknown): TaxByCountry {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
  const out: TaxByCountry = {}
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    const cc = normalizeCountryCode(key)
    const rate = Number(value)
    if (!cc || cc.length !== 2 || !Number.isFinite(rate)) continue
    out[cc] = rate
  }
  return out
}

export function upsertCountryTax(
  map: TaxByCountry | null | undefined,
  countryCode: string,
  taxPercent: number,
): TaxByCountry {
  const cc = normalizeCountryCode(countryCode)
  const rate = Number(taxPercent)
  if (!cc || cc.length !== 2 || !Number.isFinite(rate)) {
    return normalizeTaxByCountry(map)
  }
  return { ...normalizeTaxByCountry(map), [cc]: rate }
}

export function removeCountryTax(
  map: TaxByCountry | null | undefined,
  countryCode: string,
): TaxByCountry {
  const cc = normalizeCountryCode(countryCode)
  const next = { ...normalizeTaxByCountry(map) }
  if (cc) delete next[cc]
  return next
}

/** Active/default rate from the map — prefer IN, else first sorted country. */
export function defaultTaxFromMap(
  map: TaxByCountry | null | undefined,
  fallback: number | null | undefined = null,
): number | null {
  const cleaned = normalizeTaxByCountry(map)
  if (cleaned[DEFAULT_TAX_COUNTRY] != null) return cleaned[DEFAULT_TAX_COUNTRY]
  const first = Object.keys(cleaned).sort()[0]
  if (first) return cleaned[first]!
  if (fallback != null && Number.isFinite(Number(fallback))) return Number(fallback)
  return null
}

export function seedTaxByCountry(
  taxPercent: number | null | undefined,
  countryCode: string = DEFAULT_TAX_COUNTRY,
): TaxByCountry {
  const rate = taxPercent != null && Number.isFinite(Number(taxPercent)) ? Number(taxPercent) : null
  if (rate == null) return {}
  return upsertCountryTax({}, countryCode, rate)
}

export function formatTaxByCountrySummary(map: TaxByCountry | null | undefined): string | null {
  const cleaned = normalizeTaxByCountry(map)
  const keys = Object.keys(cleaned).sort()
  if (!keys.length) return null
  return keys.map((cc) => `${cc} ${cleaned[cc]}%`).join(' · ')
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
  const taxByCountry = normalizeTaxByCountry(row.tax_by_country)
  return {
    mode: CHILD_SKU_MODE,
    options,
    tempKey: typeof row.tempKey === 'string' ? row.tempKey : undefined,
    ...(Object.keys(taxByCountry).length ? { tax_by_country: taxByCountry } : {}),
  }
}

export function buildChildSkuMetadata(
  options: ChildSkuOptions,
  tempKey?: string,
  taxByCountry?: TaxByCountry | null,
): ChildSkuMeta {
  const cleanedTax = normalizeTaxByCountry(taxByCountry)
  return {
    mode: CHILD_SKU_MODE,
    options,
    ...(tempKey ? { tempKey } : {}),
    ...(Object.keys(cleanedTax).length ? { tax_by_country: cleanedTax } : {}),
  }
}

/** Merge tax_by_country into existing child metadata without dropping options/tempKey. */
export function withChildTaxByCountry(
  metadata: Json | null | undefined,
  taxByCountry: TaxByCountry | null | undefined,
): Record<string, unknown> {
  const base =
    metadata && typeof metadata === 'object' && !Array.isArray(metadata)
      ? { ...(metadata as Record<string, unknown>) }
      : { mode: CHILD_SKU_MODE, options: {} }
  const cleaned = normalizeTaxByCountry(taxByCountry)
  if (Object.keys(cleaned).length) base.tax_by_country = cleaned
  else delete base.tax_by_country
  if (base.mode !== CHILD_SKU_MODE) base.mode = CHILD_SKU_MODE
  return base
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
  return resolveChildTaxPercent(child, null, listingTax)
}

/**
 * Prefer country-specific rate from variation_metadata.tax_by_country,
 * then child.tax_percent, then listing fallback.
 */
export function resolveChildTaxPercent(
  child: ChildSkuLike | null | undefined,
  countryCode: string | null | undefined,
  listingTax: number | null | undefined = null,
): number | null {
  const meta = readChildSkuMeta(child?.variation_metadata)
  const map = normalizeTaxByCountry(
    meta?.tax_by_country ??
      (child?.variation_metadata &&
      typeof child.variation_metadata === 'object' &&
      !Array.isArray(child.variation_metadata)
        ? (child.variation_metadata as Record<string, unknown>).tax_by_country
        : null),
  )
  const cc = normalizeCountryCode(countryCode)
  if (cc && map[cc] != null) return map[cc]!
  if (child?.tax_percent != null && Number.isFinite(Number(child.tax_percent))) {
    return Number(child.tax_percent)
  }
  if (Object.keys(map).length) return defaultTaxFromMap(map, listingTax)
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
