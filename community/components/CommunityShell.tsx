import { usePathname } from 'one'

import { CommunityLeftSidebar } from '~/community/components/CommunityLeftSidebar'
import { CommunityRightSidebar } from '~/community/components/CommunityRightSidebar'
import { useCommunityUi } from '~/community/lib/community-theme'
import { COMMUNITY_LAYOUT } from '~/community/lib/layout'
import { FullWidthLayout, PageColumns, PageSection } from '~/components/layout'
import { ScrollView, YStack } from '~/components/ui'
import { useAppLayout } from '~/hooks/useAppLayout'
import { usePullToRefresh } from '~/hooks/usePullToRefresh'
import { APP_LAYOUT } from '~/lib/layout/constants'
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
 * With side rails (desktop web + large tablets): left/right stay pinned while
 * the center column scrolls — LinkedIn-style sticky sidebars on every
 * community tab (Home, Network, Jobs, …), not only the feed.
 * Mobile: page scroll via FullWidthLayout / PageScroll.
 */
export function CommunityShell({
  children,
  onRefresh,
  refreshing,
  scroll = true,
}: CommunityShellProps) {
  const communityUi = useCommunityUi()
  const pathname = usePathname()
  const { hasSideRails, hasDualSideRails, isDesktopWeb, gutter, mobileTabBarOffset } =
    useAppLayout()
  const showSidebars = isCommunityPath(pathname)
  const { refreshControl, webPullHandlers } = usePullToRefresh({
    onRefresh: scroll ? onRefresh : undefined,
    refreshing,
  })

  // Sticky rails whenever the layout shows side columns — every community tab.
  if (hasSideRails && showSidebars) {
    const shellHeight = isDesktopWeb
      ? (`calc(100dvh - ${APP_LAYOUT.desktopHeaderHeight}px)` as const)
      : undefined
    const bottomInset = isDesktopWeb ? 0 : mobileTabBarOffset

    return (
      <YStack
        flex={1}
        width="100%"
        maxWidth="100%"
        alignSelf="stretch"
        minHeight={0}
        backgroundColor={communityUi.pageBg}
        style={
          shellHeight
            ? ({
                height: shellHeight,
                maxHeight: shellHeight,
                overflow: 'hidden',
              } as const)
            : ({ flex: 1, minHeight: 0, overflow: 'hidden' } as const)
        }
      >
        <YStack
          flex={1}
          minHeight={0}
          width="100%"
          paddingHorizontal={gutter}
          paddingVertical="$3"
          paddingBottom={bottomInset > 0 ? bottomInset + 12 : undefined}
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
