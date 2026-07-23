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
  const isWeb = Platform.OS === 'web'

  return (
    <YStack
      width="100%"
      backgroundColor={communityUi.cardBg}
      borderRadius={radius.card}
      borderWidth={1}
      borderColor={communityUi.borderLight}
      // Keep clipped corners; reaction picker uses Modal on native so it won't clip.
      overflow="hidden"
      padding={padding}
      gap={gap}
      style={isWeb ? { boxShadow: communityUi.cardShadow } : nativeShadow}
      {...(isWeb ? motion.fadeUp : null)}
      {...(isWeb ? motion.pressable : null)}
      {...props}
    >
      {children}
    </YStack>
  )
}
