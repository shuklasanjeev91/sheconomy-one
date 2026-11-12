import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'one'

import { Badge, Button, Spinner, Text, XStack, YStack, useAppToast } from '~/components/ui'
import { radius } from '~/config/tokens'
import type { PayuKycStatus, ShopPayuKycRow } from '~/lib/payment/payu-kyc'
import { supabase } from '~/lib/supabase'
import { getKycDocumentSignedUrl } from '~/lib/supabase/storage-upload'

type QueueRow = ShopPayuKycRow & {
  shops?: { shop_name: string | null; slug: string | null } | null
}

const STATUS_LABEL: Record<PayuKycStatus, string> = {
  draft: 'Draft',
  submitted: 'Waiting for review',
  changes_requested: 'Changes requested',
  payu_pending: 'PayU pending',
  payu_verified: 'Verified',
  rejected: 'Rejected',
}

export function AdminPayuKycQueue() {
  const router = useRouter()
  const toast = useAppToast()
  const [rows, setRows] = useState<QueueRow[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('shop_payu_kyc')
      .select('*, shops(shop_name, slug)')
      .eq('status', 'submitted')
      .order('updated_at', { ascending: true })
    setLoading(false)
    if (error) {
      toast.show('Could not load payout queue', { tone: 'danger', message: error.message })
      return
    }
    setRows((data as QueueRow[]) ?? [])
  }, [toast])

  useEffect(() => {
    void load()
  }, [load])

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

  if (loading) {
    return (
      <XStack alignItems="center" gap="$2" padding="$4">
        <Spinner size="small" />
        <Text>Loading payout applications…</Text>
      </XStack>
    )
  }

  return (
    <YStack gap="$4" padding="$4">
      <YStack gap="$1">
        <Text fontSize={22} fontWeight="800">
          Payout KYC queue
        </Text>
        <Text color="$color10">
          Review seller payout applications. Approval creates the PayU child merchant automatically.
        </Text>
      </YStack>

      {rows.length === 0 ? (
        <YStack
          padding="$4"
          borderRadius={radius.card}
          borderWidth={1}
          borderColor="$borderColor"
          gap="$2"
        >
          <Text fontWeight="700">No applications waiting</Text>
          <Text color="$color10">Submitted payout KYC forms will appear here.</Text>
        </YStack>
      ) : (
        rows.map((row) => {
          const busy = busyId === row.shop_id
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
                <Badge tone="warning">{STATUS_LABEL[row.status]}</Badge>
              </XStack>
              <Text>
                {row.legal_name} · {row.email} · {row.mobile}
              </Text>
              <Text>
                PAN {row.pan_number} · IFSC {row.ifsc}
              </Text>
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
              <XStack gap="$2" flexWrap="wrap">
                <Button size="$3" tone="primary" disabled={busy} onPress={() => void approve(row.shop_id)}>
                  Approve
                </Button>
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
              </XStack>
            </YStack>
          )
        })
      )}
    </YStack>
  )
}
