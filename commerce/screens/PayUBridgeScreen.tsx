import { useEffect, useMemo, useState, type ComponentType } from 'react'
import { Platform } from 'react-native'
import { useLocalSearchParams, useRouter } from 'one'

import { Button, Spinner, Text, YStack } from '~/components/ui'
import { FullWidthLayout } from '~/components/layout'
import { resolveAppOrigin } from '~/config/app-origin'
import { commerceRoutes } from '~/lib/routes'
import { useAppUi } from '~/lib/theme/useAppUi'

function escapeHtmlAttr(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

/** Auto-submitting PayU hosted-checkout form (works in browser document and WebView). */
function buildPayUAutoSubmitHtml(action: string, fields: Record<string, string>): string {
  const inputs = Object.entries(fields)
    .map(
      ([name, value]) =>
        `<input type="hidden" name="${escapeHtmlAttr(name)}" value="${escapeHtmlAttr(String(value ?? ''))}" />`,
    )
    .join('')

  return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Secure payment</title>
    <style>
      body {
        margin: 0;
        min-height: 100vh;
        display: flex;
        align-items: center;
        justify-content: center;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        color: #444;
        background: #faf7f8;
      }
    </style>
  </head>
  <body onload="document.getElementById('payu-form').submit()">
    <form id="payu-form" method="POST" action="${escapeHtmlAttr(action)}">${inputs}</form>
    <p>Redirecting to secure payment…</p>
  </body>
</html>`
}

function isPayUReturnUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    return /\/orders\/payu-return\/?$/.test(parsed.pathname)
  } catch {
    return /\/orders\/payu-return(\?|$)/.test(url)
  }
}

function toInAppPayUReturnHref(url: string): string {
  try {
    const parsed = new URL(url)
    return `${parsed.pathname}${parsed.search}`
  } catch {
    const idx = url.indexOf('/orders/payu-return')
    return idx >= 0 ? url.slice(idx) : url
  }
}

/**
 * Auto-POST bridge to PayU `_payment` (merchant-hosted form flow).
 * Query: ?action=<payu_url>&payload=<json fields>
 *
 * Web: submits a hidden form via `document`.
 * iOS/Android: loads the same auto-submit HTML inside a WebView so purchase
 * never sits on an indefinite “Redirecting…” spinner (App Store rejection).
 */
export function PayUBridgeScreen() {
  const ui = useAppUi()
  const router = useRouter()
  const params = useLocalSearchParams<{ action?: string; payload?: string }>()
  const [WebViewComponent, setWebViewComponent] = useState<ComponentType<any> | null>(null)
  const [nativeError, setNativeError] = useState<string | null>(null)

  const { action, fields, error } = useMemo(() => {
    try {
      const actionUrl = typeof params.action === 'string' ? params.action : ''
      const raw = typeof params.payload === 'string' ? params.payload : ''
      if (!actionUrl || !raw) {
        return { action: '', fields: null as Record<string, string> | null, error: 'Missing payment payload' }
      }
      const parsed = JSON.parse(raw) as Record<string, string>
      return { action: actionUrl, fields: parsed, error: null as string | null }
    } catch {
      return { action: '', fields: null, error: 'Invalid payment payload' }
    }
  }, [params.action, params.payload])

  const html = useMemo(() => {
    if (!action || !fields) return null
    return buildPayUAutoSubmitHtml(action, fields)
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
        if (!cancelled) setWebViewComponent(() => module.WebView)
      })
      .catch(() => {
        if (!cancelled) {
          setNativeError('Unable to open the payment page on this device.')
        }
      })
    return () => {
      cancelled = true
    }
  }, [])

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
          <Button tone="primary" size="$4" borderRadius={999} onPress={() => router.push(commerceRoutes.cart)}>
            Back to cart
          </Button>
        </YStack>
      </FullWidthLayout>
    )
  }

  if (Platform.OS !== 'web' && html) {
    if (!WebViewComponent) {
      return (
        <FullWidthLayout>
          <YStack flex={1} alignItems="center" justifyContent="center" gap="$3" padding="$6">
            <Spinner size="large" />
            <Text color={ui.textSecondary}>Opening secure payment…</Text>
          </YStack>
        </FullWidthLayout>
      )
    }

    const WebView = WebViewComponent
    return (
      <FullWidthLayout>
        <YStack flex={1} width="100%" backgroundColor={ui.background}>
          <WebView
            originWhitelist={['*']}
            source={{ html, baseUrl: resolveAppOrigin() }}
            style={{ flex: 1, width: '100%', backgroundColor: 'transparent' }}
            startInLoadingState
            javaScriptEnabled
            domStorageEnabled
            setSupportMultipleWindows={false}
            onError={() => {
              setNativeError('Payment page failed to load. Please try again.')
            }}
            onHttpError={() => {
              setNativeError('Payment page failed to load. Please try again.')
            }}
            onShouldStartLoadWithRequest={(request: { url?: string }) => {
              const url = request?.url ?? ''
              if (!url || url === 'about:blank') return true
              if (isPayUReturnUrl(url)) {
                router.replace(toInAppPayUReturnHref(url) as never)
                return false
              }
              return true
            }}
            onNavigationStateChange={(navState: { url?: string }) => {
              const url = navState?.url ?? ''
              if (url && isPayUReturnUrl(url)) {
                router.replace(toInAppPayUReturnHref(url) as never)
              }
            }}
          />
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
