import { useMemo } from 'react'

import type { AddressInput } from '~/commerce/lib/addresses'
import { LocationFields, type LocationFieldsValue } from '~/components/geo/LocationFields'
import {
  formatGeoLocation,
  geoPartsFromAddressFields,
  parseGeoLocationText,
  type GeoLocationParts,
} from '~/lib/geo'

type LocationPickerFieldProps = {
  value: string
  onChange: (value: string) => void
  label?: string
  showPostal?: boolean
  disabled?: boolean
}

export function LocationPickerField({
  value,
  onChange,
  label = 'Location',
  showPostal = false,
  disabled = false,
}: LocationPickerFieldProps) {
  const parts = useMemo(() => {
    const parsed = parseGeoLocationText(value)
    return {
      countryCode: parsed.countryCode ?? geoPartsFromAddressFields({ country: 'IN' }).countryCode,
      stateName: parsed.stateName ?? '',
      city: parsed.city ?? '',
      postalCode: parsed.postalCode ?? '',
    } satisfies LocationFieldsValue
  }, [value])

  function handleChange(next: GeoLocationParts) {
    onChange(formatGeoLocation(next))
  }

  return (
    <LocationFields
      value={parts}
      onChange={handleChange}
      showPostal={showPostal}
      disabled={disabled}
    />
  )
}

export function addressGeoFromInput(input: AddressInput): LocationFieldsValue {
  return geoPartsFromAddressFields(input)
}

export function patchAddressFromGeo(input: AddressInput, geo: LocationFieldsValue): AddressInput {
  return {
    ...input,
    country: geo.countryCode,
    state: geo.stateName,
    city: geo.city,
    postal_code: geo.postalCode ?? '',
  }
}
