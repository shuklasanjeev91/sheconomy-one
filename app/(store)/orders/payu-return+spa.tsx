import { useLocalSearchParams } from 'one'
import { useEffect, useState } from 'react'
import { Platform } from 'react-native'

import { cancelCheckoutPayment } from '~/commerce/lib/checkout'
import {
  clearPendingOrderSuccess,
  loadPendingOrderSuccess,
  savePendingOrderSuccess,
} from '~/commerce/lib/customer-orders'
import { Spinner, Text, YStack } from '~/components/ui'
import { FullWidthLayout } from '~/components/layout'
import { navigateApp } from '~/lib/platform/navigate'
import { commerceRoutes } from '~/lib/routes'
import { useAppUi } from '~/lib/theme/useAppUi'

/**
 * PayU surl/furl landing (after shepay-payu-return 303).
 * Failure: cart is usually restored by the edge bridge; SPA cancel is a backup.
 * Success → order success (awaiting until webhook settles).
 */
export default function PayUReturnRoute() {
  const ui = useAppUi()
  const params = useLocalSearchParams<{ status?: string; embed?: string; cg?: string; txn?: string }>()
  const [message, setMessage] = useState('Confirming payment…')

  const embedParam =
    String(params.embed ?? '') === '1' ||
    String(params.embed ?? '').toLowerCase() === 'true'

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const status = (params.status ?? '').toLowerCase()
      const ok = status === 'success'
      const cgFromUrl = typeof params.cg === 'string' ? params.cg.trim() : ''
      const embed = embedParam

      const pending = await loadPendingOrderSuccess()
      if (cancelled) return

      if (embed && Platform.OS === 'web' && typeof window !== 'undefined') {
        try {
          if (ok && pending?.orderIds?.length) {
            await savePendingOrderSuccess({
              ...pending,
              awaitingExternalPayment: false,
            })
          }
          // Parent checkout listens and soft-navigates — never touch window.top.location.
          window.parent?.postMessage(
            {
              type: 'payu-embed-return',
              status: ok ? 'success' : 'failure',
              txn: typeof params.txn === 'string' ? params.txn : '',
              orderIds: pending?.orderIds ?? [],
            },
            window.location.origin,
          )

          setMessage(ok ? 'Payment received' : 'Payment was not completed')
          return
        } catch {
          // fall through to soft navigation
        }
      }

      if (cancelled) return

      if (!ok) {
        setMessage('Payment was not completed — restoring your cart…')
        const checkoutGroupId = cgFromUrl || pending?.checkoutGroupId || null
        if (checkoutGroupId) {
          // Edge bridge usually already cancelled; safe to call again (no-op if cancelled).
          const { error } = await cancelCheckoutPayment(checkoutGroupId)
          if (error) {
            console.warn('cancelCheckoutPayment', error.message)
          }
          await clearPendingOrderSuccess()
          if (cancelled) return
          navigateApp(commerceRoutes.cart)
          return
        }
        if (pending?.orderIds?.length) {
          await savePendingOrderSuccess({
            ...pending,
            awaitingExternalPayment: true,
          })
          if (cancelled) return
          navigateApp(commerceRoutes.orderSuccess(pending.orderIds))
          return
        }
        navigateApp(commerceRoutes.cart)
        return
      }

      setMessage('Payment received — confirming…')
      if (pending?.orderIds?.length) {
        await savePendingOrderSuccess({
          ...pending,
          awaitingExternalPayment: true,
        })
        if (cancelled) return
        navigateApp(commerceRoutes.orderSuccess(pending.orderIds))
        return
      }
      navigateApp(commerceRoutes.orders)
    })()
    return () => {
      cancelled = true
    }
  }, [embedParam, params.status, params.cg, params.txn])

  if (embedParam && Platform.OS === 'web') {
    return (
      <YStack flex={1} alignItems="center" justifyContent="center" gap="$2" padding="$4" minHeight={120}>
        <Spinner size="small" />
        <Text color={ui.textSecondary} fontSize={13} textAlign="center">
          {message}
        </Text>
      </YStack>
    )
  }

  return (
    <FullWidthLayout>
      <YStack flex={1} alignItems="center" justifyContent="center" gap="$3" padding="$6">
        <Spinner size="large" />
        <Text color={ui.text} fontWeight="700">
          {message}
        </Text>
        <Text color={ui.textSecondary} textAlign="center">
          Taking you back…
        </Text>
      </YStack>
    </FullWidthLayout>
  )
}
