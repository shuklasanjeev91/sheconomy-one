/**
 * Return policy service — typed data-access for vendor, admin, and shared flows.
 *
 * Ported from legacy `listing-profile-service.js` (`returnPoliciesService`).
 * Components should dispatch thunks from `return-policy.store` rather than
 * calling these functions directly.
 */

import { canManageShop } from '~/lib/shop/shop.utils'
import { supabase } from '~/lib/supabase'

import { RETURN_POLICY_SUCCESS_MESSAGES } from './return-policy.constants'
import {
  ReturnPolicyError,
  RETURN_POLICY_ERROR_CODES,
  toFriendlyReturnPolicyError,
} from './return-policy.errors'
import type {
  AssignedReturnPolicy,
  DeleteReturnPolicyResult,
  RemoveReturnPolicyResult,
  ReturnPolicy,
  ReturnPolicyAccessContext,
  ReturnPolicyInput,
  ReturnPolicyServiceResponse,
  ReturnPolicyUpdate,
} from './return-policy.type'
import { parseReturnPolicyInput, parseReturnPolicyUpdate, validateReturnPolicyInput } from './return-policy.validation'

// ============= RESPONSE HELPERS =============

function ok<T>(data: T, message?: string | null): ReturnPolicyServiceResponse<T> {
  return { success: true, data, error: null, message: message ?? null }
}

function fail<T>(error: unknown, fallback?: string): ReturnPolicyServiceResponse<T> {
  return { success: false, data: null, error: toFriendlyReturnPolicyError(error, fallback) }
}

async function resolveUserId(userId?: string | null): Promise<string> {
  if (userId) return userId

  const { data, error } = await supabase.auth.getUser()
  if (error || !data.user?.id) {
    throw new ReturnPolicyError(RETURN_POLICY_ERROR_CODES.NOT_AUTHENTICATED)
  }
  return data.user.id
}

async function assertShopAccess(
  shopId: string,
  context?: ReturnPolicyAccessContext,
): Promise<{ shopId: string; userId: string }> {
  const userId = await resolveUserId(context?.userId)

  const { data: shop, error } = await supabase
    .from('shops')
    .select('id, user_id')
    .eq('id', shopId)
    .maybeSingle()

  if (error || !shop) {
    throw new ReturnPolicyError(RETURN_POLICY_ERROR_CODES.SHOP_ACCESS_DENIED)
  }

  if (!canManageShop(shop, userId, context?.role)) {
    throw new ReturnPolicyError(RETURN_POLICY_ERROR_CODES.SHOP_ACCESS_DENIED)
  }

  return { shopId: shop.id, userId }
}

async function assertPolicyAccess(
  policyId: string,
  context?: ReturnPolicyAccessContext,
): Promise<ReturnPolicy> {
  const userId = await resolveUserId(context?.userId)

  const { data: policy, error } = await supabase
    .from('return_policies')
    .select(
      `
      *,
      shops!inner(user_id)
    `,
    )
    .eq('id', policyId)
    .maybeSingle()

  if (error || !policy) {
    throw new ReturnPolicyError(RETURN_POLICY_ERROR_CODES.POLICY_ACCESS_DENIED)
  }

  const shop = Array.isArray(policy.shops) ? policy.shops[0] : policy.shops
  if (!canManageShop(shop as { user_id: string }, userId, context?.role)) {
    throw new ReturnPolicyError(RETURN_POLICY_ERROR_CODES.POLICY_ACCESS_DENIED)
  }

  const { shops: _shops, ...row } = policy as ReturnPolicy & { shops?: unknown }
  return row
}

function toInsertPayload(shopId: string, input: ReturnPolicyInput) {
  const parsed = parseReturnPolicyInput(input)
  return {
    shop_id: shopId,
    policy_name: parsed.policy_name,
    is_default: parsed.is_default ?? false,
    return_window_days: parsed.return_window_days,
    accepts_returns: parsed.accepts_returns,
    accepts_exchanges: parsed.accepts_exchanges,
    accepts_refunds: parsed.accepts_refunds,
    condition_description: parsed.condition_description,
    return_shipping_paid_by: parsed.return_shipping_paid_by,
    policy_details: parsed.policy_details,
    is_active: parsed.is_active,
  }
}

function toUpdatePayload(input: Partial<ReturnPolicyInput>): ReturnPolicyUpdate {
  const parsed = parseReturnPolicyUpdate(input)
  const payload: ReturnPolicyUpdate = {}

  if (parsed.policy_name !== undefined) payload.policy_name = parsed.policy_name
  if (parsed.is_default !== undefined) payload.is_default = parsed.is_default
  if (parsed.return_window_days !== undefined) payload.return_window_days = parsed.return_window_days
  if (parsed.accepts_returns !== undefined) payload.accepts_returns = parsed.accepts_returns
  if (parsed.accepts_exchanges !== undefined) payload.accepts_exchanges = parsed.accepts_exchanges
  if (parsed.accepts_refunds !== undefined) payload.accepts_refunds = parsed.accepts_refunds
  if (parsed.condition_description !== undefined) payload.condition_description = parsed.condition_description
  if (parsed.return_shipping_paid_by !== undefined) payload.return_shipping_paid_by = parsed.return_shipping_paid_by
  if (parsed.policy_details !== undefined) payload.policy_details = parsed.policy_details
  if (parsed.is_active !== undefined) payload.is_active = parsed.is_active

  return payload
}

function mapListingPolicies(rows: Array<{ created_at: string; return_policies: ReturnPolicy | ReturnPolicy[] }>): AssignedReturnPolicy[] {
  return (rows ?? [])
    .map((item) => {
      const policy = Array.isArray(item.return_policies)
        ? item.return_policies[0]
        : item.return_policies
      if (!policy) return null
      return {
        ...policy,
        assigned_at: item.created_at,
      }
    })
    .filter((row): row is AssignedReturnPolicy => row !== null)
}

// ============= SHOP POLICIES =============

export async function createReturnPolicy(
  shopId: string,
  input: ReturnPolicyInput,
  context?: ReturnPolicyAccessContext,
): Promise<ReturnPolicyServiceResponse<ReturnPolicy>> {
  try {
    const validation = validateReturnPolicyInput(input)
    if (!validation.isValid) {
      throw new ReturnPolicyError(
        RETURN_POLICY_ERROR_CODES.INVALID_INPUT,
        validation.fieldErrors[0],
      )
    }

    await assertShopAccess(shopId, context)

    const { data: policy, error } = await supabase
      .from('return_policies')
      .insert(toInsertPayload(shopId, input))
      .select('*')
      .single()

    if (error) throw error
    return ok(policy, RETURN_POLICY_SUCCESS_MESSAGES.CREATED)
  } catch (error) {
    return fail(error, 'Failed to create return policy.')
  }
}

export async function getReturnPolicies(
  shopId: string,
): Promise<ReturnPolicyServiceResponse<ReturnPolicy[]>> {
  try {
    if (!shopId) {
      throw new ReturnPolicyError(RETURN_POLICY_ERROR_CODES.INVALID_INPUT, 'Shop ID is required.')
    }

    const { data, error } = await supabase
      .from('return_policies')
      .select('*')
      .eq('shop_id', shopId)
      .order('is_default', { ascending: false })
      .order('created_at', { ascending: false })

    if (error) throw error
    return ok(data ?? [])
  } catch (error) {
    return fail(error, 'Failed to load return policies.')
  }
}

export async function updateReturnPolicy(
  policyId: string,
  input: Partial<ReturnPolicyInput>,
  context?: ReturnPolicyAccessContext,
): Promise<ReturnPolicyServiceResponse<ReturnPolicy>> {
  try {
    await assertPolicyAccess(policyId, context)

    const payload = toUpdatePayload(input)
    if (Object.keys(payload).length === 0) {
      throw new ReturnPolicyError(
        RETURN_POLICY_ERROR_CODES.INVALID_INPUT,
        'At least one field is required to update a return policy.',
      )
    }

    const { data: policy, error } = await supabase
      .from('return_policies')
      .update(payload)
      .eq('id', policyId)
      .select('*')
      .single()

    if (error) throw error
    return ok(policy, RETURN_POLICY_SUCCESS_MESSAGES.UPDATED)
  } catch (error) {
    return fail(error, 'Failed to update return policy.')
  }
}

export async function deleteReturnPolicy(
  policyId: string,
  context?: ReturnPolicyAccessContext,
): Promise<ReturnPolicyServiceResponse<DeleteReturnPolicyResult>> {
  try {
    const existing = await assertPolicyAccess(policyId, context)

    const { error } = await supabase.from('return_policies').delete().eq('id', policyId)
    if (error) throw error

    return ok(
      {
        policyId: existing.id,
        policyName: existing.policy_name,
        shopId: existing.shop_id,
      },
      `Return policy "${existing.policy_name}" deleted successfully.`,
    )
  } catch (error) {
    return fail(error, 'Failed to delete return policy.')
  }
}

// ============= LISTING ASSIGNMENTS =============

export async function assignReturnPolicyToListing(
  listingId: string,
  returnPolicyId: string,
  context?: ReturnPolicyAccessContext,
): Promise<ReturnPolicyServiceResponse<RemoveReturnPolicyResult>> {
  try {
    const userId = await resolveUserId(context?.userId)

    const [listingResult, policyResult] = await Promise.all([
      supabase
        .from('listings')
        .select('id, shop_id, shops!inner(user_id)')
        .eq('id', listingId)
        .maybeSingle(),
      supabase
        .from('return_policies')
        .select('id, shop_id, shops!inner(user_id)')
        .eq('id', returnPolicyId)
        .maybeSingle(),
    ])

    const listing = listingResult.data
    const policy = policyResult.data

    if (listingResult.error || !listing) {
      throw new ReturnPolicyError(RETURN_POLICY_ERROR_CODES.LISTING_ACCESS_DENIED)
    }

    if (policyResult.error || !policy) {
      throw new ReturnPolicyError(RETURN_POLICY_ERROR_CODES.POLICY_ACCESS_DENIED)
    }

    const listingShop = Array.isArray(listing.shops) ? listing.shops[0] : listing.shops
    const policyShop = Array.isArray(policy.shops) ? policy.shops[0] : policy.shops

    if (!canManageShop(listingShop as { user_id: string }, userId, context?.role)) {
      throw new ReturnPolicyError(RETURN_POLICY_ERROR_CODES.LISTING_ACCESS_DENIED)
    }

    if (!canManageShop(policyShop as { user_id: string }, userId, context?.role)) {
      throw new ReturnPolicyError(RETURN_POLICY_ERROR_CODES.POLICY_ACCESS_DENIED)
    }

    if (listing.shop_id !== policy.shop_id) {
      throw new ReturnPolicyError(RETURN_POLICY_ERROR_CODES.SHOP_MISMATCH)
    }

    const { error } = await supabase.from('listing_return_policies').insert({
      listing_id: listingId,
      return_policy_id: returnPolicyId,
    })

    if (error) {
      if (error.code === '23505') {
        throw new ReturnPolicyError(RETURN_POLICY_ERROR_CODES.DUPLICATE)
      }
      throw error
    }

    return ok({ listingId, returnPolicyId }, RETURN_POLICY_SUCCESS_MESSAGES.ASSIGNED)
  } catch (error) {
    return fail(error, 'Failed to assign return policy to listing.')
  }
}

export async function removeReturnPolicyFromListing(
  listingId: string,
  returnPolicyId: string,
  context?: ReturnPolicyAccessContext,
): Promise<ReturnPolicyServiceResponse<RemoveReturnPolicyResult>> {
  try {
    const userId = await resolveUserId(context?.userId)

    const { data: mapping, error: checkError } = await supabase
      .from('listing_return_policies')
      .select(
        `
        listing_id,
        return_policy_id,
        listings!inner(shop_id, shops!inner(user_id))
      `,
      )
      .eq('listing_id', listingId)
      .eq('return_policy_id', returnPolicyId)
      .maybeSingle()

    if (checkError || !mapping) {
      throw new ReturnPolicyError(RETURN_POLICY_ERROR_CODES.MAPPING_ACCESS_DENIED)
    }

    const listing = Array.isArray(mapping.listings) ? mapping.listings[0] : mapping.listings
    const shop = listing && (Array.isArray(listing.shops) ? listing.shops[0] : listing.shops)

    if (!canManageShop(shop as { user_id: string }, userId, context?.role)) {
      throw new ReturnPolicyError(RETURN_POLICY_ERROR_CODES.MAPPING_ACCESS_DENIED)
    }

    const { error } = await supabase
      .from('listing_return_policies')
      .delete()
      .eq('listing_id', listingId)
      .eq('return_policy_id', returnPolicyId)

    if (error) throw error
    return ok({ listingId, returnPolicyId }, RETURN_POLICY_SUCCESS_MESSAGES.REMOVED)
  } catch (error) {
    return fail(error, 'Failed to remove return policy from listing.')
  }
}

export async function getListingReturnPolicies(
  listingId: string,
): Promise<ReturnPolicyServiceResponse<AssignedReturnPolicy[]>> {
  try {
    if (!listingId) {
      throw new ReturnPolicyError(RETURN_POLICY_ERROR_CODES.INVALID_INPUT, 'Listing ID is required.')
    }

    const { data, error } = await supabase
      .from('listing_return_policies')
      .select(
        `
        created_at,
        return_policies!inner(
          id,
          shop_id,
          policy_name,
          return_window_days,
          accepts_returns,
          accepts_exchanges,
          accepts_refunds,
          return_shipping_paid_by,
          condition_description,
          policy_details,
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
        (data ?? []) as Array<{ created_at: string; return_policies: ReturnPolicy | ReturnPolicy[] }>,
      ),
    )
  } catch (error) {
    return fail(error, 'Failed to load listing return policies.')
  }
}
