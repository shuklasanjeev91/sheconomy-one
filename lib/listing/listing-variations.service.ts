/**
 * Listing variations service (physical-product options like size / colour).
 *
 * Ported from the legacy `listingVariationsService`. Every write verifies
 * owner/admin access and returns a `ListingServiceResponse`; errors are mapped
 * through `toFriendlyListingError`.
 */

import { supabase } from '~/lib/supabase'

import { fail, ok, resolveUserId, verifyListingManageAccess } from '~/lib/listing/listing.access'
import { LISTING_TYPES } from '~/lib/listing/listing.type'
import type {
  ListingServiceResponse,
  ListingVariation,
  ListingVariationInsert,
  ListingVariationUpdate,
} from '~/lib/listing/listing.type'

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

/** Normalise a form variation into a valid insert row for a listing. */
function toVariationInsert(
  listingId: string,
  variation: Partial<ListingVariationInsert>,
): ListingVariationInsert {
  return {
    listing_id: listingId,
    variation_name: (variation.variation_name ?? '').trim(),
    variation_value: (variation.variation_value ?? '').trim(),
    price_adjustment: toNumber(variation.price_adjustment) ?? 0,
    stock: toNumber(variation.stock),
    sku: variation.sku?.trim() || null,
    weight: toNumber(variation.weight),
    display_order: toNumber(variation.display_order) ?? 0,
    is_available: variation.is_available !== false,
    variation_metadata: variation.variation_metadata ?? {},
  }
}

/** All variations for a listing, ordered for display. Public read. */
export async function getVariations(
  listingId: string,
): Promise<ListingServiceResponse<ListingVariation[]>> {
  if (!listingId) return ok([])

  try {
    const { data, error } = await supabase
      .from('listing_variations')
      .select('*')
      .eq('listing_id', listingId)
      .order('display_order', { ascending: true })
      .order('variation_name', { ascending: true })
      .order('variation_value', { ascending: true })

    if (error) return fail(error)
    return ok(data ?? [])
  } catch (error) {
    return fail(error)
  }
}

export async function addVariation(
  listingId: string,
  variation: Partial<ListingVariationInsert>,
  userId?: string | null,
): Promise<ListingServiceResponse<ListingVariation>> {
  const id = await resolveUserId(userId)
  if (!id) return fail('User not authenticated')
  if (!variation.variation_name || !variation.variation_value) {
    return fail('Variation name and value are required.')
  }

  try {
    const access = await verifyListingManageAccess(listingId, id)
    if (!access.success) return fail(access.error)

    // Variations only apply to physical products.
    const { data: listing } = await supabase
      .from('listings')
      .select('listing_type')
      .eq('id', listingId)
      .maybeSingle()
    if (listing && listing.listing_type !== LISTING_TYPES.PHYSICAL) {
      return fail('Variations are only supported for physical products.')
    }

    const { data, error } = await supabase
      .from('listing_variations')
      .insert(toVariationInsert(listingId, variation))
      .select('*')
      .single()

    if (error) return fail(error)
    return ok(data)
  } catch (error) {
    return fail(error)
  }
}

export async function updateVariation(
  variationId: string,
  updates: ListingVariationUpdate,
  userId?: string | null,
): Promise<ListingServiceResponse<ListingVariation>> {
  const id = await resolveUserId(userId)
  if (!id) return fail('User not authenticated')

  try {
    const { data: owned } = await supabase
      .from('listing_variations')
      .select('id, listing_id')
      .eq('id', variationId)
      .maybeSingle()
    if (!owned) return fail('Variation not found or access denied')

    const access = await verifyListingManageAccess(owned.listing_id, id)
    if (!access.success) return fail(access.error)

    const { data, error } = await supabase
      .from('listing_variations')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', variationId)
      .select('*')
      .single()

    if (error) return fail(error)
    return ok(data)
  } catch (error) {
    return fail(error)
  }
}

export async function deleteVariation(
  variationId: string,
  userId?: string | null,
): Promise<ListingServiceResponse<{ id: string }>> {
  const id = await resolveUserId(userId)
  if (!id) return fail('User not authenticated')

  try {
    const { data: owned } = await supabase
      .from('listing_variations')
      .select('id, listing_id')
      .eq('id', variationId)
      .maybeSingle()
    if (!owned) return fail('Variation not found or access denied')

    const access = await verifyListingManageAccess(owned.listing_id, id)
    if (!access.success) return fail(access.error)

    const { error } = await supabase.from('listing_variations').delete().eq('id', variationId)
    if (error) return fail(error)
    return ok({ id: variationId })
  } catch (error) {
    return fail(error)
  }
}

/**
 * Replace **all** variations for a listing (delete + re-insert). Used by the
 * comprehensive listing update. Assumes access was already verified by caller.
 */
export async function replaceVariations(
  listingId: string,
  variations: Partial<ListingVariationInsert>[],
): Promise<ListingServiceResponse<ListingVariation[]>> {
  try {
    const { error: deleteError } = await supabase
      .from('listing_variations')
      .delete()
      .eq('listing_id', listingId)
    if (deleteError) return fail(deleteError)

    if (!variations.length) return ok([])

    const rows = variations.map((variation) => toVariationInsert(listingId, variation))
    const { data, error } = await supabase.from('listing_variations').insert(rows).select('*')
    if (error) return fail(error)
    return ok(data ?? [])
  } catch (error) {
    return fail(error)
  }
}
