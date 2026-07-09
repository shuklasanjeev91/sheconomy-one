import type { ReactNode } from 'react'

import { useCommunityUi } from '~/community/lib/community-theme'
import { Avatar, Image, Text, XStack, YStack } from '~/components/ui'

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
      borderRadius={12}
      borderWidth={1}
      borderColor={communityUi.borderLight}
      overflow="hidden"
    >
      <YStack height={180} backgroundColor={communityUi.brand}>
        {coverUrl ? <Image src={coverUrl} width="100%" height={180} /> : null}
      </YStack>

      <YStack paddingHorizontal={16} paddingBottom={16} gap={12} marginTop={-48}>
        <Avatar
          name={avatarName}
          src={avatarUrl ?? undefined}
          size="$7"
          borderWidth={4}
          borderColor={communityUi.cardBg}
        />

        <YStack gap={6}>
          <Text fontSize={26} fontWeight="700" color={communityUi.text} letterSpacing={-0.3}>
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