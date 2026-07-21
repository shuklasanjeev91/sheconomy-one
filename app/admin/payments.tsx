import { useEffect, useMemo, useState } from 'react'
import { useRouter, type Href } from 'one'

import {
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogOverlay,
  DialogTitle,
  Input,
  ScrollView,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectViewport,
  Spinner,
  Text,
  useAppToast,
  XStack,
  YStack,
} from '~/components/ui'
import { getShadowStyle, radius } from '~/config/tokens'
import { useAppLayout } from '~/hooks/useAppLayout'
import { supabase, type Tables } from '~/lib/supabase'
import { useAppUi } from '~/lib/theme/useAppUi'

type PaymentRow = Tables<'order_payments'>
type PaymentStatus = PaymentRow['payment_status']
type StatusFilter = 'all' | PaymentStatus

const STATUS_OPTIONS: StatusFilter[] = [
  'all',
  'pending',
  'processing',
  'completed',
  'failed',
  'cancelled',
  'refunded',
  'disputed',
  'on_hold',
]

export default function AdminPaymentsPage() {
  const router = useRouter()
  const toast = useAppToast()
  const ui = useAppUi()
  const { isDesktop, safeBottom } = useAppLayout()
  const [rows, setRows] = useState<PaymentRow[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<PaymentRow | null>(null)
  const [updating, setUpdating] = useState(false)

  useEffect(() => {
    void load()
  }, [])

  async function load() {
    setLoading(true)
    const { data, error: loadError } = await supabase
      .from('order_payments')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200)
    if (loadError) setError(loadError.message)
    else setRows((data as PaymentRow[]) ?? [])
    setLoading(false)
  }

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return rows.filter((row) => {
      if (statusFilter !== 'all' && row.payment_status !== statusFilter) return false
      if (!needle) return true
      return [row.id, row.order_id, row.transaction_id, row.payment_status, row.payment_mode]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(needle)
    })
  }, [query, rows, statusFilter])

  async function updateStatus(status: PaymentStatus) {
    if (!selected) return
    setUpdating(true)
    const { error: updateError } = await supabase
      .from('order_payments')
      .update({ payment_status: status, updated_at: new Date().toISOString() })
      .eq('id', selected.id)
    setUpdating(false)
    if (updateError) {
      toast.show(updateError.message, { tone: 'danger' })
      return
    }
    toast.show(`Marked ${status}`, { tone: 'success' })
    setSelected({ ...selected, payment_status: status })
    setRows((prev) =>
      prev.map((row) => (row.id === selected.id ? { ...row, payment_status: status } : row)),
    )
  }

  return (
    <YStack
      flex={1}
      gap="$4"
      paddingHorizontal={isDesktop ? '$6' : '$4'}
      paddingTop={isDesktop ? '$6' : '$4'}
      paddingBottom={safeBottom + 24}
    >
      <YStack gap="$1">
        <Text fontSize={isDesktop ? 26 : 22} fontWeight="800" color={ui.text}>
          Payments
        </Text>
        <Text fontSize={14} color={ui.textSecondary}>
          Recent order payments across the marketplace.
        </Text>
      </YStack>

      <XStack gap="$2" flexWrap="wrap">
        <Input
          flex={1}
          minWidth={180}
          value={query}
          onChangeText={setQuery}
          placeholder="Search by order, txn, or status"
          backgroundColor={ui.surface}
        />
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
          <SelectTrigger width={150} backgroundColor={ui.surface}>
            <Select.Value placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectViewport>
              {STATUS_OPTIONS.map((value) => (
                <SelectItem key={value} value={value} index={0}>
                  {value}
                </SelectItem>
              ))}
            </SelectViewport>
          </SelectContent>
        </Select>
      </XStack>

      {loading ? (
        <YStack alignItems="center" paddingVertical="$8">
          <Spinner size="large" />
        </YStack>
      ) : error ? (
        <Text color={ui.danger}>{error}</Text>
      ) : (
        <ScrollView flex={1}>
          <YStack gap="$2">
            {filtered.length === 0 ? (
              <Text color={ui.textMuted}>No payments found.</Text>
            ) : (
              filtered.map((row) => (
                <YStack
                  key={row.id}
                  padding="$3.5"
                  borderRadius={radius.card}
                  borderWidth={1}
                  borderColor={ui.borderSubtle}
                  backgroundColor={ui.surface}
                  gap="$1.5"
                  style={getShadowStyle('sm')}
                  pressStyle={{ opacity: 0.9 }}
                  onPress={() => setSelected(row)}
                  cursor="pointer"
                >
                  <XStack justifyContent="space-between" alignItems="center" gap="$2">
                    <Text fontSize={14} fontWeight="700" color={ui.text} numberOfLines={1}>
                      {row.transaction_id || row.id.slice(0, 8)}
                    </Text>
                    <Badge>{row.payment_status ?? 'unknown'}</Badge>
                  </XStack>
                  <Text fontSize={12} color={ui.textMuted}>
                    Order {row.order_id?.slice(0, 8) ?? '—'} · {row.payment_mode ?? '—'} ·{' '}
                    {row.amount != null ? String(row.amount) : '—'}
                  </Text>
                  <Text fontSize={11} color={ui.textMuted}>
                    {row.created_at ? new Date(row.created_at).toLocaleString() : ''}
                  </Text>
                </YStack>
              ))
            )}
          </YStack>
        </ScrollView>
      )}

      <Dialog open={Boolean(selected)} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogOverlay />
        <DialogContent maxWidth={440} width="92%">
          <DialogTitle>Payment detail</DialogTitle>
          <DialogDescription>
            {selected?.transaction_id || selected?.id.slice(0, 8)}
          </DialogDescription>
          {selected ? (
            <YStack gap="$3" marginTop="$3">
              <Text fontSize={13} color={ui.textSecondary}>
                Status: {selected.payment_status}
              </Text>
              <Text fontSize={13} color={ui.textSecondary}>
                Mode: {selected.payment_mode} · Amount: {selected.amount}
              </Text>
              <Text fontSize={13} color={ui.textSecondary}>
                Gateway: {selected.payment_gateway ?? '—'}
              </Text>
              {selected.failure_reason ? (
                <Text fontSize={13} color={ui.danger}>
                  {selected.failure_reason}
                </Text>
              ) : null}
              <XStack gap="$2" flexWrap="wrap">
                {(['completed', 'refunded', 'on_hold', 'cancelled'] as PaymentStatus[]).map(
                  (status) => (
                    <Button
                      key={status}
                      size="$2"
                      disabled={updating || selected.payment_status === status}
                      onPress={() => void updateStatus(status)}
                    >
                      <Text>{status}</Text>
                    </Button>
                  ),
                )}
              </XStack>
              <Button
                onPress={() =>
                  router.push(`/admin/orders?order=${encodeURIComponent(selected.order_id)}` as Href)
                }
              >
                <Text>Open related orders</Text>
              </Button>
            </YStack>
          ) : null}
        </DialogContent>
      </Dialog>
    </YStack>
  )
}
