import { useCallback, useEffect, useState } from 'react'
import { useLocalSearchParams, useRouter } from 'one'

import {
  clearPendingOrderSuccess,
  loadPendingOrderSuccess,
  savePendingOrderSuccess,
} from '~/commerce/lib/customer-orders'
import { CommercePageHeader, CommercePanel } from '~/commerce/components'
import { Button, Icons, Spinner, Text, YStack } from '~/components/ui'
import { FullWidthLayout, PageContent } from '~/components/layout'
import { formatCurrency } from '~/lib/format'
import {
  firstQueryParam,
  platformPayuFailureMessage,
  platformPayuService,
  type PlatformPayuPaymentSummary,
} from '~/lib/platform-payu'
import { commerceRoutes } from '~/lib/routes'
import { useAppUi } from '~/lib/theme/useAppUi'

const POLL_MS = 2500
const POLL_MAX = 8

export function PlatformPayuSuccessScreen() {
  const ui = useAppUi()
  const router = useRouter()
  const params = useLocalSearchParams<{ txn?: string }>()
  const txnid = firstQueryParam(params.txn)

  const [summary, setSummary] = useState<PlatformPayuPaymentSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async (): Promise<PlatformPayuPaymentSummary | null> => {
    if (!txnid) {
      setError('Missing transaction reference.')
      setLoading(false)
      return null
    }

    const result = await platformPayuService.getPaymentByTxnId(txnid)
    if (!result.success || !result.data) {
      setError(result.error ?? 'Could not load payment details.')
      setLoading(false)
      return null
    }

    const next = platformPayuService.toPaymentSummary(result.data)
    setSummary(next)
    setLoading(false)
    return next
  }, [txnid])

  useEffect(() => {
    let cancelled = false
    let attempts = 0

    async function poll() {
      if (cancelled) return
      const current = await load()
      if (cancelled) return

      if (current?.payment_status === 'completed') {
        const pending = await loadPendingOrderSuccess()
        if (cancelled) return
        if (pending?.orderIds?.length) {
          await savePendingOrderSuccess({ ...pending, awaitingExternalPayment: false })
          router.replace(commerceRoutes.orderSuccess(pending.orderIds))
          return
        }
        if (current.order_id) {
          router.replace(commerceRoutes.order(current.order_id))
        }
        return
      }

      attempts += 1
      if (attempts < POLL_MAX) {
        window.setTimeout(poll, POLL_MS)
      }
    }

    void poll()
    return () => {
      cancelled = true
    }
  }, [load, router])

  return (
    <FullWidthLayout>
      <PageContent maxWidth={720}>
        <CommercePageHeader title="Payment status" />
        <CommercePanel>
          {loading ? (
            <YStack alignItems="center" gap="$3" padding="$6">
              <Spinner size="large" />
              <Text color={ui.textSecondary}>Confirming your payment…</Text>
            </YStack>
          ) : error ? (
            <YStack gap="$3" padding="$4">
              <Text color={ui.danger} fontWeight="600">
                {error}
              </Text>
              <Button tone="outline" onPress={() => router.replace(commerceRoutes.orders)}>
                View orders
              </Button>
            </YStack>
          ) : summary ? (
            <YStack gap="$4" padding="$4">
              <YStack alignItems="center" gap="$2">
                <Icons.CheckCircle size={48} color={ui.success} />
                <Text fontSize={20} fontWeight="700" color={ui.text}>
                  {summary.payment_status === 'completed' ? 'Payment successful' : 'Payment received'}
                </Text>
                <Text color={ui.textSecondary} textAlign="center">
                  {summary.payment_status === 'completed'
                    ? 'Your payment has been confirmed.'
                    : 'We are still confirming your payment. This page will update shortly.'}
                </Text>
              </YStack>

              <YStack gap="$2" padding="$3" borderRadius="$3" backgroundColor={ui.surfaceMuted}>
                <Text color={ui.textMuted} fontSize={13}>
                  Transaction ID
                </Text>
                <Text color={ui.text} fontWeight="600">
                  {summary.txnid}
                </Text>
                <Text color={ui.textMuted} fontSize={13} marginTop="$2">
                  Amount
                </Text>
                <Text color={ui.text} fontWeight="700" fontSize={18}>
                  {formatCurrency(summary.amount, 'INR')}
                </Text>
                {summary.gateway_transaction_id ? (
                  <>
                    <Text color={ui.textMuted} fontSize={13} marginTop="$2">
                      PayU reference
                    </Text>
                    <Text color={ui.text}>{summary.gateway_transaction_id}</Text>
                  </>
                ) : null}
              </YStack>

              <Button
                tone="primary"
                onPress={() =>
                  router.replace(commerceRoutes.order(summary.order_id))
                }
              >
                View order
              </Button>
              <Button tone="outline" onPress={() => router.replace(commerceRoutes.orders)}>
                All orders
              </Button>
            </YStack>
          ) : null}
        </CommercePanel>
      </PageContent>
    </FullWidthLayout>
  )
}

export function PlatformPayuFailureScreen() {
  const ui = useAppUi()
  const router = useRouter()
  const params = useLocalSearchParams<{ txn?: string; reason?: string }>()
  const txnid = firstQueryParam(params.txn)
  const reason = firstQueryParam(params.reason)

  return (
    <FullWidthLayout>
      <PageContent maxWidth={720}>
        <CommercePageHeader title="Payment failed" />
        <CommercePanel>
          <YStack gap="$4" padding="$4" alignItems="center">
            <Icons.XCircle size={48} color={ui.danger} />
            <Text fontSize={20} fontWeight="700" color={ui.text} textAlign="center">
              Payment not completed
            </Text>
            <Text color={ui.textSecondary} textAlign="center" lineHeight={22}>
              {platformPayuFailureMessage(reason)}
            </Text>
            {txnid ? (
              <Text color={ui.textMuted} fontSize={13}>
                Ref: {txnid}
              </Text>
            ) : null}
            <Button tone="primary" onPress={() => router.replace(commerceRoutes.checkout)}>
              Try again
            </Button>
            <Button tone="outline" onPress={() => router.replace(commerceRoutes.cart)}>
              Back to cart
            </Button>
          </YStack>
        </CommercePanel>
      </PageContent>
    </FullWidthLayout>
  )
}
