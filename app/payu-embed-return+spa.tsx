import { useLocalSearchParams } from 'one'
import { useEffect } from 'react'
import { Platform } from 'react-native'

import {
  loadPendingOrderSuccess,
  savePendingOrderSuccess,
} from '~/commerce/lib/customer-orders'
import { commerceRoutes } from '~/lib/routes'

/**
 * Minimal PayU 3DS / bank return — loads inside an iframe only.
 * Notifies parent checkout via postMessage and breaks out to order success.
 */
export default function PayUEmbedReturnRoute() {
  const params = useLocalSearchParams<{ status?: string; txn?: string }>()

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return

    let cancelled = false

    void (async () => {
      const status = String(params.status ?? '').toLowerCase()
      const ok = status === 'success'
      const txn = typeof params.txn === 'string' ? params.txn : ''
      const pending = await loadPendingOrderSuccess()
      if (cancelled) return

      if (ok && pending?.orderIds?.length) {
        await savePendingOrderSuccess({ ...pending, awaitingExternalPayment: false })
      }

      const orderIds = pending?.orderIds ?? []
      const origin = window.location.origin

      try {
        window.parent?.postMessage(
          {
            type: 'payu-embed-return',
            status: ok ? 'success' : 'failure',
            txn,
            orderIds,
          },
          origin,
        )
      } catch {
        // ignore
      }

      if (window.top && window.top !== window.self) {
        const target = ok
          ? orderIds.length
            ? String(commerceRoutes.orderSuccess(orderIds))
            : String(commerceRoutes.orders)
          : String(commerceRoutes.checkout)
        try {
          window.top.location.href = target.startsWith('http')
            ? target
            : `${origin}${target}`
        } catch {
          // sandbox may block — parent postMessage is the primary path
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [params.status, params.txn])

  if (Platform.OS !== 'web') return null

  return (
    <div
      style={{
        margin: 0,
        padding: 24,
        fontFamily: 'system-ui, sans-serif',
        textAlign: 'center',
        color: '#555',
        background: '#fff',
      }}
    >
      <p style={{ margin: 0, fontSize: 14 }}>Completing payment…</p>
    </div>
  )
}
