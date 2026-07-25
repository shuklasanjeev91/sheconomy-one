/**
 * Listing attributes service (extra spec fields like "Material: Cotton").
 *
 * Ported from the legacy `listingAttributesService`. Owner/admin access is
 * verified on every write; all results use `ListingServiceResponse`.
 */

import { supabase } from '~/lib/supabase'

import { fail, ok, resolveUserId, verifyListingManageAccess } from '~/lib/listing/listing.access'
import type {
  ListingAttribute,
  ListingAttributeInsert,
  ListingAttributeUpdate,
  ListingServiceResponse,
} from '~/lib/listing/listing.type'

function toAttributeInsert(
  listingId: string,
  attribute: Partial<ListingAttributeInsert>,
): ListingAttributeInsert {
  return {
    listing_id: listingId,
    attribute_name: (attribute.attribute_name ?? '').trim(),
    attribute_value: (attribute.attribute_value ?? '').toString().trim(),
    attribute_type: attribute.attribute_type ?? 'text',
    display_order: Number(attribute.display_order) || 0,
    is_filterable: attribute.is_filterable ?? false,
  }
}

/** All attributes for a listing, ordered for display. Public read. */
export async function getAttributes(
  listingId: string,
): Promise<ListingServiceResponse<ListingAttribute[]>> {
  if (!listingId) return ok([])

  try {
    const { data, error } = await supabase
      .from('listing_attributes')
      .select('*')
      .eq('listing_id', listingId)
      .order('display_order', { ascending: true })
      .order('attribute_name', { ascending: true })

    if (error) return fail(error)
    return ok(data ?? [])
  } catch (error) {
    return fail(error)
  }
}

export async function addAttribute(
  listingId: string,
  attribute: Partial<ListingAttributeInsert>,
  userId?: string | null,
): Promise<ListingServiceResponse<ListingAttribute>> {
  const id = await resolveUserId(userId)
  if (!id) return fail('User not authenticated')
  if (!attribute.attribute_name || attribute.attribute_value === undefined) {
    return fail('Attribute name and value are required.')
  }

  try {
    const access = await verifyListingManageAccess(listingId, id)
    if (!access.success) return fail(access.error)

    const { data, error } = await supabase
      .from('listing_attributes')
      .insert(toAttributeInsert(listingId, attribute))
      .select('*')
      .single()

    if (error) return fail(error)
    return ok(data)
  } catch (error) {
    return fail(error)
  }
}

export async function updateAttribute(
  attributeId: string,
  updates: ListingAttributeUpdate,
  userId?: string | null,
): Promise<ListingServiceResponse<ListingAttribute>> {
  const id = await resolveUserId(userId)
  if (!id) return fail('User not authenticated')

  try {
    const { data: owned } = await supabase
      .from('listing_attributes')
      .select('id, listing_id')
      .eq('id', attributeId)
      .maybeSingle()
    if (!owned) return fail('Attribute not found or access denied')

    const access = await verifyListingManageAccess(owned.listing_id, id)
    if (!access.success) return fail(access.error)

    const { data, error } = await supabase
      .from('listing_attributes')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', attributeId)
      .select('*')
      .single()

    if (error) return fail(error)
    return ok(data)
  } catch (error) {
    return fail(error)
  }
}

export async function deleteAttribute(
  attributeId: string,
  userId?: string | null,
): Promise<ListingServiceResponse<{ id: string }>> {
  const id = await resolveUserId(userId)
  if (!id) return fail('User not authenticated')

  try {
    const { data: owned } = await supabase
      .from('listing_attributes')
      .select('id, listing_id')
      .eq('id', attributeId)
      .maybeSingle()
    if (!owned) return fail('Attribute not found or access denied')

    const access = await verifyListingManageAccess(owned.listing_id, id)
    if (!access.success) return fail(access.error)

    const { error } = await supabase.from('listing_attributes').delete().eq('id', attributeId)
    if (error) return fail(error)
    return ok({ id: attributeId })
  } catch (error) {
    return fail(error)
  }
}

/** Replace **all** attributes for a listing. Assumes verified access. */
export async function replaceAttributes(
  listingId: string,
  attributes: Partial<ListingAttributeInsert>[],
): Promise<ListingServiceResponse<ListingAttribute[]>> {
  try {
    const { error: deleteError } = await supabase
      .from('listing_attributes')
      .delete()
      .eq('listing_id', listingId)
    if (deleteError) return fail(deleteError)

    if (!attributes.length) return ok([])

    const rows = attributes.map((attribute) => toAttributeInsert(listingId, attribute))
    const { data, error } = await supabase.from('listing_attributes').insert(rows).select('*')
    if (error) return fail(error)
    return ok(data ?? [])
  } catch (error) {
    return fail(error)
  }
}
