import { useCallback, useEffect, useState } from 'react'

import { Badge, Button, Input, Text, XStack, YStack, useAppToast } from '~/components/ui'
import { radius } from '~/config/tokens'
import {
  entityLabel,
  kycAllowsStorefront,
  type PayuKycDocKind,
  type PayuKycStatus,
  type ShopPayuKycRow,
} from '~/lib/payment/payu-kyc'
import { supabase } from '~/lib/supabase'
import { getKycDocumentSignedUrl } from '~/lib/supabase/storage-upload'

const STATUS_LABEL: Record<PayuKycStatus, string> = {
  draft: 'Draft',
  submitted: 'Waiting for review',
  changes_requested: 'Changes requested',
  payu_pending: 'Sending to payouts',
  payu_verified: 'PayU verified',
  rejected: 'Rejected',
}

const DOC_LABEL: Record<PayuKycDocKind, string> = {
  pan: 'PAN',
  bank: 'Bank proof',
  schedule_c: 'Schedule C',
  gst: 'GST',
  incorporation: 'Certificate of Incorporation',
  ownership: 'Ownership / deed',
  id_front: 'Government ID',
  id_back: 'ID back',
}

type DocMeta = { kind: PayuKycDocKind; storage_path: string }

export function AdminShopPayuKycPanel({
  shopId,
  onBlocksPublish,
}: {
  shopId: string
  onBlocksPublish?: (blocked: boolean) => void
}) {
  const toast = useAppToast()
  const [row, setRow] = useState<ShopPayuKycRow | null>(null)
  const [docs, setDocs] = useState<DocMeta[]>([])
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [loaded, setLoaded] = useState(false)

  const load = useCallback(async () => {
    const [{ data }, { data: docRows }] = await Promise.all([
      supabase.from('shop_payu_kyc').select('*').eq('shop_id', shopId).maybeSingle(),
      supabase.from('shop_kyc_documents').select('kind, storage_path').eq('shop_id', shopId),
    ])
    const next = (data as ShopPayuKycRow | null) ?? null
    setRow(next)
    setNote(next?.admin_note ?? '')
    setDocs(
      (docRows ?? []).map((doc) => ({
        kind: doc.kind as PayuKycDocKind,
        storage_path: doc.storage_path,
      })),
    )
    setLoaded(true)
    onBlocksPublish?.(Boolean(next && !kycAllowsStorefront(next.status)))
  }, [onBlocksPublish, shopId])

  useEffect(() => {
    void load()
  }, [load])

  async function openDoc(path: string | null | undefined) {
    if (!path) return
    const url = await getKycDocumentSignedUrl(path)
    if (!url) {
      toast.show('Could not open the document', { tone: 'danger' })
      return
    }
    if (typeof window !== 'undefined') window.open(url, '_blank', 'noopener,noreferrer')
  }

  function allDocs(): Array<{ label: string; path: string }> {
    if (!row) return []
    const byKind = new Map(docs.map((doc) => [doc.kind, doc.storage_path]))
    const legacy: Array<[PayuKycDocKind, string | null]> = [
      ['pan', row.pan_document_path],
      ['bank', row.bank_document_path],
      ['schedule_c', row.schedule_c_document_path],
      ['gst', row.gst_document_path],
    ]
    for (const [kind, path] of legacy) {
      if (path && !byKind.has(kind)) byKind.set(kind, path)
    }
    return Array.from(byKind.entries()).map(([kind, path]) => ({
      label: DOC_LABEL[kind] ?? kind,
      path,
    }))
  }

  async function review(status: 'changes_requested' | 'rejected') {
    setBusy(true)
    const { data: userData } = await supabase.auth.getUser()
    const { error } = await supabase
      .from('shop_payu_kyc')
      .update({
        status,
        admin_note: note.trim() || null,
        reviewed_by: userData.user?.id ?? null,
        reviewed_at: new Date().toISOString(),
      })
      .eq('shop_id', shopId)
    setBusy(false)
    if (error) {
      toast.show('Could not update the application', { tone: 'danger', message: error.message })
      return
    }
    toast.show(status === 'rejected' ? 'Application rejected' : 'Sent back to the vendor', {
      tone: 'success',
    })
    await load()
  }

  async function approve() {
    setBusy(true)
    const { data, error } = await supabase.functions.invoke<{ ok?: boolean; error?: string }>(
      'shepay-create-child',
      { body: { shopId } },
    )
    setBusy(false)
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

  if (!loaded) return null
  if (!row) {
    return (
      <YStack gap="$2" padding="$4" borderRadius={radius.card} borderWidth={1} borderColor="$borderColor">
        <Text fontWeight="800">Payout KYC</Text>
        <Text color="$color10">This shop has not submitted payout details.</Text>
      </YStack>
    )
  }

  const canReview = row.status === 'submitted' || row.status === 'payu_pending'

  return (
    <YStack gap="$2" padding="$4" borderRadius={radius.card} borderWidth={1} borderColor="$borderColor">
      <XStack alignItems="center" gap="$2" flexWrap="wrap">
        <Text fontWeight="800">Payout KYC</Text>
        <Badge tone={row.status === 'payu_verified' ? 'success' : 'warning'}>
          {STATUS_LABEL[row.status]}
        </Badge>
        <Badge tone="info">{entityLabel(row.business_entity_id)}</Badge>
      </XStack>
      <Text>Legal name: {row.legal_name}</Text>
      <Text>Trade name: {row.business_name}</Text>
      <Text>Mobile: {row.mobile}</Text>
      <Text>Email: {row.email}</Text>
      <Text>
        PAN: {row.pan_number} ({row.pan_name})
      </Text>
      <Text>GST: {row.gst_number || 'Not provided'}</Text>
      {row.gst_status ? <Text>GST status: {row.gst_status}</Text> : null}
      {row.gst_legal_name ? <Text>GST legal name: {row.gst_legal_name}</Text> : null}
      {row.gst_trade_name ? <Text>GST trade name: {row.gst_trade_name}</Text> : null}
      {row.cin ? <Text>CIN: {row.cin}</Text> : null}
      {row.llpin ? <Text>LLPIN: {row.llpin}</Text> : null}
      {row.registration_number ? <Text>Registration: {row.registration_number}</Text> : null}
      <Text>Account: {row.bank_account_number}</Text>
      <Text>Holder: {row.bank_holder_name}</Text>
      <Text>IFSC: {row.ifsc}</Text>
      {row.payu_onboarding_status ? <Text>Onboarding: {row.payu_onboarding_status}</Text> : null}
      {row.payu_document_status ? <Text>Documents: {row.payu_document_status}</Text> : null}
      {row.payu_error ? <Text color="$red11">{row.payu_error}</Text> : null}
      <XStack gap="$2" flexWrap="wrap">
        {allDocs().map((doc) => (
          <Button
            key={`${doc.label}-${doc.path}`}
            size="$2"
            tone="outline"
            onPress={() => void openDoc(doc.path)}
          >
            {doc.label}
          </Button>
        ))}
      </XStack>
      {canReview ? (
        <YStack gap="$2">
          <Input value={note} onChangeText={setNote} placeholder="Note for the vendor" />
          <XStack gap="$2" flexWrap="wrap">
            <Button size="$3" tone="primary" disabled={busy} onPress={() => void approve()}>
              Approve and set up payouts
            </Button>
            <Button
              size="$3"
              tone="outline"
              disabled={busy}
              onPress={() => void review('changes_requested')}
            >
              Request changes
            </Button>
            <Button size="$3" tone="destructive" disabled={busy} onPress={() => void review('rejected')}>
              Reject
            </Button>
          </XStack>
        </YStack>
      ) : null}
    </YStack>
  )
}
