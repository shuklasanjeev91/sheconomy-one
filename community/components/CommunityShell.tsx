import { usePathname } from 'one'
import { Platform } from 'react-native'

import { useCommunityUi } from '~/community/lib/community-theme'
import { COMMUNITY_LAYOUT } from '~/community/lib/layout'
import { ScrollView, YStack } from '~/components/ui'
import { FullWidthLayout, PageColumns, PageSection } from '~/components/layout'
import { APP_LAYOUT } from '~/lib/layout/constants'
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
}

/**
 * Full-width social layout: sticky side rails on desktop, single full-width feed on mobile.
 * Desktop community routes pin sidebars while the center feed scrolls independently.
 */
export function CommunityShell({ children }: CommunityShellProps) {
  const communityUi = useCommunityUi()
  const pathname = usePathname()
  const { isDesktop, isWide } = useAppLayout()
  const showSidebars = isCommunityPath(pathname)
  const usePinnedSidebars = showSidebars && isDesktop

  if (usePinnedSidebars) {
    const viewportHeight =
      Platform.OS === 'web'
        ? (`calc(100dvh - ${APP_LAYOUT.desktopHeaderHeight}px)` as const)
        : undefined

    return (
      <FullWidthLayout
        backgroundColor={communityUi.pageBg}
        flex={Platform.OS !== 'web' ? 1 : undefined}
        minHeight={Platform.OS !== 'web' ? 0 : undefined}
      >
        <PageSection
          paddingVertical="$3"
          width="100%"
          style={
            Platform.OS === 'web'
              ? ({
                  height: viewportHeight,
                  maxHeight: viewportHeight,
                  overflow: 'hidden',
                } as const)
              : ({ flex: 1, minHeight: 0, overflow: 'hidden' } as const)
          }
        >
          <PageColumns
            gap={COMMUNITY_LAYOUT.columnGap}
            width="100%"
            height="100%"
            maxHeight="100%"
            overflow="hidden"
            alignItems="stretch"
          >
            <CommunityLeftSidebar pin="viewport" />

            <ScrollView
              flex={1}
              minWidth={0}
              width="100%"
              height="100%"
              showsVerticalScrollIndicator
              keyboardShouldPersistTaps="handled"
              style={
                Platform.OS === 'web'
                  ? ({ overflowY: 'auto', minHeight: 0, flex: 1 } as const)
                  : undefined
              }
              contentContainerStyle={{
                flexGrow: 1,
                width: '100%',
                maxWidth: '100%',
              }}
            >
              <YStack gap="$3" width="100%" paddingBottom="$4" {...LAYOUT_STRETCH}>
                {children}
              </YStack>
            </ScrollView>

            {isWide ? <CommunityRightSidebar pin="viewport" /> : null}
          </PageColumns>
        </PageSection>
      </FullWidthLayout>
    )
  }

  return (
    <FullWidthLayout scroll backgroundColor={communityUi.pageBg}>
      <PageSection paddingVertical="$3">
        <PageColumns gap={COMMUNITY_LAYOUT.columnGap}>
          {showSidebars ? <CommunityLeftSidebar /> : null}

          <YStack flex={1} minWidth={0} gap="$3" {...LAYOUT_STRETCH}>
            {children}
          </YStack>

          {showSidebars && isWide ? <CommunityRightSidebar /> : null}
        </PageColumns>
      </PageSection>
    </FullWidthLayout>
  )
}
