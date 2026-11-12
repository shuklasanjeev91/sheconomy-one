import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'one'

import { Badge, Button, Input, Spinner, Text, XStack, YStack, useAppToast } from '~/components/ui'
import { radius } from '~/config/tokens'
import type { PayuKycStatus, ShopPayuKycRow } from '~/lib/payment/payu-kyc'
import { supabase } from '~/lib/supabase'
import { getKycDocumentSignedUrl } from '~/lib/supabase/storage-upload'

type QueueRow = ShopPayuKycRow & {
  shops?: { shop_name: string | null; slug: string | null } | null
}

type QueueFilter = 'submitted' | 'payu_pending' | 'errors'

const STATUS_LABEL: Record<PayuKycStatus, string> = {
  draft: 'Draft',
  submitted: 'Waiting for review',
  changes_requested: 'Changes requested',
  payu_pending: 'PayU pending',
  payu_verified: 'Verified',
  rejected: 'Rejected',
}

const FILTERS: { id: QueueFilter; label: string }[] = [
  { id: 'submitted', label: 'Needs review' },
  { id: 'payu_pending', label: 'PayU pending' },
  { id: 'errors', label: 'Setup errors' },
]

export function AdminPayuKycQueue() {
  const router = useRouter()
  const toast = useAppToast()
  const [rows, setRows] = useState<QueueRow[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [filter, setFilter] = useState<QueueFilter>('submitted')
  const [notes, setNotes] = useState<Record<string, string>>({})

  const load = useCallback(async () => {
    setLoading(true)
    let query = supabase
      .from('shop_payu_kyc')
      .select('*, shops(shop_name, slug)')
      .order('updated_at', { ascending: true })

    if (filter === 'submitted') {
      query = query.eq('status', 'submitted')
    } else if (filter === 'payu_pending') {
      query = query.eq('status', 'payu_pending')
    } else {
      query = query.eq('status', 'payu_pending').not('payu_error', 'is', null)
    }

    const { data, error } = await query
    setLoading(false)
    if (error) {
      toast.show('Could not load payout queue', { tone: 'danger', message: error.message })
      return
    }
    const next = (data as QueueRow[]) ?? []
    setRows(next)
    setNotes((prev) => {
      const merged = { ...prev }
      for (const row of next) {
        if (merged[row.shop_id] === undefined) {
          merged[row.shop_id] = row.admin_note ?? ''
        }
      }
      return merged
    })
  }, [filter, toast])

  useEffect(() => {
    void load()
  }, [load])

  const emptyCopy = useMemo(() => {
    if (filter === 'submitted') return 'Submitted payout KYC forms will appear here.'
    if (filter === 'payu_pending') return 'No shops waiting on PayU verification right now.'
    return 'No PayU setup errors right now.'
  }, [filter])

  async function openDoc(path: string | null) {
    if (!path) return
    const url = await getKycDocumentSignedUrl(path)
    if (!url) {
      toast.show('Could not open the document', { tone: 'danger' })
      return
    }
    if (typeof window !== 'undefined') window.open(url, '_blank', 'noopener,noreferrer')
  }

  async function approve(shopId: string) {
    setBusyId(shopId)
    const { data, error } = await supabase.functions.invoke<{ ok?: boolean; error?: string }>(
      'shepay-create-child',
      { body: { shopId } },
    )
    setBusyId(null)
    if (error || data?.ok === false) {
      toast.show('Payout setup did not finish', {
        tone: 'danger',
        message: data?.error || error?.message || 'Try again.',
      })
      await load()
      return
    }
    toast.show('Sent to PayU — pending verification', { tone: 'success' })
    await load()
  }

  async function review(shopId: string, status: 'changes_requested' | 'rejected') {
    setBusyId(shopId)
    const { data: userData } = await supabase.auth.getUser()
    const { error } = await supabase
      .from('shop_payu_kyc')
      .update({
        status,
        admin_note: (notes[shopId] ?? '').trim() || null,
        reviewed_by: userData.user?.id ?? null,
        reviewed_at: new Date().toISOString(),
      })
      .eq('shop_id', shopId)
    setBusyId(null)
    if (error) {
      toast.show('Could not update the application', { tone: 'danger', message: error.message })
      return
    }
    toast.show(status === 'rejected' ? 'Application rejected' : 'Sent back to the vendor', {
      tone: 'success',
    })
    await load()
  }

  return (
    <YStack gap="$4" padding="$4">
      <YStack gap="$1">
        <Text fontSize={22} fontWeight="800">
          Payout KYC queue
        </Text>
        <Text color="$color10">
          Review seller verification. Approval creates the PayU child merchant automatically.
        </Text>
      </YStack>

      <XStack gap="$2" flexWrap="wrap">
        {FILTERS.map((item) => {
          const active = filter === item.id
          return (
            <Button
              key={item.id}
              size="$2"
              tone={active ? 'primary' : 'outline'}
              borderRadius={999}
              onPress={() => setFilter(item.id)}
            >
              {item.label}
            </Button>
          )
        })}
      </XStack>

      {loading ? (
        <XStack alignItems="center" gap="$2" padding="$2">
          <Spinner size="small" />
          <Text>Loading payout applications…</Text>
        </XStack>
      ) : rows.length === 0 ? (
        <YStack
          padding="$4"
          borderRadius={radius.card}
          borderWidth={1}
          borderColor="$borderColor"
          gap="$2"
        >
          <Text fontWeight="700">No applications waiting</Text>
          <Text color="$color10">{emptyCopy}</Text>
        </YStack>
      ) : (
        rows.map((row) => {
          const busy = busyId === row.shop_id
          const canApprove = row.status === 'submitted' || Boolean(row.payu_error)
          return (
            <YStack
              key={row.shop_id}
              gap="$2"
              padding="$4"
              borderRadius={radius.card}
              borderWidth={1}
              borderColor="$borderColor"
            >
              <XStack alignItems="center" gap="$2" flexWrap="wrap">
                <Text fontWeight="800">{row.shops?.shop_name || row.business_name || 'Shop'}</Text>
                <Badge tone={row.payu_error ? 'danger' : 'warning'}>{STATUS_LABEL[row.status]}</Badge>
              </XStack>
              <Text>
                {row.legal_name} · {row.email} · {row.mobile}
              </Text>
              <Text>
                PAN {row.pan_number} · IFSC {row.ifsc}
              </Text>
              {row.payu_error ? (
                <Text color="$red10" fontWeight="600">
                  PayU error: {row.payu_error}
                </Text>
              ) : null}
              <XStack gap="$2" flexWrap="wrap">
                <Button size="$2" tone="outline" onPress={() => void openDoc(row.pan_document_path)}>
                  PAN
                </Button>
                <Button size="$2" tone="outline" onPress={() => void openDoc(row.bank_document_path)}>
                  Bank
                </Button>
                <Button
                  size="$2"
                  tone="outline"
                  onPress={() => void openDoc(row.schedule_c_document_path)}
                >
                  Schedule C
                </Button>
                {row.gst_document_path ? (
                  <Button size="$2" tone="outline" onPress={() => void openDoc(row.gst_document_path)}>
                    GST
                  </Button>
                ) : null}
                <Button
                  size="$2"
                  tone="outline"
                  onPress={() => router.push(`/admin/shops` as never)}
                >
                  Open shops
                </Button>
              </XStack>

              {row.status === 'submitted' || row.status === 'changes_requested' ? (
                <Input
                  value={notes[row.shop_id] ?? ''}
                  onChangeText={(value) =>
                    setNotes((prev) => ({
                      ...prev,
                      [row.shop_id]: value,
                    }))
                  }
                  placeholder="Admin note for the seller (optional)"
                />
              ) : null}

              <XStack gap="$2" flexWrap="wrap">
                {canApprove ? (
                  <Button
                    size="$3"
                    tone="primary"
                    disabled={busy}
                    onPress={() => void approve(row.shop_id)}
                  >
                    {row.payu_error ? 'Retry Approve' : 'Approve'}
                  </Button>
                ) : null}
                {row.status === 'submitted' ? (
                  <>
                    <Button
                      size="$3"
                      tone="outline"
                      disabled={busy}
                      onPress={() => void review(row.shop_id, 'changes_requested')}
                    >
                      Request changes
                    </Button>
                    <Button
                      size="$3"
                      tone="destructive"
                      disabled={busy}
                      onPress={() => void review(row.shop_id, 'rejected')}
                    >
                      Reject
                    </Button>
                  </>
                ) : null}
              </XStack>
            </YStack>
          )
        })
      )}
    </YStack>
  )
}
