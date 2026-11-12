import { useCallback, useEffect, useState } from 'react'

import { adminRunReconciliation, logAdminClientAction } from '~/lib/admin/ops'
import { supabase } from '~/lib/supabase/client'
import { Button, Spinner, Text, XStack, YStack, useAppToast } from '~/components/ui'
import { useAppUi } from '~/lib/theme/useAppUi'

type Run = {
  id: string
  started_at: string
  finished_at: string | null
  status: string
  matched_count: number
  mismatch_count: number
  missing_count: number
  checked_count: number
  mismatch_rate: number | null
  alert_sent: boolean
  error_message: string | null
}

type Row = {
  id: string
  result: string
  payu_id: string | null
  txnid: string | null
  local_amount: number | null
  remote_amount: number | null
  local_status: string | null
  remote_status: string | null
}

export default function AdminReconciliationPage() {
  const ui = useAppUi()
  const toast = useAppToast()
  const [runs, setRuns] = useState<Run[]>([])
  const [selectedRun, setSelectedRun] = useState<string | null>(null)
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [triggering, setTriggering] = useState(false)

  const loadRuns = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('shepay_reconciliation_runs')
      .select(
        'id, started_at, finished_at, status, matched_count, mismatch_count, missing_count, checked_count, mismatch_rate, alert_sent, error_message',
      )
      .order('started_at', { ascending: false })
      .limit(20)
    setLoading(false)
    if (error) {
      toast.show('Could not load runs', { tone: 'danger', message: error.message })
      return
    }
    setRuns((data as Run[]) ?? [])
    if (!selectedRun && data?.[0]?.id) setSelectedRun(data[0].id)
    void logAdminClientAction('admin.view_reconciliation', { count: data?.length ?? 0 })
  }, [selectedRun, toast])

  const loadRows = useCallback(async (runId: string) => {
    const { data, error } = await supabase
      .from('shepay_reconciliation_rows')
      .select(
        'id, result, payu_id, txnid, local_amount, remote_amount, local_status, remote_status',
      )
      .eq('run_id', runId)
      .in('result', ['mismatch', 'missing'])
      .order('created_at', { ascending: false })
      .limit(100)
    if (error) {
      toast.show('Could not load rows', { tone: 'danger', message: error.message })
      return
    }
    setRows((data as Row[]) ?? [])
  }, [toast])

  useEffect(() => {
    void loadRuns()
  }, [loadRuns])

  useEffect(() => {
    if (selectedRun) void loadRows(selectedRun)
  }, [selectedRun, loadRows])

  async function triggerRun() {
    setTriggering(true)
    const result = await adminRunReconciliation(100)
    setTriggering(false)
    if (result.error) {
      toast.show('Could not start reconciliation', { tone: 'danger', message: result.error })
      return
    }
    toast.show('Reconciliation completed', {
      tone: 'success',
      message: result.data?.run_id ? `Run ${result.data.run_id.slice(0, 8)}` : undefined,
    })
    await loadRuns()
  }

  return (
    <YStack gap="$4" padding="$4" width="100%">
      <XStack justifyContent="space-between" alignItems="center" gap="$3" flexWrap="wrap">
        <YStack gap={4}>
          <Text fontSize={22} fontWeight="800" color={ui.text}>
            Settlement reconciliation
          </Text>
          <Text fontSize={13} color={ui.textSecondary}>
            PayU verify_payment vs shepay_pending_settlements (daily cron + on-demand)
          </Text>
        </YStack>
        <XStack gap="$2">
          <Button tone="outline" size="$3" borderRadius={999} onPress={() => void loadRuns()}>
            Refresh
          </Button>
          <Button
            tone="primary"
            size="$3"
            borderRadius={999}
            disabled={triggering}
            onPress={() => void triggerRun()}
          >
            {triggering ? 'Running…' : 'Run now'}
          </Button>
        </XStack>
      </XStack>

      {loading ? (
        <YStack alignItems="center" paddingVertical="$8">
          <Spinner size="large" />
        </YStack>
      ) : (
        <YStack gap="$3">
          {runs.map((run) => {
            const active = selectedRun === run.id
            const rate =
              run.mismatch_rate != null
                ? `${(Number(run.mismatch_rate) * 100).toFixed(1)}%`
                : '—'
            return (
              <YStack
                key={run.id}
                padding="$3"
                gap="$1"
                borderWidth={1}
                borderColor={active ? ui.brand : ui.borderSubtle}
                borderRadius={10}
                backgroundColor={ui.surface}
                cursor="pointer"
                onPress={() => setSelectedRun(run.id)}
              >
                <XStack justifyContent="space-between" gap="$2" flexWrap="wrap">
                  <Text fontWeight="700" color={ui.text}>
                    {new Date(run.started_at).toLocaleString()} · {run.status}
                  </Text>
                  <Text fontSize={12} color={ui.textSecondary}>
                    mismatch rate {rate}
                    {run.alert_sent ? ' · alerted' : ''}
                  </Text>
                </XStack>
                <Text fontSize={12} color={ui.textMuted}>
                  checked {run.checked_count} · matched {run.matched_count} · mismatch{' '}
                  {run.mismatch_count} · missing {run.missing_count}
                </Text>
                {run.error_message ? (
                  <Text fontSize={12} color={ui.danger}>
                    {run.error_message}
                  </Text>
                ) : null}
              </YStack>
            )
          })}
          {!runs.length ? <Text color={ui.textMuted}>No runs yet.</Text> : null}
        </YStack>
      )}

      {selectedRun ? (
        <YStack gap="$2">
          <Text fontWeight="700" color={ui.text}>
            Exceptions
          </Text>
          {rows.map((row) => (
            <YStack
              key={row.id}
              padding="$3"
              gap={2}
              borderWidth={1}
              borderColor={ui.borderSubtle}
              borderRadius={10}
            >
              <Text fontWeight="700" color={ui.text}>
                {row.result.toUpperCase()} · {row.payu_id || row.txnid || '—'}
              </Text>
              <Text fontSize={12} color={ui.textSecondary}>
                local {row.local_amount ?? '—'} / {row.local_status ?? '—'} · remote{' '}
                {row.remote_amount ?? '—'} / {row.remote_status ?? '—'}
              </Text>
            </YStack>
          ))}
          {!rows.length ? (
            <Text color={ui.textMuted}>No mismatches or missing rows for this run.</Text>
          ) : null}
        </YStack>
      ) : null}
    </YStack>
  )
}
