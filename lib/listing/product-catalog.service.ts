/**
 * Shipping template and return policy attached to a listing.
 * Amazon product types, barcodes, papers, and A+ modules are no longer stored.
 */

import { supabase } from '~/lib/supabase'

import { fail, ok } from '~/lib/listing/listing.access'
import type { ListingFormData, ListingServiceResponse } from '~/lib/listing/listing.type'

export type ListingCatalogChildren = {
  deliveryProfileId: string | null
  returnPolicyId: string | null
}

export async function loadListingCatalogChildren(
  listingId: string,
): Promise<ListingServiceResponse<ListingCatalogChildren>> {
  const empty: ListingCatalogChildren = {
    deliveryProfileId: null,
    returnPolicyId: null,
  }
  if (!listingId) return ok(empty)

  try {
    const [delivery, returns] = await Promise.all([
      supabase
        .from('listing_delivery_profiles')
        .select('delivery_profile_id')
        .eq('listing_id', listingId)
        .limit(1),
      supabase
        .from('listing_return_policies')
        .select('return_policy_id')
        .eq('listing_id', listingId)
        .limit(1),
    ])
    const firstError = delivery.error || returns.error
    if (firstError) return fail(firstError)

    return ok({
      deliveryProfileId: delivery.data?.[0]?.delivery_profile_id ?? null,
      returnPolicyId: returns.data?.[0]?.return_policy_id ?? null,
    })
  } catch (error) {
    return fail(error)
  }
}

/**
 * Replace the delivery profile and return policy when those fields are on the form.
 */
export async function replaceListingCatalog(
  listingId: string,
  formData: Partial<ListingFormData>,
): Promise<ListingServiceResponse<{ listingId: string }>> {
  try {
    if ('delivery_profile_id' in formData) {
      const { error } = await supabase.from('listing_delivery_profiles').delete().eq('listing_id', listingId)
      if (error) return fail(error)
      if (formData.delivery_profile_id) {
        const { error: insertError } = await supabase.from('listing_delivery_profiles').insert({
          listing_id: listingId,
          delivery_profile_id: formData.delivery_profile_id,
        })
        if (insertError) return fail(insertError)
      }
    }

    if ('return_policy_id' in formData) {
      const { error } = await supabase.from('listing_return_policies').delete().eq('listing_id', listingId)
      if (error) return fail(error)
      if (formData.return_policy_id) {
        const { error: insertError } = await supabase.from('listing_return_policies').insert({
          listing_id: listingId,
          return_policy_id: formData.return_policy_id,
        })
        if (insertError) return fail(insertError)
      }
    }

    return ok({ listingId })
  } catch (error) {
    return fail(error)
  }
}
