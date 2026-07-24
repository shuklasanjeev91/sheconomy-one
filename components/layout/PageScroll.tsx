import { useEffect } from 'react'
import { Platform } from 'react-native'
import type { NativeSyntheticEvent, NativeScrollEvent } from 'react-native'

import { ScrollView, YStack } from '~/components/ui'
import { useAppBarScroll } from '~/components/navigation/AppBarScrollContext'
import { usePullToRefresh } from '~/hooks/usePullToRefresh'
import { useAppLayout } from '~/hooks/useAppLayout'
import { useAppUi } from '~/lib/theme/useAppUi'

type PageScrollProps = {
  children: React.ReactNode
  /** Pull-down (drag-down) refresh — works on iOS/Android and touch web scroll. */
  onRefresh?: () => void | Promise<void>
  refreshing?: boolean
}

/**
 * Cross-platform scroll container.
 * Web desktop: natural document flow (window scroll) so footer follows content.
 * Native + mobile web: flex ScrollView between sticky header and bottom tabs.
 *
 * Requires a stretch parent on mobile/native. Do not wrap document-scroll routes
 * (desktop commerce/class/co-work) in `flex:1; minHeight:0` — that clips content
 * and kills window scrolling.
 */
export function PageScroll({ children, onRefresh, refreshing }: PageScrollProps) {
  const { isDesktopWeb, mobileTabBarOffset } = useAppLayout()
  const { setScrollY } = useAppBarScroll()
  const ui = useAppUi()
  const { refreshControl, webPullHandlers, runRefresh } = usePullToRefresh({
    onRefresh,
    refreshing,
  })

  useEffect(() => {
    return () => setScrollY(0)
  }, [setScrollY])

  function handleScroll(event: NativeSyntheticEvent<NativeScrollEvent>) {
    setScrollY(event.nativeEvent.contentOffset.y)
  }

  const useDocumentScroll = Platform.OS === 'web' && isDesktopWeb

  if (useDocumentScroll) {
    return (
      <YStack
        width="100%"
        maxWidth="100%"
        alignSelf="stretch"
        flexShrink={0}
        backgroundColor={ui.background}
      >
        {onRefresh ? (
          <YStack
            alignItems="center"
            paddingVertical="$2"
            cursor="pointer"
            onPress={() => void runRefresh()}
            hoverStyle={{ opacity: 0.85 }}
            accessibilityRole="button"
            accessibilityLabel="Refresh"
          >
            {/* Subtle desktop affordance — drag-down is for touch/native. */}
          </YStack>
        ) : null}
        {children}
      </YStack>
    )
  }

  // The bottom tab bar is a fixed/absolute opaque overlay, so the scroll
  // viewport is inset by its height (via marginBottom) to end exactly at the
  // tab bar's top edge — otherwise content scrolls behind (and is hidden by) it.
  const bottomInset = isDesktopWeb ? 0 : mobileTabBarOffset

  return (
    <ScrollView
      flex={1}
      width="100%"
      maxWidth="100%"
      backgroundColor={ui.background}
      onScroll={handleScroll}
      scrollEventThrottle={16}
      showsVerticalScrollIndicator
      keyboardShouldPersistTaps="handled"
      nestedScrollEnabled
      refreshControl={refreshControl}
      {...(webPullHandlers as object)}
      style={
        Platform.OS === 'web'
          ? ({
              flex: 1,
              minHeight: 0,
              height: '100%',
              overflowY: 'auto',
              WebkitOverflowScrolling: 'touch',
              marginBottom: bottomInset,
            } as const)
          : ({ flex: 1, marginBottom: bottomInset } as const)
      }
      contentContainerStyle={{
        width: '100%',
        maxWidth: '100%',
        flexGrow: 1,
        backgroundColor: ui.background,
        // Tab clearance comes from `marginBottom` / `mobileTabBarOffset` — avoid a second spacer.
        paddingBottom: 0,
      }}
    >
      {children}
    </ScrollView>
  )
}
