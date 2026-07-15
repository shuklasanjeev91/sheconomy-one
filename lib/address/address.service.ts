/**
 * Address service — typed data-access layer for user/vendor/admin address flows.
 *
 * Ported from the legacy `address-service.js`. All reads and writes go through
 * Supabase RPC / table access; row visibility is enforced by RLS. Admin callers
 * pass `targetUserId` to load or manage another user's addresses.
 *
 * Components should dispatch thunks from `address.store` rather than calling
 * these functions directly.
 */

import { getDefaultCountryCode, resolveCountryCode } from '~/lib/geo'
import { supabase } from '~/lib/supabase'

import { toFriendlyAddressError } from './address.errors'
import { normalizeAddressInput, validateAddressData } from './address.validation'
import {
  ADDRESS_TYPE,
  type Address,
  type AddressActionResult,
  type AddressFormData,
  type AddressInput,
  type AddressServiceResponse,
  type AddressStats,
  type AddressType,
  type AddressUpdate,
} from './address.type'
import { computeAddressStats } from './address.utils'

// ============= RESPONSE HELPERS =============

function ok<T>(data: T): AddressServiceResponse<T> {
  return { data, error: null, success: true }
}

function fail<T>(error: unknown, fallback?: string): AddressServiceResponse<T> {
  return { data: null, error: toFriendlyAddressError(error, fallback), success: false }
}

async function resolveUserId(userId?: string | null): Promise<string | null> {
  if (userId) return userId
  const { data } = await supabase.auth.getUser()
  return data.user?.id ?? null
}

function parseActionResult(payload: unknown, fallback: string): AddressActionResult {
  if (payload && typeof payload === 'object' && 'success' in payload) {
    const row = payload as { success?: boolean; message?: string }
    return {
      success: Boolean(row.success),
      message: row.message ?? (row.success ? 'Done.' : fallback),
    }
  }
  return { success: false, message: fallback }
}

function toDbRow(input: AddressInput, userId: string): Omit<Address, 'id' | 'created_at' | 'updated_at' | 'address_metadata'> {
  return {
    user_id: userId,
    address_line_1: input.address_line_1.trim(),
    address_line_2: input.address_line_2?.trim() || null,
    city: input.city.trim(),
    state: input.state.trim(),
    postal_code: input.postal_code.replace(/\s/g, ''),
    country: resolveCountryCode(input.country ?? getDefaultCountryCode()),
    address_type: input.address_type ?? ADDRESS_TYPE.HOME,
    is_default: Boolean(input.is_default),
    address_label: input.address_label?.trim() || null,
  }
}

// ============= READ =============

/** All addresses for the current user, or a specific user when admin. */
export async function getUserAddresses(
  targetUserId?: string | null,
): Promise<AddressServiceResponse<Address[]>> {
  try {
    const { data, error } = await supabase.rpc('get_user_addresses', {
      target_user_id: targetUserId ?? undefined,
    })

    if (error) return fail(error)
    return ok((data as Address[]) ?? [])
  } catch (error) {
    return fail(error, 'Failed to load addresses.')
  }
}

/** Addresses filtered by type via RPC. */
export async function getAddressesByType(
  addressType: AddressType,
  targetUserId?: string | null,
): Promise<AddressServiceResponse<Address[]>> {
  try {
    const { data, error } = await supabase.rpc('get_addresses_by_type', {
      target_user_id: targetUserId ?? undefined,
      address_type_filter: addressType,
    })

    if (error) return fail(error)
    return ok((data as Address[]) ?? [])
  } catch (error) {
    return fail(error, 'Failed to load addresses for that type.')
  }
}

/** Default address for a given type (first `is_default` match). */
export async function getDefaultAddress(
  addressType: AddressType,
  targetUserId?: string | null,
): Promise<AddressServiceResponse<Address | null>> {
  const response = await getAddressesByType(addressType, targetUserId)
  if (!response.success || !response.data) return { ...response, data: null }
  return ok(response.data.find((row) => row.is_default) ?? null)
}

/** Single address by primary key. */
export async function getAddressById(addressId: string): Promise<AddressServiceResponse<Address | null>> {
  if (!addressId) return fail('Address ID is required.')

  try {
    const { data, error } = await supabase.from('addresses').select('*').eq('id', addressId).maybeSingle()
    if (error) return fail(error)
    return ok(data)
  } catch (error) {
    return fail(error, 'Failed to load that address.')
  }
}

export async function getShippingAddresses(
  targetUserId?: string | null,
): Promise<AddressServiceResponse<Address[]>> {
  return getAddressesByType(ADDRESS_TYPE.SHIPPING, targetUserId)
}

export async function getBillingAddresses(
  targetUserId?: string | null,
): Promise<AddressServiceResponse<Address[]>> {
  return getAddressesByType(ADDRESS_TYPE.BILLING, targetUserId)
}

export async function getBusinessAddresses(
  targetUserId?: string | null,
): Promise<AddressServiceResponse<Address[]>> {
  return getAddressesByType(ADDRESS_TYPE.BUSINESS, targetUserId)
}

/** Server-side search (loads all rows then filters — same as legacy). */
export async function searchAddresses(
  searchTerm: string,
  targetUserId?: string | null,
): Promise<AddressServiceResponse<Address[]>> {
  const term = searchTerm.trim()
  if (!term || term.length < 2) return ok([])

  const response = await getUserAddresses(targetUserId)
  if (!response.success || !response.data) return response

  const lower = term.toLowerCase()
  const filtered = response.data.filter(
    (address) =>
      address.city?.toLowerCase().includes(lower) ||
      address.state?.toLowerCase().includes(lower) ||
      address.address_line_1?.toLowerCase().includes(lower) ||
      address.address_label?.toLowerCase().includes(lower),
  )

  return ok(filtered)
}

/** Derived stats from the current user's address list. */
export async function getAddressStats(
  targetUserId?: string | null,
): Promise<AddressServiceResponse<AddressStats>> {
  const response = await getUserAddresses(targetUserId)
  if (!response.success || !response.data) {
    return { data: null, error: response.error, success: false }
  }
  return ok(computeAddressStats(response.data))
}

// ============= WRITE =============

/** Create a new address for the signed-in user. */
export async function createAddress(
  input: AddressFormData | AddressInput,
  userId?: string | null,
): Promise<AddressServiceResponse<Address>> {
  const validation = validateAddressData(input)
  if (!validation.isValid) {
    const firstError = Object.values(validation.errors)[0]
    return fail(firstError ?? 'Invalid address details.')
  }

  const resolvedUserId = await resolveUserId(userId)
  if (!resolvedUserId) return fail('Please sign in to add an address.')

  try {
    const normalised = normalizeAddressInput(input)
    const row = toDbRow(normalised, resolvedUserId)

    const { data, error } = await supabase.from('addresses').insert(row).select('*').single()
    if (error) return fail(error)
    return ok(data)
  } catch (error) {
    return fail(error, 'Failed to create address.')
  }
}

/** Patch an existing address. */
export async function updateAddress(
  addressId: string,
  input: AddressFormData | AddressInput,
): Promise<AddressServiceResponse<Address>> {
  if (!addressId) return fail('Address ID is required.')

  const validation = validateAddressData(input)
  if (!validation.isValid) {
    const firstError = Object.values(validation.errors)[0]
    return fail(firstError ?? 'Invalid address details.')
  }

  try {
    const normalised = normalizeAddressInput(input)
    const patch: AddressUpdate = {}

    if (normalised.address_line_1) patch.address_line_1 = normalised.address_line_1
    if (normalised.address_line_2 !== undefined) patch.address_line_2 = normalised.address_line_2
    if (normalised.city) patch.city = normalised.city
    if (normalised.state) patch.state = normalised.state
    if (normalised.postal_code) patch.postal_code = normalised.postal_code
    if (normalised.country) patch.country = normalised.country
    if (normalised.address_type) patch.address_type = normalised.address_type
    if (normalised.is_default !== undefined) patch.is_default = normalised.is_default
    if (normalised.address_label !== undefined) patch.address_label = normalised.address_label

    const { data, error } = await supabase
      .from('addresses')
      .update(patch)
      .eq('id', addressId)
      .select('*')
      .single()

    if (error) return fail(error)
    return ok(data)
  } catch (error) {
    return fail(error, 'Failed to update address.')
  }
}

/** Delete via secure RPC (owner or admin). */
export async function deleteAddress(addressId: string): Promise<AddressServiceResponse<AddressActionResult>> {
  if (!addressId) return fail('Address ID is required.')

  try {
    const { data, error } = await supabase.rpc('delete_address', { address_id: addressId })
    if (error) return fail(error)

    const result = parseActionResult(data, 'Failed to delete address.')
    if (!result.success) return fail(result.message)
    return ok(result)
  } catch (error) {
    return fail(error, 'Failed to delete address.')
  }
}

/** Mark an address as default for its type via RPC. */
export async function setDefaultAddress(
  addressId: string,
): Promise<AddressServiceResponse<AddressActionResult>> {
  if (!addressId) return fail('Address ID is required.')

  try {
    const { data, error } = await supabase.rpc('set_default_address', { address_id: addressId })
    if (error) return fail(error)

    const result = parseActionResult(data, 'Failed to set default address.')
    if (!result.success) return fail(result.message)
    return ok(result)
  } catch (error) {
    return fail(error, 'Failed to set default address.')
  }
}

/** Insert multiple addresses in one call (checkout import, onboarding). */
export async function createBulkAddresses(
  inputs: Array<AddressFormData | AddressInput>,
  userId?: string | null,
): Promise<AddressServiceResponse<Address[]>> {
  if (!Array.isArray(inputs) || inputs.length === 0) {
    return fail('Provide at least one address to import.')
  }

  const resolvedUserId = await resolveUserId(userId)
  if (!resolvedUserId) return fail('Please sign in to add addresses.')

  const rows: ReturnType<typeof toDbRow>[] = []
  for (const input of inputs) {
    const validation = validateAddressData(input)
    if (!validation.isValid) {
      const firstError = Object.values(validation.errors)[0]
      return fail(firstError ?? 'One of the addresses is invalid.')
    }
    rows.push(toDbRow(normalizeAddressInput(input), resolvedUserId))
  }

  try {
    const { data, error } = await supabase.from('addresses').insert(rows).select('*')
    if (error) return fail(error)
    return ok(data ?? [])
  } catch (error) {
    return fail(error, 'Failed to import addresses.')
  }
}
