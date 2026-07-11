import { supabase } from '~/lib/supabase/client'
import type { Tables } from '~/lib/supabase'
import { getCountryName, validateGeoLocationParts, resolveCountryCode } from '~/lib/geo'

export const ADDRESS_LABEL_OPTIONS = ['Home', 'Work', 'Other'] as const
export type AddressLabel = (typeof ADDRESS_LABEL_OPTIONS)[number]

export type UserAddress = {
  id: string
  address_label: string
  address_line_1: string
  address_line_2: string
  address_type: string
  city: string
  country: string
  is_default: boolean
  postal_code: string
  state: string
}

export type AddressInput = {
  address_line_1: string
  address_line_2?: string
  city: string
  state: string
  postal_code: string
  country?: string
  address_label?: string
}

export function validateAddressInput(input: AddressInput): string | null {
  if (!input.address_line_1.trim() || input.address_line_1.trim().length < 3) {
    return 'Enter a valid street address.'
  }

  return validateGeoLocationParts(
    {
      countryCode: resolveCountryCode(input.country),
      stateName: input.state,
      city: input.city,
      postalCode: input.postal_code,
    },
    { requirePostal: true, requireState: true },
  )
}

export function formatAddressBlock(address: UserAddress): string {
  const line1 = [address.address_line_1, address.address_line_2].filter(Boolean).join(', ')
  const line2 = `${address.city}, ${address.state} ${address.postal_code}`
  const line3 = getCountryName(address.country, address.country)
  return [line1, line2, line3].filter(Boolean).join('\n')
}

export async function fetchUserAddresses(userId?: string): Promise<{
  addresses: UserAddress[]
  error: string | null
}> {
  const { data, error } = await supabase.rpc('get_user_addresses', {
    target_user_id: userId,
  })

  if (error) {
    return { addresses: [], error: error.message }
  }

  return { addresses: data ?? [], error: null }
}

async function clearDefaultAddresses(userId: string) {
  await supabase.from('addresses').update({ is_default: false }).eq('user_id', userId)
}

export async function createUserAddress(
  userId: string,
  input: AddressInput,
  options?: { isDefault?: boolean },
): Promise<{ address: Tables<'addresses'> | null; error: string | null }> {
  const validationError = validateAddressInput(input)
  if (validationError) {
    return { address: null, error: validationError }
  }

  const { addresses } = await fetchUserAddresses(userId)
  const shouldDefault = options?.isDefault ?? addresses.length === 0

  if (shouldDefault) {
    await clearDefaultAddresses(userId)
  }

  const { data, error } = await supabase
    .from('addresses')
    .insert({
      user_id: userId,
      address_line_1: input.address_line_1.trim(),
      address_line_2: input.address_line_2?.trim() || null,
      city: input.city.trim(),
      state: input.state.trim(),
      postal_code: input.postal_code.replace(/\s/g, ''),
      country: resolveCountryCode(input.country),
      address_label: input.address_label?.trim() || 'Home',
      address_type: 'shipping',
      is_default: shouldDefault,
    })
    .select('*')
    .single()

  if (error) {
    return { address: null, error: error.message }
  }

  return { address: data, error: null }
}

export async function updateUserAddress(
  userId: string,
  addressId: string,
  input: AddressInput,
): Promise<{ address: Tables<'addresses'> | null; error: string | null }> {
  const validationError = validateAddressInput(input)
  if (validationError) {
    return { address: null, error: validationError }
  }

  const { data, error } = await supabase
    .from('addresses')
    .update({
      address_line_1: input.address_line_1.trim(),
      address_line_2: input.address_line_2?.trim() || null,
      city: input.city.trim(),
      state: input.state.trim(),
      postal_code: input.postal_code.replace(/\s/g, ''),
      country: resolveCountryCode(input.country),
      address_label: input.address_label?.trim() || 'Home',
    })
    .eq('id', addressId)
    .eq('user_id', userId)
    .select('*')
    .single()

  if (error) {
    return { address: null, error: error.message }
  }

  return { address: data, error: null }
}

export async function deleteUserAddress(
  userId: string,
  addressId: string,
): Promise<{ error: string | null }> {
  const { data: target, error: fetchError } = await supabase
    .from('addresses')
    .select('id, is_default')
    .eq('id', addressId)
    .eq('user_id', userId)
    .maybeSingle()

  if (fetchError) {
    return { error: fetchError.message }
  }
  if (!target) {
    return { error: 'Address not found.' }
  }

  const { error } = await supabase
    .from('addresses')
    .delete()
    .eq('id', addressId)
    .eq('user_id', userId)

  if (error) {
    return { error: error.message }
  }

  if (target.is_default) {
    const { data: remaining } = await supabase
      .from('addresses')
      .select('id')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (remaining?.id) {
      await setDefaultUserAddress(userId, remaining.id)
    }
  }

  return { error: null }
}

export async function setDefaultUserAddress(
  userId: string,
  addressId: string,
): Promise<{ error: string | null }> {
  await clearDefaultAddresses(userId)

  const { error } = await supabase
    .from('addresses')
    .update({ is_default: true })
    .eq('id', addressId)
    .eq('user_id', userId)

  return { error: error?.message ?? null }
}
