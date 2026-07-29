import { useRouter, useLocalSearchParams } from 'one'
import { useEffect, useState } from 'react'

import {
  cancelCheckoutPayment,
  confirmCheckoutPayment,
} from '~/commerce/lib/checkout'
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
 * Razorpay Payment Link callback landing page.
 *
 * Razorpay appends these query params on return:
 *   razorpay_payment_id            — the payment ID (e.g. pay_xxx)
 *   razorpay_payment_link_id       — the payment link ID
 *   razorpay_payment_link_status   — 'paid' | 'cancelled'
 *   razorpay_signature             — HMAC signature
 *   status                         — 'success' | 'failure'
 *   step                           — our checkout payment step UUID
 *
 * On success:
 *   1. Call process_checkout_payment_webhook via RPC to promote the order from
 *      awaiting_payment → pending and mark order_payments as paid.
 *   2. Redirect to the order success screen.
 *
 * On failure:
 *   Cancel the checkout hold and return to cart.
 */
export default function RazorpayReturnRoute() {
  const ui = useAppUi()
  const router = useRouter()
  const params = useLocalSearchParams<{
    status?: string
    razorpay_payment_id?: string
    razorpay_payment_link_status?: string
  }>()
  const [message, setMessage] = useState('Confirming payment…')

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const status = (params.status ?? '').toLowerCase()
      const linkStatus = (params.razorpay_payment_link_status ?? '').toLowerCase()
      const paymentId = params.razorpay_payment_id ?? ''
      const isPaid = status === 'success' || linkStatus === 'paid'

      const pending = await loadPendingOrderSuccess()
      if (cancelled) return

      // ── Payment failed / cancelled ──────────────────────────────────────────
      if (!isPaid) {
        setMessage('Payment was not completed')
        if (pending?.checkoutGroupId) {
          await cancelCheckoutPayment(pending.checkoutGroupId)
          await clearPendingOrderSuccess()
          if (cancelled) return
          router.push(commerceRoutes.cart)
          return
        }
        if (pending?.orderIds?.length) {
          await savePendingOrderSuccess({ ...pending, awaitingExternalPayment: true })
          if (cancelled) return
          router.push(commerceRoutes.orderSuccess(pending.orderIds))
          return
        }
        router.push(commerceRoutes.cart)
        return
      }

      // ── Payment succeeded ───────────────────────────────────────────────────
      setMessage('Payment received — confirming order…')

      if (pending?.checkoutGroupId && paymentId) {
        // Promote order: awaiting_payment → pending, mark order_payments as paid.
        await confirmCheckoutPayment(pending.checkoutGroupId, paymentId, 'razorpay')
      }

      if (pending?.orderIds?.length) {
        // Clear the awaitingExternalPayment flag — payment is now confirmed.
        await savePendingOrderSuccess({
          ...pending,
          awaitingExternalPayment: false,
        })
        if (cancelled) return
        router.push(commerceRoutes.orderSuccess(pending.orderIds))
        return
      }

      // Fallback if we lost the pending snapshot (e.g. session expired).
      router.replace(commerceRoutes.orders)
    })()
    return () => {
      cancelled = true
    }
  }, [params.status, params.razorpay_payment_id, params.razorpay_payment_link_status, router])

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
