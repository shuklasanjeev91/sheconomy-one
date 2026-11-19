import type { CSSProperties, ReactNode } from 'react'
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
  width?: number | string
  maxWidth?: number | string
} & Omit<GetProps<typeof YStack>, 'width' | 'maxWidth'>

function cssSize(value: number | string | undefined): string | number | undefined {
  if (value == null) return undefined
  return typeof value === 'number' ? value : value
}

/** Sticky side rail / order summary column — reliable on web document scroll. */
export function StickyRail({
  children,
  scrollable = false,
  pin = 'document',
  style,
  width,
  maxWidth,
  ...props
}: StickyRailProps) {
  const { isDesktopWeb, isDesktop } = useAppLayout()

  if (pin === 'viewport' && Platform.OS !== 'web') {
    // Native tablets / iPad: pin the rail to the row height and scroll inside
    // so long left-nav lists stay reachable while the center column scrolls.
    const { gap, ...rest } = props

    return (
      <YStack
        flexShrink={0}
        alignSelf="stretch"
        flex={0}
        minHeight={0}
        height="100%"
        maxHeight="100%"
        overflow="hidden"
        width={width as never}
        maxWidth={maxWidth as never}
        style={style as object}
        {...rest}
      >
        <ScrollView
          style={{ flex: 1, height: '100%' }}
          contentContainerStyle={{ paddingBottom: 24, flexGrow: 0 }}
          showsVerticalScrollIndicator={false}
          nestedScrollEnabled
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
        width={width as never}
        maxWidth={maxWidth as never}
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

  // Native div — Tamagui/Yoga can drop or rewrite `position: sticky` on YStack.
  if (stickyActive) {
    const stickyStyle: CSSProperties = {
      position: 'sticky',
      top: stickyTop,
      alignSelf: 'flex-start',
      zIndex: 5,
      flexShrink: 0,
      width: cssSize(width) ?? '100%',
      maxWidth: cssSize(maxWidth) ?? '100%',
      ...(scrollable
        ? {
            maxHeight: `calc(100vh - ${stickyTop + 16}px)`,
            overflowY: 'auto',
            overflowX: 'hidden',
            overscrollBehavior: 'contain',
            WebkitOverflowScrolling: 'touch',
          }
        : null),
      ...(style as CSSProperties),
    }

    return (
      <div data-sticky-rail="document" style={stickyStyle}>
        {children}
      </div>
    )
  }

  const stickyStyle = stickyRailStyle({ scrollable, top: stickyTop })

  return (
    <YStack
      flexShrink={0}
      alignSelf="flex-start"
      width={width as never}
      maxWidth={maxWidth as never}
      style={style ? { ...stickyStyle, ...(style as object) } : stickyStyle}
      {...props}
    >
      {children}
    </YStack>
  )
}
