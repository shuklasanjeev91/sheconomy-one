import type { ReactNode } from 'react'

import { useCommunityUi } from '~/community/lib/community-theme'
import { YStack, type YStackProps } from '~/components/ui'

type CommunityCardProps = YStackProps & {
  children: ReactNode
  padding?: YStackProps['padding']
}

/** Standard community feed card — white surface, 8px radius, subtle border shadow. */
export function CommunityCard({
  children,
  padding = '$0',
  gap = 0,
  ...props
}: CommunityCardProps) {
  const communityUi = useCommunityUi()
  return (
    <YStack
      width="100%"
      backgroundColor={communityUi.cardBg}
      borderRadius={communityUi.cardRadius}
      borderWidth={1}
      borderColor={communityUi.borderLight}
      overflow="hidden"
      padding={padding}
      gap={gap}
      style={{ boxShadow: communityUi.cardShadow }}
      {...props}
    >
      {children}
    </YStack>
  )
}