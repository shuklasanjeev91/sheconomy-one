import { useEffect, useMemo, useState } from 'react'
import { Platform } from 'react-native'

import {
  AppBottomSheet,
  Button,
  Field,
  Icons,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectViewport,
  Spinner,
  Switch,
  Text,
  XStack,
  YStack,
} from '~/components/ui'
import { LocationFields, addressGeoFromInput, patchAddressFromGeo } from '~/components/geo'
import {
  AddressAutocompleteField,
  LocationAssistActions,
} from '~/components/location'
import { radius } from '~/config/tokens'
import { resolvedAddressToFormPatch, type ResolvedAddress } from '~/lib/location'
import {
  ADDRESS_TYPES,
  type Address,
  type AddressFormData,
  type AddressType,
} from '~/lib/address/address.type'
import { addressToFormData, createEmptyAddressFormData } from '~/lib/address/address.utils'
import { getAddressTypeLabel } from '~/lib/address/address.utils'
import { validateAddressData } from '~/lib/address/address.validation'
import type { AppUiTokens } from '~/lib/theme/app-ui'

type AddressFormDrawerProps = {
  ui: AppUiTokens
  open: boolean
  isDesktop: boolean
  editingAddress: Address | null
  submitting: boolean
  onClose: () => void
  onSubmit: (formData: AddressFormData) => void
}

export function AddressFormDrawer({
  ui,
  open,
  editingAddress,
  submitting,
  onClose,
  onSubmit,
}: AddressFormDrawerProps) {
  const [formData, setFormData] = useState<AddressFormData>(() => createInitialForm(editingAddress))
  const [errors, setErrors] = useState<Partial<Record<keyof AddressFormData, string>>>({})

  useEffect(() => {
    if (open) {
      setFormData(createInitialForm(editingAddress))
      setErrors({})
    }
  }, [open, editingAddress?.id])

  const title = editingAddress ? 'Edit address' : 'Add new address'
  const subtitle = editingAddress
    ? 'Update your address information.'
    : 'Add a shipping, billing, or personal address.'

  const typeOptions = useMemo(
    () =>
      ADDRESS_TYPES.map((type, index) => ({
        type,
        label: getAddressTypeLabel(type),
        index,
      })),
    [],
  )

  function patch(partial: Partial<AddressFormData>) {
    setFormData((current) => ({ ...current, ...partial }))
  }

  function applyResolved(resolved: ResolvedAddress) {
    setFormData((current) => {
      const next = resolvedAddressToFormPatch(resolved, current)
      return {
        ...current,
        ...next,
      }
    })
    setErrors({})
  }

  function handleSubmit() {
    const result = validateAddressData(formData)
    if (!result.isValid) {
      setErrors(result.errors)
      return
    }
    onSubmit(formData)
  }

  return (
    <AppBottomSheet
      open={open}
      onOpenChange={(next) => {
        if (!next && !submitting) onClose()
      }}
      title={title}
      maxHeightRatio={0.96}
      footer={
        <XStack gap="$2" width="100%">
          <Button
            tone="outline"
            size="$4"
            borderRadius={999}
            flex={1}
            disabled={submitting}
            onPress={onClose}
          >
            Cancel
          </Button>
          <Button
            tone="primary"
            size="$4"
            borderRadius={999}
            flex={1}
            disabled={submitting}
            onPress={handleSubmit}
            icon={submitting ? <Spinner size="small" color="white" /> : <Icons.Check size={16} />}
          >
            {submitting ? 'Saving…' : editingAddress ? 'Save changes' : 'Add address'}
          </Button>
        </XStack>
      }
    >
      <Text fontSize={13} color={ui.textSecondary} marginBottom="$1">
        {subtitle}
      </Text>

      <YStack gap="$3.5" width="100%">
        <AddressAutocompleteField
          country={formData.country}
          onResolved={applyResolved}
          disabled={submitting}
        />
        <LocationAssistActions onResolved={applyResolved} disabled={submitting} />

        <Field label="Address type">
          <Select
            value={formData.address_type}
            onValueChange={(value) => patch({ address_type: value as AddressType })}
          >
            <SelectTrigger width="100%" iconAfter={<Icons.ChevronDown size={16} />}>
              <Select.Value placeholder="Select type" />
            </SelectTrigger>
            <SelectContent zIndex={300000}>
              <SelectViewport>
                {typeOptions.map((option) => (
                  <SelectItem key={option.type} index={option.index} value={option.type}>
                    <Select.ItemText>{option.label}</Select.ItemText>
                  </SelectItem>
                ))}
              </SelectViewport>
            </SelectContent>
          </Select>
        </Field>

        <Field label="Address label (optional)" error={errors.address_label}>
          <Input
            value={formData.address_label}
            onChangeText={(value) => patch({ address_label: value })}
            placeholder="e.g. Home, Office, Parents house"
          />
        </Field>

        <Field label="Address line 1" required error={errors.address_line_1}>
          <Input
            value={formData.address_line_1}
            onChangeText={(value) => patch({ address_line_1: value, source: 'manual' })}
            placeholder="House no., building, street"
            autoComplete={Platform.OS === 'web' ? ('street-address' as never) : undefined}
            textContentType={Platform.OS === 'ios' ? 'streetAddressLine1' : undefined}
          />
        </Field>

        <Field label="Address line 2 (optional)" error={errors.address_line_2}>
          <Input
            value={formData.address_line_2}
            onChangeText={(value) => patch({ address_line_2: value, source: 'manual' })}
            placeholder="Area, landmark"
            autoComplete={Platform.OS === 'web' ? ('address-line2' as never) : undefined}
            textContentType={Platform.OS === 'ios' ? 'streetAddressLine2' : undefined}
          />
        </Field>

        <LocationFields
          value={addressGeoFromInput(formData)}
          onChange={(geo) => {
            const patched = patchAddressFromGeo(formData, geo)
            setFormData((current) => ({
              ...current,
              country: patched.country ?? current.country,
              state: patched.state,
              city: patched.city,
              postal_code: patched.postal_code,
              source: current.source ?? 'manual',
            }))
          }}
        />

        {errors.city ? (
          <Text fontSize={12} color={ui.danger}>
            {errors.city}
          </Text>
        ) : null}
        {errors.state ? (
          <Text fontSize={12} color={ui.danger}>
            {errors.state}
          </Text>
        ) : null}
        {errors.postal_code ? (
          <Text fontSize={12} color={ui.danger}>
            {errors.postal_code}
          </Text>
        ) : null}

        <XStack
          alignItems="center"
          justifyContent="space-between"
          gap="$3"
          padding="$3"
          borderRadius={radius.chip}
          backgroundColor={ui.surfaceMuted}
        >
          <Text fontSize={14} color={ui.text} flex={1}>
            Set as default {getAddressTypeLabel(formData.address_type).toLowerCase()} address
          </Text>
          <Switch
            checked={formData.is_default}
            onCheckedChange={(checked) => patch({ is_default: checked })}
          />
        </XStack>
      </YStack>
    </AppBottomSheet>
  )
}

function createInitialForm(address: Address | null): AddressFormData {
  if (!address) return createEmptyAddressFormData()
  return addressToFormData(address)
}
