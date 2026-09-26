import { useCallback, useEffect, useState } from 'react'
import { Platform } from 'react-native'

import {
  Button,
  Field,
  Input,
  Spinner,
  Text,
  XStack,
  YStack,
  useAppToast,
} from '~/components/ui'
import { PhoneInput } from '~/components/forms/PhoneInput'
import { radius } from '~/config/tokens'
import {
  PAYU_BUSINESS_ENTITIES,
  maskSecret,
  normalizeIfsc,
  normalizeMobile,
  normalizePan,
  interpretGstRegistry,
  validatePayuKycInput,
  verifyGstin,
  verifyPanForEntity,
  type GstRegistryResult,
  type PayuKycStatus,
  type ShopPayuKycRow,
} from '~/lib/payment/payu-kyc'
import { supabase } from '~/lib/supabase'
import { uploadShopKycDocument } from '~/lib/supabase/storage-upload'
import type { AppUiTokens } from '~/lib/theme/app-ui'

type VendorPayuKycFormProps = {
  ui: AppUiTokens
  shopId: string
  embedded?: boolean
  onSubmitted?: () => void
}

type DocKind = 'pan' | 'bank' | 'gst'

const LOCKED: PayuKycStatus[] = ['submitted', 'payu_pending', 'payu_verified', 'rejected']

const STATUS_LABEL: Record<PayuKycStatus, string> = {
  draft: 'Not submitted',
  submitted: 'Under review',
  changes_requested: 'Changes requested',
  payu_pending: 'Payout setup in progress',
  payu_verified: 'Verified — you can sell',
  rejected: 'Not approved',
}

async function pickFile(): Promise<{ blob: Blob; mimeType: string; fileName: string } | null> {
  if (Platform.OS === 'web') {
    return new Promise((resolve) => {
      const input = document.createElement('input')
      input.type = 'file'
      input.accept = 'application/pdf,image/jpeg,image/png,image/webp'
      input.onchange = () => {
        const file = input.files?.[0]
        if (!file) {
          resolve(null)
          return
        }
        resolve({ blob: file, mimeType: file.type || 'application/pdf', fileName: file.name })
      }
      input.click()
    })
  }
  const { default: DocumentPicker } = await import('expo-document-picker')
  const result = await DocumentPicker.getDocumentAsync({
    type: ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'],
    copyToCacheDirectory: true,
  })
  if (result.canceled || !result.assets[0]) return null
  const asset = result.assets[0]
  const response = await fetch(asset.uri)
  const blob = await response.blob()
  return {
    blob,
    mimeType: asset.mimeType ?? 'application/pdf',
    fileName: asset.name,
  }
}

export function VendorPayuKycForm({ ui, shopId, onSubmitted }: VendorPayuKycFormProps) {
  const toast = useAppToast()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState<PayuKycStatus>('draft')
  const [adminNote, setAdminNote] = useState<string | null>(null)
  const [legalName, setLegalName] = useState('')
  const [mobile, setMobile] = useState('')
  const [email, setEmail] = useState('')
  const [panNumber, setPanNumber] = useState('')
  const [panName, setPanName] = useState('')
  const [hasGst, setHasGst] = useState(false)
  const [gstNumber, setGstNumber] = useState('')
  const [businessName, setBusinessName] = useState('')
  const [businessEntityId, setBusinessEntityId] = useState(2)
  const [monthlyExpectedVolume, setMonthlyExpectedVolume] = useState('50000')
  const [bankAccountNumber, setBankAccountNumber] = useState('')
  const [bankHolderName, setBankHolderName] = useState('')
  const [ifsc, setIfsc] = useState('')
  const [panDocumentPath, setPanDocumentPath] = useState('')
  const [bankDocumentPath, setBankDocumentPath] = useState('')
  const [gstDocumentPath, setGstDocumentPath] = useState('')
  const [gstHint, setGstHint] = useState<string | null>(null)
  const [panHint, setPanHint] = useState<string | null>(null)
  const [registry, setRegistry] = useState<GstRegistryResult | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const locked = LOCKED.includes(status)

  const load = useCallback(async () => {
    setLoading(true)
    const [{ data: row }, { data: shop }, { data: userData }] = await Promise.all([
      supabase.from('shop_payu_kyc').select('*').eq('shop_id', shopId).maybeSingle(),
      supabase
        .from('shops')
        .select('shop_name, shop_email, shop_phone_number, user_id')
        .eq('id', shopId)
        .maybeSingle(),
      supabase.auth.getUser(),
    ])
    const kyc = row as ShopPayuKycRow | null
    const userId = userData.user?.id
    let profile: { full_name: string | null; email: string | null; phone: string | null } | null = null
    if (userId) {
      const { data } = await supabase
        .from('profiles')
        .select('full_name, email, phone')
        .eq('id', userId)
        .maybeSingle()
      profile = data
    }

    if (kyc) {
      const editable = kyc.status === 'draft' || kyc.status === 'changes_requested'
      setStatus(kyc.status)
      setAdminNote(kyc.admin_note)
      setLegalName(kyc.legal_name)
      setMobile(kyc.mobile)
      setEmail(kyc.email)
      setPanNumber(editable ? kyc.pan_number : maskSecret(kyc.pan_number))
      setPanName(kyc.pan_name)
      setHasGst(Boolean(kyc.gst_number))
      setGstNumber(kyc.gst_number ?? '')
      setBusinessName(kyc.business_name)
      setBusinessEntityId(kyc.business_entity_id)
      setMonthlyExpectedVolume(String(kyc.monthly_expected_volume))
      setBankAccountNumber(editable ? kyc.bank_account_number : maskSecret(kyc.bank_account_number))
      setBankHolderName(kyc.bank_holder_name)
      setIfsc(kyc.ifsc)
      setPanDocumentPath(kyc.pan_document_path ?? '')
      setBankDocumentPath(kyc.bank_document_path ?? '')
      setGstDocumentPath(kyc.gst_document_path ?? '')
    } else {
      setLegalName(profile?.full_name ?? '')
      setMobile(shop?.shop_phone_number || profile?.phone || '')
      setEmail(shop?.shop_email || profile?.email || userData.user?.email || '')
      setBusinessName(shop?.shop_name ?? '')
      setPanName(profile?.full_name ?? '')
      setBankHolderName(profile?.full_name ?? '')
    }
    setLoading(false)
  }, [shopId])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (locked) return
    if (normalizePan(panNumber).length < 10) {
      setPanHint(null)
      return
    }
    setPanHint(verifyPanForEntity(panNumber, businessEntityId))
  }, [businessEntityId, locked, panNumber])

  useEffect(() => {
    if (locked || !hasGst) {
      setRegistry(null)
      setGstHint(null)
      return
    }
    const local = verifyGstin(gstNumber)
    if (!local.ok) {
      setRegistry(null)
      setGstHint(normalizePan(gstNumber).length >= 15 ? local.error : null)
      return
    }
    if (normalizePan(panNumber) !== local.pan) setPanNumber(local.pan)
    setGstHint('Checking GSTIN on the tax registry…')
    let cancelled = false
    const timer = setTimeout(() => {
      void (async () => {
        const { data, error } = await supabase.functions.invoke<{
          ok?: boolean
          configured?: boolean
          source?: string
          error?: string
          data?: unknown
          pan?: string
        }>('shepay-verify-kyc', { body: { shopId, gstin: normalizePan(gstNumber), pan: local.pan } })
        if (cancelled) return
        if (error || data?.ok === false) {
          setRegistry(null)
          setGstHint(data?.error || 'Could not verify this GSTIN. Check the number and try again.')
          return
        }
        if (data?.configured === false || data?.source === 'checksum') {
          setRegistry(null)
          setGstHint(`GSTIN verified. PAN on this GSTIN is ${local.pan}.`)
          return
        }
        const parsed = interpretGstRegistry({ data: data?.data }, local.pan)
        if (!parsed.ok) {
          setRegistry(null)
          setGstHint(parsed.error)
          return
        }
        setRegistry(parsed.result)
        if (parsed.result.legalName) {
          setPanName(parsed.result.legalName)
          setLegalName(parsed.result.legalName)
          setBankHolderName((current) => current || parsed.result.legalName)
        }
        if (parsed.result.tradeName) setBusinessName(parsed.result.tradeName)
        else if (parsed.result.legalName) setBusinessName(parsed.result.legalName)
        const trade = parsed.result.tradeName ? ` · ${parsed.result.tradeName}` : ''
        setGstHint(`Active${trade} · ${parsed.result.legalName}`)
      })()
    }, 400)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [gstNumber, hasGst, locked, shopId])

  async function upload(kind: DocKind) {
    const file = await pickFile()
    if (!file) return
    const { data: userData } = await supabase.auth.getUser()
    const userId = userData.user?.id
    if (!userId) {
      toast.show('Sign in to upload documents', { tone: 'danger' })
      return
    }
    const uploaded = await uploadShopKycDocument(userId, shopId, kind, file)
    if (uploaded.error || !uploaded.data) {
      toast.show('Could not upload the document', { tone: 'danger', message: uploaded.error ?? '' })
      return
    }
    if (kind === 'pan') setPanDocumentPath(uploaded.data.path)
    if (kind === 'bank') setBankDocumentPath(uploaded.data.path)
    if (kind === 'gst') setGstDocumentPath(uploaded.data.path)
    toast.show('Document uploaded', { tone: 'success' })
  }

  async function submit() {
    const input = {
      legalName,
      mobile,
      email,
      panNumber,
      panName,
      hasGst,
      gstNumber,
      businessName,
      businessEntityId,
      monthlyExpectedVolume: Number(monthlyExpectedVolume),
      bankAccountNumber,
      bankHolderName,
      ifsc,
      panDocumentPath,
      bankDocumentPath,
      gstDocumentPath,
    }
    const nextErrors = validatePayuKycInput(input)
    if (hasGst && gstHint && !gstHint.startsWith('Active') && !gstHint.startsWith('GSTIN verified')) {
      nextErrors.gstNumber = gstHint.replace(/^Checking GSTIN on the tax registry…$/, 'Wait for the GSTIN check to finish.')
    }
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length) return

    setSaving(true)
    const payload = {
      shop_id: shopId,
      legal_name: legalName.trim(),
      mobile: normalizeMobile(mobile),
      email: email.trim(),
      pan_number: normalizePan(panNumber),
      pan_name: panName.trim(),
      gst_number: hasGst ? normalizePan(gstNumber) : null,
      business_name: businessName.trim(),
      business_entity_id: businessEntityId,
      monthly_expected_volume: Math.round(Number(monthlyExpectedVolume)),
      bank_account_number: bankAccountNumber.replace(/\s+/g, ''),
      bank_holder_name: bankHolderName.trim(),
      ifsc: normalizeIfsc(ifsc),
      pan_document_path: panDocumentPath,
      bank_document_path: bankDocumentPath,
      gst_document_path: hasGst ? gstDocumentPath : null,
      gst_legal_name: registry?.legalName || null,
      gst_trade_name: registry?.tradeName || null,
      gst_status: registry?.status || (hasGst ? 'checksum' : null),
      status: 'submitted' as const,
    }
    const { error } = await supabase.from('shop_payu_kyc').upsert(payload, { onConflict: 'shop_id' })
    setSaving(false)
    if (error) {
      toast.show('Could not submit payout details', { tone: 'danger', message: error.message })
      return
    }
    toast.show('Payout details submitted for review', { tone: 'success' })
    onSubmitted?.()
    await load()
  }

  if (loading) {
    return (
      <XStack alignItems="center" gap="$2">
        <Spinner size="small" />
        <Text color={ui.textMuted}>Loading payout details…</Text>
      </XStack>
    )
  }

  return (
    <YStack gap="$3">
      <YStack gap="$1">
        <Text fontSize={16} fontWeight="800" color={ui.text}>
          Payout details
        </Text>
        <Text fontSize={13} color={ui.textSecondary} lineHeight={18}>
          Submit these once. SHEconomy reviews them and sets up payouts for you. You do not need a
          separate payment dashboard.
        </Text>
        <Text fontSize={13} fontWeight="700" color={ui.brand}>
          {STATUS_LABEL[status]}
        </Text>
        {adminNote && status === 'changes_requested' ? (
          <Text fontSize={13} color={ui.textSecondary}>
            Review note: {adminNote}
          </Text>
        ) : null}
        {status === 'rejected' && adminNote ? (
          <Text fontSize={13} color={ui.textSecondary}>
            {adminNote}
          </Text>
        ) : null}
      </YStack>

      <Field label="Name" error={errors.legalName}>
        <Input value={legalName} onChangeText={setLegalName} editable={!locked} />
      </Field>
      <Field label="Mobile" error={errors.mobile}>
        <PhoneInput value={mobile} onChange={setMobile} disabled={locked} />
      </Field>
      <Field label="Email" error={errors.email}>
        <Input value={email} onChangeText={setEmail} editable={!locked} autoCapitalize="none" />
      </Field>
      <Field label="PAN" error={errors.panNumber || panHint || undefined}>
        <Input
          value={panNumber}
          onChangeText={(value) => setPanNumber(value.toUpperCase())}
          editable={!locked && !hasGst}
          autoCapitalize="characters"
        />
      </Field>
      <Field label="Name on PAN" error={errors.panName}>
        <Input value={panName} onChangeText={setPanName} editable={!locked} />
      </Field>
      <Field label="Business name" error={errors.businessName}>
        <Input value={businessName} onChangeText={setBusinessName} editable={!locked} />
      </Field>
      <Field label="Business type" error={errors.businessEntityId}>
        <XStack gap="$2" flexWrap="wrap">
          {PAYU_BUSINESS_ENTITIES.map((entity) => {
            const selected = entity.id === businessEntityId
            return (
              <Button
                key={entity.id}
                size="$2"
                tone={selected ? 'primary' : 'outline'}
                borderRadius={radius.chip}
                disabled={locked}
                onPress={() => setBusinessEntityId(entity.id)}
              >
                {entity.label}
              </Button>
            )
          })}
        </XStack>
      </Field>
      <Field label="Expected monthly sales (₹)" error={errors.monthlyExpectedVolume}>
        <Input
          value={monthlyExpectedVolume}
          onChangeText={setMonthlyExpectedVolume}
          editable={!locked}
          keyboardType="number-pad"
        />
      </Field>
      <Button
        size="$3"
        tone={hasGst ? 'primary' : 'outline'}
        disabled={locked}
        onPress={() => setHasGst((value) => !value)}
      >
        {hasGst ? 'GST applies' : 'No GST'}
      </Button>
      {hasGst ? (
        <YStack gap="$2">
          <Field label="GSTIN" error={errors.gstNumber}>
            <Input
              value={gstNumber}
              onChangeText={(value) => setGstNumber(value.toUpperCase())}
              editable={!locked}
              autoCapitalize="characters"
            />
          </Field>
          {gstHint ? (
            <Text
              fontSize={12}
              color={
                gstHint.startsWith('Active') || gstHint.startsWith('GSTIN verified')
                  ? '#15803D'
                  : ui.textSecondary
              }
            >
              {gstHint}
            </Text>
          ) : null}
        </YStack>
      ) : null}
      <Field label="Bank account number" error={errors.bankAccountNumber}>
        <Input
          value={bankAccountNumber}
          onChangeText={setBankAccountNumber}
          editable={!locked}
          keyboardType="number-pad"
        />
      </Field>
      <Field label="Account holder name" error={errors.bankHolderName}>
        <Input value={bankHolderName} onChangeText={setBankHolderName} editable={!locked} />
      </Field>
      <Field label="IFSC" error={errors.ifsc}>
        <Input
          value={ifsc}
          onChangeText={(value) => setIfsc(value.toUpperCase())}
          editable={!locked}
          autoCapitalize="characters"
        />
      </Field>

      {!locked ? (
        <YStack gap="$2">
          <Button size="$3" tone="outline" onPress={() => void upload('pan')}>
            {panDocumentPath ? 'PAN uploaded' : 'Upload PAN'}
          </Button>
          {errors.panDocumentPath ? (
            <Text fontSize={12} color="#B91C1C">
              {errors.panDocumentPath}
            </Text>
          ) : null}
          <Button size="$3" tone="outline" onPress={() => void upload('bank')}>
            {bankDocumentPath ? 'Bank proof uploaded' : 'Upload cancelled cheque or bank proof'}
          </Button>
          {errors.bankDocumentPath ? (
            <Text fontSize={12} color="#B91C1C">
              {errors.bankDocumentPath}
            </Text>
          ) : null}
          {hasGst ? (
            <>
              <Button size="$3" tone="outline" onPress={() => void upload('gst')}>
                {gstDocumentPath ? 'GST certificate uploaded' : 'Upload GST certificate'}
              </Button>
              {errors.gstDocumentPath ? (
                <Text fontSize={12} color="#B91C1C">
                  {errors.gstDocumentPath}
                </Text>
              ) : null}
            </>
          ) : null}
          <Button size="$4" tone="primary" disabled={saving} onPress={() => void submit()}>
            {saving ? 'Submitting…' : 'Submit for review'}
          </Button>
        </YStack>
      ) : null}
    </YStack>
  )
}
