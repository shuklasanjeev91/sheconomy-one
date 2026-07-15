import { useEffect } from 'react'
import { Platform } from 'react-native'
import type { NativeSyntheticEvent, NativeScrollEvent } from 'react-native'

import { ScrollView, YStack } from '~/components/ui'
import { useAppBarScroll } from '~/components/navigation/AppBarScrollContext'
import { useAppLayout } from '~/hooks/useAppLayout'
import { useAppUi } from '~/lib/theme/useAppUi'

type PageScrollProps = {
  children: React.ReactNode
}

/**
 * Cross-platform scroll container.
 * Web desktop: natural document flow (window scroll) so footer follows content.
 * Native + mobile web: flex ScrollView between sticky header and bottom tabs.
 */
export function PageScroll({ children }: PageScrollProps) {
  const { isDesktopWeb, mobileTabBarOffset } = useAppLayout()
  const { setScrollY } = useAppBarScroll()
  const ui = useAppUi()

  useEffect(() => {
    return () => setScrollY(0)
  }, [setScrollY])

  function handleScroll(event: NativeSyntheticEvent<NativeScrollEvent>) {
    setScrollY(event.nativeEvent.contentOffset.y)
  }

  const useDocumentScroll = Platform.OS === 'web' && isDesktopWeb

  if (useDocumentScroll) {
    return (
      <YStack width="100%" maxWidth="100%" alignSelf="stretch" backgroundColor={ui.background}>
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
      style={
        Platform.OS === 'web'
          ? ({
              flex: 1,
              minHeight: 0,
              overflowY: 'auto',
              WebkitOverflowScrolling: 'touch',
              marginBottom: bottomInset,
            } as const)
          : ({ marginBottom: bottomInset } as const)
      }
      contentContainerStyle={{
        width: '100%',
        maxWidth: '100%',
        backgroundColor: ui.background,
        paddingBottom: 16,
      }}
    >
      {children}
    </ScrollView>
  )
}