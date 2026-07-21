import { useEffect, useState } from 'react'
import { Platform } from 'react-native'

import { ShippingPolicyFormFields } from '~/commerce/components/vendor/shipping-policy/ShippingPolicyFormFields'
import { Button, Icons, ScrollView, Spinner, Text, XStack, YStack } from '~/components/ui'
import { getShadowStyle } from '~/config/tokens'
import { useLockBodyScroll } from '~/hooks/useLockBodyScroll'
import { overlayBackdropStyle } from '~/lib/layout/styles'
import { SHIPPING_POLICY_DISPLAY } from '~/lib/shipping-policy/shipping-policy.constants'
import { toFriendlyShippingPolicyError } from '~/lib/shipping-policy/shipping-policy.errors'
import { SHIPPING_POLICY_UI_COPY } from '~/lib/shipping-policy/shipping-policy-ui.copy'
import {
  createShippingPolicyFormData,
  formDataToShippingPolicyInput,
  shippingPolicyToFormData,
} from '~/lib/shipping-policy/shipping-policy-ui.utils'
import type { ShippingPolicy, ShippingPolicyFormData } from '~/lib/shipping-policy/shipping-policy.type'
import { validateShippingPolicyInput } from '~/lib/shipping-policy/shipping-policy.validation'
import type { AppUiTokens } from '~/lib/theme/app-ui'

const PANEL_WIDTH = 920

type ShippingPolicyFormDrawerProps = {
  ui: AppUiTokens
  open: boolean
  isDesktop: boolean
  currencyCode: string
  shopCountry?: string | null
  editingPolicy: ShippingPolicy | null
  submitting: boolean
  safeBottom: number
  onClose: () => void
  onSubmit: (input: ShippingPolicyFormData) => void
  onDelete?: () => void
}

export function ShippingPolicyFormDrawer({
  ui,
  open,
  isDesktop,
  currencyCode,
  shopCountry,
  editingPolicy,
  submitting,
  safeBottom,
  onClose,
  onSubmit,
  onDelete,
}: ShippingPolicyFormDrawerProps) {
  useLockBodyScroll(open)

  const [form, setForm] = useState<ShippingPolicyFormData>(() =>
    editingPolicy ? shippingPolicyToFormData(editingPolicy) : createShippingPolicyFormData(null, shopCountry),
  )
  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    if (!open) return
    setForm(
      editingPolicy
        ? shippingPolicyToFormData(editingPolicy)
        : createShippingPolicyFormData(null, shopCountry),
    )
    setErrors({})
  }, [open, editingPolicy?.id, shopCountry])

  const title = editingPolicy
    ? SHIPPING_POLICY_UI_COPY.editDrawerTitle
    : SHIPPING_POLICY_UI_COPY.createDrawerTitle
  const subtitle = editingPolicy
    ? SHIPPING_POLICY_UI_COPY.editDrawerSubtitle
    : SHIPPING_POLICY_UI_COPY.createDrawerSubtitle

  function patch(partial: Partial<ShippingPolicyFormData>) {
    setForm((current) => ({
      ...current,
      ...partial,
      profile_name: SHIPPING_POLICY_DISPLAY.FALLBACK_PROFILE_NAME,
    }))
  }

  function handleSubmit() {
    const payload = {
      ...form,
      profile_name: SHIPPING_POLICY_DISPLAY.FALLBACK_PROFILE_NAME,
    }
    const result = validateShippingPolicyInput(formDataToShippingPolicyInput(payload))
    if (!result.isValid) {
      setErrors(result.errors)
      return
    }
    setErrors({})
    onSubmit(payload)
  }

  if (!open) return null

  const panelPositionStyle =
    Platform.OS === 'web'
      ? ({
          position: 'fixed' as const,
          top: 0,
          right: 0,
          bottom: 0,
          boxShadow: '-4px 0 24px rgba(0,0,0,0.18)',
        } as const)
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
        style={{ ...panelPositionStyle, ...getShadowStyle('lg') }}
        animation="quick"
        enterStyle={{ x: isDesktop ? PANEL_WIDTH : 400, opacity: 0.96 }}
      >
        <XStack
          alignItems="center"
          justifyContent="space-between"
          paddingHorizontal="$4"
          paddingVertical="$3"
          borderBottomWidth={1}
          borderBottomColor={ui.borderSubtle}
          backgroundColor={ui.surface}
        >
          <XStack alignItems="center" gap="$3" flex={1} minWidth={0}>
            <XStack alignItems="center" gap="$1.5" cursor="pointer" onPress={submitting ? undefined : onClose}>
              <Icons.ChevronLeft size={18} color={ui.textSecondary} />
              <Text fontSize={12.5} fontWeight="600" color={ui.textSecondary}>
                {SHIPPING_POLICY_UI_COPY.drawerBack}
              </Text>
            </XStack>
          </XStack>
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
          contentContainerStyle={{ padding: 20, paddingBottom: 28 + safeBottom }}
        >
          <YStack gap="$4">
            <YStack gap="$1">
              <Text fontSize={22} fontWeight="800" color={ui.text} letterSpacing={-0.4}>
                {title}
              </Text>
              <Text fontSize={13.5} color={ui.textSecondary} lineHeight={20} maxWidth={640}>
                {subtitle}
              </Text>
            </YStack>

            <ShippingPolicyFormFields
              ui={ui}
              form={form}
              errors={errors}
              currencyCode={currencyCode}
              shopCountry={shopCountry}
              disabled={submitting}
              onChange={patch}
            />

            {Object.keys(errors).length > 0 ? (
              <Text fontSize={12.5} color={ui.danger}>
                {SHIPPING_POLICY_UI_COPY.fixFields}
              </Text>
            ) : null}
          </YStack>
        </ScrollView>

        <XStack
          alignItems="center"
          justifyContent="space-between"
          gap="$3"
          flexWrap="wrap"
          paddingHorizontal="$4"
          paddingTop="$3"
          paddingBottom={16 + (Platform.OS !== 'web' ? safeBottom : 0)}
          borderTopWidth={1}
          borderTopColor={ui.borderSubtle}
          backgroundColor={ui.surface}
        >
          {editingPolicy && onDelete ? (
            <Button
              tone="outline"
              size="$3"
              borderRadius={999}
              disabled={submitting}
              onPress={onDelete}
              icon={<Icons.Trash2 size={15} color={ui.danger} />}
            >
              <Text color={ui.danger}>{SHIPPING_POLICY_UI_COPY.deletePolicy}</Text>
            </Button>
          ) : (
            <YStack />
          )}
          <XStack gap="$2.5" marginLeft="auto">
            <Button tone="outline" size="$4" borderRadius={999} disabled={submitting} onPress={onClose}>
              {SHIPPING_POLICY_UI_COPY.cancel}
            </Button>
            <Button
              tone="primary"
              size="$4"
              borderRadius={999}
              disabled={submitting}
              onPress={handleSubmit}
              icon={submitting ? <Spinner size="small" color="white" /> : <Icons.Check size={16} />}
            >
              {submitting
                ? 'Saving…'
                : editingPolicy
                  ? SHIPPING_POLICY_UI_COPY.updatePolicy
                  : SHIPPING_POLICY_UI_COPY.saveProfile}
            </Button>
          </XStack>
        </XStack>
      </YStack>
    </>
  )
}

export function getShippingPolicySubmitErrorMessage(error: unknown): string {
  return toFriendlyShippingPolicyError(error, SHIPPING_POLICY_UI_COPY.saveFailed)
}
