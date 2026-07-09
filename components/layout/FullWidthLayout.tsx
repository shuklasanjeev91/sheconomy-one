import type { ReactNode } from 'react'
import type { GetProps } from 'tamagui'

import { YStack, useMedia } from '~/components/ui'
import { getShadowStyle, radius } from '~/config/tokens'
import { useAppLayout } from '~/hooks/useAppLayout'
import { APP_LAYOUT } from '~/lib/layout/constants'
import { useAppUi } from '~/lib/theme/useAppUi'
import { elevatedCardStyle } from '~/lib/theme/surfaces'

import { PageScroll } from './PageScroll'
import { pageCenterMinHeight } from '~/lib/platform/viewport'

type FullWidthLayoutProps = {
  children: ReactNode
  scroll?: boolean
} & GetProps<typeof YStack>

/**
 * Edge-to-edge page root — spans 100% width on web, iOS, and Android.
 * Use `scroll` for viewport scrolling between app chrome (header / bottom tabs).
 */
export function FullWidthLayout({
  children,
  scroll,
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
      <PageScroll>
        <YStack width="100%" maxWidth="100%" alignSelf="stretch" backgroundColor={bg}>
          {children}
        </YStack>
      </PageScroll>
    )
  }

  return (
    <YStack
      flex={isDesktop ? undefined : flex ?? 1}
      minHeight={isDesktop ? undefined : minHeight}
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

/** Full-width content rail inside a section. */
export function PageRail({
  children,
  maxWidth,
  centered = false,
  ...props
}: PageRailProps) {
  return (
    <YStack
      width="100%"
      maxWidth={maxWidth ?? '100%'}
      alignSelf={centered || maxWidth ? 'center' : 'stretch'}
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
  return (
    <YStack
      width="100%"
      maxWidth="100%"
      flexDirection="column"
      gap={gap}
      alignSelf="stretch"
      $gtMd={{ flexDirection: 'row', alignItems: 'flex-start' }}
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
  ...sectionProps
}: PageContentProps & Pick<PageRailProps, 'maxWidth' | 'centered'>) {
  return (
    <FullWidthLayout scroll={scroll} backgroundColor={backgroundColor}>
      <PageSection bleed={bleed} {...sectionProps}>
        <PageRail maxWidth={maxWidth} centered={centered}>
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
export function SurfaceCard({ children, ...props }: SurfaceCardProps) {
  const ui = useAppUi()

  return (
    <YStack
      width="100%"
      maxWidth="100%"
      overflow="hidden"
      style={elevatedCardStyle(ui)}
      {...props}
    >
      {children}
    </YStack>
  )
}

/** Centered form column inside a full-width page (auth, settings, lobby). */
export function FormRail({ children, ...props }: { children: ReactNode } & GetProps<typeof YStack>) {
  return (
    <PageRail maxWidth={APP_LAYOUT.maxFormWidth} centered width="100%" {...props}>
      {children}
    </PageRail>
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
      <PageSection bleed={bleed} width="100%" {...sectionProps}>
        {form ? <FormRail>{children}</FormRail> : <PageRail>{children}</PageRail>}
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