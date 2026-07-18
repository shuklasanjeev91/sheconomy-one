import { useEffect, useState } from 'react'

import { Badge, Input, ScrollView, Spinner, Text, XStack, YStack } from '~/components/ui'
import { getShadowStyle, radius } from '~/config/tokens'
import { useAppLayout } from '~/hooks/useAppLayout'
import { supabase, type Tables } from '~/lib/supabase'
import { useAppUi } from '~/lib/theme/useAppUi'

type PaymentRow = Tables<'order_payments'>

/** Admin list of marketplace payment rows (mirrors Users/Orders table pattern). */
export default function AdminPaymentsPage() {
  const ui = useAppUi()
  const { isDesktop, safeBottom } = useAppLayout()
  const [rows, setRows] = useState<PaymentRow[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    setLoading(true)
    void supabase
      .from('order_payments')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100)
      .then(({ data, error: loadError }) => {
        if (!active) return
        if (loadError) setError(loadError.message)
        else setRows((data as PaymentRow[]) ?? [])
        setLoading(false)
      })
    return () => {
      active = false
    }
  }, [])

  const filtered = rows.filter((row) => {
    if (!query.trim()) return true
    const needle = query.trim().toLowerCase()
    return [row.id, row.order_id, row.transaction_id, row.payment_status, row.payment_mode]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
      .includes(needle)
  })

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

      <Input
        value={query}
        onChangeText={setQuery}
        placeholder="Search by order, txn, or status"
        backgroundColor={ui.surface}
      />

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
    </YStack>
  )
}
