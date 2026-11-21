/**
 * Amazon-style product identity, typed attributes, GTIN, and publish gates.
 * Pure helpers — no Supabase — so seller validation can be unit-tested.
 */

export const ITEM_CONDITIONS = [
  { value: 'new', label: 'New' },
  { value: 'used_like_new', label: 'Used — like new' },
  { value: 'used_very_good', label: 'Used — very good' },
  { value: 'used_good', label: 'Used — good' },
  { value: 'used_acceptable', label: 'Used — acceptable' },
  { value: 'refurbished', label: 'Refurbished' },
] as const

export type ItemCondition = (typeof ITEM_CONDITIONS)[number]['value']

export const PRODUCT_ID_TYPES = [
  { value: 'upc', label: 'UPC (12 digits)' },
  { value: 'ean', label: 'EAN (13 digits)' },
  { value: 'gtin', label: 'GTIN (8, 12, 13, or 14)' },
  { value: 'isbn', label: 'ISBN (10 or 13)' },
  { value: 'none', label: 'No product ID' },
] as const

export type ProductIdType = (typeof PRODUCT_ID_TYPES)[number]['value']

export const GTIN_EXEMPTION_REASONS = [
  { value: 'handmade', label: 'I made this by hand' },
  { value: 'private_label', label: 'My own brand, no barcode yet' },
  { value: 'bundle', label: 'It is a set or bundle' },
  { value: 'part', label: 'It is a spare part' },
  { value: 'brand_exemption', label: 'My brand is already exempt' },
] as const

export type GtinExemptionReason = (typeof GTIN_EXEMPTION_REASONS)[number]['value']

export const APLUS_MODULE_TYPES = [
  { value: 'image_text', label: 'Photo and words' },
  { value: 'three_image_text', label: 'Three photos' },
  { value: 'comparison', label: 'Compare options' },
  { value: 'text', label: 'Words only' },
] as const

export type AplusModuleType = (typeof APLUS_MODULE_TYPES)[number]['value']

export type AttributeDataType =
  | 'text'
  | 'number'
  | 'boolean'
  | 'enum'
  | 'multi_enum'
  | 'measurement'
  | 'date'

export type ProductTypeAttributeOption = {
  value: string
  label: string
  display_order?: number
}

export type ProductTypeAttributeDef = {
  id: string
  code: string
  label: string
  description?: string | null
  data_type: AttributeDataType
  unit?: string | null
  is_required: boolean
  is_recommended: boolean
  is_variation_axis: boolean
  max_length?: number | null
  display_order: number
  options: ProductTypeAttributeOption[]
}

export type ProductTypeComplianceDef = {
  id?: string
  code: string
  label: string
  description?: string | null
  is_required: boolean
  document_types: string[]
  display_order?: number
}

export type VariationThemeDef = {
  code: string
  label: string
  axes: string[]
}

export type ProductTypeCatalog = {
  id: string
  code: string
  name: string
  family: string
  category_id?: string | null
  variationThemes: VariationThemeDef[]
  attributes: ProductTypeAttributeDef[]
  compliance: ProductTypeComplianceDef[]
}

export type ListingProductIdentifierDraft = {
  product_id_type: ProductIdType
  product_id_value?: string | null
  gtin_exemption?: boolean
  gtin_exemption_reason?: string | null
  variation_id?: string | null
  variant_temp_key?: string | null
}

export type ListingAttributeValueDraft = {
  id?: string
  attribute_id: string
  value_text?: string | null
  value_number?: number | string | null
  value_boolean?: boolean | null
  value_json?: unknown
  variation_id?: string | null
}

export type ListingComplianceDocumentDraft = {
  id?: string
  requirement_code: string
  document_type: string
  file_url?: string | null
  file_name?: string | null
  expires_on?: string | null
  notes?: string | null
  blob?: Blob | File
  mimeType?: string
}

export type ListingAplusModuleDraft = {
  id?: string
  module_type: AplusModuleType
  display_order: number
  headline?: string | null
  body?: string | null
  image_url?: string | null
  payload?: Record<string, unknown> | null
  blob?: Blob | File
  mimeType?: string
}

export const EMPTY_PRODUCT_IDENTIFIER: ListingProductIdentifierDraft = {
  product_id_type: 'none',
  product_id_value: '',
  gtin_exemption: false,
  gtin_exemption_reason: null,
}

const GTIN_LENGTHS: Record<Exclude<ProductIdType, 'none' | 'isbn'>, number[]> = {
  upc: [12],
  ean: [13],
  gtin: [8, 12, 13, 14],
}

/** GS1 check digit for the digits that precede it. */
export function gtinCheckDigit(body: string): number {
  const digits = body.replace(/\D/g, '').split('').map(Number)
  let sum = 0
  const reversed = [...digits].reverse()
  reversed.forEach((digit, index) => {
    sum += digit * (index % 2 === 0 ? 3 : 1)
  })
  return (10 - (sum % 10)) % 10
}

function isbn10Valid(digits: string): boolean {
  if (!/^\d{9}[\dXx]$/.test(digits)) return false
  let sum = 0
  for (let i = 0; i < 9; i += 1) sum += Number(digits[i]) * (10 - i)
  const check = digits[9]!.toUpperCase()
  const expected = (11 - (sum % 11)) % 11
  return check === (expected === 10 ? 'X' : String(expected))
}

/** True when the code matches the product-id type and its check digit. */
export function isValidProductId(type: ProductIdType, raw: string | null | undefined): boolean {
  const value = (raw ?? '').trim()
  if (!value || type === 'none') return false
  if (type === 'isbn') {
    const compact = value.replace(/[-\s]/g, '')
    if (compact.length === 10) return isbn10Valid(compact)
    if (compact.length !== 13 || !/^\d{13}$/.test(compact)) return false
    return gtinCheckDigit(compact.slice(0, 12)) === Number(compact[12])
  }
  const digits = value.replace(/\D/g, '')
  if (!GTIN_LENGTHS[type].includes(digits.length)) return false
  if (digits !== value.replace(/[-\s]/g, '')) return false
  return gtinCheckDigit(digits.slice(0, -1)) === Number(digits.slice(-1))
}

export function conditionLabel(value: string | null | undefined): string {
  return ITEM_CONDITIONS.find((row) => row.value === value)?.label ?? ''
}

export function validateProductIdentifier(
  identifier: ListingProductIdentifierDraft | null | undefined,
  options: { required: boolean },
): Record<string, string> {
  const errors: Record<string, string> = {}
  const draft = identifier ?? EMPTY_PRODUCT_IDENTIFIER
  const exempt = Boolean(draft.gtin_exemption)
  const value = draft.product_id_value?.trim() ?? ''

  if (!options.required) return errors

  if (exempt) {
    if (!draft.gtin_exemption_reason) {
      errors.gtin_exemption_reason = 'Tell us why there is no barcode.'
    }
    if (value) {
      errors.product_id_value = 'Clear the barcode, or switch to “I have a barcode”.'
    }
    return errors
  }

  if (draft.product_id_type === 'none' || !value) {
    errors.product_id_value = 'Enter the barcode, or choose “No barcode”.'
    return errors
  }

  if (!isValidProductId(draft.product_id_type, value)) {
    errors.product_id_value = 'That barcode does not look right. Check the digits and try again.'
  }
  return errors
}

function measurementValue(raw: unknown): { value: number | null; unit: string } {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { value: null, unit: '' }
  const record = raw as { value?: unknown; unit?: unknown }
  const value = typeof record.value === 'number' ? record.value : Number(record.value)
  return {
    value: Number.isFinite(value) ? value : null,
    unit: typeof record.unit === 'string' ? record.unit : '',
  }
}

export function attributeValuePresent(
  def: ProductTypeAttributeDef,
  draft: ListingAttributeValueDraft | undefined,
): boolean {
  if (!draft) return false
  switch (def.data_type) {
    case 'number': {
      const n = typeof draft.value_number === 'number' ? draft.value_number : Number(draft.value_number)
      return Number.isFinite(n)
    }
    case 'boolean':
      return typeof draft.value_boolean === 'boolean'
    case 'multi_enum':
      return Array.isArray(draft.value_json) && draft.value_json.some((item) => String(item).trim())
    case 'measurement':
      return measurementValue(draft.value_json).value != null
    case 'date':
    case 'text':
    case 'enum':
    default:
      return Boolean(draft.value_text?.trim())
  }
}

export function formatAttributeValue(
  def: ProductTypeAttributeDef,
  draft: ListingAttributeValueDraft | undefined,
): string {
  if (!draft || !attributeValuePresent(def, draft)) return ''
  switch (def.data_type) {
    case 'boolean':
      return draft.value_boolean ? 'Yes' : 'No'
    case 'number':
      return def.unit ? `${draft.value_number} ${def.unit}` : String(draft.value_number)
    case 'multi_enum':
      return (Array.isArray(draft.value_json) ? draft.value_json : []).map(String).join(', ')
    case 'measurement': {
      const measured = measurementValue(draft.value_json)
      const unit = measured.unit || def.unit || ''
      return unit ? `${measured.value} ${unit}` : String(measured.value)
    }
    default: {
      const option = def.options.find((row) => row.value === draft.value_text)
      return option?.label || draft.value_text?.trim() || ''
    }
  }
}

export function validateRequiredAttributes(
  catalog: ProductTypeCatalog | null | undefined,
  values: ListingAttributeValueDraft[] | undefined,
): Record<string, string> {
  const errors: Record<string, string> = {}
  if (!catalog) return errors
  const byId = new Map((values ?? []).map((row) => [row.attribute_id, row]))
  for (const def of catalog.attributes) {
    if (!def.is_required) continue
    if (!attributeValuePresent(def, byId.get(def.id))) {
      errors[`attr_${def.code}`] = `${def.label} is needed before you can publish.`
    }
  }
  return errors
}

export function validateRequiredCompliance(
  catalog: ProductTypeCatalog | null | undefined,
  documents: ListingComplianceDocumentDraft[] | undefined,
): Record<string, string> {
  const errors: Record<string, string> = {}
  if (!catalog) return errors
  for (const requirement of catalog.compliance) {
    if (!requirement.is_required) continue
    const uploaded = (documents ?? []).some(
      (doc) =>
        doc.requirement_code === requirement.code &&
        (Boolean(doc.file_url?.trim()) || Boolean(doc.blob)),
    )
    if (!uploaded) {
      errors[`compliance_${requirement.code}`] = `Add ${requirement.label}.`
    }
  }
  return errors
}

export function variationAxisNames(catalog: ProductTypeCatalog | null | undefined): string[] {
  if (!catalog) return []
  const names = new Set<string>()
  for (const theme of catalog.variationThemes) {
    for (const axis of theme.axes) {
      if (axis.trim()) names.add(axis.trim())
    }
  }
  for (const attr of catalog.attributes) {
    if (attr.is_variation_axis && attr.label.trim()) names.add(attr.label.trim())
  }
  return [...names]
}

export type CompletenessInput = {
  listingType?: string | null
  productTypeId?: string | null
  itemCondition?: string | null
  identifier?: ListingProductIdentifierDraft | null
  attributeValues?: ListingAttributeValueDraft[]
  documents?: { requirement_code: string; file_url?: string | null }[]
  catalog?: ProductTypeCatalog | null
}

/** Short inventory hint. Empty when the listing can publish its identity block. */
export function listingCompletenessHint(input: CompletenessInput): string | null {
  if (input.listingType && input.listingType !== 'physical' && input.listingType !== 'digital') {
    return null
  }
  if (!input.productTypeId) return 'Choose what you are selling'
  if (input.listingType !== 'digital') {
    if (!input.itemCondition) return 'Say if this is new or used'
    const idErrors = validateProductIdentifier(input.identifier, { required: true })
    if (Object.keys(idErrors).length) return 'Add a barcode, or say there is none'
  }
  const attrErrors = validateRequiredAttributes(input.catalog, input.attributeValues)
  if (Object.keys(attrErrors).length) return 'A required detail is still empty'
  if (input.listingType !== 'digital') {
    const docErrors = validateRequiredCompliance(input.catalog, input.documents)
    if (Object.keys(docErrors).length) return 'A required paper is still missing'
  }
  return null
}

export function parseVariationThemes(raw: unknown): VariationThemeDef[] {
  if (!Array.isArray(raw)) return []
  return raw.flatMap((item) => {
    if (!item || typeof item !== 'object') return []
    const row = item as { code?: unknown; label?: unknown; axes?: unknown }
    const axes = Array.isArray(row.axes) ? row.axes.map(String).filter(Boolean) : []
    const code = typeof row.code === 'string' ? row.code : ''
    const label = typeof row.label === 'string' ? row.label : code
    if (!code && !label) return []
    return [{ code: code || label, label: label || code, axes }]
  })
}

export function saleWindowActive(
  startsAt: string | null | undefined,
  endsAt: string | null | undefined,
  now: Date = new Date(),
): boolean {
  const start = startsAt?.trim() ? Date.parse(startsAt) : null
  const end = endsAt?.trim() ? Date.parse(endsAt) : null
  if (start != null && Number.isNaN(start)) return false
  if (end != null && Number.isNaN(end)) return false
  if (start != null && now.getTime() < start) return false
  if (end != null && now.getTime() > end) return false
  return start != null || end != null
}

/** Selling price during an active sale window; otherwise the offer price. */
export function effectiveUnitPrice(
  price: number,
  salePrice: number | null | undefined,
  startsAt?: string | null,
  endsAt?: string | null,
  now: Date = new Date(),
): number {
  const sale = salePrice == null ? null : Number(salePrice)
  if (sale == null || !Number.isFinite(sale) || sale < 0 || sale >= price) return price
  if (!saleWindowActive(startsAt, endsAt, now)) return price
  return sale
}
