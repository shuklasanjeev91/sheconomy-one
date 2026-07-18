import { useRouter, useLocalSearchParams } from 'one'
import { useEffect, useState } from 'react'

import { Spinner, Text, YStack } from '~/components/ui'
import { FullWidthLayout } from '~/components/layout'
import { loadPendingOrderSuccess } from '~/commerce/lib/customer-orders'
import { commerceRoutes } from '~/lib/routes'
import { useAppUi } from '~/lib/theme/useAppUi'

/** PayU surl/furl landing — send buyer to order success (awaiting until webhook settles). */
export default function PayUReturnRoute() {
  const ui = useAppUi()
  const router = useRouter()
  const params = useLocalSearchParams<{ status?: string }>()
  const [message, setMessage] = useState('Confirming payment…')

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const ok = params.status === 'success'
      setMessage(ok ? 'Payment received' : 'Payment was not completed')
      const pending = await loadPendingOrderSuccess()
      if (cancelled) return
      if (pending?.orderIds?.length) {
        router.replace(commerceRoutes.orderSuccess(pending.orderIds))
        return
      }
      router.replace(ok ? commerceRoutes.orders : commerceRoutes.cart)
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
          Taking you back to your order…
        </Text>
      </YStack>
    </FullWidthLayout>
  )
}
