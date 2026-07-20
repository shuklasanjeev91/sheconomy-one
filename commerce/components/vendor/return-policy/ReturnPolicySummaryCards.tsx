import { Platform } from 'react-native'

import { Icons, Text, XStack, YStack } from '~/components/ui'
import { getShadowStyle, radius } from '~/config/tokens'
import { RETURN_POLICY_UI_COPY } from '~/lib/return-policy/return-policy-ui.copy'
import type { ReturnPolicyHubStats } from '~/lib/return-policy/return-policy-ui.utils'
import { formatReturnWindowLabel } from '~/lib/return-policy/return-policy-ui.utils'
import type { AppUiTokens } from '~/lib/theme/app-ui'

type ReturnPolicySummaryCardsProps = {
  ui: AppUiTokens
  stats: ReturnPolicyHubStats
  isDesktop: boolean
}

function SummaryCard({
  ui,
  label,
  value,
  subtext,
  icon: Icon,
}: {
  ui: AppUiTokens
  label: string
  value: string
  subtext?: string
  icon: typeof Icons.Undo2
}) {
  return (
    <YStack
      width="100%"
      gap="$2"
      padding="$4"
      borderRadius={radius.card}
      borderWidth={1}
      borderColor={ui.borderSubtle}
      backgroundColor={ui.surface}
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
      <Text fontSize={22} fontWeight="800" color={ui.text} letterSpacing={-0.4}>
        {value}
      </Text>
      {subtext ? (
        <Text fontSize={12} color={ui.textMuted} fontWeight="600">
          {subtext}
        </Text>
      ) : null}
    </YStack>
  )
}

export function ReturnPolicySummaryCards({ ui, stats, isDesktop }: ReturnPolicySummaryCardsProps) {
  const cards = [
    {
      label: RETURN_POLICY_UI_COPY.summaryActivePolicies,
      value: String(stats.activeCount),
      subtext: `${stats.totalCount} ${RETURN_POLICY_UI_COPY.summaryRegistered.toLowerCase()}`,
      icon: Icons.ClipboardCheck,
    },
    {
      label: RETURN_POLICY_UI_COPY.summaryDefaultWindow,
      value: formatReturnWindowLabel(stats.defaultWindowDays),
      subtext: RETURN_POLICY_UI_COPY.summaryIndustryStandard,
      icon: Icons.Calendar,
    },
    {
      label: RETURN_POLICY_UI_COPY.summaryShippingPayer,
      value: stats.shippingPaidByLabel,
      subtext: RETURN_POLICY_UI_COPY.summaryTrustTier,
      icon: Icons.Truck,
    },
  ] as const

  if (Platform.OS !== 'web') {
    return (
      <XStack gap="$3" flexWrap="wrap" width="100%">
        {cards.map((card) => (
          <XStack key={card.label} flexBasis="30%" flexGrow={1} minWidth={150}>
            <SummaryCard ui={ui} {...card} />
          </XStack>
        ))}
      </XStack>
    )
  }

  return (
    <YStack
      width="100%"
      style={{
        display: 'grid',
        gridTemplateColumns: isDesktop ? 'repeat(3, minmax(0, 1fr))' : 'minmax(0, 1fr)',
        gap: 12,
      }}
    >
      {cards.map((card) => (
        <YStack key={card.label} width="100%" minWidth={0}>
          <SummaryCard ui={ui} {...card} />
        </YStack>
      ))}
    </YStack>
  )
}
