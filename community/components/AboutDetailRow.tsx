import type { ComponentType } from 'react'

import { useCommunityUi } from '~/community/lib/community-theme'
import { Text, XStack, YStack } from '~/components/ui'

type AboutDetailRowProps = {
  icon: ComponentType<{ size?: number; color?: string }>
  label: string
  value: string
}

export function AboutDetailRow({ icon: Icon, label, value }: AboutDetailRowProps) {
  const communityUi = useCommunityUi()
  return (
    <XStack gap={12} alignItems="flex-start" paddingVertical={10}>
      <XStack
        width={36}
        height={36}
        borderRadius={999}
        backgroundColor={communityUi.divider}
        alignItems="center"
        justifyContent="center"
        flexShrink={0}
      >
        <Icon size={18} color={communityUi.textMuted} />
      </XStack>
      <YStack flex={1} gap={2}>
        <Text fontSize={12} fontWeight="600" color={communityUi.textMuted} textTransform="uppercase">
          {label}
        </Text>
        <Text fontSize={15} color={communityUi.text} lineHeight={22}>
          {value}
        </Text>
      </YStack>
    </XStack>
  )
}