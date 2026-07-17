import type { ReactNode } from 'react'
import { Platform } from 'react-native'

import { YStack } from '~/components/ui'
import type { GetProps } from 'tamagui'
import { useAppLayout } from '~/hooks/useAppLayout'
import { STICKY_RAIL_TOP, stickyRailStyle } from './sticky'

type StickyRailPin = 'document' | 'viewport'

type StickyRailProps = {
  children: ReactNode
  /** Pin and scroll inside the viewport on web desktop. */
  scrollable?: boolean
  /**
   * `document` — stick while the page scrolls (cart summary).
   * `viewport` — fill the column height; scroll inside the rail (community sidebars).
   */
  pin?: StickyRailPin
} & GetProps<typeof YStack>

/** Sticky side rail / order summary column — reliable on web document scroll. */
export function StickyRail({
  children,
  scrollable = false,
  pin = 'document',
  style,
  ...props
}: StickyRailProps) {
  const { isDesktopWeb, isDesktop } = useAppLayout()

  if (pin === 'viewport') {
    return (
      <YStack
        flexShrink={0}
        height="100%"
        maxHeight="100%"
        overflow="scroll"
        style={
          Platform.OS === 'web'
            ? ({ overflowY: 'auto', minHeight: 0, ...(style as object) } as const)
            : (style as object)
        }
        {...props}
      >
        {children}
      </YStack>
    )
  }

  // Sticky whenever the rail sits beside content on web. Wide windows scroll
  // the document (offset below the sticky app header); narrower desktop
  // windows scroll an inner container that already starts below the header,
  // so `position: sticky` pins against that container with a small offset.
  const stickyActive = Platform.OS === 'web' && isDesktop
  const stickyTop = isDesktopWeb ? STICKY_RAIL_TOP : 16
  const stickyStyle = stickyActive
    ? stickyRailStyle({ scrollable, top: stickyTop })
    : undefined

  return (
    <YStack
      flexShrink={0}
      alignSelf="flex-start"
      position={stickyActive ? 'sticky' : undefined}
      top={stickyActive ? stickyTop : undefined}
      zIndex={stickyActive ? 5 : undefined}
      style={
        stickyStyle || style
          ? { ...(stickyStyle ?? {}), ...(style as object) }
          : undefined
      }
      {...props}
    >
      {children}
    </YStack>
  )
}
