import { Icons, Text, XStack, YStack } from '~/components/ui'
import { getShadowStyle, radius } from '~/config/tokens'
import type { AddressStats } from '~/lib/address/address.type'
import { getAddressTypeLabel } from '~/lib/address/address.utils'
import type { AppUiTokens } from '~/lib/theme/app-ui'

type AddressStatsProps = {
  ui: AppUiTokens
  stats: AddressStats | null
}

export function AddressStatsPanel({ ui, stats }: AddressStatsProps) {
  if (!stats || stats.total === 0) return null

  const topType = Object.entries(stats.byType).sort(([, a], [, b]) => (b ?? 0) - (a ?? 0))[0]?.[0]

  const cards = [
    {
      title: 'Total addresses',
      value: String(stats.total),
      description: 'Across all types',
      icon: Icons.MapPin,
    },
    {
      title: 'Default addresses',
      value: String(stats.defaultCount),
      description: 'Marked as default',
      icon: Icons.Star,
    },
    {
      title: 'Most used type',
      value: topType ? getAddressTypeLabel(topType) : 'None',
      description: 'By saved count',
      icon: Icons.BarChart3,
    },
    {
      title: 'Recently added',
      value: String(stats.recentlyAdded),
      description: 'In the last 7 days',
      icon: Icons.Calendar,
    },
  ]

  return (
    <XStack gap="$3" flexWrap="wrap">
      {cards.map((card) => {
        const Icon = card.icon
        return (
          <YStack
            key={card.title}
            flex={1}
            minWidth={180}
            gap="$2"
            padding="$4"
            borderRadius={radius.card}
            borderWidth={1}
            borderColor={ui.borderSubtle}
            backgroundColor={ui.surface}
            style={getShadowStyle('sm')}
          >
            <XStack alignItems="center" justifyContent="space-between">
              <Text fontSize={12} fontWeight="700" color={ui.textSecondary}>
                {card.title}
              </Text>
              <Icon size={16} color={ui.textMuted} />
            </XStack>
            <Text fontSize={24} fontWeight="800" color={ui.text} letterSpacing={-0.5}>
              {card.value}
            </Text>
            <Text fontSize={11.5} color={ui.textMuted}>
              {card.description}
            </Text>
          </YStack>
        )
      })}
    </XStack>
  )
}
