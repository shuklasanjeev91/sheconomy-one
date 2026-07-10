import type { ReactNode } from 'react'
import { Platform } from 'react-native'

import { useCommunityUi } from '~/community/lib/community-theme'
import { radius } from '~/config/tokens'
import { motion } from '~/lib/theme/motion'
import { useThemedShadowStyle } from '~/lib/theme/useThemedShadowStyle'
import { YStack, type YStackProps } from '~/components/ui'

type CommunityCardProps = YStackProps & {
  children: ReactNode
  padding?: YStackProps['padding']
}

/** Standard community feed card — elevated surface, generous radius, cross-platform shadow. */
export function CommunityCard({
  children,
  padding = '$0',
  gap = 0,
  ...props
}: CommunityCardProps) {
  const communityUi = useCommunityUi()
  const nativeShadow = useThemedShadowStyle('sm')

  return (
    <YStack
      width="100%"
      backgroundColor={communityUi.cardBg}
      borderRadius={radius.card}
      borderWidth={1}
      borderColor={communityUi.borderLight}
      overflow="hidden"
      padding={padding}
      gap={gap}
      style={
        Platform.OS === 'web'
          ? { boxShadow: communityUi.cardShadow, transition: 'transform 0.2s ease, box-shadow 0.2s ease' }
          : nativeShadow
      }
      animation="quick"
      hoverStyle={Platform.OS === 'web' ? { y: -2 } : undefined}
      {...motion.fadeUp}
      {...props}
    >
      {children}
    </YStack>
  )
}