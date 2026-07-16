import type { ReactNode } from 'react'
import type { GetProps } from 'tamagui'

import { YStack, useMedia } from '~/components/ui'
import { radius } from '~/config/tokens'
import { useAppLayout } from '~/hooks/useAppLayout'
import { APP_LAYOUT } from '~/lib/layout/constants'
import { LAYOUT_STRETCH } from '~/lib/layout/styles'
import { useAppUi, useIsDarkTheme } from '~/lib/theme/useAppUi'
import { motion } from '~/lib/theme/motion'
import { elevatedCardStyle } from '~/lib/theme/surfaces'

import { PageScroll } from './PageScroll'
import { pageCenterMinHeight } from '~/lib/platform/viewport'

export { LAYOUT_STRETCH } from '~/lib/layout/styles'

type FullWidthLayoutProps = {
  children: ReactNode
  scroll?: boolean
  onRefresh?: () => void | Promise<void>
  refreshing?: boolean
} & GetProps<typeof YStack>

/**
 * Edge-to-edge page root — spans 100% width on web, iOS, and Android.
 * Use `scroll` for viewport scrolling between app chrome (header / bottom tabs).
 */
export function FullWidthLayout({
  children,
  scroll,
  onRefresh,
  refreshing,
  flex,
  minHeight,
  backgroundColor,
  ...stackProps
}: FullWidthLayoutProps) {
  const ui = useAppUi()
  const { isDesktop } = useAppLayout()
  const bg = backgroundColor ?? ui.background

  if (scroll) {
    return (
      <PageScroll onRefresh={onRefresh} refreshing={refreshing}>
        <YStack width="100%" maxWidth="100%" alignSelf="stretch" backgroundColor={bg}>
          {children}
        </YStack>
      </PageScroll>
    )
  }

  return (
    <YStack
      flex={flex !== undefined ? flex : isDesktop ? undefined : 1}
      minHeight={minHeight !== undefined ? minHeight : undefined}
      width="100%"
      maxWidth="100%"
      alignSelf="stretch"
      backgroundColor={bg}
      {...stackProps}
    >
      {children}
    </YStack>
  )
}

type PageSectionProps = {
  children: ReactNode
  /** Remove horizontal gutters for edge-to-edge rails (carousels, heroes). */
  bleed?: boolean
} & GetProps<typeof YStack>

/** Full-width section with responsive horizontal gutters. */
export function PageSection({ children, bleed, flex, minHeight, paddingHorizontal, ...props }: PageSectionProps) {
  const { gutter } = useAppLayout()

  return (
    <YStack
      width="100%"
      maxWidth="100%"
      alignSelf="stretch"
      paddingHorizontal={bleed ? 0 : paddingHorizontal ?? gutter}
      flex={flex}
      minHeight={minHeight}
      {...props}
    >
      {children}
    </YStack>
  )
}

type PageRailProps = {
  children: ReactNode
  /** Optional cap for narrow flows (forms, dialogs-in-page). Omit for full-width feeds. */
  maxWidth?: number
  centered?: boolean
} & GetProps<typeof YStack>

/** Full-width content rail — stretches edge-to-edge unless `maxWidth` is set (forms only). */
export function PageRail({
  children,
  maxWidth,
  centered = false,
  ...props
}: PageRailProps) {
  const constrained = maxWidth != null

  return (
    <YStack
      {...LAYOUT_STRETCH}
      {...(constrained ? { maxWidth, width: '100%' as const } : null)}
      alignSelf={constrained && centered ? 'center' : 'stretch'}
      {...props}
    >
      {children}
    </YStack>
  )
}

type PageColumnsProps = {
  children: ReactNode
  gap?: number | string
} & GetProps<typeof YStack>

/** Responsive multi-column row that stretches edge-to-edge. */
export function PageColumns({ children, gap = '$4', ...props }: PageColumnsProps) {
  const { isDesktop } = useAppLayout()

  return (
    <YStack
      width="100%"
      maxWidth="100%"
      flexDirection={isDesktop ? 'row' : 'column'}
      alignItems="flex-start"
      gap={gap}
      alignSelf="stretch"
      {...props}
    >
      {children}
    </YStack>
  )
}

type PageContentProps = {
  children: ReactNode
  scroll?: boolean
  bleed?: boolean
  backgroundColor?: string
  onRefresh?: () => void | Promise<void>
  refreshing?: boolean
} & GetProps<typeof YStack>

/**
 * Opinionated page scaffold: full-width layout + guttered section + rail.
 */
export function PageContent({
  children,
  scroll = true,
  bleed = false,
  backgroundColor,
  maxWidth,
  centered,
  onRefresh,
  refreshing,
  ...sectionProps
}: PageContentProps & Pick<PageRailProps, 'maxWidth' | 'centered'>) {
  return (
    <FullWidthLayout
      scroll={scroll}
      backgroundColor={backgroundColor}
      onRefresh={onRefresh}
      refreshing={refreshing}
    >
      <PageSection bleed={bleed} {...sectionProps}>
        <PageRail maxWidth={maxWidth} centered={centered} {...(maxWidth == null ? LAYOUT_STRETCH : {})}>
          {children}
        </PageRail>
      </PageSection>
    </FullWidthLayout>
  )
}

type SurfaceCardProps = {
  children: ReactNode
} & GetProps<typeof YStack>

/** Elevated surface card used across feed and settings. */
export function SurfaceCard({ children, padding = '$4', ...props }: SurfaceCardProps) {
  const ui = useAppUi()
  const isDark = useIsDarkTheme()

  return (
    <YStack
      width="100%"
      maxWidth="100%"
      overflow="hidden"
      padding={padding}
      style={elevatedCardStyle(ui, 'sm', isDark ? 'dark' : 'light')}
      {...motion.fadeUp}
      {...props}
    >
      {children}
    </YStack>
  )
}

/** Centered narrow form column — use inside full-width pages for inputs only. */
export function FormRail({ children, ...props }: { children: ReactNode } & GetProps<typeof YStack>) {
  return (
    <PageRail maxWidth={APP_LAYOUT.maxFormWidth} centered width="100%" {...props}>
      {children}
    </PageRail>
  )
}

/**
 * Standard full-width page scaffold.
 * Content spans 100% between app chrome gutters unless `form` narrows the inner column.
 */
export function FullWidthPage({
  children,
  scroll = true,
  bleed = false,
  form = false,
  backgroundColor,
  ...sectionProps
}: {
  children: ReactNode
  scroll?: boolean
  bleed?: boolean
  form?: boolean
  backgroundColor?: string
} & GetProps<typeof YStack>) {
  return (
    <FullWidthLayout scroll={scroll} backgroundColor={backgroundColor}>
      <PageSection bleed={bleed} {...LAYOUT_STRETCH} {...sectionProps}>
        {form ? <FormRail>{children}</FormRail> : <PageRail {...LAYOUT_STRETCH}>{children}</PageRail>}
      </PageSection>
    </FullWidthLayout>
  )
}

/**
 * Standard app page — full-width scrollable layout with gutters.
 * Pass `form` to center content in a readable form column; otherwise content is full width.
 */
export function AppPage({
  children,
  scroll = true,
  bleed = false,
  form = false,
  backgroundColor,
  ...sectionProps
}: {
  children: ReactNode
  scroll?: boolean
  bleed?: boolean
  form?: boolean
  backgroundColor?: string
} & GetProps<typeof YStack>) {
  return (
    <FullWidthLayout scroll={scroll} backgroundColor={backgroundColor}>
      <PageSection bleed={bleed} {...LAYOUT_STRETCH} {...sectionProps}>
        {form ? <FormRail>{children}</FormRail> : <PageRail {...LAYOUT_STRETCH}>{children}</PageRail>}
      </PageSection>
    </FullWidthLayout>
  )
}

/** Centered loading/error placeholder spanning the content area. */
export function PageCenter({ children }: { children: ReactNode }) {
  const ui = useAppUi()
  const media = useMedia()

  return (
    <YStack
      width="100%"
      maxWidth="100%"
      flex={media.gtMd ? undefined : 1}
      minHeight={pageCenterMinHeight(media.gtMd)}
      alignItems="center"
      justifyContent="center"
      alignSelf="stretch"
      backgroundColor={ui.background}
      paddingVertical="$10"
      paddingHorizontal={APP_LAYOUT.railPaddingMobile}
    >
      {children}
    </YStack>
  )
}