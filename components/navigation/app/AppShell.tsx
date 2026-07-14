import type { ReactNode } from 'react'
import { Platform } from 'react-native'
import { usePathname } from 'one'

import { YStack } from '~/components/ui'
import { AppAccessGate } from '~/components/auth/AppAccessGate'
import { ScreenFill, NativeSafeArea } from '~/components/layout'
import { AppBarScrollProvider } from '~/components/navigation/AppBarScrollContext'
import { DesktopScrollTracker } from '~/components/navigation/DesktopScrollTracker'
import { CommerceDesktopFooter } from '~/commerce/navigation/CommerceDesktopFooter'
import { useAppLayout } from '~/hooks/useAppLayout'
import { useAuthScreen } from '~/hooks/useAuthScreen'
import { isChatConversationPath, isCommercePath } from '~/lib/routes'
import { authViewportStyle } from '~/components/auth/auth-layout'
import { appShellStyle, meetingViewportStyle } from '~/lib/platform/viewport'
import { useAppUi } from '~/lib/theme/useAppUi'

import { IncomingCallHost } from '~/chat/components/IncomingCallHost'

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
    pathname.startsWith('/vendor') ||
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
  const { isDesktop, isDesktopWeb } = useAppLayout()
  const pathname = usePathname()
  const chromeless = useChromelessRoute()
  const authScreen = useAuthScreen()
  const compactMobileTopBar = useCompactMobileTopBar()
  const showCommerceFooter = isDesktopWeb && isCommercePath(pathname)
  const stretchMainContent = Platform.OS !== 'web' || !isDesktopWeb
  // Open conversations are full-screen on mobile: no app header/tabs.
  const chatFullScreen = !isDesktop && isChatConversationPath(pathname)

  if (chromeless || chatFullScreen || authScreen.chromeless) {
    return (
      <NativeSafeArea edges={['top', 'bottom']}>
        <ScreenFill
          flex={1}
          width="100%"
          maxWidth="100%"
          backgroundColor={ui.background}
          overflow="hidden"
          style={
            authScreen.chromeless && !chromeless
              ? authViewportStyle()
              : meetingViewportStyle()
          }
        >
          <AppAccessGate>
            {children}
            <IncomingCallHost />
          </AppAccessGate>
        </ScreenFill>
      </NativeSafeArea>
    )
  }

  return (
    <NativeSafeArea edges={['top']}>
      <AppAccessGate>
        <AppBarScrollProvider>
          <DesktopScrollTracker />
          <ScreenFill
            flex={Platform.OS === 'web' ? undefined : 1}
            flexDirection="column"
            position="relative"
            backgroundColor={ui.background}
            overflow={Platform.OS === 'web' && isDesktopWeb ? 'visible' : 'hidden'}
            style={appShellStyle(isDesktopWeb)}
          >
            {isDesktop ? <AppDesktopHeader /> : null}
            {!isDesktop ? <AppMobileHeader minimal={compactMobileTopBar} /> : null}
            <YStack
              flexGrow={stretchMainContent ? 1 : undefined}
              flex={stretchMainContent ? 1 : undefined}
              width="100%"
              maxWidth="100%"
              minHeight={Platform.OS === 'web' && isDesktopWeb ? undefined : 0}
            >
              {children}
            </YStack>
            {showCommerceFooter ? <CommerceDesktopFooter /> : null}
            {!isDesktop ? <AppMobileBottomTabs /> : null}
            <IncomingCallHost />
          </ScreenFill>
        </AppBarScrollProvider>
      </AppAccessGate>
    </NativeSafeArea>
  )
}