import { Platform } from 'react-native'

import { Icons, Text, XStack, YStack } from '~/components/ui'
import { getShadowStyle, radius } from '~/config/tokens'
import { PAYMENT_UI_COPY } from '~/lib/payment/payment-ui.copy'
import { getSetupStatusLabel } from '~/lib/payment/payment.utils'
import type { PaymentSetupStatus } from '~/lib/payment/payment.type'
import type { AppUiTokens } from '~/lib/theme/app-ui'

type PaymentSummaryCardsProps = {
  ui: AppUiTokens
  connectedCount: number
  setupStatus: PaymentSetupStatus
  isDesktop: boolean
}

function SummaryCard({
  ui,
  label,
  value,
  icon: Icon,
  valueColor,
  accentSurface,
}: {
  ui: AppUiTokens
  label: string
  value: string
  icon: typeof Icons.CreditCard
  valueColor?: string
  accentSurface?: string
}) {
  return (
    <YStack
      width="100%"
      gap="$2"
      padding="$4"
      borderRadius={radius.card}
      borderWidth={1}
      borderColor={ui.borderSubtle}
      backgroundColor={accentSurface ?? ui.surface}
      style={getShadowStyle('sm')}
    >
      <XStack alignItems="center" justifyContent="space-between">
        <Text fontSize={11} fontWeight="700" color={ui.textMuted} letterSpacing={0.6} textTransform="uppercase">
          {label}
        </Text>
        <YStack
          width={30}
          height={30}
          borderRadius={radius.chip}
          backgroundColor={ui.roseSurface}
          alignItems="center"
          justifyContent="center"
        >
          <Icon size={15} color={ui.brand} />
        </YStack>
      </XStack>
      <Text fontSize={22} fontWeight="800" color={valueColor ?? ui.text} letterSpacing={-0.4}>
        {value}
      </Text>
    </YStack>
  )
}

export function PaymentSummaryCards({
  ui,
  connectedCount,
  setupStatus,
  isDesktop,
}: PaymentSummaryCardsProps) {
  const setupLabel = getSetupStatusLabel(setupStatus)
  const setupPending = !setupStatus.isFullySetup

  if (Platform.OS !== 'web') {
    return (
      <XStack gap="$3" flexWrap="wrap" width="100%" alignItems="stretch">
        <XStack flexBasis="30%" flexGrow={1} flexShrink={0} minWidth={160} alignSelf="stretch">
          <SummaryCard
            ui={ui}
            label={PAYMENT_UI_COPY.connectedProviders}
            value={`${connectedCount} Provider${connectedCount === 1 ? '' : 's'}`}
            icon={Icons.CreditCard}
          />
        </XStack>
        <XStack flexBasis="30%" flexGrow={1} flexShrink={0} minWidth={160} alignSelf="stretch">
          <SummaryCard
            ui={ui}
            label={PAYMENT_UI_COPY.setupStatus}
            value={setupLabel}
            icon={Icons.ClipboardList}
            valueColor={setupPending ? '#B45309' : ui.success}
          />
        </XStack>
        <XStack flexBasis="30%" flexGrow={1} flexShrink={0} minWidth={160} alignSelf="stretch">
          <YStack
            width="100%"
            gap="$2"
            padding="$4"
            borderRadius={radius.card}
            borderWidth={1}
            borderColor="#86EFAC"
            backgroundColor="#F0FDF4"
            style={getShadowStyle('sm')}
          >
            <XStack alignItems="center" justifyContent="space-between">
              <Text fontSize={11} fontWeight="700" color="#166534" letterSpacing={0.6} textTransform="uppercase">
                {PAYMENT_UI_COPY.secureStatus}
              </Text>
              <Icons.ShieldCheck size={18} color="#16A34A" />
            </XStack>
            <XStack alignItems="center" gap="$2">
              <Text fontSize={15} fontWeight="800" color="#166534">
                {PAYMENT_UI_COPY.secureStatusValue}
              </Text>
              <Icons.Info size={14} color="#16A34A" />
            </XStack>
          </YStack>
        </XStack>
      </XStack>
    )
  }

  return (
    <YStack
      width="100%"
      style={{
        display: 'grid',
        gridTemplateColumns: isDesktop ? 'repeat(3, minmax(160px, 1fr))' : 'minmax(0, 1fr)',
        gap: 12,
        width: '100%',
      }}
    >
      <SummaryCard
        ui={ui}
        label={PAYMENT_UI_COPY.connectedProviders}
        value={`${connectedCount} Provider${connectedCount === 1 ? '' : 's'}`}
        icon={Icons.CreditCard}
      />
      <SummaryCard
        ui={ui}
        label={PAYMENT_UI_COPY.setupStatus}
        value={setupLabel}
        icon={Icons.ClipboardList}
        valueColor={setupPending ? '#B45309' : ui.success}
      />
      <YStack
        width="100%"
        gap="$2"
        padding="$4"
        borderRadius={radius.card}
        borderWidth={1}
        borderColor="#86EFAC"
        backgroundColor="#F0FDF4"
        style={getShadowStyle('sm')}
      >
        <XStack alignItems="center" justifyContent="space-between">
          <Text fontSize={11} fontWeight="700" color="#166534" letterSpacing={0.6} textTransform="uppercase">
            {PAYMENT_UI_COPY.secureStatus}
          </Text>
          <Icons.ShieldCheck size={18} color="#16A34A" />
        </XStack>
        <XStack alignItems="center" gap="$2">
          <Text fontSize={15} fontWeight="800" color="#166534">
            {PAYMENT_UI_COPY.secureStatusValue}
          </Text>
          <Icons.Info size={14} color="#16A34A" />
        </XStack>
      </YStack>
    </YStack>
  )
}
