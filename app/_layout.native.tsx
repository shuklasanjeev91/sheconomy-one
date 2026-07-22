/**
 * Native root layout — same shared `AppShell` + screens as web.
 * `.native` only omits the web `<html>` document shell on RN.
 *
 * Provider tree mirrors web `AppProviders` for tab/settings hooks
 * (push, zoom, locale, location, marketplace). Heavy hosts that can
 * block first paint (biometric gate, update manager, analytics) stay off.
 */
import { LoadProgressBar, Slot } from 'one'
import { Provider as ReduxProvider } from 'react-redux'
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { TamaguiProvider, Theme, YStack } from 'tamagui'
import { SchemeProvider, useUserScheme } from '@vxrn/color-scheme'
import { ToastProvider, ToastViewport } from '@tamagui/toast'
import type { ReactNode } from 'react'

import { AppErrorBoundary } from '~/components/AppErrorBoundary'
import config from '~/config/tamagui.config.native'
import { AppToasts } from '~/components/ui/Toast'
import { AppShell } from '~/components/navigation/app/AppShell'
import { ScreenZoomRoot } from '~/components/media/ScreenZoomRoot'
import { CartProvider } from '~/commerce/hooks/useCart'
import { FavoritesProvider } from '~/commerce/hooks/useFavorites'
import { MarketplacePersonalizationProvider } from '~/commerce/context/MarketplacePersonalizationContext'
import { useAppFonts } from '~/hooks/useAppFonts'
import { RegionPreferencesProvider } from '~/lib/locale/RegionPreferencesContext'
import { CurrencyRatesProvider } from '~/lib/currency/CurrencyRatesProvider'
import { UserLocationProvider } from '~/lib/location'
import { ScreenZoomProvider } from '~/lib/zoom/ScreenZoomContext'
import { store } from '~/lib/store'
import { PushNotificationsProvider } from '~/providers/PushNotificationsProvider'
import { SupabaseProvider } from '~/providers/SupabaseProvider'
import { AiAssistProvider } from '~/providers/AiAssistProvider'
import { ConnectivityProvider } from '~/providers/ConnectivityProvider'

function AppProviders({ children }: { children: ReactNode }) {
  useAppFonts()

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
                                <ConnectivityProvider>
                                  <AppErrorBoundary scope="AppShell">
                                    <AppShell>{children}</AppShell>
                                  </AppErrorBoundary>
                                </ConnectivityProvider>
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

function ThemedApp({ children }: { children: ReactNode }) {
  const insets = useSafeAreaInsets()
  const userScheme = useUserScheme()
  const themeName = userScheme.value === 'dark' ? 'dark' : 'light'

  return (
    <TamaguiProvider config={config} defaultTheme={themeName}>
      <Theme name={themeName}>
        <YStack flex={1} width="100%" backgroundColor="$background">
          <ToastProvider swipeDirection="horizontal" duration={4000} native={false}>
            {children}
            <AppToasts />
            <ToastViewport top={Math.max(insets.top, 8)} left={0} right={0} />
          </ToastProvider>
        </YStack>
      </Theme>
    </TamaguiProvider>
  )
}

export default function NativeLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <LoadProgressBar />
        <AppProviders>
          <Slot />
        </AppProviders>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  )
}
