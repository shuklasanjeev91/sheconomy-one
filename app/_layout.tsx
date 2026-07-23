import { LoadProgressBar, Slot } from 'one'
import { Provider as ReduxProvider } from 'react-redux'
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context'
import { Platform } from 'react-native'
import { TamaguiProvider, Theme, YStack } from 'tamagui'
import { MetaTheme, SchemeProvider, useUserScheme } from '@vxrn/color-scheme'
import { ToastProvider, ToastViewport } from '@tamagui/toast'
import type { ReactNode } from 'react'

import { AppErrorBoundary } from '~/components/AppErrorBoundary'
import { BiometricUnlockGate } from '~/components/auth/BiometricUnlockGate'
import config from '~/config/tamagui.config'
import { screenFillStyle } from '~/lib/platform/viewport'
import { AppToasts } from '~/components/ui/Toast'
import { AppUsageTracker } from '~/components/analytics/AppUsageTracker'
import { ExternalAnalyticsScripts } from '~/components/analytics/ExternalAnalyticsScripts'
import { ExternalAnalyticsTracker } from '~/components/analytics/ExternalAnalyticsTracker'
import { AppShell } from '~/components/navigation/app/AppShell'
import { RouteWarmup } from '~/components/navigation/RouteWarmup'
import { AppBootstrapPrefetch } from '~/components/navigation/AppBootstrapPrefetch'
import { CartProvider } from '~/commerce/hooks/useCart'
import { FavoritesProvider } from '~/commerce/hooks/useFavorites'
import { MarketplacePersonalizationProvider } from '~/commerce/context/MarketplacePersonalizationContext'
import { useAppFonts } from '~/hooks/useAppFonts'
import { RegionPreferencesProvider } from '~/lib/locale/RegionPreferencesContext'
import { CurrencyRatesProvider } from '~/lib/currency/CurrencyRatesProvider'
import { UserLocationProvider } from '~/lib/location'
import { store } from '~/lib/store'
import { PushNotificationsProvider } from '~/providers/PushNotificationsProvider'
import { SupabaseProvider } from '~/providers/SupabaseProvider'
import { InAppNotificationHost } from '~/components/notifications/InAppNotificationHost'
import { PushForegroundNotificationHost } from '~/components/notifications/PushForegroundNotificationHost'
import { AutomaticUpdateManager } from '~/components/system/AutomaticUpdateManager'
import { AiAssistProvider } from '~/providers/AiAssistProvider'
import { ScreenZoomProvider } from '~/lib/zoom/ScreenZoomContext'
import { ScreenZoomRoot } from '~/components/media/ScreenZoomRoot'
import { ConnectivityProvider } from '~/providers/ConnectivityProvider'
import { RouteSeoProvider } from '~/components/seo/RouteSeo'

function NativeRootShell({ children }: { children: ReactNode }) {
  if (Platform.OS === 'web') {
    return <>{children}</>
  }

  const { GestureHandlerRootView } = require('react-native-gesture-handler') as typeof import('react-native-gesture-handler')
  return <GestureHandlerRootView style={{ flex: 1 }}>{children}</GestureHandlerRootView>
}

export default function Layout() {
  const routes = (
    <>
      {Platform.OS !== 'web' ? <LoadProgressBar /> : null}
      <Slot />
    </>
  )

  if (Platform.OS === 'web') {
    return (
      <html lang="en-US">
        <head>
          <meta charSet="utf-8" />
          <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
          <meta
            name="viewport"
            content="width=device-width, initial-scale=1, maximum-scale=5"
          />
          <link rel="icon" href="/favicon.png" type="image/png" sizes="80x80" />
          <link rel="apple-touch-icon" href="/apple-touch-icon.png" sizes="80x80" />
          <MetaTheme lightColor="#fef5f9" darkColor="#1c0f14" />
          <meta name="theme-color" content="#D01060" />
          <meta
            name="google-site-verification"
            content="-NBqtpzczzj-BY1yV4J8jtUZZAjChrU5HUFYuYIcMtI"
          />
          <ExternalAnalyticsScripts />
          <style
            dangerouslySetInnerHTML={{
              __html: `
html, body, #root {
  width: 100%;
  max-width: 100%;
  margin: 0;
  overflow-x: hidden;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-rendering: optimizeLegibility;
}
body {
  min-height: 100vh;
  min-height: 100dvh;
  background-color: var(--background, #fef5f9);
  color: var(--color, #1a0a12);
  font-feature-settings: 'kern' 1, 'liga' 1;
}
@media (max-width: 1020px) {
  html, body {
    height: 100%;
    overflow: hidden;
  }
}
@media (min-width: 1021px) {
  html, body {
    height: auto;
    min-height: 100vh;
    min-height: 100dvh;
    overflow-y: auto;
    scroll-behavior: smooth;
  }
  /* Sticky footer: shell fills the viewport so footer sits after content (or at bottom when short). */
  #root {
    min-height: 100vh;
    min-height: 100dvh;
    display: flex;
    flex-direction: column;
  }
}
::selection {
  background: rgba(208, 16, 96, 0.22);
  color: inherit;
}
a {
  text-decoration: none;
}
img {
  max-width: 100%;
}
.listing-html-content {
  width: 100%;
  color: inherit;
  font-size: 14px;
  line-height: 1.7;
  word-break: break-word;
}
.listing-html-content p {
  margin: 0 0 14px;
}
.listing-html-content ul,
.listing-html-content ol {
  margin: 0 0 14px;
  padding-left: 1.25rem;
}
.listing-html-content li {
  margin-bottom: 6px;
}
.listing-html-content h1,
.listing-html-content h2,
.listing-html-content h3,
.listing-html-content h4 {
  margin: 0 0 12px;
  color: inherit;
  line-height: 1.35;
}
.listing-html-content a {
  color: var(--color9, #D01060);
  text-decoration: underline;
}
.listing-html-content strong,
.listing-html-content b {
  font-weight: 600;
}
.listing-html-content img {
  border-radius: 8px;
  margin: 8px 0 16px;
}
.t_unmounted .is_View,
.t_unmounted .is_Text,
.t_unmounted .is_Pressable,
.t_unmounted .is_ScrollView,
.t_unmounted .is_Spinner,
.t_unmounted [role="progressbar"] {
  opacity: 1 !important;
  transform: none !important;
  visibility: visible !important;
}
@keyframes heroProgress {
  from { transform: scaleX(0); }
  to { transform: scaleX(1); }
}
`,
            }}
          />
        </head>

        <body>
          <SafeAreaProvider>
            <AppProviders>{routes}</AppProviders>
          </SafeAreaProvider>
        </body>
      </html>
    )
  }

  return (
    <NativeRootShell>
      <SafeAreaProvider>
        <AppProviders>{routes}</AppProviders>
      </SafeAreaProvider>
    </NativeRootShell>
  )
}

function AppProviders({ children }: { children: React.ReactNode }) {
  useAppFonts()
  const insets = useSafeAreaInsets()

  return (
    <ReduxProvider store={store}>
      <SupabaseProvider>
        <RegionPreferencesProvider>
          <UserLocationProvider>
            <CurrencyRatesProvider>
              <PushNotificationsProvider>
                <SchemeProvider>
                  <ThemedApp>
                    <CartProvider>
                      <FavoritesProvider>
                        <MarketplacePersonalizationProvider>
                          <AiAssistProvider>
                            <ScreenZoomProvider>
                              <ScreenZoomRoot>
                                <AutomaticUpdateManager />
                                <InAppNotificationHost />
                                <PushForegroundNotificationHost />
                                <AppUsageTracker />
                                <ExternalAnalyticsTracker />
                                <BiometricUnlockGate>
                                  <ConnectivityProvider>
                                    <AppErrorBoundary scope="AppShell">
                                      <RouteSeoProvider>
                                        <RouteWarmup />
                                        <AppBootstrapPrefetch />
                                        <AppShell>{children}</AppShell>
                                      </RouteSeoProvider>
                                    </AppErrorBoundary>
                                  </ConnectivityProvider>
                                </BiometricUnlockGate>
                              </ScreenZoomRoot>
                            </ScreenZoomProvider>
                          </AiAssistProvider>
                        </MarketplacePersonalizationProvider>
                      </FavoritesProvider>
                    </CartProvider>
                  </ThemedApp>
                </SchemeProvider>
              </PushNotificationsProvider>
            </CurrencyRatesProvider>
          </UserLocationProvider>
        </RegionPreferencesProvider>
      </SupabaseProvider>
    </ReduxProvider>
  )
}

function ThemedApp({ children }: { children: React.ReactNode }) {
  const userScheme = useUserScheme()
  const insets = useSafeAreaInsets()

  return (
    <TamaguiProvider config={config} defaultTheme={userScheme.value}>
      <Theme name={userScheme.value}>
        <YStack
          flex={Platform.OS === 'web' ? undefined : 1}
          width="100%"
          style={Platform.OS === 'web' ? screenFillStyle() : undefined}
        >
          <ToastProvider swipeDirection="horizontal" duration={4000} native={false}>
            {children}
            <AppToasts />
            <ToastViewport
              top={Platform.OS === 'web' ? '$8' : Math.max(insets.top, 8)}
              left={0}
              right={0}
            />
          </ToastProvider>
        </YStack>
      </Theme>
    </TamaguiProvider>
  )
}