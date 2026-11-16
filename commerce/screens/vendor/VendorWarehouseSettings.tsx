import { useCallback, useEffect, useState } from 'react'

import { Field, Icons, Input, Spinner, Text, YStack, useAppToast } from '~/components/ui'
import { PhoneInput } from '~/components/forms/PhoneInput'
import { LocationFields } from '~/components/geo'
import { radius } from '~/config/tokens'
import type { Shop } from '~/lib/shop/shop.type'
import type { AppUiTokens } from '~/lib/theme/app-ui'
import { useProfile } from '~/hooks/useProfile'
import { useSupabase } from '~/providers/SupabaseProvider'

import {
  emptyWarehouseForm,
  loadWarehouseFormState,
  upsertDefaultWarehouse,
  type WarehouseFormState,
} from '~/commerce/lib/warehouse'

import {
  SettingsCard,
  SettingsSaveBar,
  SettingsSectionTitle,
} from '~/commerce/screens/vendor/vendor-settings-shared'

type VendorWarehouseSettingsProps = {
  ui: AppUiTokens
  shop: Shop
  isDesktop: boolean
  safeBottom: number
}

/**
 * Fulfillment ship-from warehouse — EasyShip label origin for this shop.
 */
export function VendorWarehouseSettings({
  ui,
  shop,
  isDesktop,
  safeBottom,
}: VendorWarehouseSettingsProps) {
  const toast = useAppToast()
  const { user } = useSupabase()
  const { profile } = useProfile()

  const [form, setForm] = useState<WarehouseFormState>(() =>
    emptyWarehouseForm({
      warehouse_name: `${shop.shop_name ?? 'Shop'} warehouse`,
      contact_person: profile?.full_name ?? '',
      mobile_number: shop.shop_phone_number ?? '',
    }),
  )
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const load = useCallback(async () => {
    setIsLoading(true)
    const { form: next, error } = await loadWarehouseFormState({
      shopId: shop.id,
      shopName: shop.shop_name,
      shopPhone: shop.shop_phone_number,
      contactName: profile?.full_name,
    })
    setForm(next)
    if (error) {
      toast.show('Could not load warehouse', { tone: 'danger', message: error })
    }
    setIsLoading(false)
  }, [
    profile?.full_name,
    shop.id,
    shop.shop_name,
    shop.shop_phone_number,
    toast,
  ])

  useEffect(() => {
    void load()
  }, [load])

  async function handleSave() {
    if (!user?.id) {
      toast.show('Sign in required', { tone: 'warning', message: 'Please sign in again.' })
      return
    }

    setIsSaving(true)
    setErrors({})
    const { warehouse, error } = await upsertDefaultWarehouse(shop.id, user.id, {
      warehouse_name: form.warehouse_name,
      contact_person: form.contact_person,
      mobile_number: form.mobile_number,
      address_line_1: form.address_line_1,
      address_line_2: form.address_line_2,
      geo: form.geo,
    })
    setIsSaving(false)

    if (error || !warehouse) {
      setErrors({ form: error ?? 'Could not save warehouse.' })
      toast.show('Could not save warehouse', {
        tone: 'danger',
        message: error ?? 'Check the address and try again.',
      })
      return
    }

    setForm((current) => ({
      ...current,
      id: warehouse.id,
      warehouse_code: warehouse.warehouse_code,
    }))
    toast.show('Warehouse saved', {
      tone: 'success',
      message: 'EasyShip labels will ship from this fulfillment address.',
    })
  }

  return (
    <YStack flex={1} minHeight={0} width="100%" maxWidth="100%">
      {/*
        Match Connect/General: one natural-height content stack, then sticky save.
        A flex:1 content wrapper forces the save bar mid-viewport over tall forms.
      */}
      <YStack
        gap="$4"
        paddingHorizontal={isDesktop ? '$6' : '$4'}
        paddingTop={isDesktop ? '$6' : '$4'}
        paddingBottom="$5"
      >
        <YStack gap="$2">
          <Text fontSize={isDesktop ? 26 : 22} fontWeight="800" color={ui.text} letterSpacing={-0.4}>
            Warehouse & ship-from
          </Text>
          <Text fontSize={14} color={ui.textSecondary} maxWidth={640} lineHeight={20}>
            Set the fulfillment address EasyShip uses when you buy shipping labels. This is your
            warehouse / pick-up origin — separate from the public shop address under Contact.
          </Text>
        </YStack>

        {isLoading ? (
          <YStack padding="$6" alignItems="center">
            <Spinner size="large" />
          </YStack>
        ) : (
          <SettingsCard ui={ui}>
            <SettingsSectionTitle ui={ui} icon={Icons.Building2} title="Default warehouse" />
            <Text fontSize={12.5} color={ui.textMuted} marginBottom="$2">
              {form.id
                ? `Active ship-from${form.warehouse_code ? ` · ${form.warehouse_code}` : ''}`
                : 'No warehouse yet — save to create your default fulfillment origin.'}
            </Text>

            <YStack gap="$3">
              <Field label="Warehouse name" error={errors.warehouse_name}>
                <Input
                  value={form.warehouse_name}
                  onChangeText={(value) => setForm((c) => ({ ...c, warehouse_name: value }))}
                  placeholder="Main warehouse"
                />
              </Field>
              <Field label="Contact person" error={errors.contact_person}>
                <Input
                  value={form.contact_person}
                  onChangeText={(value) => setForm((c) => ({ ...c, contact_person: value }))}
                  placeholder="Who hands packages to the courier"
                />
              </Field>
              <Field label="Mobile number" error={errors.mobile_number}>
                <PhoneInput
                  value={form.mobile_number}
                  onChange={(value) => setForm((c) => ({ ...c, mobile_number: value }))}
                />
              </Field>
              <Field label="Address line 1" error={errors.address_line_1}>
                <Input
                  value={form.address_line_1}
                  onChangeText={(value) => setForm((c) => ({ ...c, address_line_1: value }))}
                  placeholder="Street, building, unit"
                />
              </Field>
              <Field label="Address line 2">
                <Input
                  value={form.address_line_2 ?? ''}
                  onChangeText={(value) => setForm((c) => ({ ...c, address_line_2: value }))}
                  placeholder="Landmark, suite (optional)"
                />
              </Field>
              <LocationFields
                value={form.geo}
                onChange={(geo) => setForm((c) => ({ ...c, geo }))}
                disabled={isSaving}
              />
              {errors.form ? (
                <Text fontSize={12.5} fontWeight="600" color={ui.danger}>
                  {errors.form}
                </Text>
              ) : null}
              <YStack
                padding="$3"
                borderRadius={radius.chip}
                backgroundColor={ui.roseSurface}
                gap="$1"
              >
                <Text fontSize={12} color={ui.textSecondary} lineHeight={18}>
                  Used as the EasyShip origin when you fulfil orders. Keep street, city, PIN, and
                  phone accurate so carrier labels and pickups succeed.
                </Text>
              </YStack>
            </YStack>
          </SettingsCard>
        )}
      </YStack>

      <SettingsSaveBar
        ui={ui}
        isDesktop={isDesktop}
        safeBottom={safeBottom}
        isSaving={isSaving || isLoading}
        onSave={() => void handleSave()}
      />
    </YStack>
  )
}
