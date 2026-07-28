import { useRouter, useLocalSearchParams } from 'one'
import { useEffect, useState } from 'react'

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
 * PayU surl/furl landing.
 * Success → order success (awaiting until webhook settles).
 * Failure → cancel hold when possible, then pending/fail UX (never “confirmed”).
 */
export default function PayUReturnRoute() {
  const ui = useAppUi()
  const router = useRouter()
  const params = useLocalSearchParams<{ status?: string }>()
  const [message, setMessage] = useState('Confirming payment…')

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const status = (params.status ?? '').toLowerCase()
      const ok = status === 'success'

      const pending = await loadPendingOrderSuccess()
      if (cancelled) return

      if (!ok) {
        setMessage('Payment was not completed')
        if (pending?.checkoutGroupId) {
          await cancelCheckoutPayment(pending.checkoutGroupId)
          await clearPendingOrderSuccess()
          if (cancelled) return
          router.push(commerceRoutes.cart)
          return
        }
        if (pending?.orderIds?.length) {
          await savePendingOrderSuccess({
            ...pending,
            awaitingExternalPayment: true,
          })
          if (cancelled) return
          router.push(commerceRoutes.orderSuccess(pending.orderIds))
          return
        }
        router.push(commerceRoutes.cart)
        return
      }

      setMessage('Payment received — confirming…')
      if (pending?.orderIds?.length) {
        await savePendingOrderSuccess({
          ...pending,
          awaitingExternalPayment: true,
        })
        if (cancelled) return
        router.push(commerceRoutes.orderSuccess(pending.orderIds))
        return
      }
      router.push(commerceRoutes.orders)
    })()
    return () => {
      cancelled = true
    }
  }, [params.status, router])

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
