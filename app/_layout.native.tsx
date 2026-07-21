/**
 * Native root layout — same shared `AppShell` + screens as web.
 * `.native` only omits the web `<html>` document shell on RN.
 *
 * Extra hosts (biometric gate, AI assist, update manager, etc.) are layered
 * back once each is confirmed not to block first paint on Hermes.
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
import { CartProvider } from '~/commerce/hooks/useCart'
import { FavoritesProvider } from '~/commerce/hooks/useFavorites'
import { useAppFonts } from '~/hooks/useAppFonts'
import { store } from '~/lib/store'
import { SupabaseProvider } from '~/providers/SupabaseProvider'

function AppProviders({ children }: { children: ReactNode }) {
  useAppFonts()

  return (
    <ReduxProvider store={store}>
      <SupabaseProvider>
        <SchemeProvider>
          <ThemedApp>
            <CartProvider>
              <FavoritesProvider>
                <AppErrorBoundary scope="AppShell">
                  <AppShell>{children}</AppShell>
                </AppErrorBoundary>
              </FavoritesProvider>
            </CartProvider>
          </ThemedApp>
        </SchemeProvider>
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
