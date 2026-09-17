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
  isAdminPath,
  isChatConversationPath,
  isChatPath,
  isCommercePath,
  isCommunityPath,
  isCreateShopPath,
  isVendorPath,
} from '~/lib/routes'
import { authViewportStyle } from '~/components/auth/auth-layout'
import { appShellStyle, lockedAppShellStyle, meetingViewportStyle } from '~/lib/platform/viewport'
import { useAppUi } from '~/lib/theme/useAppUi'

import { ChatActionsHost } from '~/chat/components/ChatActionsHost'
import { IncomingCallHost } from '~/chat/components/IncomingCallHost'
import { CommunityComposerHost } from '~/community/components/CommunityComposerHost'
import { ImageCropHost } from '~/components/media/ImageCropHost'
import { InstantMeetingHost } from '~/co-work/components/InstantMeetingHost'
import { ProfileOnboardingNudge } from '~/components/auth/ProfileOnboardingNudge'
import { GenderVerificationHost } from '~/components/gender-verification/GenderVerificationHost'
import { GlobalSessionHost } from '~/components/session/GlobalSessionHost'
import { useInstantMeetingSession } from '~/co-work/lib/instant-meeting-session'
import { useGlobalSession, shouldUseChromelessShell } from '~/lib/session/global-session'

import { AppDesktopHeader } from '~/components/navigation/app/AppDesktopHeader'
import { AppMobileBottomTabs } from '~/components/navigation/app/AppMobileBottomTabs'
import { AppMobileHeader } from '~/components/navigation/app/AppMobileHeader'
import { WarmTopTabRoutes } from '~/components/navigation/app/WarmTopTabRoutes'

type AppShellProps = {
  children: ReactNode
}

function useChromelessRoute() {
  const pathname = usePathname()
  const instantMeeting = useInstantMeetingSession()
  const globalSession = useGlobalSession()
  // Full-screen meeting lobby + live room — no app header/tabs (Zoom-style).
  // Minimized / PiP sessions keep normal chrome so other tabs stay usable.
  const embedPayuReturn =
    Platform.OS === 'web' &&
    typeof window !== 'undefined' &&
    pathname.startsWith('/orders/payu-return') &&
    new URLSearchParams(window.location.search).get('embed') === '1'

  if (embedPayuReturn) return true

  return shouldUseChromelessShell({
    pathname,
    instantMeetingOpen: !!instantMeeting,
    globalPresentation: globalSession?.presentation ?? null,
  })
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
    pathname.startsWith('/blog') ||
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
  const isSellerLanding = pathname === '/sellerlanding' || pathname.startsWith('/sellerlanding/')
  const compactMobileTopBar = useCompactMobileTopBar()
  const showCommerceFooter =
    isDesktopWeb &&
    isCommercePath(pathname) &&
    !isCreateShopPath(pathname) &&
    !isAdminPath(pathname) &&
    pathname !== '/checkout'

  // Chat + Community are pane apps: lock the shell so side rails stay sticky
  // while only the center column scrolls (Home, Network, Jobs, …).
  // Class / co-work / commerce keep PageScroll (document on desktop web).
  const lockViewport = isChatPath(pathname) || isCommunityPath(pathname)
  /** Desktop web document pages: window scroll; main column flexes on short pages. */
  const documentDesktop = Platform.OS === 'web' && isDesktopWeb && !lockViewport
  const documentDesktopFlex =
    Platform.OS === 'web' && documentDesktop ? ({ flex: '1 0 auto' } as const) : undefined
  const stretchMainContent =
    lockViewport || Platform.OS !== 'web' || !isDesktopWeb
  const clipShellOverflow =
    lockViewport || Platform.OS !== 'web' || !isDesktopWeb
  // Open conversations keep the app header (shared back); hide bottom tabs only.
  const chatConversationMobile = !isDesktop && isChatConversationPath(pathname)
  // Manage Shop uses its own top bar + Etsy-style bottom tabs — hide marketplace header.
  const hideMobileHeader = !isDesktop && isVendorPath(pathname)

  const useChromelessLayout = chromeless || authScreen.chromeless

  return (
    <NativeSafeArea edges={useChromelessLayout ? ['top', 'bottom'] : ['top']}>
      <AppAccessGate>
        {/*
          One relative root so InstantMeetingHost / GlobalSessionHost / ImageCropHost
          survive chromeless ↔ chrome flips. Dual mounts used to remount LiveKit and
          land Maximize on Join Meeting.
        */}
        <YStack
          flex={1}
          width="100%"
          maxWidth="100%"
          position="relative"
          minHeight={0}
          // Give absolute overlays (InstantMeetingHost) a real viewport box on web
          // document-scroll pages when a live meeting is open / chromeless.
          style={
            Platform.OS === 'web' && useChromelessLayout
              ? ({ minHeight: '100dvh', height: '100dvh', overflow: 'hidden' } as const)
              : undefined
          }
        >
          {useChromelessLayout ? (
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
              {children}
            </ScreenFill>
          ) : (
            <AppBarScrollProvider>
              <DesktopScrollTracker />
              <ScreenFill
                flex={stretchMainContent ? 1 : undefined}
                flexGrow={documentDesktop ? 1 : undefined}
                flexShrink={documentDesktop ? 0 : undefined}
                flexDirection="column"
                position="relative"
                backgroundColor={ui.background}
                overflow={clipShellOverflow ? 'hidden' : 'visible'}
                style={{
                  ...(lockViewport ? lockedAppShellStyle() : appShellStyle(isDesktopWeb)),
                  ...documentDesktopFlex,
                }}
              >
                {isDesktop ? <AppDesktopHeader /> : null}
                {!isDesktop && !hideMobileHeader ? (
                  <AppMobileHeader minimal={compactMobileTopBar || chatConversationMobile} />
                ) : null}
                <ProfileOnboardingNudge />
                <YStack
                  flexGrow={1}
                  flexShrink={0}
                  flex={stretchMainContent ? 1 : undefined}
                  width="100%"
                  maxWidth="100%"
                  minHeight={stretchMainContent ? 0 : undefined}
                  style={documentDesktopFlex}
                >
                  {children}
                </YStack>
                <WarmTopTabRoutes />
                {showCommerceFooter ? <CommerceDesktopFooter /> : null}
                {!isDesktop && !chatConversationMobile && !isSellerLanding ? (
                  <AppMobileBottomTabs />
                ) : null}
                {/* Section overlays — not session-critical across chrome flips. */}
                <CommunityComposerHost />
                <ChatActionsHost />
              </ScreenFill>
            </AppBarScrollProvider>
          )}

          <IncomingCallHost />
          <InstantMeetingHost />
          <GlobalSessionHost />
          {/* Mount last so crop sits above InstantMeetingHost (z 90k) during live meetings. */}
          <ImageCropHost />
        </YStack>
        <GenderVerificationHost />
      </AppAccessGate>
    </NativeSafeArea>
  )
}
