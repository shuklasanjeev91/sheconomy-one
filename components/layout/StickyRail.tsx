import type { ReactNode } from 'react'
import { Platform } from 'react-native'

import { ScrollView, YStack } from '~/components/ui'
import type { GetProps } from 'tamagui'
import { useAppLayout } from '~/hooks/useAppLayout'
import { STICKY_RAIL_TOP, stickyRailStyle } from '~/components/layout/sticky'

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

  if (pin === 'viewport' && Platform.OS !== 'web') {
    // Native tablets: the page doesn't scroll around the rail, so the rail
    // scrolls itself — otherwise its lower nav items are unreachable in landscape.
    const { gap, ...rest } = props

    return (
      <YStack
        flexShrink={0}
        alignSelf="stretch"
        height="100%"
        maxHeight="100%"
        minHeight={0}
        style={style as object}
        {...rest}
      >
        <ScrollView
          flex={1}
          minHeight={0}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 24 }}
        >
          <YStack width="100%" gap={gap}>
            {children}
          </YStack>
        </ScrollView>
      </YStack>
    )
  }

  if (pin === 'viewport') {
    return (
      <YStack
        flexShrink={0}
        alignSelf="stretch"
        height="100%"
        maxHeight="100%"
        minHeight={0}
        overflow="hidden"
        style={
          {
            height: '100%',
            maxHeight: '100%',
            minHeight: 0,
            overflowY: 'auto',
            overflowX: 'hidden',
            overscrollBehavior: 'contain',
            WebkitOverflowScrolling: 'touch',
            ...(style as object),
          } as const
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
      zIndex={stickyActive ? 5 : undefined}
      style={
        stickyActive || style
          ? {
              ...(stickyStyle ?? {}),
              // Prefer CSS sticky via style — Tamagui `position` can drop `sticky` on web.
              ...(stickyActive
                ? ({ position: 'sticky', top: stickyTop, zIndex: 5 } as const)
                : null),
              ...(style as object),
            }
          : undefined
      }
      {...props}
    >
      {children}
    </YStack>
  )
}
