import type { PickedImage } from '~/lib/media/pick-image'
import { pickedImageToBlob } from '~/lib/media/pick-image'
import type { ListingDetails } from '~/lib/listing/listing.service'
import type {
  ListingAttribute,
  ListingFormData,
  ListingImage,
  ListingImageDraft,
  ListingMaterial,
  ListingVariation,
} from '~/lib/listing/listing.type'
import { LISTING_STATUS, LISTING_TYPES } from '~/lib/listing/listing.type'
import { validatePersonalization } from '~/lib/listing/product-catalog'
import type { ListingCatalogChildren } from '~/lib/listing/product-catalog.service'
import { generateListingSlug } from '~/lib/listing/listing.utils'
import {
  validateListingQuality,
  validateListingImagesQuality,
  validatePhysicalProductInfoQuality,
} from '~/lib/listing/listing-quality'
import {
  validateCategoryData,
  validateListingData,
  validateListingField,
} from '~/lib/listing/listing.validation'
import type { PublishListingData } from '~/lib/listing/listing-publish.orchestrator'
import {
  parseListingProductInfo,
  serializeListingProductInfo,
  type ListingProductInfo,
} from '~/commerce/lib/listing-product-info'

import {
  LISTING_METADATA_KEYS,
  LISTING_PUBLISH_DEFAULT_METADATA,
  LISTING_PUBLISH_IMAGE_HINTS,
  LISTING_PUBLISH_STEP_IDS,
  PRODUCT_STRUCTURES,
  type ListingPublishStepId,
  type ProductStructure,
} from '~/commerce/components/vendor/listing-publish/listing-publish.constants'

export function countWords(text: string): number {
  const trimmed = text.trim()
  if (!trimmed) return 0
  return trimmed.split(/\s+/).length
}

export function formatRelativeLastSaved(iso: string | null): string {
  if (!iso) return ''
  const then = new Date(iso).getTime()
  const now = Date.now()
  const diffSec = Math.max(0, Math.floor((now - then) / 1000))
  if (diffSec < 60) return 'just now'
  const diffMin = Math.floor(diffSec / 60)
  if (diffMin < 60) return `${diffMin} minute${diffMin === 1 ? '' : 's'} ago`
  const diffHr = Math.floor(diffMin / 60)
  if (diffHr < 24) return `${diffHr} hour${diffHr === 1 ? '' : 's'} ago`
  const diffDay = Math.floor(diffHr / 24)
  return `${diffDay} day${diffDay === 1 ? '' : 's'} ago`
}

export function mergeListingMetadata(
  existing: Record<string, unknown> | undefined,
): Record<string, unknown> {
  return { ...LISTING_PUBLISH_DEFAULT_METADATA, ...(existing ?? {}) }
}

export function readMetadataString(
  meta: Record<string, unknown> | undefined,
  key: string,
  fallback = '',
): string {
  const value = meta?.[key]
  if (value === null || value === undefined) return fallback
  return String(value)
}

export function readMetadataBoolean(meta: Record<string, unknown>, key: string, fallback: boolean): boolean {
  const value = meta[key]
  if (typeof value === 'boolean') return value
  if (value === 'true') return true
  if (value === 'false') return false
  return fallback
}

export function readMetadataStringList(meta: Record<string, unknown>, key: string): string[] {
  const value = meta[key]
  if (!Array.isArray(value)) return []
  return value.map((entry) => String(entry ?? '').trim()).filter(Boolean)
}

/**
 * Infer product structure from metadata + variations.
 * Child SKUs always win — default metadata is "simple", which must not hide
 * existing variable listings that never wrote product_structure=variable.
 */
export function resolveProductStructure(formData: {
  listing_metadata?: Record<string, unknown> | null
  variations?: { variation_value?: string | null }[] | null
}): ProductStructure {
  const hasChildren =
    Array.isArray(formData.variations) &&
    formData.variations.some((row) => String(row.variation_value ?? '').trim())
  if (hasChildren) return PRODUCT_STRUCTURES.VARIABLE

  const meta = (formData.listing_metadata ?? {}) as Record<string, unknown>
  const raw = String(meta[LISTING_METADATA_KEYS.PRODUCT_STRUCTURE] ?? '').trim().toLowerCase()
  if (raw === PRODUCT_STRUCTURES.VARIABLE) return PRODUCT_STRUCTURES.VARIABLE
  // simple | grouped | unset → Simple when there are no child SKUs
  return PRODUCT_STRUCTURES.SIMPLE
}

/** Parent price range from variation SKUs (for Pricing step summary). */
export function variationPriceRange(
  variations: { price?: number | string | null }[] | null | undefined,
): { min: number; max: number; count: number } | null {
  const prices = (variations ?? [])
    .map((row) => Number(row.price))
    .filter((n) => Number.isFinite(n) && n >= 0)
  if (!prices.length) return null
  return {
    min: Math.min(...prices),
    max: Math.max(...prices),
    count: prices.length,
  }
}

export function pickedImagesToDrafts(images: PickedImage[]): ListingImageDraft[] {
  return images.map((img, index) => ({
    image_url: img.uri,
    mimeType: img.mimeType,
    fileName: img.fileName,
    blob: img.file ?? undefined,
    is_primary: index === 0,
    display_order: index,
  }))
}

export function listingImagesToDrafts(images: ListingImage[]): ListingImageDraft[] {
  return images
    .slice()
    .sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0))
    .map((img) => ({
      id: img.id,
      image_url: img.image_url,
      alt_text: img.alt_text,
      is_primary: img.is_primary,
      display_order: img.display_order,
      width: img.width,
      height: img.height,
      file_size: img.file_size,
      image_type: img.image_type,
      variation_id: img.variation_id ?? null,
    }))
}

function readFirstSectionId(sections: unknown): string | null {
  if (!Array.isArray(sections) || !sections.length) return null
  const first = sections[0]
  if (!first || typeof first !== 'object') return null
  const id = (first as { id?: unknown }).id
  return typeof id === 'string' ? id : null
}

export function buildFormFromListingDetails(
  listing: ListingDetails,
  extras?: {
    images?: ListingImage[]
    variations?: ListingVariation[]
    attributes?: ListingAttribute[]
    materials?: ListingMaterial[]
    categoryIds?: { category_id: string; is_primary?: boolean }[]
    catalog?: ListingCatalogChildren
    /** Prefill create wizard as a duplicate (Amazon “Copy listing”). */
    asDuplicate?: boolean
  },
): ListingFormData {
  const asDuplicate = Boolean(extras?.asDuplicate)
  const baseTitle = listing.title ?? ''
  const title = asDuplicate
    ? baseTitle.toLowerCase().startsWith('copy of ')
      ? baseTitle
      : `Copy of ${baseTitle}`
    : baseTitle

  const images = extras?.images ? listingImagesToDrafts(extras.images) : []
  const variations = (extras?.variations ?? []).map((row) =>
    asDuplicate
      ? {
          ...row,
          id: undefined,
          listing_id: undefined,
        }
      : row,
  )
  const hasChildren = variations.some((row) => String(row.variation_value ?? '').trim())
  const meta = mergeListingMetadata({
    ...((listing.listing_metadata as Record<string, unknown> | null) ?? {}),
    ...(hasChildren
      ? { [LISTING_METADATA_KEYS.PRODUCT_STRUCTURE]: PRODUCT_STRUCTURES.VARIABLE }
      : {}),
  })
  const productInfo = serializeListingProductInfo(
    parseListingProductInfo(listing.product_info, listing.listing_metadata),
  )
  const materials = (extras?.materials ?? []).map((row) =>
    asDuplicate ? { ...row, id: undefined, listing_id: undefined } : row,
  )
  const attributes = (extras?.attributes ?? []).map((row) =>
    asDuplicate ? { ...row, id: undefined, listing_id: undefined } : row,
  )

  return {
    shop_id: listing.shop_id ?? undefined,
    title,
    description: listing.description ?? '',
    listing_type: listing.listing_type ?? LISTING_TYPES.PHYSICAL,
    price: listing.price ?? '',
    mrp: listing.mrp ?? '',
    price_includes_tax: listing.price_includes_tax ?? true,
    tax_percent: listing.tax_percent ?? '18',
    product_info: productInfo,
    quantity: listing.quantity ?? 1,
    is_featured: asDuplicate ? false : (listing.is_featured ?? false),
    is_active: asDuplicate ? false : (listing.is_active ?? true),
    listing_status: asDuplicate ? LISTING_STATUS.DRAFT : listing.listing_status ?? undefined,
    slug: asDuplicate ? '' : (listing.slug ?? ''),
    meta_title: asDuplicate ? '' : (listing.meta_title ?? ''),
    meta_description: listing.meta_description ?? '',
    tags: listing.tags ?? [],
    listing_metadata: meta,
    stock: listing.stock ?? 0,
    sku: asDuplicate && listing.sku ? `${listing.sku}-COPY` : (listing.sku ?? ''),
    weight: listing.weight ?? null,
    dimensions: (listing.dimensions as Record<string, unknown>) ?? {},
    shipping_required: listing.shipping_required ?? true,
    digital_file_url: listing.digital_file_url ?? '',
    digital_file_size: listing.digital_file_size ?? null,
    digital_file_type: listing.digital_file_type ?? '',
    download_limit: listing.download_limit ?? null,
    is_online: listing.is_online ?? false,
    booking_duration_minutes: listing.booking_duration_minutes ?? null,
    meeting_url: listing.meeting_url ?? '',
    max_attendees: listing.max_attendees ?? 1,
    requires_approval: listing.requires_approval ?? false,
    categories:
      extras?.categoryIds ??
      (listing.category_assignments ?? []).map((row) => ({
        category_id: row.category_id,
        is_primary: row.is_primary ?? false,
      })),
    images: asDuplicate
      ? images.map((img) => ({
          ...img,
          id: undefined,
          variation_id: null,
        }))
      : images,
    variations,
    attributes,
    materials,
    who_made: listing.who_made ?? null,
    when_made: listing.when_made ?? null,
    what_is_it: listing.what_is_it ?? null,
    personalization_enabled: Boolean(listing.personalization_enabled),
    personalization_instructions: listing.personalization_instructions ?? '',
    personalization_char_limit: listing.personalization_char_limit ?? 256,
    personalization_required: Boolean(listing.personalization_required),
    shop_section_id: readFirstSectionId(listing.sections),
    delivery_profile_id: extras?.catalog?.deliveryProfileId ?? null,
    return_policy_id: extras?.catalog?.returnPolicyId ?? null,
  }
}

/** Read a single product_info string for the publish form. */
export function readProductInfoString(
  productInfo: Record<string, unknown> | undefined,
  key: string,
  fallback = '',
): string {
  const value = productInfo?.[key]
  if (value === null || value === undefined) return fallback
  return String(value)
}

/** Patch camelCase UI fields into the snake_case `product_info` bag. */
export function patchListingProductInfo(
  current: Record<string, unknown> | undefined,
  patch: Partial<ListingProductInfo>,
): Record<string, string> {
  const existing = parseListingProductInfo(current)
  return serializeListingProductInfo({ ...existing, ...patch })
}

/** Mirror origin / HSN onto listing_metadata for shipping / customs. */
export function mirrorProductInfoToListingMetadata(
  metadata: Record<string, unknown> | undefined,
  productInfo: Record<string, unknown> | undefined,
): Record<string, unknown> {
  const parsed = parseListingProductInfo(productInfo)
  const next = mergeListingMetadata(metadata)
  if (parsed.countryOfOrigin) {
    next[LISTING_METADATA_KEYS.COUNTRY_OF_ORIGIN] = parsed.countryOfOrigin
  }
  if (parsed.hsnCode) {
    next[LISTING_METADATA_KEYS.HS_CODE] = parsed.hsnCode
  }
  return next
}

export function formDataToPublishPayload(
  formData: ListingFormData,
  shopId: string,
): PublishListingData {
  const slug = formData.slug?.trim() || generateListingSlug(formData.title)
  const productInfo = serializeListingProductInfo(parseListingProductInfo(formData.product_info))
  const listing_metadata = mirrorProductInfoToListingMetadata(
    formData.listing_metadata as Record<string, unknown>,
    productInfo,
  )
  return {
    ...formData,
    shop_id: shopId,
    slug,
    description: formData.description ?? '',
    product_info: productInfo,
    listing_metadata,
    shop_sections: formData.shop_section_id ? [formData.shop_section_id] : [],
  }
}

export type StepValidationResult = {
  isValid: boolean
  errors: Record<string, string>
  warnings: string[]
}

function sectionErrors(
  formData: ListingFormData,
  fields: string[],
): Record<string, string> {
  const quality = validateListingQuality(formData)
  const picked: Record<string, string> = {}
  for (const field of fields) {
    if (quality.errors[field]) picked[field] = quality.errors[field]
  }
  return picked
}

export function validatePublishStep(
  stepId: ListingPublishStepId,
  formData: ListingFormData,
): StepValidationResult {
  const errors: Record<string, string> = {}
  const warnings: string[] = []

  switch (stepId) {
    case LISTING_PUBLISH_STEP_IDS.PHOTOS:
      Object.assign(errors, sectionErrors(formData, ['images']))
      break
    case LISTING_PUBLISH_STEP_IDS.ABOUT: {
      const title = validateListingField('title', formData.title ?? '')
      if (!title.isValid && title.error) errors.title = title.error
      const desc = validateListingField('description', formData.description ?? '')
      if (!desc.isValid && desc.error) errors.description = desc.error
      if (!formData.listing_type) errors.listing_type = 'Choose physical or digital.'
      const cat = validateCategoryData(formData.categories)
      if (!cat.isValid && cat.error) errors.categories = cat.error
      break
    }
    case LISTING_PUBLISH_STEP_IDS.PRICE: {
      const price = validateListingField('price', formData.price)
      if (!price.isValid && price.error) errors.price = price.error
      Object.assign(errors, sectionErrors(formData, ['stock']))
      break
    }
    case LISTING_PUBLISH_STEP_IDS.VARIATIONS:
      Object.assign(errors, sectionErrors(formData, ['variations']))
      break
    case LISTING_PUBLISH_STEP_IDS.PERSONALIZATION:
      Object.assign(errors, validatePersonalization(formData))
      break
    case LISTING_PUBLISH_STEP_IDS.SHIPPING:
      if (formData.listing_type === LISTING_TYPES.DIGITAL) {
        if (!formData.digital_file_url?.trim()) {
          errors.digital_file_url = 'A download URL is required for digital products.'
        }
        if (!formData.digital_file_type?.trim()) {
          errors.digital_file_type = 'File type is required for digital products.'
        }
      } else {
        Object.assign(
          errors,
          sectionErrors(formData, ['weight', 'package_length_cm', 'package_width_cm', 'package_height_cm']),
        )
      }
      break
    case LISTING_PUBLISH_STEP_IDS.DETAILS: {
      if (formData.listing_type === LISTING_TYPES.PHYSICAL) {
        const productQuality = validatePhysicalProductInfoQuality(
          formData.product_info,
          formData.listing_metadata,
        )
        Object.assign(errors, productQuality.errors)
        warnings.push(...productQuality.warnings)
      }
      Object.assign(errors, sectionErrors(formData, ['who_made', 'when_made', 'what_is_it', 'tags']))
      break
    }
    default:
      break
  }

  return { isValid: Object.keys(errors).length === 0, errors, warnings }
}

/**
 * Drafts are deliberately permissive: a vendor should be able to park a
 * half-finished listing. Only what the row needs to exist is required.
 */
export function validateDraftForm(formData: ListingFormData): StepValidationResult {
  const errors: Record<string, string> = {}
  const title = validateListingField('title', formData.title ?? '')
  if (!title.isValid && title.error) errors.title = title.error
  if (!formData.listing_type) errors.listing_type = 'Please select a listing type.'
  return { isValid: Object.keys(errors).length === 0, errors, warnings: [] }
}

export function validateFullPublishForm(formData: ListingFormData): StepValidationResult {
  const structure = resolveProductStructure(formData)
  const result = validateListingData(formData)
  const quality = validateListingQuality(formData)
  const errors = { ...result.errors, ...quality.errors }
  const warnings = [...quality.warnings]

  if (structure === PRODUCT_STRUCTURES.VARIABLE) {
    delete errors.price
    delete errors.stock
  }

  return { isValid: Object.keys(errors).length === 0, errors, warnings }
}

const FIELD_STEP_LOOKUP: Record<string, ListingPublishStepId> = {
  images: LISTING_PUBLISH_STEP_IDS.PHOTOS,
  title: LISTING_PUBLISH_STEP_IDS.ABOUT,
  description: LISTING_PUBLISH_STEP_IDS.ABOUT,
  listing_type: LISTING_PUBLISH_STEP_IDS.ABOUT,
  categories: LISTING_PUBLISH_STEP_IDS.ABOUT,
  price: LISTING_PUBLISH_STEP_IDS.PRICE,
  stock: LISTING_PUBLISH_STEP_IDS.PRICE,
  quantity: LISTING_PUBLISH_STEP_IDS.PRICE,
  sku: LISTING_PUBLISH_STEP_IDS.PRICE,
  variations: LISTING_PUBLISH_STEP_IDS.VARIATIONS,
  personalization_instructions: LISTING_PUBLISH_STEP_IDS.PERSONALIZATION,
  personalization_char_limit: LISTING_PUBLISH_STEP_IDS.PERSONALIZATION,
  weight: LISTING_PUBLISH_STEP_IDS.SHIPPING,
  package_length_cm: LISTING_PUBLISH_STEP_IDS.SHIPPING,
  package_width_cm: LISTING_PUBLISH_STEP_IDS.SHIPPING,
  package_height_cm: LISTING_PUBLISH_STEP_IDS.SHIPPING,
  digital_file_url: LISTING_PUBLISH_STEP_IDS.SHIPPING,
  digital_file_type: LISTING_PUBLISH_STEP_IDS.SHIPPING,
  who_made: LISTING_PUBLISH_STEP_IDS.DETAILS,
  when_made: LISTING_PUBLISH_STEP_IDS.DETAILS,
  what_is_it: LISTING_PUBLISH_STEP_IDS.DETAILS,
  tags: LISTING_PUBLISH_STEP_IDS.DETAILS,
  materials: LISTING_PUBLISH_STEP_IDS.DETAILS,
  manufacturer_name: LISTING_PUBLISH_STEP_IDS.DETAILS,
  manufacturer_address: LISTING_PUBLISH_STEP_IDS.DETAILS,
  brand: LISTING_PUBLISH_STEP_IDS.DETAILS,
  generic_name: LISTING_PUBLISH_STEP_IDS.DETAILS,
  key_features: LISTING_PUBLISH_STEP_IDS.DETAILS,
  country_of_origin: LISTING_PUBLISH_STEP_IDS.DETAILS,
}

/** Which step owns the first offending field, so we can jump the vendor there. */
export function findStepForErrors(
  errors: Record<string, string>,
): ListingPublishStepId | undefined {
  for (const field of Object.keys(errors)) {
    const step = FIELD_STEP_LOOKUP[field]
    if (step) return step
  }
  return undefined
}

export async function ensureImageBlobsForPublish(
  images: ListingImageDraft[] | undefined,
): Promise<ListingImageDraft[]> {
  const drafts = images ?? []
  const withBlobs: ListingImageDraft[] = []

  for (const draft of drafts) {
    if (draft.image_url && !draft.blob) {
      withBlobs.push(draft)
      continue
    }
    if (draft.blob) {
      withBlobs.push(draft)
      continue
    }
    if (draft.image_url) {
      try {
        const picked: PickedImage = {
          uri: draft.image_url,
          mimeType: draft.mimeType ?? 'image/jpeg',
          fileName: draft.fileName,
        }
        const blob = await pickedImageToBlob(picked)
        withBlobs.push({ ...draft, blob, mimeType: draft.mimeType ?? blob.type })
      } catch {
        withBlobs.push(draft)
      }
    }
  }

  return withBlobs
}

export function updateListingMetadataField(
  current: Record<string, unknown> | undefined,
  key: (typeof LISTING_METADATA_KEYS)[keyof typeof LISTING_METADATA_KEYS],
  value: unknown,
): Record<string, unknown> {
  return { ...mergeListingMetadata(current), [key]: value }
}
