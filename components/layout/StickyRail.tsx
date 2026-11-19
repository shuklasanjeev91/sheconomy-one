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
  const { isDesktopWeb, isDesktop, hasSideRails } = useAppLayout()

  if (pin === 'viewport' && Platform.OS !== 'web') {
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

  // Stick on any web two-column layout (cart/checkout), not only gtMd.
  const stickyActive = Platform.OS === 'web' && (isDesktop || hasSideRails || isDesktopWeb)
  const stickyTop = isDesktopWeb ? STICKY_RAIL_TOP : 16

  // Native div — Tamagui/Yoga can drop or rewrite `position: sticky` on YStack.
  // IMPORTANT: never put overflow on the sticky node itself — that disables sticky
  // in Chromium. Scroll tall summaries in an inner wrapper instead.
  if (stickyActive) {
    const stickyStyle: CSSProperties = {
      position: 'sticky',
      top: stickyTop,
      alignSelf: 'flex-start',
      zIndex: 5,
      flexShrink: 0,
      width: cssSize(width) ?? '100%',
      maxWidth: cssSize(maxWidth) ?? '100%',
      ...(style as CSSProperties),
    }

    const innerStyle: CSSProperties | undefined = scrollable
      ? {
          maxHeight: `calc(100vh - ${stickyTop + 16}px)`,
          overflowY: 'auto',
          overflowX: 'hidden',
          overscrollBehavior: 'contain',
          WebkitOverflowScrolling: 'touch',
        }
      : undefined

    return (
      <div data-sticky-rail="document" style={stickyStyle}>
        {innerStyle ? <div style={innerStyle}>{children}</div> : children}
      </div>
    )
  }

  const fallbackStyle = stickyRailStyle({ scrollable, top: stickyTop })

  return (
    <YStack
      flexShrink={0}
      alignSelf="flex-start"
      width={width as never}
      maxWidth={maxWidth as never}
      style={style ? { ...fallbackStyle, ...(style as object) } : fallbackStyle}
      {...props}
    >
      {children}
    </YStack>
  )
}
