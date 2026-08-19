import type { CommunitySuggestion } from '~/community/lib/community-personalization'
import { AppLink } from '~/components/navigation/AppLink'
import { ShopActionButtons } from '~/commerce/components/ShopActionButtons'
import { useCommunityUi } from '~/community/lib/community-theme'
import { Avatar, Icons, Text, XStack, YStack } from '~/components/ui'
import { brandColors } from '~/config/brand-colors'

const AVATAR_SIZE = 28

export function CommunityShopSuggestionRow({ item }: { item: CommunitySuggestion }) {
  const communityUi = useCommunityUi()
  const title = item.title?.trim() ?? ''
  const subtitle = item.subtitle?.trim() ?? ''
  const reason = item.reason?.trim() ?? ''
  const avatarName = title || subtitle || '?'

  return (
    <XStack
      width="100%"
      gap={10}
      alignItems="center"
      paddingVertical={8}
      paddingHorizontal={8}
      borderRadius={8}
      minHeight={64}
      hoverStyle={{ backgroundColor: communityUi.divider }}
    >
      <AppLink href={item.href as never} asChild>
        <XStack flex={1} minWidth={0} gap={10} alignItems="flex-start" cursor="pointer" pressStyle={{ opacity: 0.92 }}>
          {item.imageUrl ? (
            <YStack width={AVATAR_SIZE} height={AVATAR_SIZE} flexShrink={0} marginTop={2}>
              <Avatar name={avatarName} src={item.imageUrl} size={AVATAR_SIZE} />
            </YStack>
          ) : (
            <XStack
              width={AVATAR_SIZE}
              height={AVATAR_SIZE}
              flexShrink={0}
              marginTop={2}
              borderRadius={999}
              backgroundColor={brandColors.coral}
              alignItems="center"
              justifyContent="center"
            >
              <Icons.Store size={14} color="white" />
            </XStack>
          )}

          <YStack flex={1} minWidth={0} gap={2} justifyContent="center">
            <Text fontSize={14} fontWeight="600" lineHeight={18} color={communityUi.text} numberOfLines={1}>
              {title}
            </Text>
            {subtitle ? (
              <Text fontSize={12} lineHeight={16} color={communityUi.textMuted} numberOfLines={1}>
                {subtitle}
              </Text>
            ) : null}
            {reason ? (
              <Text fontSize={11} lineHeight={14} fontWeight="500" color={communityUi.brand} numberOfLines={1}>
                {reason}
              </Text>
            ) : null}
          </YStack>
        </XStack>
      </AppLink>

      <YStack flexShrink={0}>
        <ShopActionButtons shopId={item.id} size="$2" borderRadius={999} />
      </YStack>
    </XStack>
  )
}
