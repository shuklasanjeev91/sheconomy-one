import type { ReactNode } from 'react'

import { Platform } from 'react-native'

import { ScrollView, XStack } from '~/components/ui'

type HorizontalScrollRowProps = {
  children: ReactNode
  gap?: number | string
}

/** Cross-platform horizontal scroller for full-width card rails (web + native). */
export function HorizontalScrollRow({ children, gap = '$3' }: HorizontalScrollRowProps) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      width="100%"
      maxWidth="100%"
      style={Platform.OS === 'web' ? { overflowX: 'auto', overflowY: 'visible', flexGrow: 0 } : { flexGrow: 0 }}
      contentContainerStyle={{
        flexGrow: 0,
        alignItems: 'stretch',
      }}
    >
      <XStack gap={gap} paddingRight="$4" alignItems="stretch" minHeight={1} width="100%">
        {children}
      </XStack>
    </ScrollView>
  )
}