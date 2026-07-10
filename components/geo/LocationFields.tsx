import { useMemo } from 'react'

import { GeoSelectField } from '~/components/geo/GeoSelectField'
import { useGeoCities } from '~/components/geo/useGeoCities'
import { Field, Input, Spinner, Text, XStack, YStack } from '~/components/ui'
import {
  countryToOption,
  getAllGeoCountries,
  getCountryName,
  getPostalCodeLabel,
  getPostalCodePlaceholder,
  getStatesOfCountry,
  matchStateName,
  resolveCountryCode,
  stateToOption,
  type GeoLocationParts,
} from '~/lib/geo'
import { useAppUi } from '~/lib/theme/useAppUi'

export type LocationFieldsValue = GeoLocationParts

type LocationFieldsProps = {
  value: LocationFieldsValue
  onChange: (value: LocationFieldsValue) => void
  showPostal?: boolean
  disabled?: boolean
  postalRequired?: boolean
}

export function LocationFields({
  value,
  onChange,
  showPostal = true,
  disabled = false,
  postalRequired = true,
}: LocationFieldsProps) {
  const ui = useAppUi()
  const countryCode = resolveCountryCode(value.countryCode)

  const countryOptions = useMemo(
    () => getAllGeoCountries().map(countryToOption),
    [],
  )
  const stateOptions = useMemo(
    () => getStatesOfCountry(countryCode).map(stateToOption),
    [countryCode],
  )
  const { options: cityOptions, isLoading: citiesLoading } = useGeoCities(
    countryCode,
    value.stateName,
  )

  const hasStates = stateOptions.length > 0
  const hasCities = cityOptions.length > 0

  function patch(partial: Partial<LocationFieldsValue>) {
    onChange({ ...value, ...partial })
  }

  function handleCountryChange(nextCountryCode: string) {
    onChange({
      countryCode: nextCountryCode,
      stateName: '',
      city: '',
      postalCode: value.postalCode ?? '',
    })
  }

  function handleStateChange(nextStateName: string) {
    onChange({
      ...value,
      stateName: matchStateName(countryCode, nextStateName),
      city: '',
    })
  }

  return (
    <YStack gap="$3" width="100%">
      <GeoSelectField
        label="Country"
        value={countryCode}
        displayValue={getCountryName(countryCode)}
        placeholder="Select country"
        options={countryOptions}
        onChange={handleCountryChange}
        disabled={disabled}
        sheetTitle="Select country"
        searchPlaceholder="Search countries"
        showFlags
        required
      />

      {hasStates ? (
        <GeoSelectField
          label="State / Province"
          value={value.stateName}
          placeholder="Select state"
          options={stateOptions}
          onChange={handleStateChange}
          disabled={disabled}
          sheetTitle="Select state"
          searchPlaceholder="Search states"
          required
        />
      ) : (
        <Field label="State / Province" required>
          <Input
            value={value.stateName}
            onChangeText={(text) => patch({ stateName: text })}
            placeholder="State or region"
            backgroundColor={ui.surface}
            editable={!disabled}
          />
        </Field>
      )}

      {hasCities ? (
        <YStack gap="$1.5" width="100%">
          <GeoSelectField
            label="City"
            value={value.city}
            placeholder={citiesLoading ? 'Loading cities…' : 'Select city'}
            options={cityOptions}
            onChange={(nextCity) => patch({ city: nextCity })}
            disabled={disabled || !value.stateName.trim() || citiesLoading}
            sheetTitle="Select city"
            searchPlaceholder="Search cities"
            required
          />
          {citiesLoading ? (
            <XStack alignItems="center" gap="$2">
              <Spinner size="small" />
              <Text fontSize={12} color={ui.textMuted}>
                Loading cities…
              </Text>
            </XStack>
          ) : null}
        </YStack>
      ) : (
        <Field label="City" required>
          <Input
            value={value.city}
            onChangeText={(text) => patch({ city: text })}
            placeholder="City"
            backgroundColor={ui.surface}
            editable={!disabled}
          />
        </Field>
      )}

      {showPostal ? (
        <Field label={getPostalCodeLabel(countryCode)} required={postalRequired}>
          <Input
            value={value.postalCode ?? ''}
            onChangeText={(text) => patch({ postalCode: text })}
            placeholder={getPostalCodePlaceholder(countryCode)}
            backgroundColor={ui.surface}
            autoCapitalize="characters"
            editable={!disabled}
          />
        </Field>
      ) : null}
    </YStack>
  )
}

export function LocationFieldsRow({
  value,
  onChange,
  showPostal = true,
  disabled = false,
  postalRequired = true,
}: LocationFieldsProps) {
  return (
    <XStack gap="$3" flexWrap="wrap" width="100%">
      <YStack flex={1} minWidth={280} width="100%">
        <LocationFields
          value={value}
          onChange={onChange}
          showPostal={showPostal}
          disabled={disabled}
          postalRequired={postalRequired}
        />
      </YStack>
    </XStack>
  )
}
