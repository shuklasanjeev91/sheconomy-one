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
import { LISTING_TYPES } from '~/lib/listing/listing.type'
import { generateListingSlug } from '~/lib/listing/listing.utils'
import {
  validateCategoryData,
  validateListingCore,
  validateListingData,
  validateListingField,
} from '~/lib/listing/listing.validation'
import type { PublishListingData } from '~/lib/listing/listing-publish.orchestrator'

import {
  LISTING_METADATA_KEYS,
  LISTING_PUBLISH_DEFAULT_METADATA,
  LISTING_PUBLISH_IMAGE_HINTS,
  LISTING_PUBLISH_STEP_IDS,
  type ListingPublishStepId,
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

export function readMetadataString(meta: Record<string, unknown>, key: string, fallback = ''): string {
  const value = meta[key]
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
    }))
}

export function buildFormFromListingDetails(
  listing: ListingDetails,
  extras?: {
    images?: ListingImage[]
    variations?: ListingVariation[]
    attributes?: ListingAttribute[]
    materials?: ListingMaterial[]
    categoryIds?: { category_id: string; is_primary?: boolean }[]
  },
): ListingFormData {
  const meta = mergeListingMetadata(
    (listing.listing_metadata as Record<string, unknown> | null) ?? undefined,
  )

  return {
    shop_id: listing.shop_id ?? undefined,
    title: listing.title ?? '',
    description: listing.description ?? '',
    listing_type: listing.listing_type ?? LISTING_TYPES.PHYSICAL,
    price: listing.price ?? '',
    quantity: listing.quantity ?? 1,
    is_featured: listing.is_featured ?? false,
    is_active: listing.is_active ?? true,
    listing_status: listing.listing_status ?? undefined,
    slug: listing.slug ?? '',
    meta_title: listing.meta_title ?? '',
    meta_description: listing.meta_description ?? '',
    tags: listing.tags ?? [],
    listing_metadata: meta,
    stock: listing.stock ?? 0,
    sku: listing.sku ?? '',
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
    images: extras?.images ? listingImagesToDrafts(extras.images) : [],
    variations: extras?.variations ?? [],
    attributes: extras?.attributes ?? [],
    materials: extras?.materials ?? [],
  }
}

export function formDataToPublishPayload(
  formData: ListingFormData,
  shopId: string,
): PublishListingData {
  const slug = formData.slug?.trim() || generateListingSlug(formData.title)
  return {
    ...formData,
    shop_id: shopId,
    slug,
    description: formData.description ?? '',
    listing_metadata: mergeListingMetadata(formData.listing_metadata as Record<string, unknown>),
  }
}

export type StepValidationResult = {
  isValid: boolean
  errors: Record<string, string>
  warnings: string[]
}

export function validatePublishStep(
  stepId: ListingPublishStepId,
  formData: ListingFormData,
): StepValidationResult {
  const errors: Record<string, string> = {}
  const warnings: string[] = []

  switch (stepId) {
    case LISTING_PUBLISH_STEP_IDS.BASIC: {
      const core = validateListingCore(formData)
      Object.assign(errors, core.errors)
      const desc = validateListingField('description', formData.description ?? '')
      if (!desc.isValid && desc.error) errors.description = desc.error
      break
    }
    case LISTING_PUBLISH_STEP_IDS.DETAILS: {
      if (formData.listing_type === LISTING_TYPES.PHYSICAL) {
        if (!formData.materials?.length) {
          errors.materials = 'At least one material is required for physical products.'
        }
        if (!formData.variations?.length) {
          errors.variations = 'At least one product variation is required for physical products.'
        }
        if (formData.stock === '' || formData.stock === null || formData.stock === undefined) {
          errors.stock = 'Stock quantity is required for physical products.'
        }
      }
      break
    }
    case LISTING_PUBLISH_STEP_IDS.PRICING: {
      const price = validateListingField('price', formData.price)
      if (!price.isValid && price.error) errors.price = price.error
      break
    }
    case LISTING_PUBLISH_STEP_IDS.CATEGORIES: {
      const cat = validateCategoryData(formData.categories)
      if (!cat.isValid && cat.error) errors.categories = cat.error
      if (cat.warning) warnings.push(cat.warning)
      break
    }
    case LISTING_PUBLISH_STEP_IDS.IMAGES: {
      const count = formData.images?.length ?? 0
      if (count < LISTING_PUBLISH_IMAGE_HINTS.MIN_REQUIRED_PUBLISH) {
        errors.images = 'At least one image is required to save or publish.'
      } else if (count < LISTING_PUBLISH_IMAGE_HINTS.MIN_RECOMMENDED) {
        warnings.push(
          `Upload at least ${LISTING_PUBLISH_IMAGE_HINTS.MIN_RECOMMENDED} images for best results.`,
        )
      }
      break
    }
    case LISTING_PUBLISH_STEP_IDS.SEO: {
      const slug = validateListingField('slug', formData.slug ?? generateListingSlug(formData.title))
      if (!slug.isValid && slug.error) errors.slug = slug.error
      const metaTitle = validateListingField('meta_title', formData.meta_title ?? '')
      if (!metaTitle.isValid && metaTitle.error) errors.meta_title = metaTitle.error
      const metaDesc = validateListingField('meta_description', formData.meta_description ?? '')
      if (!metaDesc.isValid && metaDesc.error) errors.meta_description = metaDesc.error
      break
    }
    default:
      break
  }

  return { isValid: Object.keys(errors).length === 0, errors, warnings }
}

export function validateFullPublishForm(formData: ListingFormData): StepValidationResult {
  const result = validateListingData(formData)
  const warnings: string[] = []
  const imageCount = formData.images?.length ?? 0
  if (imageCount < LISTING_PUBLISH_IMAGE_HINTS.MIN_RECOMMENDED) {
    warnings.push(
      `Upload at least ${LISTING_PUBLISH_IMAGE_HINTS.MIN_RECOMMENDED} images for best conversion.`,
    )
  }
  return { isValid: result.isValid, errors: result.errors, warnings }
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
