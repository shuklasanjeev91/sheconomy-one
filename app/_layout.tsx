import { LoadProgressBar, Slot } from 'one'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { Platform } from 'react-native'
import { TamaguiProvider, Theme, YStack } from 'tamagui'
import { MetaTheme, SchemeProvider, useUserScheme } from '@vxrn/color-scheme'
import { ToastProvider, ToastViewport } from '@tamagui/toast'

import config from '~/config/tamagui.config'
import { AppToasts } from '~/components/ui/Toast'
import { AppShell } from '~/components/navigation/app/AppShell'
import { CartProvider } from '~/commerce/hooks/useCart'
import { FavoritesProvider } from '~/commerce/hooks/useFavorites'
import { MarketplacePersonalizationProvider } from '~/commerce/context/MarketplacePersonalizationContext'
import { useAppFonts } from '~/hooks/useAppFonts'
import { SupabaseProvider } from '~/providers/SupabaseProvider'

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
          <style
            dangerouslySetInnerHTML={{
              __html: `
html, body, #root {
  width: 100%;
  max-width: 100%;
  margin: 0;
  min-height: 100%;
  overflow-x: hidden;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-rendering: optimizeLegibility;
}
body {
  background-color: var(--background);
  color: var(--color);
  font-feature-settings: 'kern' 1, 'liga' 1;
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
@media (min-width: 1021px) {
  html, body {
    height: auto;
    overflow-y: auto;
  }
}
.t_unmounted .is_View,
.t_unmounted .is_Text,
.t_unmounted .is_Pressable,
.t_unmounted .is_ScrollView {
  opacity: 1 !important;
  transform: none !important;
  visibility: visible !important;
}
`,
            }}
          />
        </head>

        <body>
          <AppProviders>{routes}</AppProviders>
        </body>
      </html>
    )
  }

  return (
    <YStack flex={1} width="100%">
      <AppProviders>{routes}</AppProviders>
    </YStack>
  )
}

function AppProviders({ children }: { children: React.ReactNode }) {
  const [fontsLoaded] = useAppFonts()

  if (!fontsLoaded) {
    return null
  }

  return (
    <SupabaseProvider>
      <SafeAreaProvider>
        <SchemeProvider>
          <ThemedApp>
            <CartProvider>
              <FavoritesProvider>
                <MarketplacePersonalizationProvider>
                  <AppShell>{children}</AppShell>
                </MarketplacePersonalizationProvider>
              </FavoritesProvider>
            </CartProvider>
          </ThemedApp>
        </SchemeProvider>
      </SafeAreaProvider>
    </SupabaseProvider>
  )
}

function ThemedApp({ children }: { children: React.ReactNode }) {
  const userScheme = useUserScheme()

  return (
    <TamaguiProvider config={config} defaultTheme={userScheme.value}>
      <Theme name={userScheme.value}>
        <ToastProvider swipeDirection="horizontal" duration={4000} native={false}>
          {children}
          <AppToasts />
          <ToastViewport top="$8" left={0} right={0} />
        </ToastProvider>
      </Theme>
    </TamaguiProvider>
  )
}