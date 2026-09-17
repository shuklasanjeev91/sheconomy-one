import { usePathname } from 'one'
import { Platform, useWindowDimensions } from 'react-native'

import { CommunityLeftSidebar } from '~/community/components/CommunityLeftSidebar'
import { CommunityRightSidebar } from '~/community/components/CommunityRightSidebar'
import { useCommunityUi } from '~/community/lib/community-theme'
import { COMMUNITY_LAYOUT } from '~/community/lib/layout'
import { FullWidthLayout, PageColumns, PageSection } from '~/components/layout'
import { ScrollView, YStack } from '~/components/ui'
import { useAppLayout } from '~/hooks/useAppLayout'
import { usePullToRefresh } from '~/hooks/usePullToRefresh'
import { LAYOUT_STRETCH, scrollHostTransformReset } from '~/lib/layout/styles'
import { isCommunityPath } from '~/lib/routes'

import type { ReactNode } from 'react'

type CommunityShellProps = {
  children: ReactNode
  /** @deprecated Feed is always full width between side rails. */
  wide?: boolean
  onRefresh?: () => void | Promise<void>
  refreshing?: boolean
  /**
   * When false, shell does not wrap content in a page ScrollView —
   * child owns scrolling (e.g. FlashList feed). Default true.
   */
  scroll?: boolean
}

/**
 * Full-width social layout.
 * With side rails (desktop web + iPad / large tablets): left/right stay pinned while
 * the center column scrolls — LinkedIn-style sticky sidebars on every
 * community tab (Home, Network, Jobs, …), not only the feed.
 * Phone: page scroll via FullWidthLayout / PageScroll.
 */
export function CommunityShell({
  children,
  onRefresh,
  refreshing,
  scroll = true,
}: CommunityShellProps) {
  const communityUi = useCommunityUi()
  const pathname = usePathname()
  const { height: windowHeight } = useWindowDimensions()
  const {
    hasSideRails,
    hasDualSideRails,
    isDesktop,
    gutter,
    mobileTabBarOffset,
    mobileHeaderTotalHeight,
    desktopHeaderHeight,
  } = useAppLayout()
  const showSidebars = isCommunityPath(pathname)
  const { refreshControl, webPullHandlers } = usePullToRefresh({
    onRefresh: scroll ? onRefresh : undefined,
    refreshing,
  })

  // Sticky rails whenever the layout shows side columns — every community tab.
  if (hasSideRails && showSidebars) {
    // Lock a definite viewport height on web + native tablets. Previously only
    // `isDesktopWeb` got calc(100dvh…), so iPad (Safari + app) grew with content
    // and the sidebars scrolled away with the page.
    const chromePx = isDesktop
      ? desktopHeaderHeight
      : mobileHeaderTotalHeight + mobileTabBarOffset
    const lockedPx = Math.max(240, Math.floor(windowHeight - chromePx))
    const bottomInset = isDesktop ? 0 : 12

    return (
      <YStack
        flex={1}
        width="100%"
        maxWidth="100%"
        alignSelf="stretch"
        minHeight={0}
        backgroundColor={communityUi.pageBg}
        style={
          Platform.OS === 'web'
            ? ({
                flex: 1,
                minHeight: 0,
                height: `calc(100dvh - ${chromePx}px)`,
                maxHeight: `calc(100dvh - ${chromePx}px)`,
                overflow: 'hidden',
              } as const)
            : ({
                flex: 1,
                minHeight: 0,
                height: lockedPx,
                maxHeight: lockedPx,
                overflow: 'hidden',
              } as const)
        }
      >
        <YStack
          flex={1}
          minHeight={0}
          width="100%"
          height="100%"
          paddingHorizontal={gutter}
          paddingVertical="$3"
          paddingBottom={bottomInset > 0 ? bottomInset : undefined}
        >
          <PageColumns
            gap={COMMUNITY_LAYOUT.columnGap}
            flex={1}
            minHeight={0}
            height="100%"
            alignItems="stretch"
          >
            <CommunityLeftSidebar pin="viewport" />

            {scroll ? (
              <ScrollView
                flex={1}
                minWidth={0}
                minHeight={0}
                showsVerticalScrollIndicator
                refreshControl={refreshControl}
                {...(webPullHandlers as object)}
                style={
                  {
                    flex: 1,
                    minHeight: 0,
                    height: '100%',
                    overflowY: 'auto',
                    WebkitOverflowScrolling: 'touch',
                    ...scrollHostTransformReset(),
                  } as const
                }
                contentContainerStyle={{
                  width: '100%',
                  maxWidth: '100%',
                  flexGrow: 1,
                  gap: 12,
                  paddingBottom: 24,
                }}
              >
                <YStack
                  flex={1}
                  minWidth={0}
                  gap="$3"
                  backgroundColor={communityUi.pageBg}
                  {...LAYOUT_STRETCH}
                >
                  {children}
                </YStack>
              </ScrollView>
            ) : (
              <YStack
                flex={1}
                minWidth={0}
                minHeight={0}
                gap="$3"
                backgroundColor={communityUi.pageBg}
                style={{ minHeight: 0, height: '100%', overflow: 'hidden' }}
                {...LAYOUT_STRETCH}
              >
                {children}
              </YStack>
            )}

            {hasDualSideRails ? <CommunityRightSidebar pin="viewport" /> : null}
          </PageColumns>
        </YStack>
      </YStack>
    )
  }

  return (
    <FullWidthLayout
      scroll={scroll}
      backgroundColor={communityUi.pageBg}
      onRefresh={scroll ? onRefresh : undefined}
      refreshing={scroll ? refreshing : undefined}
      flex={1}
    >
      <PageSection paddingVertical="$3" flex={scroll ? undefined : 1} minHeight={scroll ? undefined : 0}>
        <YStack
          flex={1}
          minWidth={0}
          minHeight={scroll ? undefined : 0}
          gap="$3"
          backgroundColor={communityUi.pageBg}
          {...LAYOUT_STRETCH}
        >
          {children}
        </YStack>
      </PageSection>
    </FullWidthLayout>
  )
}
