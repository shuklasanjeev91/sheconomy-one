import type { ReactNode } from 'react'
import { usePathname } from 'one'

import { YStack } from '~/components/ui'
import { AppAccessGate } from '~/components/auth/AppAccessGate'
import { ScreenFill } from '~/components/layout'
import { AppBarScrollProvider } from '~/components/navigation/AppBarScrollContext'
import { DesktopScrollTracker } from '~/components/navigation/DesktopScrollTracker'
import { CommerceDesktopFooter } from '~/commerce/navigation/CommerceDesktopFooter'
import { useAppLayout } from '~/hooks/useAppLayout'
import { isCommercePath } from '~/lib/routes'
import { meetingViewportStyle } from '~/lib/platform/viewport'
import { useAppUi } from '~/lib/theme/useAppUi'

import { AppDesktopHeader } from './AppDesktopHeader'
import { AppMobileBottomTabs } from './AppMobileBottomTabs'
import { AppMobileHeader } from './AppMobileHeader'

type AppShellProps = {
  children: ReactNode
}

function useChromelessRoute() {
  const pathname = usePathname()
  return pathname.startsWith('/ui-kit') || /\/co-work\/meeting\/[^/]+\/live/.test(pathname)
}

function useCompactMobileTopBar() {
  const pathname = usePathname()
  if (
    pathname === '/' ||
    pathname === '/community' ||
    pathname === '/chat' ||
    pathname === '/class' ||
    pathname === '/co-work'
  ) {
    return false
  }

  return (
    pathname.startsWith('/shop/') ||
    pathname.startsWith('/listing/') ||
    pathname.startsWith('/category/') ||
    pathname.startsWith('/browse/') ||
    pathname.startsWith('/search') ||
    pathname.startsWith('/favorites') ||
    pathname.startsWith('/cart') ||
    pathname.startsWith('/checkout') ||
    pathname.startsWith('/my-shops') ||
    pathname.startsWith('/settings') ||
    pathname.startsWith('/profile') ||
    pathname.startsWith('/notifications') ||
    pathname.startsWith('/community/') ||
    pathname.startsWith('/class/') ||
    pathname.startsWith('/co-work/') ||
    pathname.startsWith('/chat/')
  )
}

/** Global app chrome — header, footer, and bottom tabs on every section. */
export function AppShell({ children }: AppShellProps) {
  const ui = useAppUi()
  const { isDesktop, mobileTabBarOffset } = useAppLayout()
  const pathname = usePathname()
  const chromeless = useChromelessRoute()
  const compactMobileTopBar = useCompactMobileTopBar()
  const showCommerceFooter = isDesktop && isCommercePath(pathname)

  if (chromeless) {
    return <ScreenFill style={meetingViewportStyle()}>{children}</ScreenFill>
  }

  return (
    <AppAccessGate>
      <AppBarScrollProvider>
        <DesktopScrollTracker />
        <ScreenFill flexDirection="column" backgroundColor={ui.background} overflow="hidden">
          <AppDesktopHeader />
          {!isDesktop ? <AppMobileHeader minimal={compactMobileTopBar} /> : null}
          <YStack
            flexGrow={1}
            flex={isDesktop ? undefined : 1}
            width="100%"
            maxWidth="100%"
            minHeight={0}
            paddingBottom={isDesktop ? 0 : mobileTabBarOffset}
          >
            {children}
          </YStack>
          {showCommerceFooter ? <CommerceDesktopFooter /> : null}
          {!isDesktop ? <AppMobileBottomTabs /> : null}
        </ScreenFill>
      </AppBarScrollProvider>
    </AppAccessGate>
  )
}