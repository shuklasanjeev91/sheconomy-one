import { z } from 'zod'

import { validateImportedListingImageUrl } from '~/lib/config/listing-image-import-rules'

import {
  BULK_IMPORT_CONFIG,
  BULK_IMPORT_TITLE_LIMITS,
} from './listing-bulk-import.constants'
import type { BulkImportRowValidationResult } from './listing-bulk-import.type'
import { LISTING_TYPES } from './listing.type'
import type { PublishListingData } from './listing-publish.orchestrator'

const listingTypeSchema = z.enum([
  LISTING_TYPES.PHYSICAL,
  LISTING_TYPES.DIGITAL,
  LISTING_TYPES.SERVICE,
])

const bulkImportImageSchema = z.object({
  image_url: z.string().trim().min(1),
  alt_text: z.string().optional(),
})

/** Zod schema for a normalised publish payload (post-CSV mapping). */
export const bulkImportPublishDataSchema = z
  .object({
    shop_id: z.string().uuid().optional(),
    title: z.string().trim(),
    description: z.string().trim(),
    listing_type: listingTypeSchema,
    price: z.number().finite().min(0),
    quantity: z.number().int().min(0).optional(),
    images: z.array(bulkImportImageSchema).min(1, 'At least one image_url is required'),
    stock: z.number().int().min(0).nullable().optional(),
    materials: z.array(z.object({ material_name: z.string() })).optional(),
    variations: z.array(z.object({ variation_name: z.string(), variation_value: z.string() })).optional(),
    digital_file_url: z.string().trim().nullable().optional(),
    booking_duration_minutes: z.number().int().min(1).nullable().optional(),
  })
  .superRefine((data, ctx) => {
    const titleLength = data.title.length
    if (titleLength < BULK_IMPORT_TITLE_LIMITS.MIN_LENGTH || titleLength > BULK_IMPORT_TITLE_LIMITS.MAX_LENGTH) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Title must be between ${BULK_IMPORT_TITLE_LIMITS.MIN_LENGTH} and ${BULK_IMPORT_TITLE_LIMITS.MAX_LENGTH} characters`,
        path: ['title'],
      })
    }

    if (!data.description) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Description is required',
        path: ['description'],
      })
    }

    data.images.forEach((img, index) => {
      const result = validateImportedListingImageUrl(img.image_url ?? '')
      result.errors.forEach((message) => {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `image_url_${index + 1}: ${message}`,
          path: ['images', index, 'url'],
        })
      })
    })

    if (data.listing_type === LISTING_TYPES.PHYSICAL) {
      if (data.stock == null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'stock is required for physical listings',
          path: ['stock'],
        })
      }
      if (!data.materials?.length) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'At least one material is required for physical products.',
          path: ['materials'],
        })
      }
      if (!data.variations?.length) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'At least one product variation is required for physical products.',
          path: ['variations'],
        })
      }
    }

    if (data.listing_type === LISTING_TYPES.DIGITAL && !data.digital_file_url?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'digital_file_url is required for digital listings',
        path: ['digital_file_url'],
      })
    }

    if (data.listing_type === LISTING_TYPES.SERVICE && !data.booking_duration_minutes) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'booking_duration_minutes is required for service listings',
        path: ['booking_duration_minutes'],
      })
    }
  })

function parseBulkImportNumber(value: unknown): number | null {
  if (value == null || value === '') return null
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  const parsed = parseFloat(String(value).trim())
  return Number.isFinite(parsed) ? parsed : null
}

function parseBulkImportInteger(value: unknown): number | null {
  if (value == null || value === '') return null
  if (typeof value === 'number') return Number.isInteger(value) ? value : Math.trunc(value)
  const parsed = parseInt(String(value).trim(), 10)
  return Number.isFinite(parsed) ? parsed : null
}

/** Map orchestrator form shape (stringly fields) into values Zod can validate. */
function toBulkImportValidationPayload(publishData: PublishListingData) {
  const price = parseBulkImportNumber(publishData.price)
  return {
    shop_id: publishData.shop_id,
    title: publishData.title ?? '',
    description: publishData.description ?? '',
    listing_type: publishData.listing_type,
    price: price ?? Number.NaN,
    quantity: parseBulkImportInteger(publishData.quantity) ?? undefined,
    images: (publishData.images ?? []).map((img) => ({
      image_url: img.image_url ?? '',
      alt_text: img.alt_text ?? undefined,
    })),
    stock: parseBulkImportInteger(publishData.stock),
    materials: publishData.materials,
    variations: publishData.variations,
    digital_file_url: publishData.digital_file_url,
    booking_duration_minutes: parseBulkImportInteger(publishData.booking_duration_minutes),
  }
}

/** Validate a normalised row before publishing. */
export function validateBulkImportRow(publishData: PublishListingData): BulkImportRowValidationResult {
  const result = bulkImportPublishDataSchema.safeParse(toBulkImportValidationPayload(publishData))
  if (result.success) return { valid: true, errors: [] }

  const errors = result.error.issues.map((issue) => issue.message)
  return { valid: false, errors: [...new Set(errors)] }
}

export function assertBulkImportFileSize(bytes: number): string | null {
  if (bytes > BULK_IMPORT_CONFIG.MAX_FILE_BYTES) {
    const maxMb = Math.round(BULK_IMPORT_CONFIG.MAX_FILE_BYTES / (1024 * 1024))
    return `File is too large. Maximum size is ${maxMb} MB.`
  }
  return null
}

export function assertBulkImportFileName(fileName: string): string | null {
  const lower = fileName.toLowerCase()
  const allowed = ['.csv', '.xlsx', '.xls']
  if (!allowed.some((ext) => lower.endsWith(ext))) {
    return 'Unsupported file. Upload a .csv or .xlsx file.'
  }
  return null
}
