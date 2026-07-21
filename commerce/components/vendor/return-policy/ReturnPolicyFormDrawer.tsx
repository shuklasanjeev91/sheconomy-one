import { useEffect, useState } from 'react'
import { Platform } from 'react-native'

import { ReturnPolicyFormFields } from '~/commerce/components/vendor/return-policy/ReturnPolicyFormFields'
import { ReturnPolicyLivePreview } from '~/commerce/components/vendor/return-policy/ReturnPolicyLivePreview'
import { Button, Icons, ScrollView, Spinner, Text, XStack, YStack } from '~/components/ui'
import { getShadowStyle } from '~/config/tokens'
import { useLockBodyScroll } from '~/hooks/useLockBodyScroll'
import { overlayBackdropStyle } from '~/lib/layout/styles'
import { toFriendlyReturnPolicyError } from '~/lib/return-policy/return-policy.errors'
import { RETURN_POLICY_UI_COPY } from '~/lib/return-policy/return-policy-ui.copy'
import {
  createReturnPolicyFormData,
  formDataToReturnPolicyInput,
  returnPolicyToFormData,
} from '~/lib/return-policy/return-policy-ui.utils'
import type { ReturnPolicy, ReturnPolicyFormData } from '~/lib/return-policy/return-policy.type'
import { validateReturnPolicyInput } from '~/lib/return-policy/return-policy.validation'
import type { AppUiTokens } from '~/lib/theme/app-ui'

const PANEL_WIDTH = 920

type ReturnPolicyFormDrawerProps = {
  ui: AppUiTokens
  open: boolean
  isDesktop: boolean
  shopName?: string | null
  editingPolicy: ReturnPolicy | null
  submitting: boolean
  safeBottom: number
  onClose: () => void
  onSubmit: (input: ReturnPolicyFormData) => void
  onDelete?: () => void
}

export function ReturnPolicyFormDrawer({
  ui,
  open,
  isDesktop,
  shopName,
  editingPolicy,
  submitting,
  safeBottom,
  onClose,
  onSubmit,
  onDelete,
}: ReturnPolicyFormDrawerProps) {
  useLockBodyScroll(open)

  const [form, setForm] = useState<ReturnPolicyFormData>(() =>
    editingPolicy ? returnPolicyToFormData(editingPolicy) : createReturnPolicyFormData(shopName),
  )
  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    if (!open) return
    setForm(editingPolicy ? returnPolicyToFormData(editingPolicy) : createReturnPolicyFormData(shopName))
    setErrors({})
  }, [open, editingPolicy?.id, shopName])

  const title = editingPolicy ? RETURN_POLICY_UI_COPY.editPolicy : RETURN_POLICY_UI_COPY.createDrawerTitle
  const subtitle = editingPolicy
    ? RETURN_POLICY_UI_COPY.editDrawerSubtitle
    : RETURN_POLICY_UI_COPY.createDrawerSubtitle

  function patch(partial: Partial<ReturnPolicyFormData>) {
    setForm((current) => ({ ...current, ...partial }))
  }

  function handleSubmit() {
    const result = validateReturnPolicyInput(formDataToReturnPolicyInput(form))
    if (!result.isValid) {
      setErrors(result.errors)
      return
    }
    setErrors({})
    onSubmit(form)
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
                {RETURN_POLICY_UI_COPY.drawerBack}
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

            {isDesktop ? (
              <XStack gap="$4" alignItems="flex-start">
                <YStack flex={1.2} minWidth={0}>
                  <ReturnPolicyFormFields
                    ui={ui}
                    form={form}
                    errors={errors}
                    disabled={submitting}
                    onChange={patch}
                  />
                </YStack>
                <YStack flex={0.8} minWidth={280} maxWidth={340} gap="$3">
                  <ReturnPolicyLivePreview
                    ui={ui}
                    form={form}
                    onActiveChange={(checked) => patch({ is_active: checked })}
                  />
                </YStack>
              </XStack>
            ) : (
              <YStack gap="$4">
                <ReturnPolicyFormFields
                  ui={ui}
                  form={form}
                  errors={errors}
                  disabled={submitting}
                  onChange={patch}
                />
                <ReturnPolicyLivePreview ui={ui} form={form} />
              </YStack>
            )}
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
              <Text color={ui.danger}>{RETURN_POLICY_UI_COPY.deletePolicy}</Text>
            </Button>
          ) : (
            <YStack />
          )}
          <XStack gap="$2.5" marginLeft="auto">
            <Button tone="outline" size="$4" borderRadius={999} disabled={submitting} onPress={onClose}>
              {RETURN_POLICY_UI_COPY.cancel}
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
                  ? RETURN_POLICY_UI_COPY.updatePolicy
                  : RETURN_POLICY_UI_COPY.savePolicy}
            </Button>
          </XStack>
        </XStack>
      </YStack>
    </>
  )
}

export function getReturnPolicySubmitErrorMessage(error: unknown): string {
  return toFriendlyReturnPolicyError(error, RETURN_POLICY_UI_COPY.saveFailed)
}
