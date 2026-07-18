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
import {
  isChatConversationPath,
  isChatPath,
  isCommercePath,
  isCreateShopPath,
} from '~/lib/routes'
import { authViewportStyle } from '~/components/auth/auth-layout'
import { appShellStyle, lockedAppShellStyle, meetingViewportStyle } from '~/lib/platform/viewport'
import { useAppUi } from '~/lib/theme/useAppUi'

import { IncomingCallHost } from '~/chat/components/IncomingCallHost'
import { ProfileOnboardingNudge } from '~/components/auth/ProfileOnboardingNudge'
import { GenderVerificationHost } from '~/components/gender-verification/GenderVerificationHost'

import { AppDesktopHeader } from './AppDesktopHeader'
import { AppMobileBottomTabs } from './AppMobileBottomTabs'
import { AppMobileHeader } from './AppMobileHeader'

type AppShellProps = {
  children: ReactNode
}

function useChromelessRoute() {
  const pathname = usePathname()
  // Full-screen meeting lobby + live room — no app header/tabs (Zoom-style).
  return (
    pathname.startsWith('/ui-kit') ||
    pathname.startsWith('/co-work/meeting/') ||
    pathname === '/co-work/meeting' ||
    pathname.startsWith('/chat/call/')
  )
}

function useCompactMobileTopBar() {
  const pathname = usePathname()
  if (
    pathname === '/' ||
    pathname === '/community' ||
    pathname === '/chat' ||
    pathname === '/class' ||
    pathname === '/class/video' ||
    pathname === '/class/audio' ||
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
    pathname.startsWith('/create-my-shop') ||
    pathname.startsWith('/vendor') ||
    pathname.startsWith('/settings') ||
    pathname.startsWith('/legal') ||
    pathname.startsWith('/help') ||
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
  const showCommerceFooter =
    isDesktopWeb && isCommercePath(pathname) && !isCreateShopPath(pathname)

  // Chat is a true two-pane app — lock the shell so panes get a definite height.
  // Community / class / co-work / commerce use PageScroll (document on desktop web).
  const lockViewport = isChatPath(pathname)
  const stretchMainContent =
    lockViewport || Platform.OS !== 'web' || !isDesktopWeb
  const clipShellOverflow =
    lockViewport || Platform.OS !== 'web' || !isDesktopWeb

  // Open conversations keep the app header (shared back); hide bottom tabs only.
  const chatConversationMobile = !isDesktop && isChatConversationPath(pathname)

  if (chromeless || authScreen.chromeless) {
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
            flex={Platform.OS === 'web' && !stretchMainContent ? undefined : 1}
            flexDirection="column"
            position="relative"
            backgroundColor={ui.background}
            overflow={clipShellOverflow ? 'hidden' : 'visible'}
            style={lockViewport ? lockedAppShellStyle() : appShellStyle(isDesktopWeb)}
          >
            {isDesktop ? <AppDesktopHeader /> : null}
            {!isDesktop ? <AppMobileHeader minimal={compactMobileTopBar || chatConversationMobile} /> : null}
            <ProfileOnboardingNudge />
            <YStack
              flexGrow={stretchMainContent ? 1 : undefined}
              flex={stretchMainContent ? 1 : undefined}
              width="100%"
              maxWidth="100%"
              // Only constrain height when we intentionally fill; document-scroll
              // pages must grow with content or the window cannot scroll.
              minHeight={stretchMainContent ? 0 : undefined}
            >
              {children}
            </YStack>
            {showCommerceFooter ? <CommerceDesktopFooter /> : null}
            {!isDesktop && !chatConversationMobile ? <AppMobileBottomTabs /> : null}
            <IncomingCallHost />
            <GenderVerificationHost />
          </ScreenFill>
        </AppBarScrollProvider>
      </AppAccessGate>
    </NativeSafeArea>
  )
}
