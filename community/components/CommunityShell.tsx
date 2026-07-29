import { usePathname } from 'one'
import { Platform } from 'react-native'

import { CommunityLeftSidebar } from '~/community/components/CommunityLeftSidebar'
import { CommunityRightSidebar } from '~/community/components/CommunityRightSidebar'
import { useCommunityUi } from '~/community/lib/community-theme'
import { COMMUNITY_LAYOUT } from '~/community/lib/layout'
import { FullWidthLayout, PageColumns, PageSection } from '~/components/layout'
import { ScrollView, YStack } from '~/components/ui'
import { useAppLayout } from '~/hooks/useAppLayout'
import { APP_LAYOUT } from '~/lib/layout/constants'
import { LAYOUT_STRETCH } from '~/lib/layout/styles'
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
 * Desktop web: viewport-locked columns — left/right rails stay put while the
 * center feed scrolls (LinkedIn-style sticky sidebars).
 * Mobile/native: page scroll via FullWidthLayout / PageScroll.
 */
export function CommunityShell({
  children,
  onRefresh,
  refreshing,
  scroll = true,
}: CommunityShellProps) {
  const communityUi = useCommunityUi()
  const pathname = usePathname()
  const { isWide, isDesktopWeb, gutter } = useAppLayout()
  const showSidebars = isCommunityPath(pathname)

  // Desktop web sticky rails: always use center ScrollView for document chrome.
  // When scroll=false (FlashList feed), skip the outer page scroller on mobile/native.
  if (Platform.OS === 'web' && isDesktopWeb && showSidebars) {
    const shellHeight = `calc(100dvh - ${APP_LAYOUT.desktopHeaderHeight}px)` as const

    return (
      <YStack
        width="100%"
        maxWidth="100%"
        alignSelf="stretch"
        backgroundColor={communityUi.pageBg}
        style={
          {
            height: shellHeight,
            maxHeight: shellHeight,
            overflow: 'hidden',
          } as const
        }
      >
        <YStack
          flex={1}
          minHeight={0}
          width="100%"
          paddingHorizontal={gutter}
          paddingVertical="$3"
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
                style={
                  {
                    flex: 1,
                    minHeight: 0,
                    height: '100%',
                    overflowY: 'auto',
                    WebkitOverflowScrolling: 'touch',
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
                <YStack flex={1} minWidth={0} gap="$3" backgroundColor={communityUi.pageBg} {...LAYOUT_STRETCH}>
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

            {isWide ? <CommunityRightSidebar pin="viewport" /> : null}
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
        <PageColumns gap={COMMUNITY_LAYOUT.columnGap} flex={scroll ? undefined : 1} minHeight={scroll ? undefined : 0}>
          {showSidebars ? <CommunityLeftSidebar pin="document" /> : null}

          <YStack flex={1} minWidth={0} minHeight={scroll ? undefined : 0} gap="$3" backgroundColor={communityUi.pageBg} {...LAYOUT_STRETCH}>
            {children}
          </YStack>

          {showSidebars && isWide ? <CommunityRightSidebar pin="document" /> : null}
        </PageColumns>
      </PageSection>
    </FullWidthLayout>
  )
}
