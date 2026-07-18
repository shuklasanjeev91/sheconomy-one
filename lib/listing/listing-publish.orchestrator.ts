/**
 * Listing Publish Orchestrator
 *
 * Drives the complete "Publish" workflow: it inserts the main listing and then
 * fans out to every child table (images, categories, variations, attributes,
 * materials, tags, shop sections) in sequence, reporting per-step progress and
 * rolling back the whole listing if a critical step fails.
 *
 * Migrated from the legacy `listing-publish-orchestrator.js`, but every table
 * write now reuses the already-migrated services instead of duplicating query
 * logic:
 *   - main payload prep .......... `prepareListingDataForSubmission` (listing.utils)
 *   - slug ....................... `generateListingSlug` (listing.utils)
 *   - sku ........................ `normalizeSku` / `generateUniqueSku` (sku.utils)
 *   - shop ownership ............. `verifyShopManageAccess` (listing.access)
 *   - images ..................... `batchUploadImages` + `addImage` (listing-images.service)
 *   - categories ................. `assignCategories` (listing.service)
 *   - variations/attrs/materials . `replace*` (child services)
 *   - rollback ................... `deleteListing` (listing.service)
 *
 * Logging from the legacy service is intentionally NOT migrated.
 */

import { supabase } from '~/lib/supabase'

import { resolveUserId, verifyShopManageAccess } from './listing.access'
import { assignCategories, deleteListing } from './listing.service'
import { generateListingSlug, prepareListingDataForSubmission } from './listing.utils'
import { addImage, batchUploadImages } from './listing-images.service'
import { replaceAttributes } from './listing-attributes.service'
import { replaceMaterials } from './listing-materials.service'
import { replaceVariations } from './listing-variations.service'
import { generateUniqueSku, normalizeSku } from './sku.utils'
import { LISTING_STATUS, LISTING_TYPES } from './listing.type'
import type { ListingCategoryInput, ListingFormData } from './listing.type'

// Shop sections — attach via existing save_shop_section RPC / vendor-operations.

// ============= TYPES =============

export const PUBLISH_STEPS = {
  VALIDATION: 'validation',
  MAIN_LISTING: 'main_listing',
  IMAGES: 'images',
  CATEGORIES: 'categories',
  VARIATIONS: 'variations',
  ATTRIBUTES: 'attributes',
  MATERIALS: 'materials',
  TAGS: 'tags',
  SHOP_SECTIONS: 'shop_sections',
  INDEXING: 'indexing',
  COMPLETED: 'completed',
} as const

export type PublishStep = (typeof PUBLISH_STEPS)[keyof typeof PUBLISH_STEPS]

const STEP_CONFIG: Record<
  Exclude<PublishStep, 'completed'>,
  { required: boolean; description: string }
> = {
  [PUBLISH_STEPS.VALIDATION]: {
    required: true,
    description: 'Validating listing data and user permissions',
  },
  [PUBLISH_STEPS.MAIN_LISTING]: { required: true, description: 'Creating main listing record' },
  [PUBLISH_STEPS.IMAGES]: { required: true, description: 'Processing and uploading listing images' },
  [PUBLISH_STEPS.CATEGORIES]: { required: false, description: 'Assigning categories to listing' },
  [PUBLISH_STEPS.VARIATIONS]: { required: false, description: 'Creating product variations' },
  [PUBLISH_STEPS.ATTRIBUTES]: { required: false, description: 'Adding product attributes' },
  [PUBLISH_STEPS.MATERIALS]: { required: false, description: 'Adding material information' },
  [PUBLISH_STEPS.TAGS]: { required: false, description: 'Processing listing tags' },
  [PUBLISH_STEPS.SHOP_SECTIONS]: { required: false, description: 'Adding to shop sections' },
  [PUBLISH_STEPS.INDEXING]: { required: false, description: 'Updating search indexes' },
}

/** Total number of executable steps (excludes the terminal `completed` marker). */
export const PUBLISH_TOTAL_STEPS = Object.keys(STEP_CONFIG).length

/** Data accepted by the publisher: the listing form plus optional shop sections. */
export type PublishListingData = Partial<ListingFormData> & {
  shop_sections?: string[]
}

/** Result of a single publishing step. */
export type StepResult = {
  success: boolean
  error?: string
  message?: string
  listing_id?: string
  [key: string]: unknown
}

export type PublishCallbacks = {
  onStepProgress: (step: PublishStep, description: string) => void
  onStepComplete: (step: PublishStep, result: StepResult) => void
  onError: (step: PublishStep, error: unknown) => void
}

export type PublishOptions = Partial<PublishCallbacks> & {
  rollbackOnFailure?: boolean
  publishImmediately?: boolean
}

export type PublishResult = {
  success: boolean
  listing_id: string | null
  steps_completed: PublishStep[]
  steps_failed: PublishStep[]
  total_steps: number
  detailed_results: Record<string, StepResult>
  rollback_performed: boolean
  error_details: string | { step: PublishStep; message: string; stack?: string } | null
}

// ============= HELPERS =============

function initializePublishResult(): PublishResult {
  return {
    success: false,
    listing_id: null,
    steps_completed: [],
    steps_failed: [],
    total_steps: PUBLISH_TOTAL_STEPS,
    detailed_results: {},
    rollback_performed: false,
    error_details: null,
  }
}

type StepOutcome = { success: boolean; result?: StepResult; error?: string; shouldContinue?: boolean }

/** Run a step with standardized progress/error reporting. */
async function executeStep(
  stepName: Exclude<PublishStep, 'completed'>,
  executor: () => Promise<StepResult>,
  publishResult: PublishResult,
  callbacks: PublishCallbacks,
): Promise<StepOutcome> {
  const stepConfig = STEP_CONFIG[stepName]

  try {
    callbacks.onStepProgress(stepName, stepConfig.description)

    const result = await executor()

    if (result.success) {
      publishResult.detailed_results[stepName] = result
      publishResult.steps_completed.push(stepName)
      callbacks.onStepComplete(stepName, result)
      return { success: true, result }
    }

    const errorMessage = result.error || 'Step failed'
    publishResult.error_details = errorMessage
    publishResult.steps_failed.push(stepName)
    callbacks.onError(stepName, errorMessage)
    return { success: false, error: errorMessage, shouldContinue: !stepConfig.required }
  } catch (error) {
    const errorMessage = (error as Error).message
    publishResult.error_details = errorMessage
    publishResult.steps_failed.push(stepName)
    callbacks.onError(stepName, error)
    return { success: false, error: errorMessage, shouldContinue: !stepConfig.required }
  }
}

/** Settle a set of insert promises and summarise successes/failures. */
async function executeBatch(
  operations: PromiseLike<unknown>[],
  operationType: string,
): Promise<{
  success: boolean
  created: number
  failed: number
  total: number
  failed_reasons: string[]
  message: string
}> {
  const results = await Promise.allSettled(operations)
  const successful = results.filter((r) => r.status === 'fulfilled')
  const failed = results.filter((r): r is PromiseRejectedResult => r.status === 'rejected')

  return {
    success: successful.length > 0,
    created: successful.length,
    failed: failed.length,
    total: operations.length,
    failed_reasons: failed.map((f) => (f.reason as Error)?.message || 'Unknown error'),
    message: `Created ${successful.length}/${operations.length} ${operationType} successfully`,
  }
}

// ============= STEP: VALIDATION =============

async function validatePublishingRequirements(publishData: PublishListingData): Promise<StepResult> {
  try {
    const userId = await resolveUserId()
    if (!userId) return { success: false, error: 'User not authenticated' }

    // Required base fields.
    const requiredFields: (keyof PublishListingData)[] = [
      'shop_id',
      'title',
      'description',
      'listing_type',
      'price',
    ]
    const missingFields = requiredFields.filter((field) => !publishData[field])
    if (missingFields.length > 0) {
      return { success: false, error: `Missing required fields: ${missingFields.join(', ')}` }
    }

    // At least one image is required to publish.
    const images = publishData.images
    if (!Array.isArray(images) || images.length === 0) {
      return { success: false, error: 'At least one image is required to publish a listing' }
    }

    // Each image must have either an upload payload (blob) or an existing URL.
    const invalidImages = images.filter((img) => {
      const hasBlob = Boolean(img.blob) && Boolean(img.mimeType)
      const hasUrl = typeof img.image_url === 'string' && img.image_url.length > 0
      return !(hasBlob || hasUrl)
    })
    if (invalidImages.length > 0) {
      return {
        success: false,
        error: `${invalidImages.length} image(s) are missing both file data and URL`,
      }
    }

    // Shop ownership / admin access.
    const access = await verifyShopManageAccess(publishData.shop_id as string, userId)
    if (!access.success) {
      return { success: false, error: access.error ?? 'Shop not found or access denied' }
    }

    const typeValidation = validateListingTypeRequirements(publishData)
    if (!typeValidation.success) return typeValidation

    return { success: true, user_id: userId, validation_passed: true }
  } catch (error) {
    return { success: false, error: (error as Error).message }
  }
}

function validateListingTypeRequirements(publishData: PublishListingData): StepResult {
  switch (publishData.listing_type) {
    case LISTING_TYPES.PHYSICAL:
      if (publishData.stock === undefined || publishData.stock === null || publishData.stock === '') {
        return { success: false, error: 'Stock quantity is required for physical products' }
      }
      return { success: true }
    case LISTING_TYPES.DIGITAL:
      if (!publishData.digital_file_url) {
        return { success: false, error: 'Digital file URL is required for digital products' }
      }
      return { success: true }
    case LISTING_TYPES.SERVICE:
      if (!publishData.booking_duration_minutes) {
        return { success: false, error: 'Booking duration is required for service listings' }
      }
      return { success: true }
    default:
      return { success: false, error: 'Invalid listing type' }
  }
}

// ============= STEP: MAIN LISTING =============

/** Normalise or generate a unique SKU for physical listings. */
async function resolveSku(publishData: PublishListingData): Promise<string | null> {
  const normalized = normalizeSku(publishData.sku)
  if (normalized) return normalized
  return generateUniqueSku({ minLength: 8, maxLength: 12 })
}

async function createMainListing(
  publishData: PublishListingData,
  publishImmediately: boolean,
): Promise<StepResult> {
  try {
    const slug = publishData.slug || generateListingSlug(publishData.title)

    let sku = publishData.sku
    if (publishData.listing_type === LISTING_TYPES.PHYSICAL) {
      sku = (await resolveSku(publishData)) ?? undefined
    }

    // Reuse the shared payload builder (handles trimming, numeric coercion and
    // type-specific fields), then layer on publish-time status/timestamps.
    const payload = prepareListingDataForSubmission({
      ...publishData,
      slug,
      sku,
      is_active: publishImmediately,
      listing_status: publishImmediately ? LISTING_STATUS.ACTIVE : LISTING_STATUS.DRAFT,
    })
    payload.published_at = publishImmediately ? new Date().toISOString() : null

    const { data: listing, error } = await supabase
      .from('listings')
      .insert(payload)
      .select()
      .single()

    if (error || !listing) {
      return { success: false, error: error?.message ?? 'Failed to create main listing' }
    }

    return {
      success: true,
      listing,
      listing_id: listing.id,
      message: 'Main listing created successfully',
    }
  } catch (error) {
    return { success: false, error: (error as Error).message }
  }
}

// ============= STEP: IMAGES =============

async function processListingImages(
  listingId: string,
  images: ListingFormData['images'] = [],
  userId?: string | null,
): Promise<StepResult> {
  if (!images || images.length === 0) {
    return { success: false, error: 'Images are required for listing publication', images_processed: 0 }
  }

  try {
    // Split freshly-picked uploads from images that already have a URL.
    const blobDrafts = images
      .map((img, index) => ({ img, index }))
      .filter(({ img }) => Boolean(img.blob) && Boolean(img.mimeType))
    const uploadedByIndex = new Map<number, { url: string; fileSize: number; fileType: string }>()

    // Step 1: batch-upload the blobs (single NSFW moderation pass).
    if (blobDrafts.length > 0) {
      const uploadResult = await batchUploadImages(
        blobDrafts.map(({ img }) => ({
          blob: img.blob as Blob,
          mimeType: img.mimeType as string,
          fileName: img.fileName,
        })),
        listingId,
      )
      if (!uploadResult.success || !uploadResult.data) {
        return { success: false, error: uploadResult.error ?? 'Image upload failed', images_processed: 0 }
      }
      uploadResult.data.forEach((uploaded, i) => {
        uploadedByIndex.set(blobDrafts[i].index, uploaded)
      })
    }

    // Step 2: attach every image row (reusing `addImage`).
    const results: { index: number; success: boolean; error?: string; url?: string }[] = []
    let successCount = 0
    let failureCount = 0

    for (let i = 0; i < images.length; i += 1) {
      const draft = images[i]
      const uploaded = uploadedByIndex.get(i)
      const imageUrl = uploaded?.url ?? draft.image_url

      if (!imageUrl) {
        results.push({ index: i, success: false, error: 'No image URL available' })
        failureCount += 1
        continue
      }

      const altText = (draft.alt_text ?? '').trim() || null
      const imageType = uploaded?.fileType?.split('/')[1] ?? draft.image_type ?? null

      const addResult = await addImage(
        listingId,
        {
          image_url: imageUrl,
          alt_text: altText,
          display_order: draft.display_order ?? i,
          is_primary: draft.is_primary ?? i === 0,
          file_size: uploaded?.fileSize ?? draft.file_size ?? null,
          width: draft.width ?? null,
          height: draft.height ?? null,
          image_type: imageType,
        },
        userId,
      )

      if (addResult.success) {
        results.push({ index: i, success: true, url: imageUrl })
        successCount += 1
      } else {
        results.push({ index: i, success: false, error: addResult.error ?? 'Failed to save image' })
        failureCount += 1
      }
    }

    if (successCount === 0) {
      return {
        success: false,
        error: `All ${images.length} image(s) failed to process.`,
        images_processed: 0,
        images_failed: failureCount,
        total_images: images.length,
        results,
      }
    }

    return {
      success: true,
      images_processed: successCount,
      images_failed: failureCount,
      total_images: images.length,
      results,
      has_primary_image: results.some((r) => r.success && r.index === 0),
      message: `Processed ${successCount}/${images.length} images successfully`,
    }
  } catch (error) {
    return { success: false, error: `Image processing failed: ${(error as Error).message}` }
  }
}

// ============= STEP: CATEGORIES / VARIATIONS / ATTRIBUTES / MATERIALS =============

async function assignListingCategories(
  listingId: string,
  categories: ListingCategoryInput[] = [],
  userId?: string | null,
): Promise<StepResult> {
  if (!categories || categories.length === 0) {
    return { success: true, message: 'No categories to assign', categories_assigned: 0 }
  }
  const response = await assignCategories(listingId, categories, userId)
  if (!response.success) return { success: false, error: response.error ?? 'Category assignment failed' }
  return {
    success: true,
    categories_assigned: response.data?.assigned ?? 0,
    message: `Assigned ${response.data?.assigned ?? 0} categories to listing`,
  }
}

async function createListingVariations(
  listingId: string,
  variations: ListingFormData['variations'] = [],
): Promise<StepResult> {
  if (!variations || variations.length === 0) {
    return { success: true, message: 'No variations to create', variations_created: 0 }
  }
  const response = await replaceVariations(listingId, variations)
  if (!response.success) return { success: false, error: response.error ?? 'Variations creation failed' }
  const created = response.data?.length ?? 0
  return { success: true, variations_created: created, message: `Created ${created} variations successfully` }
}

async function createListingAttributes(
  listingId: string,
  attributes: ListingFormData['attributes'] = [],
): Promise<StepResult> {
  if (!attributes || attributes.length === 0) {
    return { success: true, message: 'No attributes to create', attributes_created: 0 }
  }
  const response = await replaceAttributes(listingId, attributes)
  if (!response.success) return { success: false, error: response.error ?? 'Attributes creation failed' }
  const created = response.data?.length ?? 0
  return { success: true, attributes_created: created, message: `Created ${created} attributes successfully` }
}

async function createListingMaterials(
  listingId: string,
  materials: ListingFormData['materials'] = [],
): Promise<StepResult> {
  if (!materials || materials.length === 0) {
    return { success: true, message: 'No materials to create', materials_created: 0 }
  }
  const response = await replaceMaterials(listingId, materials)
  if (!response.success) return { success: false, error: response.error ?? 'Materials creation failed' }
  const created = response.data?.length ?? 0
  return { success: true, materials_created: created, message: `Created ${created} materials successfully` }
}

// ============= STEP: TAGS =============

async function processListingTags(listingId: string, tags: string[] = []): Promise<StepResult> {
  if (!tags || tags.length === 0) {
    return { success: true, message: 'No tags to process', tags_created: 0 }
  }
  try {
    const cleanTags = [
      ...new Set(
        tags
          .filter((tag): tag is string => Boolean(tag) && typeof tag === 'string')
          .map((tag) => tag.trim().toLowerCase())
          .filter((tag) => tag.length >= 2),
      ),
    ]

    if (cleanTags.length === 0) {
      return { success: true, message: 'No valid tags found', tags_created: 0 }
    }

    const tagPromises = cleanTags.map((tag) =>
      supabase.from('listing_tags').insert({ listing_id: listingId, tag_name: tag }),
    )
    const batchResult = await executeBatch(tagPromises, 'tags')

    return {
      success: batchResult.success,
      tags_created: batchResult.created,
      tags_failed: batchResult.failed,
      total_tags: batchResult.total,
      processed_tags: cleanTags,
      failed_reasons: batchResult.failed_reasons,
      message: batchResult.message,
    }
  } catch (error) {
    return { success: false, error: (error as Error).message }
  }
}

// ============= STEP: SHOP SECTIONS =============

/**
 * Add the listing to the requested shop sections.
 *
 * ⛔ Placeholder — `shop-sections.service` has not been migrated yet. Once it
 * is, import `addListingToSection` at the top of this file and replace the body
 * below with the per-section loop (mirroring the other batch steps). This step
 * is optional, so it currently no-ops without failing the publish.
 */
async function addToShopSections(listingId: string, shopSections: string[] = []): Promise<StepResult> {
  if (!shopSections || shopSections.length === 0) {
    return { success: true, message: 'No shop sections specified', sections_added: 0 }
  }

  const { saveVendorShopSection } = await import('~/commerce/lib/vendor-operations')
  let added = 0
  let skipped = 0

  for (const sectionId of shopSections) {
    const { data: section } = await supabase
      .from('shop_sections')
      .select('id, shop_id, section_name, description, is_active, listing_sections(listing_id)')
      .eq('id', sectionId)
      .maybeSingle()

    if (!section) {
      skipped += 1
      continue
    }

    const existingIds = (section.listing_sections ?? []).map(
      (link: { listing_id: string }) => link.listing_id,
    )
    if (existingIds.includes(listingId)) {
      skipped += 1
      continue
    }

    const { error } = await saveVendorShopSection({
      shopId: section.shop_id,
      sectionId: section.id,
      name: section.section_name,
      description: section.description,
      active: section.is_active ?? true,
      listingIds: [...existingIds, listingId],
    })

    if (error) skipped += 1
    else added += 1
  }

  return {
    success: true,
    sections_added: added,
    sections_skipped: skipped,
    message:
      added > 0
        ? `Added listing to ${added} shop section(s)`
        : 'Shop sections skipped or already linked',
  }
}

// ============= STEP: SEARCH INDEXING =============

async function updateSearchIndexing(
  listingId: string,
  publishData: PublishListingData,
): Promise<StepResult> {
  try {
    const searchContent = [
      publishData.title,
      publishData.description,
      ...(publishData.tags ?? []),
      ...(publishData.attributes ?? []).map(
        (attr) => `${attr.attribute_name ?? ''} ${attr.attribute_value ?? ''}`,
      ),
      ...(publishData.materials ?? []).map((mat) => mat.material_name ?? ''),
    ]
      .filter(Boolean)
      .join(' ')

    const { error } = await supabase
      .from('listings')
      .update({
        listing_metadata: {
          ...(publishData.listing_metadata ?? {}),
          search_content: searchContent,
          indexed_at: new Date().toISOString(),
        },
      })
      .eq('id', listingId)

    if (error) return { success: false, error: error.message }
    return {
      success: true,
      message: 'Search indexing updated successfully',
      search_content_length: searchContent.length,
    }
  } catch (error) {
    return { success: false, error: (error as Error).message }
  }
}

// ============= ROLLBACK =============

/** Delete the main listing (child rows cascade). Reuses the migrated service. */
async function performRollback(publishResult: PublishResult): Promise<boolean> {
  if (!publishResult.listing_id) return false
  const response = await deleteListing(publishResult.listing_id)
  return response.success
}

// ============= ORCHESTRATOR =============

export const listingPublishOrchestrator = {
  /**
   * Run the complete publishing workflow. Steps execute sequentially; failure
   * of a required step (validation / main listing / images) aborts and rolls
   * back, while optional steps are allowed to fail without blocking publish.
   */
  async publishListing(
    publishData: PublishListingData,
    options: PublishOptions = {},
  ): Promise<PublishResult> {
    const callbacks: PublishCallbacks = {
      onStepProgress: options.onStepProgress ?? (() => {}),
      onStepComplete: options.onStepComplete ?? (() => {}),
      onError: options.onError ?? (() => {}),
    }
    const { rollbackOnFailure = true, publishImmediately = true } = options

    const publishResult = initializePublishResult()
    let currentStep: PublishStep = PUBLISH_STEPS.VALIDATION
    // The acting user, resolved once at validation and reused by later steps.
    let userId: string | null = null

    try {
      const steps: {
        step: Exclude<PublishStep, 'completed'>
        run: () => Promise<StepResult>
        critical?: boolean
      }[] = [
        {
          step: PUBLISH_STEPS.VALIDATION,
          run: async () => {
            const result = await validatePublishingRequirements(publishData)
            if (result.success) userId = (result.user_id as string) ?? null
            return result
          },
        },
        {
          step: PUBLISH_STEPS.MAIN_LISTING,
          critical: true,
          run: () => createMainListing(publishData, publishImmediately),
        },
        {
          step: PUBLISH_STEPS.IMAGES,
          critical: true,
          run: () => processListingImages(publishResult.listing_id as string, publishData.images, userId),
        },
        {
          step: PUBLISH_STEPS.CATEGORIES,
          run: () =>
            assignListingCategories(publishResult.listing_id as string, publishData.categories, userId),
        },
        {
          step: PUBLISH_STEPS.VARIATIONS,
          run: () => createListingVariations(publishResult.listing_id as string, publishData.variations),
        },
        {
          step: PUBLISH_STEPS.ATTRIBUTES,
          run: () => createListingAttributes(publishResult.listing_id as string, publishData.attributes),
        },
        {
          step: PUBLISH_STEPS.MATERIALS,
          run: () => createListingMaterials(publishResult.listing_id as string, publishData.materials),
        },
        {
          step: PUBLISH_STEPS.TAGS,
          run: () => processListingTags(publishResult.listing_id as string, publishData.tags),
        },
        {
          step: PUBLISH_STEPS.SHOP_SECTIONS,
          run: () => addToShopSections(publishResult.listing_id as string, publishData.shop_sections),
        },
        {
          step: PUBLISH_STEPS.INDEXING,
          run: () => updateSearchIndexing(publishResult.listing_id as string, publishData),
        },
      ]

      for (const { step, run, critical } of steps) {
        currentStep = step

        const outcome = await executeStep(step, run, publishResult, callbacks)

        // Capture the new listing id as soon as the main listing is created.
        if (step === PUBLISH_STEPS.MAIN_LISTING && outcome.result?.listing_id) {
          publishResult.listing_id = outcome.result.listing_id
        }

        if (!outcome.success) {
          const abort = critical || !outcome.shouldContinue
          if (abort) {
            if (rollbackOnFailure && publishResult.listing_id) {
              publishResult.rollback_performed = await performRollback(publishResult)
            }
            return publishResult
          }
        }
      }

      return completePublication(publishResult)
    } catch (error) {
      return handlePublishError(error, currentStep, publishResult, rollbackOnFailure, callbacks.onError)
    }
  },

  /** Read the current publishing progress for a listing (dashboard/status UI). */
  async getPublishingProgress(listingId: string): Promise<StepResult> {
    try {
      const { data: listing, error } = await supabase
        .from('listings')
        .select(
          `
          id,
          title,
          listing_status,
          is_active,
          published_at,
          created_at,
          listing_images(count),
          listing_variations(count),
          listing_attributes(count),
          listing_materials(count),
          listing_tags(count)
        `,
        )
        .eq('id', listingId)
        .single()

      if (error || !listing) {
        return { success: false, error: 'Listing not found' }
      }

      const count = (rows: { count: number }[] | null | undefined) => rows?.[0]?.count ?? 0

      return {
        success: true,
        listing_id: listingId,
        status: listing.listing_status,
        is_published: Boolean(listing.is_active && listing.published_at),
        published_at: listing.published_at,
        components: {
          images: count(listing.listing_images),
          variations: count(listing.listing_variations),
          attributes: count(listing.listing_attributes),
          materials: count(listing.listing_materials),
          tags: count(listing.listing_tags),
        },
      }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  },
}

function completePublication(publishResult: PublishResult): PublishResult {
  publishResult.success = true
  publishResult.steps_completed.push(PUBLISH_STEPS.COMPLETED)
  return publishResult
}

async function handlePublishError(
  error: unknown,
  currentStep: PublishStep,
  publishResult: PublishResult,
  rollbackOnFailure: boolean,
  onError: PublishCallbacks['onError'],
): Promise<PublishResult> {
  publishResult.error_details = {
    step: currentStep,
    message: (error as Error).message,
    stack: (error as Error).stack,
  }
  publishResult.steps_failed.push(currentStep)

  if (rollbackOnFailure && publishResult.listing_id) {
    publishResult.rollback_performed = await performRollback(publishResult)
  }

  onError(currentStep, error)
  return publishResult
}
