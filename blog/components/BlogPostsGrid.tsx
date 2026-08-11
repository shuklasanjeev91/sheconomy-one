import { Children, type ReactNode, useEffect } from 'react'
import { Platform, type StyleProp, type ViewStyle, useWindowDimensions } from 'react-native'

import { XStack, YStack } from '~/components/ui'

const GAP = 16
const STYLE_ID = 'sheconomy-blog-posts-grid-css'

/**
 * Responsive column count:
 * - phone (< 700): 1
 * - tablet (700–979): 2
 * - desktop (≥ 980): 3
 */
export function blogGridColumns(isDesktopOrWidth: boolean | number, isTablet = false): 1 | 2 | 3 {
  if (typeof isDesktopOrWidth === 'number') {
    if (isDesktopOrWidth >= 980) return 3
    if (isDesktopOrWidth >= 700) return 2
    return 1
  }
  if (isDesktopOrWidth) return 3
  if (isTablet) return 2
  return 1
}

export function blogCardColumnWidth(isDesktop: boolean, isTablet: boolean): string | number {
  const cols = blogGridColumns(isDesktop, isTablet)
  if (Platform.OS !== 'web') return '100%'
  if (cols === 1) return '100%'
  const gaps = GAP * (cols - 1)
  return `calc((100% - ${gaps}px) / ${cols})`
}

function ensureGridCss() {
  if (typeof document === 'undefined') return
  if (document.getElementById(STYLE_ID)) return
  const el = document.createElement('style')
  el.id = STYLE_ID
  el.textContent = `
.blog-posts-grid {
  display: grid;
  width: 100%;
  gap: ${GAP}px;
  align-items: stretch;
  grid-template-columns: minmax(0, 1fr);
}
@media (min-width: 700px) {
  .blog-posts-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
@media (min-width: 980px) {
  .blog-posts-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}
.blog-posts-grid > * {
  min-width: 0;
  width: 100%;
  max-width: 100%;
}
`
  document.head.appendChild(el)
}

/** Responsive card grid: 1 → 2 → 3 columns by viewport width. */
export function BlogPostsGrid({ children }: { children: ReactNode }) {
  const { width } = useWindowDimensions()

  useEffect(() => {
    if (Platform.OS === 'web') ensureGridCss()
  }, [])

  if (Platform.OS === 'web') {
    return (
      <div className="blog-posts-grid" style={{ width: '100%' }}>
        {children}
      </div>
    )
  }

  const cols = blogGridColumns(width)
  const cardWidth =
    cols === 1 ? '100%' : (`calc((100% - ${GAP * (cols - 1)}px) / ${cols})` as const)

  return (
    <XStack gap={GAP} flexWrap="wrap" width="100%" alignItems="stretch">
      {Children.map(children, (child) => (
        <YStack
          width={cardWidth as any}
          flexShrink={0}
          maxWidth="100%"
          style={{ minWidth: 0 } as StyleProp<ViewStyle>}
        >
          {child}
        </YStack>
      ))}
    </XStack>
  )
}
