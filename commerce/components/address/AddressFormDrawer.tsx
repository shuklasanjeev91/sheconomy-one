import { useEffect, useMemo, useState } from 'react'
import { Platform } from 'react-native'

import {
  Button,
  Field,
  Icons,
  Input,
  ScrollView,
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
import { getShadowStyle, radius } from '~/config/tokens'
import { useLockBodyScroll } from '~/hooks/useLockBodyScroll'
import { overlayBackdropStyle } from '~/lib/layout/styles'
import {
  ADDRESS_TYPE,
  ADDRESS_TYPES,
  type Address,
  type AddressFormData,
  type AddressType,
} from '~/lib/address/address.type'
import { addressToFormData, createEmptyAddressFormData } from '~/lib/address/address.utils'
import { getAddressTypeLabel } from '~/lib/address/address.utils'
import { validateAddressData } from '~/lib/address/address.validation'
import type { AppUiTokens } from '~/lib/theme/app-ui'

const PANEL_WIDTH = 520

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
  isDesktop,
  editingAddress,
  submitting,
  onClose,
  onSubmit,
}: AddressFormDrawerProps) {
  useLockBodyScroll(open)

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

  function handleSubmit() {
    const result = validateAddressData(formData)
    if (!result.isValid) {
      setErrors(result.errors)
      return
    }
    onSubmit(formData)
  }

  if (!open) return null

  const panelPositionStyle =
    Platform.OS === 'web'
      ? ({ position: 'fixed' as const, top: 0, right: 0, bottom: 0, boxShadow: '-4px 0 24px rgba(0,0,0,0.18)' } as const)
      : ({ position: 'absolute' as const, top: 0, right: 0, bottom: 0 } as const)

  return (
    <>
      <YStack
        backgroundColor="rgba(0,0,0,0.5)"
        zIndex={100000}
        cursor="pointer"
        style={overlayBackdropStyle()}
        animation="quick"
        enterStyle={{ opacity: 0 }}
        onPress={submitting ? undefined : onClose}
      />
      <YStack
        width={isDesktop ? PANEL_WIDTH : '100%'}
        maxWidth="100%"
        backgroundColor={ui.background}
        borderLeftWidth={isDesktop ? 1 : 0}
        borderLeftColor={ui.borderSubtle}
        zIndex={100001}
        style={panelPositionStyle}
        animation="quick"
        enterStyle={{ x: PANEL_WIDTH }}
      >
        <XStack
          alignItems="center"
          justifyContent="space-between"
          gap="$3"
          paddingHorizontal="$4"
          paddingVertical="$3.5"
          borderBottomWidth={1}
          borderBottomColor={ui.borderSubtle}
          backgroundColor={ui.surface}
        >
          <YStack gap="$0.5" flex={1} minWidth={0}>
            <Text fontSize={17} fontWeight="800" color={ui.text} letterSpacing={-0.2}>
              {title}
            </Text>
            <Text fontSize={12.5} color={ui.textSecondary} numberOfLines={2}>
              {subtitle}
            </Text>
          </YStack>
          <YStack
            width={36}
            height={36}
            borderRadius={999}
            alignItems="center"
            justifyContent="center"
            cursor={submitting ? 'default' : 'pointer'}
            hoverStyle={{ backgroundColor: ui.surfaceMuted }}
            onPress={submitting ? undefined : onClose}
          >
            <Icons.X size={20} color={ui.textSecondary} />
          </YStack>
        </XStack>

        <ScrollView
          flex={1}
          showsVerticalScrollIndicator={false}
          style={
            Platform.OS === 'web'
              ? ({ overflowY: 'auto', minHeight: 0, flexBasis: 0 } as const)
              : undefined
          }
          contentContainerStyle={{ padding: 20, paddingBottom: 28 }}
        >
          <YStack gap="$3.5">
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
                onChangeText={(value) => patch({ address_line_1: value })}
                placeholder="House no., building, street"
              />
            </Field>

            <Field label="Address line 2 (optional)" error={errors.address_line_2}>
              <Input
                value={formData.address_line_2}
                onChangeText={(value) => patch({ address_line_2: value })}
                placeholder="Area, landmark"
              />
            </Field>

            <LocationFields
              value={addressGeoFromInput(formData)}
              onChange={(geo) => setFormData((current) => patchAddressFromGeo(current, geo))}
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
        </ScrollView>

        <XStack
          gap="$2"
          paddingHorizontal="$4"
          paddingVertical="$3"
          borderTopWidth={1}
          borderTopColor={ui.borderSubtle}
          backgroundColor={ui.surface}
          style={getShadowStyle('sm')}
        >
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
      </YStack>
    </>
  )
}

function createInitialForm(address: Address | null): AddressFormData {
  if (!address) return createEmptyAddressFormData()
  return addressToFormData(address)
}
