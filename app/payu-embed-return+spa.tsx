import { useLocalSearchParams } from 'one'
import { useEffect } from 'react'
import { Platform } from 'react-native'

import {
  loadPendingOrderSuccess,
  savePendingOrderSuccess,
} from '~/commerce/lib/customer-orders'

/**
 * Minimal PayU 3DS / bank return — loads inside an iframe only.
 * Notifies parent checkout via postMessage; parent soft-navigates with router.push.
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

      try {
        // Parent CheckoutPayuPanel soft-navigates — never touch window.top.location.
        window.parent?.postMessage(
          {
            type: 'payu-embed-return',
            status: ok ? 'success' : 'failure',
            txn,
            orderIds,
          },
          window.location.origin,
        )
      } catch {
        // ignore
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
