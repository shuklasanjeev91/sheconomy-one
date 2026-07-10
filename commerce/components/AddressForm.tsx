import {
  ADDRESS_LABEL_OPTIONS,
  type AddressInput,
  type AddressLabel,
} from '~/commerce/lib/addresses'
import {
  LocationFields,
  addressGeoFromInput,
  patchAddressFromGeo,
} from '~/components/geo'
import { Button, Field, Input, Switch, Text, XStack, YStack } from '~/components/ui'
import { createDefaultGeoLocation } from '~/lib/geo'
import { useAppUi } from '~/lib/theme/useAppUi'

export function createEmptyAddressInput(): AddressInput {
  const geo = createDefaultGeoLocation()
  return {
    address_line_1: '',
    address_line_2: '',
    city: geo.city,
    state: geo.stateName,
    postal_code: geo.postalCode ?? '',
    country: geo.countryCode,
    address_label: 'Home',
  }
}

export const EMPTY_ADDRESS_INPUT: AddressInput = createEmptyAddressInput()

type AddressFormProps = {
  value: AddressInput
  onChange: (value: AddressInput) => void
  onSubmit: () => void
  onCancel?: () => void
  submitLabel: string
  isSubmitting?: boolean
  showDefaultToggle?: boolean
  isDefault?: boolean
  onDefaultChange?: (value: boolean) => void
}

export function AddressForm({
  value,
  onChange,
  onSubmit,
  onCancel,
  submitLabel,
  isSubmitting = false,
  showDefaultToggle = false,
  isDefault = false,
  onDefaultChange,
}: AddressFormProps) {
  const ui = useAppUi()

  function patch(partial: Partial<AddressInput>) {
    onChange({ ...value, ...partial })
  }

  const geoValue = addressGeoFromInput(value)

  return (
    <YStack gap="$3" width="100%">
      <Text fontSize={13} fontWeight="600" color={ui.textSecondary}>
        Address label
      </Text>
      <XStack gap="$2" flexWrap="wrap">
        {ADDRESS_LABEL_OPTIONS.map((label) => (
          <Button
            key={label}
            tone={(value.address_label ?? 'Home') === label ? 'primary' : 'outline'}
            size="$2.5"
            borderRadius={999}
            onPress={() => patch({ address_label: label })}
          >
            {label}
          </Button>
        ))}
      </XStack>

      <Field label="Address line 1">
        <Input
          value={value.address_line_1}
          onChangeText={(text) => patch({ address_line_1: text })}
          placeholder="House no., building, street"
          backgroundColor={ui.surface}
        />
      </Field>
      <Field label="Address line 2 (optional)">
        <Input
          value={value.address_line_2 ?? ''}
          onChangeText={(text) => patch({ address_line_2: text })}
          placeholder="Area, landmark"
          backgroundColor={ui.surface}
        />
      </Field>

      <LocationFields
        value={geoValue}
        onChange={(geo) => onChange(patchAddressFromGeo(value, geo))}
      />

      {showDefaultToggle && onDefaultChange ? (
        <XStack alignItems="center" justifyContent="space-between" gap="$3">
          <Text fontSize={14} color={ui.text}>
            Set as default delivery address
          </Text>
          <Switch checked={isDefault} onCheckedChange={onDefaultChange} />
        </XStack>
      ) : null}

      <XStack gap="$2" flexWrap="wrap">
        <Button
          tone="primary"
          size="$4"
          borderRadius={999}
          disabled={isSubmitting}
          onPress={onSubmit}
        >
          {isSubmitting ? 'Saving…' : submitLabel}
        </Button>
        {onCancel ? (
          <Button tone="outline" size="$4" borderRadius={999} disabled={isSubmitting} onPress={onCancel}>
            Cancel
          </Button>
        ) : null}
      </XStack>
    </YStack>
  )
}

export function addressInputFromUserAddress(address: {
  address_line_1: string
  address_line_2: string
  city: string
  state: string
  postal_code: string
  country: string
  address_label: string
}): AddressInput {
  return {
    address_line_1: address.address_line_1,
    address_line_2: address.address_line_2,
    city: address.city,
    state: address.state,
    postal_code: address.postal_code,
    country: address.country,
    address_label: (ADDRESS_LABEL_OPTIONS as readonly string[]).includes(address.address_label)
      ? (address.address_label as AddressLabel)
      : 'Other',
  }
}
