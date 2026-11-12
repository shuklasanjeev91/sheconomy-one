import { useCallback, useEffect, useMemo, useState } from 'react'

import { logAdminClientAction } from '~/lib/admin/ops'
import { supabase } from '~/lib/supabase/client'
import { Button, Spinner, Text, XStack, YStack, useAppToast } from '~/components/ui'
import { useAppUi } from '~/lib/theme/useAppUi'

type DisputeRow = {
  id: string
  order_id: string
  issue_type: string | null
  issue_title: string | null
  issue_priority: string | null
  status: string | null
  created_at: string
  sla_due_at: string | null
  first_response_at: string | null
  orders?: { order_number: string | null } | null
}

function slaLabel(row: DisputeRow): { text: string; overdue: boolean } {
  if (!row.sla_due_at) return { text: 'No SLA', overdue: false }
  if (row.first_response_at || ['resolved', 'closed'].includes(String(row.status))) {
    return { text: 'Responded', overdue: false }
  }
  const due = new Date(row.sla_due_at).getTime()
  const overdue = Date.now() > due
  const hours = Math.round((due - Date.now()) / 36e5)
  return {
    text: overdue ? `Overdue ${Math.abs(hours)}h` : `Due in ${hours}h`,
    overdue,
  }
}

export default function AdminDisputesPage() {
  const ui = useAppUi()
  const toast = useAppToast()
  const [rows, setRows] = useState<DisputeRow[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('order_issues')
      .select(
        'id, order_id, issue_type, issue_title, issue_priority, status, created_at, sla_due_at, first_response_at, orders(order_number)',
      )
      .is('closed_at', null)
      .order('sla_due_at', { ascending: true, nullsFirst: false })
      .limit(100)
    setLoading(false)
    if (error) {
      toast.show('Could not load disputes', { tone: 'danger', message: error.message })
      return
    }
    setRows((data as DisputeRow[]) ?? [])
    void logAdminClientAction('admin.view_disputes_queue', { count: data?.length ?? 0 })
  }, [toast])

  useEffect(() => {
    void load()
  }, [load])

  const overdueCount = useMemo(
    () => rows.filter((r) => slaLabel(r).overdue).length,
    [rows],
  )

  return (
    <YStack gap="$4" padding="$4" width="100%">
      <XStack justifyContent="space-between" alignItems="center" gap="$3" flexWrap="wrap">
        <YStack gap={4}>
          <Text fontSize={22} fontWeight="800" color={ui.text}>
            Disputes queue
          </Text>
          <Text fontSize={13} color={ui.textSecondary}>
            Open issues sorted by SLA · {overdueCount} overdue
          </Text>
        </YStack>
        <Button tone="outline" size="$3" borderRadius={999} onPress={() => void load()}>
          Refresh
        </Button>
      </XStack>

      {loading ? (
        <YStack alignItems="center" paddingVertical="$8">
          <Spinner size="large" />
        </YStack>
      ) : (
        <YStack gap="$2" width="100%">
          {rows.map((row) => {
            const sla = slaLabel(row)
            return (
              <YStack
                key={row.id}
                padding="$3"
                gap="$1"
                borderWidth={1}
                borderColor={sla.overdue ? ui.danger : ui.borderSubtle}
                borderRadius={10}
                backgroundColor={ui.surface}
              >
                <XStack justifyContent="space-between" gap="$2" flexWrap="wrap">
                  <Text fontWeight="700" color={ui.text}>
                    {row.issue_title || row.issue_type || 'Issue'} · #
                    {row.orders?.order_number ?? row.order_id.slice(0, 8)}
                  </Text>
                  <Text
                    fontSize={12}
                    fontWeight="700"
                    color={sla.overdue ? ui.danger : ui.textSecondary}
                  >
                    {sla.text}
                  </Text>
                </XStack>
                <Text fontSize={12} color={ui.textMuted}>
                  {row.status} · {row.issue_priority ?? 'normal'} ·{' '}
                  {new Date(row.created_at).toLocaleString()}
                </Text>
              </YStack>
            )
          })}
          {!rows.length ? <Text color={ui.textMuted}>No open disputes.</Text> : null}
        </YStack>
      )}
    </YStack>
  )
}
