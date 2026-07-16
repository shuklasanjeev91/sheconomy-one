import { usePathname } from 'one'

import { useCommunityUi } from '~/community/lib/community-theme'
import { COMMUNITY_LAYOUT } from '~/community/lib/layout'
import { YStack } from '~/components/ui'
import { FullWidthLayout, PageColumns, PageSection } from '~/components/layout'
import { LAYOUT_STRETCH } from '~/lib/layout/styles'
import { isCommunityPath } from '~/lib/routes'
import { useAppLayout } from '~/hooks/useAppLayout'

import type { ReactNode } from 'react'

import { CommunityLeftSidebar } from '~/community/components/CommunityLeftSidebar'
import { CommunityRightSidebar } from '~/community/components/CommunityRightSidebar'

type CommunityShellProps = {
  children: ReactNode
  /** @deprecated Feed is always full width between side rails. */
  wide?: boolean
  onRefresh?: () => void | Promise<void>
  refreshing?: boolean
}

/**
 * Full-width social layout: sticky side rails on desktop, single full-width feed on mobile.
 * Uses page scroll (document on desktop web, PageScroll on mobile/native) so the feed
 * never collapses inside a zero-height overflow:hidden pane.
 */
export function CommunityShell({ children, onRefresh, refreshing }: CommunityShellProps) {
  const communityUi = useCommunityUi()
  const pathname = usePathname()
  const { isWide } = useAppLayout()
  const showSidebars = isCommunityPath(pathname)

  return (
    <FullWidthLayout
      scroll
      backgroundColor={communityUi.pageBg}
      onRefresh={onRefresh}
      refreshing={refreshing}
    >
      <PageSection paddingVertical="$3">
        <PageColumns gap={COMMUNITY_LAYOUT.columnGap}>
          {showSidebars ? <CommunityLeftSidebar pin="document" /> : null}

          <YStack flex={1} minWidth={0} gap="$3" {...LAYOUT_STRETCH}>
            {children}
          </YStack>

          {showSidebars && isWide ? <CommunityRightSidebar pin="document" /> : null}
        </PageColumns>
      </PageSection>
    </FullWidthLayout>
  )
}
