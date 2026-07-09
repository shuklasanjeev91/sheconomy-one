import { useCommunityUi } from '~/community/lib/community-theme'
import { COMMUNITY_LAYOUT } from '~/community/lib/layout'
import { YStack } from '~/components/ui'
import { FullWidthLayout, PageColumns, PageSection } from '~/components/layout'
import { LAYOUT_STRETCH } from '~/lib/layout/styles'

import type { ReactNode } from 'react'

import { CommunityLeftSidebar } from '~/community/components/CommunityLeftSidebar'
import { CommunityRightSidebar } from '~/community/components/CommunityRightSidebar'

type CommunityShellProps = {
  children: ReactNode
  /** @deprecated Feed is always full width between side rails. */
  wide?: boolean
}

/**
 * Full-width social layout: sticky side rails on desktop, single full-width feed on mobile.
 */
export function CommunityShell({ children }: CommunityShellProps) {
  const communityUi = useCommunityUi()
  return (
    <FullWidthLayout scroll backgroundColor={communityUi.pageBg}>
      <PageSection paddingVertical="$3">
        <PageColumns gap={COMMUNITY_LAYOUT.columnGap}>
          <CommunityLeftSidebar />

          <YStack flex={1} minWidth={0} gap="$2" {...LAYOUT_STRETCH}>
            {children}
          </YStack>

          <CommunityRightSidebar />
        </PageColumns>
      </PageSection>
    </FullWidthLayout>
  )
}