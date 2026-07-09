import type { ReactNode } from 'react'

import { CommunityCard } from '~/community/components/CommunityCard'
import { useCommunityUi } from '~/community/lib/community-theme'
import { Text, XStack, YStack } from '~/components/ui'

type CommunityWidgetProps = {
  title: string
  subtitle?: string
  headerActions?: ReactNode
  children: ReactNode
  footer?: ReactNode
}

/** Right-rail widget card for the community feed. */
export function CommunityWidget({
  title,
  subtitle,
  headerActions,
  children,
  footer,
}: CommunityWidgetProps) {
  const communityUi = useCommunityUi()
  return (
    <CommunityCard gap={0}>
      <XStack
        paddingHorizontal={12}
        paddingTop={12}
        paddingBottom={subtitle ? 4 : 8}
        alignItems="center"
        justifyContent="space-between"
        gap={8}
      >
        <YStack flex={1} gap={subtitle ? 4 : 0}>
          <Text fontSize={17} fontWeight="700" color={communityUi.text}>
            {title}
          </Text>
          {subtitle ? (
            <Text fontSize={12} color={communityUi.textMuted} lineHeight={16}>
              {subtitle}
            </Text>
          ) : null}
        </YStack>
        {headerActions ? <XStack gap={4}>{headerActions}</XStack> : null}
      </XStack>
      <YStack paddingHorizontal={12} paddingBottom={12}>
        {children}
      </YStack>
      {footer ? (
        <YStack
          paddingHorizontal={12}
          paddingVertical={10}
          borderTopWidth={1}
          borderTopColor={communityUi.borderLight}
        >
          {footer}
        </YStack>
      ) : null}
    </CommunityCard>
  )
}