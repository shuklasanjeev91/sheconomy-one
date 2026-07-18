import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'one'
import { AppLink } from '~/components/navigation/AppLink'

import { CommercePageHeader, CommercePanel } from '~/commerce/components'
import { OrderStatusBadge } from '~/commerce/components/vendor/OrderStatusBadge'
import { cancelCheckoutPayment, resumeCheckoutPayment } from '~/commerce/lib/checkout'
import {
  isAppPayUBridgeUrl,
  isOrderPaymentSettled,
  orderSuccessHeadline,
  orderSuccessSubtitle,
  ordersAwaitingOnlinePayment,
} from '~/commerce/lib/checkout-payment-route'
import { firstCheckoutUrlFromSteps } from '~/commerce/lib/checkout-utils'
import {
  clearPendingOrderSuccess,
  fetchCustomerOrdersByIds,
  loadPendingOrderSuccess,
  savePendingOrderSuccess,
  type CustomerOrderSummary,
} from '~/commerce/lib/customer-orders'
import { formatEstimatedDelivery } from '~/commerce/lib/customer-order-lifecycle'
import { Button, Icons, ScreenState, Text, XStack, YStack, useAppToast } from '~/components/ui'
import { FullWidthLayout, PageSection } from '~/components/layout'
import { formatCurrency } from '~/lib/format'
import { formatOrderDate } from '~/lib/orders/order.utils'
import { openExternalUrl } from '~/lib/platform/openUrl'
import { commerceRoutes } from '~/lib/routes'
import { useProfile } from '~/hooks/useProfile'
import { useAppUi } from '~/lib/theme/useAppUi'
import { trackCommerceEvent } from '~/lib/analytics'

const PAYMENT_POLL_MS = 2500
const PAYMENT_POLL_MAX = 12

function parseIdsFromSearch(): string[] {
  if (typeof window === 'undefined') return []
  try {
    const params = new URLSearchParams(window.location.search)
    const raw = params.get('ids') ?? ''
    return raw
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean)
  } catch {
    return []
  }
}

export function OrderSuccessScreen() {
  const ui = useAppUi()
  const router = useRouter()
  const toast = useAppToast()
  const { user } = useProfile()
  const [orders, setOrders] = useState<CustomerOrderSummary[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [checkoutGroupId, setCheckoutGroupId] = useState<string | null>(null)
  const [checkoutUrl, setCheckoutUrl] = useState<string | null>(null)
  const [paymentBusy, setPaymentBusy] = useState(false)
  const [confirmingPayment, setConfirmingPayment] = useState(false)
  const purchaseTracked = useRef(false)
  const pollCount = useRef(0)

  const load = useCallback(async () => {
    if (!user?.id) {
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    setError(null)

    let ids = parseIdsFromSearch()
    const pending = await loadPendingOrderSuccess()
    if (!ids.length && pending?.orderIds?.length) {
      ids = pending.orderIds
    }
    setCheckoutGroupId(pending?.checkoutGroupId ?? null)
    setCheckoutUrl(pending?.checkoutUrl ?? null)

    if (!ids.length) {
      setOrders([])
      setError(null)
      setIsLoading(false)
      return
    }

    const result = await fetchCustomerOrdersByIds(ids, user.id)
    setOrders(result.orders)
    setError(result.error)
    setIsLoading(false)

    const paymentSettled =
      result.orders.length > 0 && result.orders.every((order) => isOrderPaymentSettled(order))

    if (paymentSettled) {
      await clearPendingOrderSuccess()
      if (!purchaseTracked.current) {
        purchaseTracked.current = true
        const primary = result.orders[0]
        trackCommerceEvent('purchase', {
          currency: primary?.currency ?? 'INR',
          value: result.orders.reduce((sum, row) => sum + (row.total_amount ?? 0), 0),
          transactionId: primary?.order_number ?? primary?.id,
          items: result.orders.map((row) => ({
            id: row.id,
            name: row.order_number ?? row.id,
            price: row.total_amount ?? undefined,
            quantity: row.item_count ?? 1,
          })),
        })
      }
    }
  }, [user?.id])

  useEffect(() => {
    void load()
  }, [load])

  const awaitingPayment = useMemo(() => ordersAwaitingOnlinePayment(orders), [orders])

  useEffect(() => {
    if (!awaitingPayment || !user?.id) {
      setConfirmingPayment(false)
      return
    }

    setConfirmingPayment(true)
    pollCount.current = 0
    const timer = setInterval(() => {
      pollCount.current += 1
      if (pollCount.current > PAYMENT_POLL_MAX) {
        clearInterval(timer)
        setConfirmingPayment(false)
        return
      }
      void load()
    }, PAYMENT_POLL_MS)

    return () => clearInterval(timer)
  }, [awaitingPayment, load, user?.id])

  useEffect(() => {
    if (!awaitingPayment) setConfirmingPayment(false)
  }, [awaitingPayment])

  const headline = useMemo(
    () => orderSuccessHeadline({ orders, awaitingPayment }),
    [awaitingPayment, orders],
  )

  const subtitle = useMemo(
    () =>
      confirmingPayment && awaitingPayment
        ? 'Confirming payment with your bank… this usually takes a few seconds.'
        : orderSuccessSubtitle({ awaitingPayment }),
    [awaitingPayment, confirmingPayment],
  )

  async function openPaymentUrl(url: string) {
    if (isAppPayUBridgeUrl(url) || /\/orders\/payu(\?|$)/.test(url)) {
      router.replace(url as never)
      return true
    }
    return openExternalUrl(url)
  }

  async function handleResumePayment() {
    if (!checkoutGroupId || paymentBusy) return
    setPaymentBusy(true)
    try {
      const { data, error: resumeError } = await resumeCheckoutPayment(checkoutGroupId)
      if (resumeError) {
        toast.show('Could not resume payment', { tone: 'danger', message: resumeError.message })
        return
      }
      const payload = (data ?? {}) as Record<string, unknown>
      const steps = Array.isArray(payload.payment_steps)
        ? (payload.payment_steps as Array<{ checkout_url?: unknown }>)
        : []
      const nextUrl = firstCheckoutUrlFromSteps(steps) ?? checkoutUrl
      if (nextUrl) {
        setCheckoutUrl(nextUrl)
        const pending = await loadPendingOrderSuccess()
        if (pending) {
          await savePendingOrderSuccess({ ...pending, checkoutUrl: nextUrl, awaitingExternalPayment: true })
        }
        const opened = await openPaymentUrl(nextUrl)
        if (!opened) {
          toast.show('Payment page blocked', {
            tone: 'info',
            message: 'Allow pop-ups, or open the payment link from your email.',
          })
        }
      } else {
        toast.show('Payment link not ready', {
          tone: 'info',
          message: 'Your order is reserved. Try again in a moment.',
        })
      }
    } finally {
      setPaymentBusy(false)
    }
  }

  async function handleCancelCheckout() {
    if (!checkoutGroupId || paymentBusy) return
    setPaymentBusy(true)
    try {
      const { error: cancelError } = await cancelCheckoutPayment(checkoutGroupId)
      if (cancelError) {
        toast.show('Could not cancel checkout', { tone: 'danger', message: cancelError.message })
        return
      }
      await clearPendingOrderSuccess()
      setCheckoutGroupId(null)
      setCheckoutUrl(null)
      toast.show('Checkout cancelled', {
        tone: 'success',
        message: 'Reserved stock was released and items can return to your cart.',
      })
      router.replace(commerceRoutes.cart)
    } finally {
      setPaymentBusy(false)
    }
  }

  return (
    <FullWidthLayout scroll>
      <PageSection paddingVertical="$6">
        <YStack gap="$5" width="100%">
          <CommercePageHeader title={headline} subtitle={subtitle} />

          {awaitingPayment && checkoutGroupId ? (
            <CommercePanel padding="$4" gap="$3">
              <Text fontWeight="700" fontSize={15} color={ui.text}>
                Payment required
              </Text>
              <Text fontSize={13} color={ui.textSecondary} lineHeight={18}>
                Finish checkout on PayU (SHEPay) or the seller’s payment page. Cancel releases
                reserved stock and returns items to your cart.
              </Text>
              <XStack gap="$2" flexWrap="wrap">
                <Button
                  tone="primary"
                  size="$3"
                  borderRadius={999}
                  disabled={paymentBusy}
                  onPress={() => void handleResumePayment()}
                >
                  {paymentBusy
                    ? 'Working…'
                    : checkoutUrl && isAppPayUBridgeUrl(checkoutUrl)
                      ? 'Continue to PayU'
                      : 'Resume payment'}
                </Button>
                <Button
                  tone="outline"
                  size="$3"
                  borderRadius={999}
                  disabled={paymentBusy}
                  onPress={() => void handleCancelCheckout()}
                >
                  Cancel checkout
                </Button>
              </XStack>
            </CommercePanel>
          ) : null}

          <ScreenState
            loading={isLoading && orders.length === 0}
            error={error}
            empty={!isLoading && !error && orders.length === 0}
            emptyTitle="No recent order found"
            emptyMessage="If you just paid in another tab, open Your orders — or place a new order from the cart."
            emptyActionLabel="View your orders"
            onEmptyAction={() => router.replace(commerceRoutes.orders)}
            onRetry={() => void load()}
          >
            <YStack gap="$3" width="100%">
              {orders.map((order) => {
                const eta = formatEstimatedDelivery(order.estimated_delivery_date)
                const unpaid = ordersAwaitingOnlinePayment([order])
                const paymentLine = [order.payment_mode, order.payment_status]
                  .filter(Boolean)
                  .join(' · ')

                return (
                  <CommercePanel key={order.id} padding="$4" gap="$3">
                    <XStack justifyContent="space-between" alignItems="flex-start" gap="$3">
                      <YStack flex={1} gap={4}>
                        <Text fontWeight="800" fontSize={16} color={ui.text}>
                          Order #{order.order_number}
                        </Text>
                        <Text fontSize={13} color={ui.textSecondary}>
                          {order.shop_name ?? 'Shop'}
                          {order.item_count ? ` · ${order.item_count} items` : ''}
                        </Text>
                        <Text fontSize={12} color={ui.textMuted}>
                          {unpaid
                            ? `Awaiting payment · reserved ${formatOrderDate(order.created_at, true)}`
                            : `Placed ${formatOrderDate(order.created_at, true)}`}
                        </Text>
                      </YStack>
                      <YStack alignItems="flex-end" gap="$2">
                        <OrderStatusBadge status={order.order_status} size="sm" />
                        <Text fontWeight="800" fontSize={15} color={ui.text}>
                          {formatCurrency(order.total_amount, order.currency)}
                        </Text>
                      </YStack>
                    </XStack>

                    {paymentLine || eta ? (
                      <YStack gap={2}>
                        {paymentLine ? (
                          <Text fontSize={12} color={ui.textSecondary} textTransform="capitalize">
                            Payment: {paymentLine}
                          </Text>
                        ) : null}
                        {eta && !unpaid ? (
                          <Text fontSize={12} color={ui.textSecondary}>
                            Estimated delivery: {eta}
                          </Text>
                        ) : null}
                      </YStack>
                    ) : null}

                    <XStack gap="$2" flexWrap="wrap">
                      <AppLink href={commerceRoutes.order(order.id)} asChild>
                        <Button tone="primary" size="$3" borderRadius={999}>
                          View order
                        </Button>
                      </AppLink>
                      {!unpaid ? (
                        <AppLink href={commerceRoutes.order(order.id)} asChild>
                          <Button
                            tone="outline"
                            size="$3"
                            borderRadius={999}
                            icon={<Icons.Truck size={14} />}
                          >
                            Track package
                          </Button>
                        </AppLink>
                      ) : null}
                    </XStack>
                  </CommercePanel>
                )
              })}
            </YStack>
          </ScreenState>

          <XStack gap="$2" flexWrap="wrap">
            <AppLink href={commerceRoutes.orders} asChild>
              <Button tone="outline" size="$3" borderRadius={999}>
                All orders
              </Button>
            </AppLink>
            <AppLink href={commerceRoutes.home} asChild>
              <Button tone="primary" size="$3" borderRadius={999}>
                Continue shopping
              </Button>
            </AppLink>
          </XStack>
        </YStack>
      </PageSection>
    </FullWidthLayout>
  )
}
