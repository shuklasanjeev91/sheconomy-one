import type { ReactNode } from 'react'
import { Platform } from 'react-native'

import { useCommunityUi } from '~/community/lib/community-theme'
import { Avatar, Image, Text, XStack, YStack } from '~/components/ui'
import { getShadowStyle, radius } from '~/config/tokens'

type EntityPageHeroProps = {
  coverUrl?: string | null
  avatarUrl?: string | null
  avatarName: string
  title: string
  subtitle?: string | null
  meta?: string | null
  badge?: string | null
  actions?: ReactNode
}

export function EntityPageHero({
  coverUrl,
  avatarUrl,
  avatarName,
  title,
  subtitle,
  meta,
  badge,
  actions,
}: EntityPageHeroProps) {
  const communityUi = useCommunityUi()
  return (
    <YStack
      backgroundColor={communityUi.cardBg}
      borderRadius={radius.card}
      borderWidth={1}
      borderColor={communityUi.borderLight}
      overflow="hidden"
      style={getShadowStyle('sm')}
    >
      <YStack height={200} backgroundColor={communityUi.brand} overflow="hidden" position="relative">
        {coverUrl ? (
          <Image src={coverUrl} width="100%" height={200} objectFit="cover" />
        ) : (
          <YStack
            flex={1}
            width="100%"
            height="100%"
            style={
              Platform.OS === 'web'
                ? ({ background: `linear-gradient(135deg, ${communityUi.brand} 0%, ${communityUi.brand}cc 100%)` } as const)
                : undefined
            }
            backgroundColor={communityUi.brand}
          />
        )}
      </YStack>

      <YStack paddingHorizontal={20} paddingBottom={20} gap={12} marginTop={-52}>
        <Avatar
          name={avatarName}
          src={avatarUrl ?? undefined}
          size="$7"
          borderWidth={4}
          borderColor={communityUi.cardBg}
          style={getShadowStyle('md')}
        />

        <YStack gap={6}>
          <Text fontSize={28} fontWeight="800" color={communityUi.text} letterSpacing={-0.45}>
            {title}
          </Text>
          {subtitle ? (
            <Text fontSize={15} color={communityUi.textMuted} lineHeight={22}>
              {subtitle}
            </Text>
          ) : null}
          {meta ? (
            <Text fontSize={13} color={communityUi.textMuted} lineHeight={20}>
              {meta}
            </Text>
          ) : null}
          {badge ? (
            <XStack alignSelf="flex-start" paddingHorizontal={10} paddingVertical={4} borderRadius={999} backgroundColor={communityUi.divider}>
              <Text fontSize={12} fontWeight="600" color={communityUi.textMuted}>
                {badge}
              </Text>
            </XStack>
          ) : null}
        </YStack>

        {actions ? <XStack gap={8} flexWrap="wrap">{actions}</XStack> : null}
      </YStack>
    </YStack>
  )
}