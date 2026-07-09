import type { ReactNode } from 'react'
import type { GetProps } from 'tamagui'

import { YStack } from '~/components/ui'
import { screenFillStyle } from '~/lib/platform/viewport'

type ScreenFillProps = {
  children: ReactNode
} & GetProps<typeof YStack>

/** Cross-platform full-height screen root (flex on native, minHeight 100vh on web). */
export function ScreenFill({ children, ...props }: ScreenFillProps) {
  return (
    <YStack alignSelf="stretch" style={screenFillStyle()} {...props}>
      {children}
    </YStack>
  )
}

type ScreenCenterProps = {
  children: ReactNode
} & GetProps<typeof YStack>

/** Cross-platform centered screen state (loading, empty, error). */
export function ScreenCenter({ children, ...props }: ScreenCenterProps) {
  return (
    <ScreenFill alignItems="center" justifyContent="center" {...props}>
      {children}
    </ScreenFill>
  )
}