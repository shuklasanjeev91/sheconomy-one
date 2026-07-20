import { Icons, Text, XStack, YStack } from '~/components/ui'
import { getShadowStyle, radius } from '~/config/tokens'
import { formatReturnPolicy } from '~/lib/return-policy/return-policy.utils'
import type { ReturnPolicy } from '~/lib/return-policy/return-policy.type'
import { buildReturnPolicyTags, getReturnPolicyBadge } from '~/lib/return-policy/return-policy-ui.utils'
import type { AppUiTokens } from '~/lib/theme/app-ui'

type ReturnPolicyListItemProps = {
  ui: AppUiTokens
  policy: ReturnPolicy
  onPress: () => void
}

function badgeColors(ui: AppUiTokens, tone: 'primary' | 'muted' | 'warning') {
  if (tone === 'primary') {
    return { backgroundColor: ui.roseSurface, color: ui.brand, borderColor: `${ui.brand}44` }
  }
  if (tone === 'warning') {
    return { backgroundColor: '#FEF3C7', color: '#92400E', borderColor: '#FCD34D' }
  }
  return { backgroundColor: ui.chip, color: ui.textSecondary, borderColor: ui.borderSubtle }
}

export function ReturnPolicyListItem({ ui, policy, onPress }: ReturnPolicyListItemProps) {
  const formatted = formatReturnPolicy(policy)
  const badge = getReturnPolicyBadge(policy)
  const badgeStyle = badgeColors(ui, badge.tone)
  const tags = buildReturnPolicyTags(policy)
  const description =
    policy.policy_details?.trim() ||
    policy.condition_description?.trim() ||
    formatted?.services_display ||
    ''

  return (
    <YStack
      gap="$2.5"
      padding="$4"
      borderRadius={radius.card}
      borderWidth={1}
      borderColor={ui.borderSubtle}
      backgroundColor={ui.surface}
      cursor="pointer"
      animation="quick"
      hoverStyle={{ borderColor: `${ui.brand}55`, backgroundColor: ui.surfaceMuted }}
      pressStyle={{ opacity: 0.92 }}
      onPress={onPress}
      style={getShadowStyle('sm')}
    >
      <XStack alignItems="flex-start" justifyContent="space-between" gap="$3">
        <YStack flex={1} minWidth={0} gap="$1">
          <XStack alignItems="center" gap="$2" flexWrap="wrap">
            <Text fontSize={16} fontWeight="800" color={ui.text} letterSpacing={-0.2} numberOfLines={1}>
              {policy.policy_name}
            </Text>
            <YStack
              paddingHorizontal={8}
              paddingVertical={2}
              borderRadius={999}
              borderWidth={1}
              backgroundColor={badgeStyle.backgroundColor}
              borderColor={badgeStyle.borderColor}
            >
              <Text fontSize={10} fontWeight="800" color={badgeStyle.color} letterSpacing={0.3}>
                {badge.label.toUpperCase()}
              </Text>
            </YStack>
          </XStack>
          {description ? (
            <Text fontSize={13} color={ui.textSecondary} lineHeight={20} numberOfLines={2}>
              {description}
            </Text>
          ) : null}
        </YStack>
        <Icons.ChevronRight size={18} color={ui.textMuted} />
      </XStack>

      <XStack gap="$2" flexWrap="wrap">
        {tags.map((tag) => (
          <YStack
            key={tag}
            paddingHorizontal={10}
            paddingVertical={4}
            borderRadius={999}
            backgroundColor={ui.surfaceMuted}
            borderWidth={1}
            borderColor={ui.borderSubtle}
          >
            <Text fontSize={11} fontWeight="700" color={ui.textSecondary}>
              {tag}
            </Text>
          </YStack>
        ))}
      </XStack>
    </YStack>
  )
}
