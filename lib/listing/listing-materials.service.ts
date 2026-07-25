/**
 * Listing materials service (composition rows like "80% Cotton, sustainable").
 *
 * There was no standalone materials service in the legacy code — materials were
 * only handled inside `updateListingWithDetails`. This module gives them the
 * same first-class CRUD + replace surface as variations and attributes.
 */

import { supabase } from '~/lib/supabase'

import { fail, ok, resolveUserId, verifyListingManageAccess } from '~/lib/listing/listing.access'
import type {
  ListingMaterial,
  ListingMaterialInsert,
  ListingMaterialUpdate,
  ListingServiceResponse,
} from '~/lib/listing/listing.type'

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

function toMaterialInsert(
  listingId: string,
  material: Partial<ListingMaterialInsert>,
): ListingMaterialInsert {
  return {
    listing_id: listingId,
    material_name: (material.material_name ?? '').trim(),
    percentage: toNumber(material.percentage),
    is_primary: material.is_primary ?? false,
    is_sustainable: material.is_sustainable ?? false,
    certification: material.certification?.trim() || null,
  }
}

/** All materials for a listing. Public read. */
export async function getMaterials(
  listingId: string,
): Promise<ListingServiceResponse<ListingMaterial[]>> {
  if (!listingId) return ok([])

  try {
    const { data, error } = await supabase
      .from('listing_materials')
      .select('*')
      .eq('listing_id', listingId)
      .order('is_primary', { ascending: false })
      .order('material_name', { ascending: true })

    if (error) return fail(error)
    return ok(data ?? [])
  } catch (error) {
    return fail(error)
  }
}

export async function addMaterial(
  listingId: string,
  material: Partial<ListingMaterialInsert>,
  userId?: string | null,
): Promise<ListingServiceResponse<ListingMaterial>> {
  const id = await resolveUserId(userId)
  if (!id) return fail('User not authenticated')
  if (!material.material_name) return fail('Material name is required.')

  try {
    const access = await verifyListingManageAccess(listingId, id)
    if (!access.success) return fail(access.error)

    const { data, error } = await supabase
      .from('listing_materials')
      .insert(toMaterialInsert(listingId, material))
      .select('*')
      .single()

    if (error) return fail(error)
    return ok(data)
  } catch (error) {
    return fail(error)
  }
}

export async function updateMaterial(
  materialId: string,
  updates: ListingMaterialUpdate,
  userId?: string | null,
): Promise<ListingServiceResponse<ListingMaterial>> {
  const id = await resolveUserId(userId)
  if (!id) return fail('User not authenticated')

  try {
    const { data: owned } = await supabase
      .from('listing_materials')
      .select('id, listing_id')
      .eq('id', materialId)
      .maybeSingle()
    if (!owned) return fail('Material not found or access denied')

    const access = await verifyListingManageAccess(owned.listing_id, id)
    if (!access.success) return fail(access.error)

    const { data, error } = await supabase
      .from('listing_materials')
      .update(updates)
      .eq('id', materialId)
      .select('*')
      .single()

    if (error) return fail(error)
    return ok(data)
  } catch (error) {
    return fail(error)
  }
}

export async function deleteMaterial(
  materialId: string,
  userId?: string | null,
): Promise<ListingServiceResponse<{ id: string }>> {
  const id = await resolveUserId(userId)
  if (!id) return fail('User not authenticated')

  try {
    const { data: owned } = await supabase
      .from('listing_materials')
      .select('id, listing_id')
      .eq('id', materialId)
      .maybeSingle()
    if (!owned) return fail('Material not found or access denied')

    const access = await verifyListingManageAccess(owned.listing_id, id)
    if (!access.success) return fail(access.error)

    const { error } = await supabase.from('listing_materials').delete().eq('id', materialId)
    if (error) return fail(error)
    return ok({ id: materialId })
  } catch (error) {
    return fail(error)
  }
}

/** Replace **all** materials for a listing. Assumes verified access. */
export async function replaceMaterials(
  listingId: string,
  materials: Partial<ListingMaterialInsert>[],
): Promise<ListingServiceResponse<ListingMaterial[]>> {
  try {
    const { error: deleteError } = await supabase
      .from('listing_materials')
      .delete()
      .eq('listing_id', listingId)
    if (deleteError) return fail(deleteError)

    if (!materials.length) return ok([])

    const rows = materials.map((material) => toMaterialInsert(listingId, material))
    const { data, error } = await supabase.from('listing_materials').insert(rows).select('*')
    if (error) return fail(error)
    return ok(data ?? [])
  } catch (error) {
    return fail(error)
  }
}
