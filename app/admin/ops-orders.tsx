import { useState } from 'react'

import {
  adminManualRelease,
  adminResyncShipment,
  adminRetrySplit,
  adminSearchOrders,
} from '~/lib/admin/ops'
import { Button, Input, Spinner, Text, XStack, YStack, useAppToast } from '~/components/ui'
import { useAppUi } from '~/lib/theme/useAppUi'

export default function AdminOpsOrdersPage() {
  const ui = useAppUi()
  const toast = useAppToast()
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [orders, setOrders] = useState<Array<Record<string, unknown>>>([])
  const [settlements, setSettlements] = useState<Array<Record<string, unknown>>>([])
  const [deliveries, setDeliveries] = useState<Array<Record<string, unknown>>>([])

  async function search() {
    const q = query.trim()
    if (q.length < 3) {
      toast.show('Enter at least 3 characters', { tone: 'danger' })
      return
    }
    setLoading(true)
    const result = await adminSearchOrders(q)
    setLoading(false)
    if (result.error) {
      toast.show('Search failed', { tone: 'danger', message: result.error })
      return
    }
    setOrders(result.data?.orders ?? [])
    setSettlements(result.data?.settlements ?? [])
    setDeliveries(result.data?.deliveries ?? [])
  }

  async function retrySplit(id: string) {
    setBusyId(id)
    const result = await adminRetrySplit(id)
    setBusyId(null)
    toast.show(result.error ? 'Retry split failed' : 'Split retried', {
      tone: result.error ? 'danger' : 'success',
      message: result.error ?? undefined,
    })
  }

  async function manualRelease(id: string) {
    setBusyId(id)
    const result = await adminManualRelease(id, 'admin_manual_release')
    setBusyId(null)
    toast.show(result.error ? 'Release failed' : 'Settlement released', {
      tone: result.error ? 'danger' : 'success',
      message: result.error ?? undefined,
    })
  }

  async function resync(orderId: string) {
    setBusyId(orderId)
    const result = await adminResyncShipment({ orderId })
    setBusyId(null)
    toast.show(result.error ? 'Resync failed' : 'Shipment resync requested', {
      tone: result.error ? 'danger' : 'success',
      message: result.error ?? undefined,
    })
  }

  return (
    <YStack gap="$4" padding="$4" width="100%">
      <YStack gap={4}>
        <Text fontSize={22} fontWeight="800" color={ui.text}>
          Order ops
        </Text>
        <Text fontSize={13} color={ui.textSecondary}>
          Search by order number, PayU id / txnid, or AWB. Retry split, resync shipment, manual
          release.
        </Text>
      </YStack>

      <XStack gap="$2" flexWrap="wrap" alignItems="center">
        <Input
          flex={1}
          minWidth={220}
          value={query}
          onChangeText={setQuery}
          placeholder="Order #, PayU id, txnid, AWB…"
          onSubmitEditing={() => void search()}
        />
        <Button tone="primary" size="$3" borderRadius={999} onPress={() => void search()}>
          Search
        </Button>
      </XStack>

      {loading ? (
        <YStack alignItems="center" paddingVertical="$6">
          <Spinner />
        </YStack>
      ) : (
        <YStack gap="$4">
          <YStack gap="$2">
            <Text fontWeight="700" color={ui.text}>
              Orders ({orders.length})
            </Text>
            {orders.map((o) => (
              <XStack
                key={String(o.id)}
                justifyContent="space-between"
                gap="$2"
                flexWrap="wrap"
                padding="$3"
                borderWidth={1}
                borderColor={ui.borderSubtle}
                borderRadius={10}
              >
                <YStack flex={1} gap={2}>
                  <Text fontWeight="700" color={ui.text}>
                    #{String(o.order_number)} · {String(o.order_status)}
                  </Text>
                  <Text fontSize={11} color={ui.textMuted}>
                    {String(o.id)}
                  </Text>
                </YStack>
                <Button
                  tone="outline"
                  size="$2"
                  borderRadius={999}
                  disabled={busyId === String(o.id)}
                  onPress={() => void resync(String(o.id))}
                >
                  Resync shipment
                </Button>
              </XStack>
            ))}
          </YStack>

          <YStack gap="$2">
            <Text fontWeight="700" color={ui.text}>
              Settlements ({settlements.length})
            </Text>
            {settlements.map((s) => (
              <YStack
                key={String(s.id)}
                gap="$2"
                padding="$3"
                borderWidth={1}
                borderColor={ui.borderSubtle}
                borderRadius={10}
              >
                <Text fontWeight="700" color={ui.text}>
                  {String(s.payu_id)} · {String(s.status)}
                  {s.hold_reason ? ` (${String(s.hold_reason)})` : ''}
                </Text>
                <Text fontSize={12} color={ui.textSecondary}>
                  txn {String(s.txnid ?? '—')} · split {String(s.split_status ?? '—')} · ₹
                  {String(s.amount)}
                </Text>
                <XStack gap="$2" flexWrap="wrap">
                  <Button
                    tone="outline"
                    size="$2"
                    borderRadius={999}
                    disabled={busyId === String(s.id)}
                    onPress={() => void retrySplit(String(s.id))}
                  >
                    Retry split
                  </Button>
                  <Button
                    tone="primary"
                    size="$2"
                    borderRadius={999}
                    disabled={busyId === String(s.id)}
                    onPress={() => void manualRelease(String(s.id))}
                  >
                    Manual release
                  </Button>
                  {s.order_id ? (
                    <Button
                      tone="ghost"
                      size="$2"
                      borderRadius={999}
                      disabled={busyId === String(s.order_id)}
                      onPress={() => void resync(String(s.order_id))}
                    >
                      Resync order
                    </Button>
                  ) : null}
                </XStack>
              </YStack>
            ))}
          </YStack>

          <YStack gap="$2">
            <Text fontWeight="700" color={ui.text}>
              Deliveries / AWB ({deliveries.length})
            </Text>
            {deliveries.map((d) => (
              <XStack
                key={String(d.id)}
                justifyContent="space-between"
                gap="$2"
                flexWrap="wrap"
                padding="$3"
                borderWidth={1}
                borderColor={ui.borderSubtle}
                borderRadius={10}
              >
                <Text color={ui.text} fontSize={13}>
                  {String(d.awb_code || d.tracking_number || '—')} · {String(d.delivery_status)}
                </Text>
                {d.order_id ? (
                  <Button
                    tone="outline"
                    size="$2"
                    borderRadius={999}
                    onPress={() => void resync(String(d.order_id))}
                  >
                    Resync
                  </Button>
                ) : null}
              </XStack>
            ))}
          </YStack>
        </YStack>
      )}
    </YStack>
  )
}
