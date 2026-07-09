import { Text, XStack } from '~/components/ui'
import type { ListingBadge as ListingBadgeModel } from '~/commerce/lib/marketplace-personalization'
import { type AppUiTokens } from '~/lib/theme/app-ui'
import { useAppUi } from '~/lib/theme/useAppUi'

function getToneStyles(
  ui: AppUiTokens,
): Record<ListingBadgeModel['tone'], { backgroundColor: string; color: string }> {
  return {
    brand: { backgroundColor: ui.badgeBrandBg, color: ui.badgeBrandText },
    accent: { backgroundColor: ui.badgeAccentBg, color: ui.badgeAccentText },
    success: { backgroundColor: ui.badgeSuccessBg, color: ui.badgeSuccessText },
    info: { backgroundColor: ui.badgeInfoBg, color: ui.badgeInfoText },
    neutral: { backgroundColor: ui.badgeNeutralBg, color: ui.badgeNeutralText },
  }
}

type ListingBadgeProps = {
  badge: ListingBadgeModel
}

export function ListingBadge({ badge }: ListingBadgeProps) {
  const ui = useAppUi()
  const tone = getToneStyles(ui)[badge.tone]

  return (
    <XStack
      backgroundColor={tone.backgroundColor}
      paddingHorizontal="$2"
      paddingVertical={3}
      borderRadius={4}
      maxWidth="100%"
      alignSelf="flex-start"
      flexShrink={1}
    >
      <Text
        fontSize={10}
        fontWeight="700"
        color={tone.color}
        letterSpacing={0.2}
        lineHeight={14}
      >
        {badge.label}
      </Text>
    </XStack>
  )
}