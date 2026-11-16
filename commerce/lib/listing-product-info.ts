export type ListingProductInfo = {
  brand: string | null
  genericName: string | null
  manufacturerName: string | null
  manufacturerAddress: string | null
  packerName: string | null
  packerAddress: string | null
  importerName: string | null
  countryOfOrigin: string | null
  netQuantity: string | null
  hsnCode: string | null
  modelNumber: string | null
  materialComposition: string | null
  careInstructions: string | null
  shelfLife: string | null
  warranty: string | null
  /**
   * Key feature bullets. Stored as newline-separated text in jsonb
   * (`key_features`) or as a string array.
   */
  keyFeatures: string | null
  /** ISO date `YYYY-MM-DD` when the product was manufactured. */
  manufacturingDate: string | null
  /** ISO date `YYYY-MM-DD` best before / expiry. */
  expiryDate: string | null
}

const EMPTY_PRODUCT_INFO: ListingProductInfo = {
  brand: null,
  genericName: null,
  manufacturerName: null,
  manufacturerAddress: null,
  packerName: null,
  packerAddress: null,
  importerName: null,
  countryOfOrigin: null,
  netQuantity: null,
  hsnCode: null,
  modelNumber: null,
  materialComposition: null,
  careInstructions: null,
  shelfLife: null,
  warranty: null,
  keyFeatures: null,
  manufacturingDate: null,
  expiryDate: null,
}

/** Split key-features text / array into trimmed non-empty bullets. */
export function parseKeyFeatures(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map((item) => (typeof item === 'string' ? item.trim() : ''))
      .filter(Boolean)
  }
  const raw = typeof value === 'string' ? value : null
  if (!raw?.trim()) return []
  return raw
    .split(/\r?\n|•|·|;/)
    .map((line) => line.replace(/^\s*[-*]\s*/, '').trim())
    .filter(Boolean)
}

export function serializeKeyFeatures(bullets: string[]): string {
  return bullets
    .map((line) => line.trim())
    .filter(Boolean)
    .join('\n')
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

function str(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length ? trimmed : null
}

/** Normalize to `YYYY-MM-DD` or null. */
export function normalizeProductInfoDate(value: unknown): string | null {
  const raw = str(value)
  if (!raw) return null
  // Accept already-ISO dates or Date-parseable strings; store calendar date only.
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw
  const parsed = new Date(raw)
  if (Number.isNaN(parsed.getTime())) return null
  const year = parsed.getFullYear()
  const month = String(parsed.getMonth() + 1).padStart(2, '0')
  const day = String(parsed.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function formatProductInfoDateLabel(iso: string | null): string | null {
  if (!iso) return null
  const parsed = new Date(`${iso}T00:00:00`)
  if (Number.isNaN(parsed.getTime())) return iso
  return parsed.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

/** Parse `product_info` jsonb (+ legacy listing_metadata.product_info). */
export function parseListingProductInfo(
  productInfo?: unknown,
  listingMetadata?: unknown,
): ListingProductInfo {
  const fromColumn = asRecord(productInfo)
  const fromMeta = asRecord(asRecord(listingMetadata)?.product_info)
  const source = { ...EMPTY_PRODUCT_INFO, ...(fromMeta ?? {}), ...(fromColumn ?? {}) } as Record<
    string,
    unknown
  >

  const keyFeatureBullets = parseKeyFeatures(
    source.key_features ?? source.keyFeatures ?? source.bullet_points ?? source.bulletPoints,
  )

  return {
    brand: str(source.brand),
    genericName: str(source.generic_name ?? source.genericName),
    manufacturerName: str(source.manufacturer_name ?? source.manufacturerName),
    manufacturerAddress: str(source.manufacturer_address ?? source.manufacturerAddress),
    packerName: str(source.packer_name ?? source.packerName),
    packerAddress: str(source.packer_address ?? source.packerAddress),
    importerName: str(source.importer_name ?? source.importerName),
    countryOfOrigin: str(source.country_of_origin ?? source.countryOfOrigin),
    netQuantity: str(source.net_quantity ?? source.netQuantity),
    hsnCode: str(source.hsn_code ?? source.hsnCode),
    modelNumber: str(source.model_number ?? source.modelNumber),
    materialComposition: str(source.material_composition ?? source.materialComposition),
    careInstructions: str(source.care_instructions ?? source.careInstructions),
    shelfLife: str(source.shelf_life ?? source.shelfLife),
    warranty: str(source.warranty),
    keyFeatures: keyFeatureBullets.length ? serializeKeyFeatures(keyFeatureBullets) : null,
    manufacturingDate: normalizeProductInfoDate(
      source.manufacturing_date ?? source.manufacturingDate,
    ),
    expiryDate: normalizeProductInfoDate(source.expiry_date ?? source.expiryDate),
  }
}

/** Serialize UI form values into the jsonb shape stored on `listings.product_info`. */
export function serializeListingProductInfo(
  info: Partial<ListingProductInfo>,
): Record<string, string> {
  const out: Record<string, string> = {}
  const pairs: Array<[keyof ListingProductInfo, string]> = [
    ['brand', 'brand'],
    ['genericName', 'generic_name'],
    ['manufacturerName', 'manufacturer_name'],
    ['manufacturerAddress', 'manufacturer_address'],
    ['packerName', 'packer_name'],
    ['packerAddress', 'packer_address'],
    ['importerName', 'importer_name'],
    ['countryOfOrigin', 'country_of_origin'],
    ['netQuantity', 'net_quantity'],
    ['hsnCode', 'hsn_code'],
    ['modelNumber', 'model_number'],
    ['materialComposition', 'material_composition'],
    ['careInstructions', 'care_instructions'],
    ['shelfLife', 'shelf_life'],
    ['warranty', 'warranty'],
    ['keyFeatures', 'key_features'],
    ['manufacturingDate', 'manufacturing_date'],
    ['expiryDate', 'expiry_date'],
  ]

  for (const [key, snake] of pairs) {
    const raw = info[key]
    if (key === 'manufacturingDate' || key === 'expiryDate') {
      const normalized = normalizeProductInfoDate(raw)
      if (normalized) out[snake] = normalized
      continue
    }
    if (key === 'keyFeatures') {
      const bullets = parseKeyFeatures(raw)
      if (bullets.length) out[snake] = serializeKeyFeatures(bullets)
      continue
    }
    const value = typeof raw === 'string' ? raw.trim() : ''
    if (value) out[snake] = value
  }
  return out
}

export type ListingSpecification = {
  label: string
  value: string
}

/** Manufacturing & legal rows for the PDP details table. */
export function buildManufacturingSpecifications(
  info: ListingProductInfo,
): ListingSpecification[] {
  const featureText = parseKeyFeatures(info.keyFeatures).join(' · ') || null
  const rows: Array<[string, string | null]> = [
    ['Brand', info.brand],
    ['Generic name', info.genericName],
    ['Key features', featureText],
    ['Manufacturer', info.manufacturerName],
    ['Manufacturer address', info.manufacturerAddress],
    ['Packer', info.packerName],
    ['Packer address', info.packerAddress],
    ['Importer', info.importerName],
    ['Country of origin', info.countryOfOrigin],
    ['Manufactured on', formatProductInfoDateLabel(info.manufacturingDate)],
    ['Best before', formatProductInfoDateLabel(info.expiryDate)],
    ['Net quantity', info.netQuantity],
    ['HSN code', info.hsnCode],
    ['Model / item no.', info.modelNumber],
    ['Material / composition', info.materialComposition],
    ['Care instructions', info.careInstructions],
    ['Shelf life', info.shelfLife],
    ['Warranty', info.warranty],
  ]

  return rows
    .filter(([, value]) => !!value)
    .map(([label, value]) => ({ label, value: value as string }))
}

export function hasListingProductInfo(info: ListingProductInfo): boolean {
  return Object.values(info).some((value) => !!value)
}

export { EMPTY_PRODUCT_INFO }
