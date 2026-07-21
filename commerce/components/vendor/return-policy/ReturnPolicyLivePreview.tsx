import { Icons, Switch, Text, XStack, YStack } from '~/components/ui'
import { getShadowStyle, radius } from '~/config/tokens'
import { RETURN_POLICY_UI_COPY } from '~/lib/return-policy/return-policy-ui.copy'
import { formatReturnWindowLabel } from '~/lib/return-policy/return-policy-ui.utils'
import type { ReturnPolicyFormData } from '~/lib/return-policy/return-policy.type'
import { RETURN_POLICY_DISPLAY, RETURN_SHIPPING_PAID_BY } from '~/lib/return-policy/return-policy.constants'
import type { AppUiTokens } from '~/lib/theme/app-ui'

type ReturnPolicyLivePreviewProps = {
  ui: AppUiTokens
  form: ReturnPolicyFormData
  isDraft?: boolean
  onActiveChange?: (active: boolean) => void
}

function PreviewRow({
  ui,
  label,
  enabled,
}: {
  ui: AppUiTokens
  label: string
  enabled: boolean
}) {
  return (
    <XStack alignItems="center" justifyContent="space-between" gap="$2">
      <Text fontSize={13} fontWeight="600" color={ui.textSecondary}>
        {label}
      </Text>
      {enabled ? (
        <Icons.Check size={16} color={ui.brand} />
      ) : (
        <Icons.X size={16} color={ui.textMuted} />
      )}
    </XStack>
  )
}

export function ReturnPolicyLivePreview({
  ui,
  form,
  isDraft = true,
  onActiveChange,
}: ReturnPolicyLivePreviewProps) {
  const shippingLabel =
    form.return_shipping_paid_by === RETURN_SHIPPING_PAID_BY.SELLER
      ? RETURN_POLICY_DISPLAY.SHIPPING_SELLER
      : RETURN_POLICY_DISPLAY.SHIPPING_BUYER

  return (
    <YStack
      gap="$3"
      padding="$4"
      borderRadius={radius.card}
      borderWidth={1}
      borderColor={ui.borderSubtle}
      backgroundColor={ui.surface}
      style={getShadowStyle('sm')}
    >
      <XStack alignItems="center" justifyContent="space-between" gap="$2">
        <Text fontSize={14} fontWeight="800" color={ui.text}>
          {RETURN_POLICY_UI_COPY.livePreview}
        </Text>
        {isDraft ? (
          <YStack paddingHorizontal={8} paddingVertical={2} borderRadius={999} backgroundColor={ui.chip}>
            <Text fontSize={10} fontWeight="800" color={ui.textMuted} letterSpacing={0.4}>
              {RETURN_POLICY_UI_COPY.draftBadge}
            </Text>
          </YStack>
        ) : null}
      </XStack>

      <YStack gap="$2" padding="$3" borderRadius={radius.chip} backgroundColor={ui.surfaceMuted}>
        <PreviewRow
          ui={ui}
          label={`Policy Window: ${formatReturnWindowLabel(form.return_window_days)}`}
          enabled
        />
        <PreviewRow ui={ui} label={RETURN_POLICY_DISPLAY.SERVICE_RETURNS} enabled={form.accepts_returns} />
        <PreviewRow ui={ui} label={RETURN_POLICY_DISPLAY.SERVICE_EXCHANGES} enabled={form.accepts_exchanges} />
        <PreviewRow ui={ui} label={RETURN_POLICY_DISPLAY.SERVICE_REFUNDS} enabled={form.accepts_refunds} />
        <PreviewRow ui={ui} label={`Shipping: ${shippingLabel}`} enabled />
      </YStack>

      <Text fontSize={12} color={ui.textMuted} lineHeight={18}>
        {RETURN_POLICY_UI_COPY.previewHint}
      </Text>

      {onActiveChange ? (
        <XStack
          alignItems="center"
          justifyContent="space-between"
          gap="$3"
          paddingTop="$1"
          borderTopWidth={1}
          borderTopColor={ui.borderSubtle}
        >
          <YStack flex={1} minWidth={0} gap={2}>
            <Text fontSize={13} fontWeight="700" color={ui.text}>
              {RETURN_POLICY_UI_COPY.activePolicy}
            </Text>
            <Text fontSize={12} color={ui.textMuted}>
              {RETURN_POLICY_UI_COPY.activePolicyHint}
            </Text>
          </YStack>
          <Switch checked={form.is_active} onCheckedChange={onActiveChange} />
        </XStack>
      ) : null}
    </YStack>
  )
}
