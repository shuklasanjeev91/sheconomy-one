/**
 * Shop-level shipping policy service (delivery profiles).
 *
 * Ported from legacy `listing-profile-service.js` (`deliveryProfilesService`).
 * Components should dispatch thunks from `shipping-policy.store`.
 */

import { canManageShop } from '~/lib/shop/shop.utils'
import type { Json } from '~/lib/supabase'
import { supabase } from '~/lib/supabase'

import { SHIPPING_POLICY_SUCCESS_MESSAGES } from '~/lib/shipping-policy/shipping-policy.constants'
import {
  ShippingPolicyError,
  SHIPPING_POLICY_ERROR_CODES,
  toFriendlyShippingPolicyError,
} from '~/lib/shipping-policy/shipping-policy.errors'
import type {
  AssignedShippingPolicy,
  DeleteShippingPolicyResult,
  RemoveShippingPolicyResult,
  ShippingPolicy,
  ShippingPolicyAccessContext,
  ShippingPolicyInput,
  ShippingPolicyServiceResponse,
  ShippingPolicyUpdate,
} from '~/lib/shipping-policy/shipping-policy.type'
import { parseShippingPolicyInput, parseShippingPolicyUpdate, validateShippingPolicyInput } from '~/lib/shipping-policy/shipping-policy.validation'
import { serializeShippingZones } from '~/lib/shipping-policy/shipping-policy.utils'

function ok<T>(data: T, message?: string | null): ShippingPolicyServiceResponse<T> {
  return { success: true, data, error: null, message: message ?? null }
}

function fail<T>(error: unknown, fallback?: string): ShippingPolicyServiceResponse<T> {
  return { success: false, data: null, error: toFriendlyShippingPolicyError(error, fallback) }
}

async function resolveUserId(userId?: string | null): Promise<string> {
  if (userId) return userId

  const { data, error } = await supabase.auth.getUser()
  if (error || !data.user?.id) {
    throw new ShippingPolicyError(SHIPPING_POLICY_ERROR_CODES.NOT_AUTHENTICATED)
  }
  return data.user.id
}

async function assertShopAccess(
  shopId: string,
  context?: ShippingPolicyAccessContext,
): Promise<{ shopId: string; userId: string }> {
  const userId = await resolveUserId(context?.userId)

  const { data: shop, error } = await supabase
    .from('shops')
    .select('id, user_id')
    .eq('id', shopId)
    .maybeSingle()

  if (error || !shop) {
    throw new ShippingPolicyError(SHIPPING_POLICY_ERROR_CODES.SHOP_ACCESS_DENIED)
  }

  if (!canManageShop(shop, userId, context?.role)) {
    throw new ShippingPolicyError(SHIPPING_POLICY_ERROR_CODES.SHOP_ACCESS_DENIED)
  }

  return { shopId: shop.id, userId }
}

async function assertPolicyAccess(
  policyId: string,
  context?: ShippingPolicyAccessContext,
): Promise<ShippingPolicy> {
  const userId = await resolveUserId(context?.userId)

  const { data: policy, error } = await supabase
    .from('delivery_profiles')
    .select(
      `
      *,
      shops!inner(user_id)
    `,
    )
    .eq('id', policyId)
    .maybeSingle()

  if (error || !policy) {
    throw new ShippingPolicyError(SHIPPING_POLICY_ERROR_CODES.PROFILE_ACCESS_DENIED)
  }

  const shop = Array.isArray(policy.shops) ? policy.shops[0] : policy.shops
  if (!canManageShop(shop as { user_id: string }, userId, context?.role)) {
    throw new ShippingPolicyError(SHIPPING_POLICY_ERROR_CODES.PROFILE_ACCESS_DENIED)
  }

  const { shops: _shops, ...row } = policy as ShippingPolicy & { shops?: unknown }
  return row
}

function toInsertPayload(shopId: string, input: ShippingPolicyInput) {
  const parsed = parseShippingPolicyInput(input)
  return {
    shop_id: shopId,
    profile_name: parsed.profile_name,
    is_default: parsed.is_default ?? false,
    is_active: parsed.is_active ?? true,
    shipping_zones: serializeShippingZones(parsed.shipping_zones ?? []) as Json,
    processing_time_min: parsed.processing_time_min,
    processing_time_max: parsed.processing_time_max,
    free_shipping_threshold: parsed.free_shipping_threshold ?? null,
    delivery_metadata: (parsed.delivery_metadata ?? {}) as Json,
    shipping_rate_type: parsed.shipping_rate_type,
    fixed_fee: parsed.fixed_fee ?? 0,
  }
}

function toUpdatePayload(input: Partial<ShippingPolicyInput>): ShippingPolicyUpdate {
  const parsed = parseShippingPolicyUpdate(input)
  const payload: ShippingPolicyUpdate = {}

  if (parsed.profile_name !== undefined) payload.profile_name = parsed.profile_name
  if (parsed.is_default !== undefined) payload.is_default = parsed.is_default
  if (parsed.is_active !== undefined) payload.is_active = parsed.is_active
  if (parsed.processing_time_min !== undefined) payload.processing_time_min = parsed.processing_time_min
  if (parsed.processing_time_max !== undefined) payload.processing_time_max = parsed.processing_time_max
  if (parsed.shipping_zones !== undefined) {
    payload.shipping_zones = serializeShippingZones(parsed.shipping_zones) as Json
  }
  if (parsed.free_shipping_threshold !== undefined) payload.free_shipping_threshold = parsed.free_shipping_threshold
  if (parsed.delivery_metadata !== undefined) {
    payload.delivery_metadata = (parsed.delivery_metadata ?? {}) as Json
  }
  if (parsed.shipping_rate_type !== undefined) payload.shipping_rate_type = parsed.shipping_rate_type
  if (parsed.fixed_fee !== undefined) payload.fixed_fee = parsed.fixed_fee

  return payload
}

function mapListingPolicies(
  rows: Array<{ created_at: string; delivery_profiles: ShippingPolicy | ShippingPolicy[] }>,
): AssignedShippingPolicy[] {
  return (rows ?? [])
    .map((item) => {
      const policy = Array.isArray(item.delivery_profiles)
        ? item.delivery_profiles[0]
        : item.delivery_profiles
      if (!policy) return null
      return {
        ...policy,
        assigned_at: item.created_at,
      }
    })
    .filter((row): row is AssignedShippingPolicy => row !== null)
}

// ============= SHOP POLICIES =============

export async function createShippingPolicy(
  shopId: string,
  input: ShippingPolicyInput,
  context?: ShippingPolicyAccessContext,
): Promise<ShippingPolicyServiceResponse<ShippingPolicy>> {
  try {
    const validation = validateShippingPolicyInput(input)
    if (!validation.isValid) {
      throw new ShippingPolicyError(
        SHIPPING_POLICY_ERROR_CODES.INVALID_INPUT,
        validation.fieldErrors[0],
      )
    }

    await assertShopAccess(shopId, context)

    const { data: policy, error } = await supabase
      .from('delivery_profiles')
      .insert(toInsertPayload(shopId, input))
      .select('*')
      .single()

    if (error) throw error
    return ok(policy, SHIPPING_POLICY_SUCCESS_MESSAGES.CREATED)
  } catch (error) {
    return fail(error, 'Failed to create shipping policy.')
  }
}

export async function getShippingPolicies(
  shopId: string,
): Promise<ShippingPolicyServiceResponse<ShippingPolicy[]>> {
  try {
    if (!shopId) {
      throw new ShippingPolicyError(SHIPPING_POLICY_ERROR_CODES.INVALID_INPUT, 'Shop ID is required.')
    }

    const { data, error } = await supabase
      .from('delivery_profiles')
      .select('*')
      .eq('shop_id', shopId)
      .order('is_default', { ascending: false })
      .order('created_at', { ascending: false })

    if (error) throw error
    return ok(data ?? [])
  } catch (error) {
    return fail(error, 'Failed to load shipping policies.')
  }
}

export async function updateShippingPolicy(
  policyId: string,
  input: Partial<ShippingPolicyInput>,
  context?: ShippingPolicyAccessContext,
): Promise<ShippingPolicyServiceResponse<ShippingPolicy>> {
  try {
    await assertPolicyAccess(policyId, context)

    const payload = toUpdatePayload(input)
    if (Object.keys(payload).length === 0) {
      throw new ShippingPolicyError(
        SHIPPING_POLICY_ERROR_CODES.INVALID_INPUT,
        'At least one field is required to update a shipping policy.',
      )
    }

    const { data: policy, error } = await supabase
      .from('delivery_profiles')
      .update(payload)
      .eq('id', policyId)
      .select('*')
      .single()

    if (error) throw error
    return ok(policy, SHIPPING_POLICY_SUCCESS_MESSAGES.UPDATED)
  } catch (error) {
    return fail(error, 'Failed to update shipping policy.')
  }
}

export async function deleteShippingPolicy(
  policyId: string,
  context?: ShippingPolicyAccessContext,
): Promise<ShippingPolicyServiceResponse<DeleteShippingPolicyResult>> {
  try {
    const existing = await assertPolicyAccess(policyId, context)

    const { error } = await supabase.from('delivery_profiles').delete().eq('id', policyId)
    if (error) throw error

    return ok(
      {
        policyId: existing.id,
        profileName: existing.profile_name,
        shopId: existing.shop_id,
      },
      `Delivery profile "${existing.profile_name}" deleted successfully.`,
    )
  } catch (error) {
    return fail(error, 'Failed to delete shipping policy.')
  }
}

// ============= LISTING ASSIGNMENTS =============

export async function assignShippingPolicyToListing(
  listingId: string,
  deliveryProfileId: string,
  context?: ShippingPolicyAccessContext,
): Promise<ShippingPolicyServiceResponse<RemoveShippingPolicyResult>> {
  try {
    const userId = await resolveUserId(context?.userId)

    const [listingResult, policyResult] = await Promise.all([
      supabase
        .from('listings')
        .select('id, shop_id, shops!inner(user_id)')
        .eq('id', listingId)
        .maybeSingle(),
      supabase
        .from('delivery_profiles')
        .select('id, shop_id, shops!inner(user_id)')
        .eq('id', deliveryProfileId)
        .maybeSingle(),
    ])

    const listing = listingResult.data
    const policy = policyResult.data

    if (listingResult.error || !listing) {
      throw new ShippingPolicyError(SHIPPING_POLICY_ERROR_CODES.LISTING_ACCESS_DENIED)
    }

    if (policyResult.error || !policy) {
      throw new ShippingPolicyError(SHIPPING_POLICY_ERROR_CODES.PROFILE_ACCESS_DENIED)
    }

    const listingShop = Array.isArray(listing.shops) ? listing.shops[0] : listing.shops
    const policyShop = Array.isArray(policy.shops) ? policy.shops[0] : policy.shops

    if (!canManageShop(listingShop as { user_id: string }, userId, context?.role)) {
      throw new ShippingPolicyError(SHIPPING_POLICY_ERROR_CODES.LISTING_ACCESS_DENIED)
    }

    if (!canManageShop(policyShop as { user_id: string }, userId, context?.role)) {
      throw new ShippingPolicyError(SHIPPING_POLICY_ERROR_CODES.PROFILE_ACCESS_DENIED)
    }

    if (listing.shop_id !== policy.shop_id) {
      throw new ShippingPolicyError(SHIPPING_POLICY_ERROR_CODES.SHOP_MISMATCH)
    }

    const { error } = await supabase.from('listing_delivery_profiles').insert({
      listing_id: listingId,
      delivery_profile_id: deliveryProfileId,
    })

    if (error) {
      if (error.code === '23505') {
        throw new ShippingPolicyError(SHIPPING_POLICY_ERROR_CODES.DUPLICATE)
      }
      throw error
    }

    return ok({ listingId, deliveryProfileId }, SHIPPING_POLICY_SUCCESS_MESSAGES.ASSIGNED)
  } catch (error) {
    return fail(error, 'Failed to assign shipping policy to listing.')
  }
}

export async function removeShippingPolicyFromListing(
  listingId: string,
  deliveryProfileId: string,
  context?: ShippingPolicyAccessContext,
): Promise<ShippingPolicyServiceResponse<RemoveShippingPolicyResult>> {
  try {
    const userId = await resolveUserId(context?.userId)

    const { data: mapping, error: checkError } = await supabase
      .from('listing_delivery_profiles')
      .select(
        `
        listing_id,
        delivery_profile_id,
        listings!inner(shop_id, shops!inner(user_id))
      `,
      )
      .eq('listing_id', listingId)
      .eq('delivery_profile_id', deliveryProfileId)
      .maybeSingle()

    if (checkError || !mapping) {
      throw new ShippingPolicyError(SHIPPING_POLICY_ERROR_CODES.MAPPING_ACCESS_DENIED)
    }

    const listing = Array.isArray(mapping.listings) ? mapping.listings[0] : mapping.listings
    const shop = listing && (Array.isArray(listing.shops) ? listing.shops[0] : listing.shops)

    if (!canManageShop(shop as { user_id: string }, userId, context?.role)) {
      throw new ShippingPolicyError(SHIPPING_POLICY_ERROR_CODES.MAPPING_ACCESS_DENIED)
    }

    const { error } = await supabase
      .from('listing_delivery_profiles')
      .delete()
      .eq('listing_id', listingId)
      .eq('delivery_profile_id', deliveryProfileId)

    if (error) throw error
    return ok({ listingId, deliveryProfileId }, SHIPPING_POLICY_SUCCESS_MESSAGES.REMOVED)
  } catch (error) {
    return fail(error, 'Failed to remove shipping policy from listing.')
  }
}

export async function getListingShippingPolicies(
  listingId: string,
): Promise<ShippingPolicyServiceResponse<AssignedShippingPolicy[]>> {
  try {
    if (!listingId) {
      throw new ShippingPolicyError(SHIPPING_POLICY_ERROR_CODES.INVALID_INPUT, 'Listing ID is required.')
    }

    const { data, error } = await supabase
      .from('listing_delivery_profiles')
      .select(
        `
        created_at,
        delivery_profiles!inner(
          id,
          shop_id,
          profile_name,
          processing_time_min,
          processing_time_max,
          shipping_zones,
          free_shipping_threshold,
          shipping_rate_type,
          fixed_fee,
          delivery_metadata,
          is_default,
          is_active,
          created_at,
          updated_at
        )
      `,
      )
      .eq('listing_id', listingId)
      .order('created_at', { ascending: true })

    if (error) throw error

    return ok(
      mapListingPolicies(
        (data ?? []) as Array<{ created_at: string; delivery_profiles: ShippingPolicy | ShippingPolicy[] }>,
      ),
    )
  } catch (error) {
    return fail(error, 'Failed to load listing shipping policies.')
  }
}
