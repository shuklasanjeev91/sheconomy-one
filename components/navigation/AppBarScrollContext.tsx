import type { ReactNode } from 'react'
import { Platform } from 'react-native'
import { createContext, useContext, useMemo, useState } from 'react'

import { YStack } from '~/components/ui'
import { useAppLayout } from '~/hooks/useAppLayout'

type AppBarScrollContextValue = {
  scrollY: number
  setScrollY: (y: number) => void
}

const AppBarScrollContext = createContext<AppBarScrollContextValue | null>(null)

const noop = () => {}

export function AppBarScrollProvider({ children }: { children: React.ReactNode }) {
  const [scrollY, setScrollY] = useState(0)
  const value = useMemo(() => ({ scrollY, setScrollY }), [scrollY])
  const { isDesktopWeb } = useAppLayout()
  const useDocumentScroll = Platform.OS === 'web' && isDesktopWeb

  return (
    <AppBarScrollContext.Provider value={value}>
      <YStack flex={useDocumentScroll ? undefined : 1} width="100%" maxWidth="100%">
        {children}
      </YStack>
    </AppBarScrollContext.Provider>
  )
}

export function useAppBarScroll() {
  const context = useContext(AppBarScrollContext)
  if (!context) {
    return { scrollY: 0, setScrollY: noop }
  }
  return context
}