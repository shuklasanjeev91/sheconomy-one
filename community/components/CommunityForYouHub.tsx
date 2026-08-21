import { useState, type ReactNode } from 'react'

import { useCommunityUi } from '~/community/lib/community-theme'
import { Icons, Text, XStack, YStack } from '~/components/ui'

type CommunityForYouHubProps = {
  children: ReactNode
}

export function CommunityForYouHub({ children }: CommunityForYouHubProps) {
  const communityUi = useCommunityUi()
  const [expanded, setExpanded] = useState(true)

  return (
    <YStack gap={12} width="100%">
      <XStack
        alignItems="center"
        justifyContent="space-between"
        gap={8}
        cursor="pointer"
        onPress={() => setExpanded((value) => !value)}
        paddingHorizontal={4}
        hitSlop={8}
      >
        <YStack flex={1} minWidth={0} gap={2}>
          <Text fontSize={16} fontWeight="700" color={communityUi.text}>
            For you
          </Text>
          <Text fontSize={13} color={communityUi.textMuted}>
            Invitations, revisits, jobs, commerce picks, and tags in one place.
          </Text>
        </YStack>
        {/* Wrap icon in XStack so Tamagui's rotate prop applies reliably on iOS/Android */}
        <XStack
          rotate={expanded ? '180deg' : '0deg'}
          animation="quick"
          alignItems="center"
          justifyContent="center"
        >
          <Icons.ChevronDown size={18} color={communityUi.textMuted} />
        </XStack>
      </XStack>

      {/*
        Keep children mounted even when collapsed so data-fetching children
        (like TodayCelebrationsCard) don't lose their loaded state on re-expand.
        We hide via display="none" equivalent using height/overflow instead of
        unmounting, so hooks stay alive.
      */}
      <YStack
        gap={12}
        width="100%"
        display={expanded ? 'flex' : 'none'}
      >
        {children}
      </YStack>
    </YStack>
  )
}
