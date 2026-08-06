import { useEffect, useMemo, useState, type ComponentType } from 'react'
import { Platform } from 'react-native'
import { useLocalSearchParams, useRouter } from 'one'

import {
  buildPayuAutoSubmitHtml,
  consumePayuBridgeSession,
  firstSearchParam,
  isPayuReturnUrl,
  parsePayuBridgeParams,
  payuReturnHref,
  payuReturnStatusFromUrl,
} from '~/commerce/lib/payu-bridge'
import { Button, Spinner, Text, YStack } from '~/components/ui'
import { FullWidthLayout } from '~/components/layout'
import { commerceRoutes } from '~/lib/routes'
import { useAppUi } from '~/lib/theme/useAppUi'

const NATIVE_BRIDGE_TIMEOUT_MS = 45_000

/**
 * Auto-POST bridge to PayU `_payment` (merchant-hosted form flow).
 * Query: ?action=<payu_url>&payload=<json fields>
 * Native also accepts an in-memory session (avoids huge URL query issues).
 *
 * Web: injects a hidden form and submits it.
 * iOS/Android: loads the same form in a WebView and intercepts PayU return URLs.
 */
export function PayUBridgeScreen() {
  const ui = useAppUi()
  const router = useRouter()
  const params = useLocalSearchParams<{ action?: string | string[]; payload?: string | string[] }>()
  const [nativeError, setNativeError] = useState<string | null>(null)
  const [WebView, setWebView] = useState<ComponentType<Record<string, unknown>> | null>(null)
  const [showEscape, setShowEscape] = useState(false)

  const [bridge] = useState(() => {
    const fromQuery = parsePayuBridgeParams(
      firstSearchParam(params.action),
      firstSearchParam(params.payload),
    )
    if (fromQuery.fields && fromQuery.action) return fromQuery

    const session = consumePayuBridgeSession()
    if (session) {
      return { action: session.action, fields: session.fields, error: null as string | null }
    }
    return fromQuery
  })
  const { action, fields, error } = bridge

  const html = useMemo(() => {
    if (!action || !fields) return null
    return buildPayuAutoSubmitHtml(action, fields)
  }, [action, fields])

  useEffect(() => {
    if (Platform.OS !== 'web' || !action || !fields || typeof document === 'undefined') return
    const form = document.createElement('form')
    form.method = 'POST'
    form.action = action
    form.style.display = 'none'
    for (const [name, value] of Object.entries(fields)) {
      const input = document.createElement('input')
      input.type = 'hidden'
      input.name = name
      input.value = value
      form.appendChild(input)
    }
    document.body.appendChild(form)
    form.submit()
  }, [action, fields])

  useEffect(() => {
    if (Platform.OS === 'web') return
    let cancelled = false
    void import('react-native-webview')
      .then((module) => {
        if (!cancelled) setWebView(() => module.WebView as never)
      })
      .catch(() => {
        if (!cancelled) setNativeError('Could not open the payment page. Please try again.')
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (Platform.OS === 'web' || error || nativeError) return
    const timer = setTimeout(() => setShowEscape(true), NATIVE_BRIDGE_TIMEOUT_MS)
    return () => clearTimeout(timer)
  }, [error, nativeError])

  function handleReturnNavigation(url: string): boolean {
    if (!isPayuReturnUrl(url)) return false
    const status = payuReturnStatusFromUrl(url)
    router.replace(payuReturnHref(status) as never)
    return true
  }

  const displayError = error ?? nativeError

  if (displayError) {
    return (
      <FullWidthLayout>
        <YStack flex={1} alignItems="center" justifyContent="center" gap="$3" padding="$6">
          <Text color={ui.danger} textAlign="center" fontWeight="700">
            {displayError}
          </Text>
          <Text color={ui.textSecondary} textAlign="center">
            You can return to your cart and try checkout again.
          </Text>
          <Button tone="primary" borderRadius={999} onPress={() => router.replace(commerceRoutes.cart as never)}>
            Back to cart
          </Button>
        </YStack>
      </FullWidthLayout>
    )
  }

  if (Platform.OS !== 'web' && html) {
    if (!WebView) {
      return (
        <FullWidthLayout>
          <YStack flex={1} alignItems="center" justifyContent="center" gap="$3" padding="$6">
            <Spinner size="large" />
            <Text color={ui.textSecondary}>Preparing secure payment…</Text>
            {showEscape ? (
              <Button tone="outline" borderRadius={999} onPress={() => router.replace(commerceRoutes.cart as never)}>
                Cancel and go back
              </Button>
            ) : null}
          </YStack>
        </FullWidthLayout>
      )
    }

    return (
      <FullWidthLayout>
        <YStack flex={1} width="100%" minHeight={0}>
          <WebView
            originWhitelist={['*']}
            source={{ html, baseUrl: 'https://sheconomy.in' }}
            style={{ flex: 1, width: '100%', backgroundColor: 'transparent' }}
            startInLoadingState
            javaScriptEnabled
            domStorageEnabled
            sharedCookiesEnabled
            thirdPartyCookiesEnabled
            setSupportMultipleWindows={false}
            onShouldStartLoadWithRequest={(request: { url?: string }) => {
              const url = request?.url ?? ''
              if (handleReturnNavigation(url)) return false
              return true
            }}
            onNavigationStateChange={(navState: { url?: string }) => {
              const url = navState?.url ?? ''
              handleReturnNavigation(url)
            }}
            onHttpError={() => {
              setNativeError('Payment page failed to load. Please try again.')
            }}
            onError={() => {
              setNativeError('Could not open the payment page. Please try again.')
            }}
          />
          {showEscape ? (
            <YStack padding="$3" borderTopWidth={1} borderTopColor={ui.borderSubtle}>
              <Button tone="outline" borderRadius={999} onPress={() => router.replace(commerceRoutes.cart as never)}>
                Cancel payment
              </Button>
            </YStack>
          ) : null}
        </YStack>
      </FullWidthLayout>
    )
  }

  return (
    <FullWidthLayout>
      <YStack flex={1} alignItems="center" justifyContent="center" gap="$3" padding="$6">
        <Spinner size="large" />
        <Text color={ui.textSecondary}>Redirecting to secure payment…</Text>
      </YStack>
    </FullWidthLayout>
  )
}
