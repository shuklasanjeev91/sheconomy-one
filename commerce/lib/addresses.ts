/**
 * Backward-compatible commerce helpers.
 *
 * New code should import from `~/lib/address` and dispatch thunks from
 * `address.store`. These thin wrappers remain for checkout and legacy screens
 * that still call the commerce layer directly.
 */

import * as addressService from '~/lib/address/address.service'
import type { Address, AddressInput } from '~/lib/address/address.type'
import { formatAddressMultiline } from '~/lib/address/address.utils'
import { validateAddressData } from '~/lib/address/address.validation'
import { getCountryName } from '~/lib/geo'
import type { Tables } from '~/lib/supabase'

export const ADDRESS_LABEL_OPTIONS = ['Home', 'Work', 'Other'] as const
export type AddressLabel = (typeof ADDRESS_LABEL_OPTIONS)[number]

/** Compact row shape used by checkout and the legacy address form. */
export type UserAddress = Pick<
  Address,
  | 'id'
  | 'address_label'
  | 'address_line_1'
  | 'address_line_2'
  | 'address_type'
  | 'city'
  | 'country'
  | 'is_default'
  | 'postal_code'
  | 'state'
>

export type { AddressInput }

export function validateAddressInput(input: AddressInput): string | null {
  const result = validateAddressData({
    address_line_1: input.address_line_1,
    address_line_2: input.address_line_2 ?? '',
    city: input.city,
    state: input.state,
    postal_code: input.postal_code,
    country: input.country ?? '',
    address_type: input.address_type ?? 'shipping',
    is_default: input.is_default ?? false,
    address_label: input.address_label ?? '',
  })
  if (!result.isValid) return Object.values(result.errors)[0] ?? 'Invalid address.'
  return null
}

export function formatAddressBlock(address: UserAddress): string {
  const countryName = getCountryName(address.country, address.country)
  const line1 = [address.address_line_1, address.address_line_2].filter(Boolean).join(', ')
  const line2 = `${address.city}, ${address.state} ${address.postal_code}`
  const line3 = countryName
  return [line1, line2, line3].filter(Boolean).join('\n')
}

export async function fetchUserAddresses(userId?: string): Promise<{
  addresses: UserAddress[]
  error: string | null
}> {
  const response = await addressService.getUserAddresses(userId)
  return {
    addresses: (response.data ?? []) as UserAddress[],
    error: response.error,
  }
}

export async function createUserAddress(
  userId: string,
  input: AddressInput,
  options?: { isDefault?: boolean },
): Promise<{ address: Tables<'addresses'> | null; error: string | null }> {
  const response = await addressService.createAddress(
    {
      ...input,
      address_line_2: input.address_line_2 ?? '',
      address_type: input.address_type ?? 'shipping',
      is_default: options?.isDefault ?? false,
      address_label: input.address_label ?? 'Home',
    },
    userId,
  )
  return { address: response.data, error: response.error }
}

export async function updateUserAddress(
  userId: string,
  addressId: string,
  input: AddressInput,
): Promise<{ address: Tables<'addresses'> | null; error: string | null }> {
  void userId
  const response = await addressService.updateAddress(addressId, {
    ...input,
    address_line_2: input.address_line_2 ?? '',
    address_type: input.address_type ?? 'shipping',
    address_label: input.address_label ?? 'Home',
  })
  return { address: response.data, error: response.error }
}

export async function deleteUserAddress(
  userId: string,
  addressId: string,
): Promise<{ error: string | null }> {
  void userId
  const response = await addressService.deleteAddress(addressId)
  return { error: response.error }
}

export async function setDefaultUserAddress(
  userId: string,
  addressId: string,
): Promise<{ error: string | null }> {
  void userId
  const response = await addressService.setDefaultAddress(addressId)
  return { error: response.error }
}

/** Re-export multiline formatter under the legacy name. */
export { formatAddressMultiline as formatAddressString }
