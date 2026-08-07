import { useRouter, useLocalSearchParams } from 'one'
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
import { commerceRoutes } from '~/lib/routes'
import { useAppUi } from '~/lib/theme/useAppUi'

/**
 * PayU surl/furl landing (after shepay-payu-return 303).
 * Failure: cart is usually restored by the edge bridge; SPA cancel is a backup.
 * Success → order success (awaiting until webhook settles).
 */
export default function PayUReturnRoute() {
  const ui = useAppUi()
  const router = useRouter()
  const params = useLocalSearchParams<{ status?: string; embed?: string; cg?: string }>()
  const [message, setMessage] = useState('Confirming payment…')

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const status = (params.status ?? '').toLowerCase()
      const ok = status === 'success'
      const cgFromUrl = typeof params.cg === 'string' ? params.cg.trim() : ''
      const embed =
        String(params.embed ?? '') === '1' ||
        String(params.embed ?? '').toLowerCase() === 'true'

      if (embed && Platform.OS === 'web' && typeof window !== 'undefined') {
        try {
          window.parent?.postMessage(
            { type: 'payu-embed-return', status: ok ? 'success' : 'failure' },
            '*',
          )
          setMessage(ok ? 'Payment received' : 'Payment was not completed')
          return
        } catch {
          // fall through to full navigation
        }
      }

      const pending = await loadPendingOrderSuccess()
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
          router.replace(commerceRoutes.cart)
          return
        }
        if (pending?.orderIds?.length) {
          await savePendingOrderSuccess({
            ...pending,
            awaitingExternalPayment: true,
          })
          if (cancelled) return
          router.replace(commerceRoutes.orderSuccess(pending.orderIds))
          return
        }
        router.replace(commerceRoutes.cart)
        return
      }

      setMessage('Payment received — confirming…')
      if (pending?.orderIds?.length) {
        await savePendingOrderSuccess({
          ...pending,
          awaitingExternalPayment: true,
        })
        if (cancelled) return
        router.replace(commerceRoutes.orderSuccess(pending.orderIds))
        return
      }
      router.replace(commerceRoutes.orders)
    })()
    return () => {
      cancelled = true
    }
  }, [params.status, params.embed, params.cg, router])

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
