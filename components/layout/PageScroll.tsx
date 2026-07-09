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
 * Mobile native: flex ScrollView between sticky header and fixed bottom tabs.
 * Web desktop: natural document flow so the global footer follows content.
 */
export function PageScroll({ children }: PageScrollProps) {
  const { isDesktop } = useAppLayout()
  const { setScrollY } = useAppBarScroll()
  const ui = useAppUi()

  useEffect(() => {
    return () => setScrollY(0)
  }, [setScrollY])

  function handleScroll(event: NativeSyntheticEvent<NativeScrollEvent>) {
    setScrollY(event.nativeEvent.contentOffset.y)
  }

  if (isDesktop) {
    return (
      <YStack width="100%" maxWidth="100%" alignSelf="stretch" backgroundColor={ui.background}>
        {children}
      </YStack>
    )
  }

  return (
    <ScrollView
      flex={1}
      width="100%"
      maxWidth="100%"
      backgroundColor={ui.background}
      onScroll={handleScroll}
      scrollEventThrottle={16}
      showsVerticalScrollIndicator={Platform.OS === 'web'}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{
        flexGrow: 1,
        width: '100%',
        maxWidth: '100%',
      }}
    >
      {children}
    </ScrollView>
  )
}