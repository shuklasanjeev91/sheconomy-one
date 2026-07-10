import type { ReactNode } from 'react'
import { Platform } from 'react-native'
import type { Edge } from 'react-native-safe-area-context'
import { SafeAreaView } from 'react-native-safe-area-context'

type NativeSafeAreaProps = {
  children: ReactNode
  edges?: Edge[]
}

/** Applies iOS/Android safe-area insets via react-native-safe-area-context (no-op on web). */
export function NativeSafeArea({ children, edges = ['top'] }: NativeSafeAreaProps) {
  if (Platform.OS === 'web') {
    return children
  }

  return (
    <SafeAreaView style={{ flex: 1, width: '100%' }} edges={edges}>
      {children}
    </SafeAreaView>
  )
}
