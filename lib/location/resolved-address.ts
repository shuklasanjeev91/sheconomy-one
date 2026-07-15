import type { AddressFormData } from '~/lib/address/address.type'
import { ADDRESS_TYPE } from '~/lib/address/address.type'
import { resolveCountryCode } from '~/lib/geo'

import type { ResolvedAddress } from './types'

/** Map Places / reverse-geocode result into address form buffer fields. */
export function resolvedAddressToFormPatch(
  resolved: ResolvedAddress,
  current?: Partial<AddressFormData>,
): Partial<AddressFormData> & {
  latitude: number | null
  longitude: number | null
  place_id: string | null
  source: ResolvedAddress['source']
} {
  return {
    address_line_1: resolved.address_line_1 || current?.address_line_1 || '',
    address_line_2: resolved.address_line_2 || current?.address_line_2 || '',
    city: resolved.city || current?.city || '',
    state: resolved.state || current?.state || '',
    postal_code: resolved.postal_code || current?.postal_code || '',
    country: resolveCountryCode(resolved.country || current?.country || ''),
    address_type: current?.address_type ?? ADDRESS_TYPE.SHIPPING,
    is_default: current?.is_default ?? false,
    address_label: current?.address_label ?? '',
    latitude: resolved.latitude,
    longitude: resolved.longitude,
    place_id: resolved.place_id,
    source: resolved.source,
  }
}

export function emptyResolvedAddress(
  partial?: Partial<ResolvedAddress>,
): ResolvedAddress {
  return {
    address_line_1: '',
    address_line_2: '',
    city: '',
    state: '',
    postal_code: '',
    country: '',
    latitude: null,
    longitude: null,
    place_id: null,
    formatted: null,
    source: 'manual',
    ...partial,
  }
}
