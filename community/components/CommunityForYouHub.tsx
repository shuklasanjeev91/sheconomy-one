import { useState, type ReactNode } from 'react'

import { ForYouSlotsProvider, useForYouSlots } from '~/community/components/ForYouSlot'
import { useCommunityUi } from '~/community/lib/community-theme'
import { Button, Icons, Text, XStack, YStack } from '~/components/ui'

/** Community Home "For you" hub — density-capped strip list with See all. */

type CommunityForYouHubProps = {
  children: ReactNode
}

export function CommunityForYouHub({ children }: CommunityForYouHubProps) {
  const [expanded, setExpanded] = useState(true)
  const [showAll, setShowAll] = useState(false)

  return (
    <ForYouSlotsProvider showAll={showAll}>
      <CommunityForYouHubInner
        expanded={expanded}
        showAll={showAll}
        onToggleExpanded={() => setExpanded((value) => !value)}
        onToggleShowAll={() => setShowAll((value) => !value)}
      >
        {children}
      </CommunityForYouHubInner>
    </ForYouSlotsProvider>
  )
}

function CommunityForYouHubInner({
  children,
  expanded,
  showAll,
  onToggleExpanded,
  onToggleShowAll,
}: {
  children: ReactNode
  expanded: boolean
  showAll: boolean
  onToggleExpanded: () => void
  onToggleShowAll: () => void
}) {
  const communityUi = useCommunityUi()
  const { contentCount, overflowCount } = useForYouSlots()

  return (
    <YStack gap={12} width="100%">
      <XStack
        alignItems="center"
        justifyContent="space-between"
        gap={8}
        cursor="pointer"
        onPress={onToggleExpanded}
        paddingHorizontal={4}
        hitSlop={8}
      >
        <YStack flex={1} minWidth={0} gap={2}>
          <Text fontSize={16} fontWeight="700" color={communityUi.text}>
            For you
          </Text>
          <Text fontSize={13} color={communityUi.textMuted}>
            {contentCount > 0
              ? `${contentCount} update${contentCount === 1 ? '' : 's'} · invitations, revisits, and picks`
              : 'Invitations, revisits, jobs, commerce picks, and tags in one place.'}
          </Text>
        </YStack>
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
        Keep children mounted when collapsed so data-fetching strips do not
        lose loaded state on re-expand.
      */}
      <YStack gap={12} width="100%" display={expanded ? 'flex' : 'none'}>
        {children}
        {overflowCount > 0 ? (
          <XStack justifyContent="center" paddingTop={4}>
            <Button
              tone="ghost"
              size="$3"
              borderRadius={999}
              onPress={onToggleShowAll}
              iconAfter={
                showAll ? (
                  <Icons.ChevronUp size={16} color={communityUi.textMuted} />
                ) : (
                  <Icons.ChevronDown size={16} color={communityUi.textMuted} />
                )
              }
            >
              {showAll ? 'Show less' : `See all (${overflowCount} more)`}
            </Button>
          </XStack>
        ) : null}
      </YStack>
    </YStack>
  )
}
