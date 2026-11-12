import { useState } from 'react'
import { Linking } from 'react-native'

import { PhoneInput } from '~/components/forms/PhoneInput'
import { LocationFields } from '~/components/geo/LocationFields'
import {
  AppBottomSheet,
  Badge,
  Button,
  Field,
  Icons,
  Input,
  Spinner,
  Text,
  XStack,
  YStack,
  useAppToast,
} from '~/components/ui'
import { getCountryName, resolveCountryCode, type GeoLocationParts } from '~/lib/geo'
import { getShadowStyle, radius } from '~/config/tokens'
import { parsePickupAddress } from '~/lib/vendor-shipping/vendor-shipping.type'
import { toFriendlyVendorShippingError } from '~/lib/vendor-shipping/vendor-shipping.errors'
import {
  createCustomShippingPartner,
  resetCustomPartnerForm,
  setCustomPartnerForm,
} from '~/lib/vendor-shipping/vendor-shipping.store'
import type {
  CustomShippingPartner,
  VendorShippingAccessContext,
} from '~/lib/vendor-shipping/vendor-shipping.type'
import { VENDOR_SHIPPING_UI_COPY } from '~/lib/vendor-shipping/vendor-shipping-ui.copy'
import { formToCustomPartnerInput, validateCustomPartnerInput } from '~/lib/vendor-shipping/vendor-shipping.validation'
import { useAppDispatch, useAppSelector } from '~/lib/store/hooks'
import type { AppUiTokens } from '~/lib/theme/app-ui'

type CustomShippingPartnerPanelProps = {
  ui: AppUiTokens
  shopId: string
  partners: CustomShippingPartner[]
  loading?: boolean
  creating?: boolean
  accessContext: VendorShippingAccessContext
  onRefresh: () => void
}

export function CustomShippingPartnerPanel({
  ui,
  shopId,
  partners,
  loading,
  creating,
  accessContext,
  onRefresh,
}: CustomShippingPartnerPanelProps) {
  const dispatch = useAppDispatch()
  const toast = useAppToast()
  const copy = VENDOR_SHIPPING_UI_COPY.customPartner
  const form = useAppSelector((state) => state.vendorShipping.partnerForm)
  const [sheetOpen, setSheetOpen] = useState(false)

  function patchForm(values: Parameters<typeof setCustomPartnerForm>[0]) {
    dispatch(setCustomPartnerForm(values))
  }

  async function handleSubmit() {
    const validation = validateCustomPartnerInput(form)
    if (!validation.isValid) {
      toast.show('Could not add partner', { tone: 'danger', message: validation.errors[0] })
      return
    }

    try {
      await dispatch(
        createCustomShippingPartner({
          shopId,
          input: formToCustomPartnerInput(form),
          accessContext,
        }),
      ).unwrap()
      toast.show('Partner added', { tone: 'success' })
      setSheetOpen(false)
      dispatch(resetCustomPartnerForm())
      onRefresh()
    } catch (error) {
      toast.show('Could not add partner', {
        tone: 'danger',
        message: toFriendlyVendorShippingError(error),
      })
    }
  }

  return (
    <>
      <YStack
        gap="$4"
        padding="$5"
        borderRadius={radius.card}
        borderWidth={1}
        borderColor={ui.borderSubtle}
        backgroundColor={ui.surface}
        style={getShadowStyle('sm')}
      >
        <XStack alignItems="flex-start" justifyContent="space-between" gap="$3" flexWrap="wrap">
          <XStack gap="$3" flex={1} minWidth={220}>
            <YStack
              width={44}
              height={44}
              borderRadius={12}
              backgroundColor="#EFF6FF"
              alignItems="center"
              justifyContent="center"
            >
              <Icons.Truck size={22} color="#2563EB" />
            </YStack>
            <YStack flex={1} gap="$1">
              <Text fontSize={18} fontWeight="800" color={ui.text}>
                {copy.title}
              </Text>
              <Text fontSize={13} color={ui.textSecondary} lineHeight={20}>
                {copy.subtitle}
              </Text>
            </YStack>
          </XStack>
          <Button tone="primary" size="$3" icon={<Icons.Plus size={15} />} onPress={() => setSheetOpen(true)}>
            {copy.addPartner}
          </Button>
        </XStack>

        {loading ? (
          <YStack alignItems="center" padding="$8">
            <Spinner size="large" />
          </YStack>
        ) : partners.length === 0 ? (
          <YStack alignItems="center" padding="$8" gap="$3">
            <YStack
              width={64}
              height={64}
              borderRadius={999}
              backgroundColor={ui.surfaceMuted}
              alignItems="center"
              justifyContent="center"
            >
              <Icons.Truck size={28} color={ui.textMuted} />
            </YStack>
            <Text fontSize={16} fontWeight="800" color={ui.text}>
              {copy.emptyTitle}
            </Text>
            <Text fontSize={13} color={ui.textSecondary} textAlign="center">
              {copy.emptyBody}
            </Text>
            <Button tone="primary" icon={<Icons.Plus size={15} />} onPress={() => setSheetOpen(true)}>
              {copy.addFirstPartner}
            </Button>
          </YStack>
        ) : (
          <YStack gap="$3">
            {partners.map((partner) => {
              const address = parsePickupAddress(partner.pickup_address)
              return (
                <YStack
                  key={partner.id}
                  gap="$3"
                  padding="$4"
                  borderRadius={14}
                  borderWidth={1}
                  borderColor={ui.borderSubtle}
                  backgroundColor={ui.surfaceMuted}
                >
                  <XStack gap="$2" flexWrap="wrap" alignItems="center">
                    <Text fontSize={16} fontWeight="800" color={ui.text}>
                      {partner.partner_name}
                    </Text>
                    <Badge tone={partner.is_verified ? 'success' : 'neutral'}>
                      {partner.is_verified ? copy.verified : copy.unverified}
                    </Badge>
                    {partner.shipping_providers?.is_active ? (
                      <Badge tone="info">{copy.active}</Badge>
                    ) : null}
                  </XStack>
                  <XStack gap="$3" flexWrap="wrap">
                    {partner.contact_person ? (
                      <Text fontSize={12} color={ui.textSecondary}>
                        {partner.contact_person}
                      </Text>
                    ) : null}
                    {partner.phone ? (
                      <Text fontSize={12} color={ui.textSecondary}>
                        {partner.phone}
                      </Text>
                    ) : null}
                    {partner.email ? (
                      <Text fontSize={12} color={ui.textSecondary}>
                        {partner.email}
                      </Text>
                    ) : null}
                    {partner.website ? (
                      <Text
                        fontSize={12}
                        color={ui.brand}
                        cursor="pointer"
                        onPress={() => void Linking.openURL(partner.website!)}
                      >
                        {copy.visitWebsite}
                      </Text>
                    ) : null}
                  </XStack>
                  {address?.address_line1 ? (
                    <XStack gap="$2" alignItems="flex-start">
                      <Icons.MapPin size={14} color={ui.textMuted} />
                      <Text fontSize={12} color={ui.textSecondary} flex={1}>
                        {address.address_line1}
                        {address.city ? `, ${address.city}` : ''}
                        {address.state ? `, ${address.state}` : ''}
                        {address.pincode ? ` - ${address.pincode}` : ''}
                      </Text>
                    </XStack>
                  ) : null}
                </YStack>
              )
            })}
          </YStack>
        )}
      </YStack>

      <AppBottomSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        title={copy.dialogTitle}
        footer={
          <XStack gap="$2">
            <Button
              tone="outline"
              flex={1}
              onPress={() => {
                setSheetOpen(false)
                dispatch(resetCustomPartnerForm())
              }}
            >
              Cancel
            </Button>
            <Button tone="primary" flex={1} disabled={creating} onPress={() => void handleSubmit()}>
              {creating ? copy.adding : copy.addAction}
            </Button>
          </XStack>
        }
      >
        <Text fontSize={13} color={ui.textSecondary}>
          {copy.dialogSubtitle}
        </Text>

        <YStack gap="$3">
          <Text fontSize={14} fontWeight="800" color={ui.text}>
            {copy.basicInfo}
          </Text>
          <Field label={`${copy.partnerName} *`}>
            <Input
              value={form.partner_name}
              onChangeText={(partner_name) => patchForm({ partner_name })}
              placeholder="Local Courier Service"
            />
          </Field>
          <XStack gap="$3" flexWrap="wrap">
            <Field label={copy.contactPerson} flex={1} minWidth={160}>
              <Input
                value={form.contact_person}
                onChangeText={(contact_person) => patchForm({ contact_person })}
              />
            </Field>
            <Field label={copy.phone} flex={1} minWidth={160}>
              <PhoneInput
                value={form.phone}
                onChange={(phone) => patchForm({ phone })}
                compact
              />
            </Field>
          </XStack>
          <XStack gap="$3" flexWrap="wrap">
            <Field label={copy.email} flex={1} minWidth={160}>
              <Input
                value={form.email}
                onChangeText={(email) => patchForm({ email })}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </Field>
            <Field label={copy.website} flex={1} minWidth={160}>
              <Input
                value={form.website}
                onChangeText={(website) => patchForm({ website })}
                autoCapitalize="none"
              />
            </Field>
          </XStack>
          <Field label={copy.trackingTemplate} hint={copy.trackingHint}>
            <Input
              value={form.tracking_url_template}
              onChangeText={(tracking_url_template) => patchForm({ tracking_url_template })}
              placeholder="https://track.courier.com/?awb={TRACKING_NUMBER}"
            />
          </Field>
        </YStack>

        <YStack gap="$3">
          <Text fontSize={14} fontWeight="800" color={ui.text}>
            {copy.pickupAddress}
          </Text>
          <Field label={copy.addressLine1}>
            <Input
              value={form.pickup_address.address_line1}
              onChangeText={(address_line1) =>
                patchForm({ pickup_address: { ...form.pickup_address, address_line1 } })
              }
            />
          </Field>
          <Field label={copy.addressLine2}>
            <Input
              value={form.pickup_address.address_line2}
              onChangeText={(address_line2) =>
                patchForm({ pickup_address: { ...form.pickup_address, address_line2 } })
              }
            />
          </Field>
          <LocationFields
            value={{
              countryCode: resolveCountryCode(form.pickup_address.country || 'IN'),
              stateName: form.pickup_address.state || '',
              city: form.pickup_address.city || '',
              postalCode: form.pickup_address.pincode || '',
            }}
            onChange={(next: GeoLocationParts) =>
              patchForm({
                pickup_address: {
                  ...form.pickup_address,
                  country: getCountryName(next.countryCode) || next.countryCode,
                  state: next.stateName,
                  city: next.city,
                  pincode: next.postalCode ?? '',
                },
              })
            }
            postalRequired={false}
          />
        </YStack>
      </AppBottomSheet>
    </>
  )
}
