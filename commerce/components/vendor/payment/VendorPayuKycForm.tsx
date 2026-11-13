import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
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
  PAYU_BUSINESS_ENTITY_GROUPS,
  entitiesInGroup,
  getEntityKycRequirements,
  maskSecret,
  normalizeIfsc,
  normalizeLlpin,
  normalizeMobile,
  normalizePan,
  interpretGstRegistry,
  validatePayuKycInput,
  verifyGstin,
  verifyPanForEntity,
  type GstRegistryResult,
  type PayuKycDocKind,
  type PayuKycStatus,
  type ShopPayuKycRow,
} from '~/lib/payment/payu-kyc'
import { updateShopGst } from '~/lib/shop/shop.store'
import { useAppDispatch } from '~/lib/store/hooks'
import { supabase } from '~/lib/supabase'
import { uploadShopKycDocument } from '~/lib/supabase/storage-upload'
import type { AppUiTokens } from '~/lib/theme/app-ui'

type VendorPayuKycFormProps = {
  ui: AppUiTokens
  shopId: string
  embedded?: boolean
  onSubmitted?: () => void
}

type DocKind = PayuKycDocKind

const LOCKED: PayuKycStatus[] = ['submitted', 'payu_pending', 'payu_verified']

const STATUS_LABEL: Record<PayuKycStatus, string> = {
  draft: 'Not submitted',
  submitted: 'Under review',
  changes_requested: 'Changes requested — update and resubmit',
  payu_pending: 'Payout verification in progress',
  payu_verified: 'Verified — you can sell',
  rejected: 'Not approved — update documents and resubmit',
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

export function VendorPayuKycForm({ ui, shopId, embedded, onSubmitted }: VendorPayuKycFormProps) {
  const toast = useAppToast()
  const dispatch = useAppDispatch()
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
  const [cin, setCin] = useState('')
  const [llpin, setLlpin] = useState('')
  const [registrationNumber, setRegistrationNumber] = useState('')
  const [panDocumentPath, setPanDocumentPath] = useState('')
  const [bankDocumentPath, setBankDocumentPath] = useState('')
  const [gstDocumentPath, setGstDocumentPath] = useState('')
  const [scheduleCDocumentPath, setScheduleCDocumentPath] = useState('')
  const [incorporationDocumentPath, setIncorporationDocumentPath] = useState('')
  const [ownershipDocumentPath, setOwnershipDocumentPath] = useState('')
  const [idFrontDocumentPath, setIdFrontDocumentPath] = useState('')
  const [idBackDocumentPath, setIdBackDocumentPath] = useState('')
  const [gstHint, setGstHint] = useState<string | null>(null)
  const [panHint, setPanHint] = useState<string | null>(null)
  const [registry, setRegistry] = useState<GstRegistryResult | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const locked = LOCKED.includes(status)
  const entityReqs = useMemo(() => getEntityKycRequirements(businessEntityId), [businessEntityId])

  const setDocPath = useCallback((kind: DocKind, path: string) => {
    if (kind === 'pan') setPanDocumentPath(path)
    if (kind === 'bank') setBankDocumentPath(path)
    if (kind === 'gst') setGstDocumentPath(path)
    if (kind === 'schedule_c') setScheduleCDocumentPath(path)
    if (kind === 'incorporation') setIncorporationDocumentPath(path)
    if (kind === 'ownership') setOwnershipDocumentPath(path)
    if (kind === 'id_front') setIdFrontDocumentPath(path)
    if (kind === 'id_back') setIdBackDocumentPath(path)
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    const [{ data: row }, { data: shop }, { data: userData }, { data: docs }] = await Promise.all([
      supabase.from('shop_payu_kyc').select('*').eq('shop_id', shopId).maybeSingle(),
      supabase
        .from('shops')
        .select('shop_name, shop_email, shop_phone_number, user_id')
        .eq('id', shopId)
        .maybeSingle(),
      supabase.auth.getUser(),
      supabase.from('shop_kyc_documents').select('kind, storage_path').eq('shop_id', shopId),
    ])
    const kyc = row as ShopPayuKycRow | null
    const userId = userData.user?.id
    let profile: { full_name: string | null; email: string | null; phone: string | null } | null =
      null
    if (userId) {
      const { data } = await supabase
        .from('profiles')
        .select('full_name, email, phone')
        .eq('id', userId)
        .maybeSingle()
      profile = data
    }

    const pathByKind = new Map<string, string>()
    for (const doc of docs ?? []) {
      if (doc.storage_path) pathByKind.set(doc.kind, doc.storage_path)
    }

    if (kyc) {
      const editable =
        kyc.status === 'draft' || kyc.status === 'changes_requested' || kyc.status === 'rejected'
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
      setCin(kyc.cin ?? '')
      setLlpin(kyc.llpin ?? '')
      setRegistrationNumber(kyc.registration_number ?? '')
      setPanDocumentPath(pathByKind.get('pan') || kyc.pan_document_path || '')
      setBankDocumentPath(pathByKind.get('bank') || kyc.bank_document_path || '')
      setGstDocumentPath(pathByKind.get('gst') || kyc.gst_document_path || '')
      setScheduleCDocumentPath(pathByKind.get('schedule_c') || kyc.schedule_c_document_path || '')
      setIncorporationDocumentPath(pathByKind.get('incorporation') || '')
      setOwnershipDocumentPath(pathByKind.get('ownership') || '')
      setIdFrontDocumentPath(pathByKind.get('id_front') || '')
      setIdBackDocumentPath(pathByKind.get('id_back') || '')
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
        }>('shepay-verify-kyc', {
          body: { shopId, gstin: normalizePan(gstNumber), pan: local.pan },
        })
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
    setDocPath(kind, uploaded.data.path)

    const { data: auth } = await supabase.auth.getUser()
    await supabase.from('shop_kyc_documents').upsert(
      {
        shop_id: shopId,
        kind,
        storage_path: uploaded.data.path,
        mime_type: file.mimeType,
        file_size: file.blob.size,
        uploaded_by: auth.user?.id ?? null,
        payu_document_uuid: null,
        payu_document_status: null,
        rejection_reason: null,
      },
      { onConflict: 'shop_id,kind' },
    )

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
      cin,
      llpin,
      registrationNumber,
      panDocumentPath,
      bankDocumentPath,
      gstDocumentPath,
      scheduleCDocumentPath,
      incorporationDocumentPath,
      ownershipDocumentPath,
      idFrontDocumentPath,
      idBackDocumentPath,
    }
    const nextErrors = validatePayuKycInput(input)
    if (
      hasGst &&
      gstHint &&
      !gstHint.startsWith('Active') &&
      !gstHint.startsWith('GSTIN verified')
    ) {
      nextErrors.gstNumber = gstHint.replace(
        /^Checking GSTIN on the tax registry…$/,
        'Wait for the GSTIN check to finish.',
      )
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
      cin: entityReqs.requiresCin ? normalizePan(cin) : null,
      llpin: entityReqs.requiresLlpin ? normalizeLlpin(llpin) : null,
      registration_number: entityReqs.requiresRegistrationNumber
        ? registrationNumber.trim()
        : null,
      pan_document_path: panDocumentPath,
      bank_document_path: bankDocumentPath,
      gst_document_path: hasGst ? gstDocumentPath : null,
      schedule_c_document_path: scheduleCDocumentPath,
      gst_legal_name: registry?.legalName || null,
      gst_trade_name: registry?.tradeName || null,
      gst_status: registry?.status || (hasGst ? 'checksum' : null),
      status: 'submitted' as const,
    }
    const { error } = await supabase.from('shop_payu_kyc').upsert(payload, { onConflict: 'shop_id' })
    if (!error) {
      const docs: Array<{ kind: DocKind; path: string }> = [
        { kind: 'pan', path: panDocumentPath },
        { kind: 'bank', path: bankDocumentPath },
        { kind: 'schedule_c', path: scheduleCDocumentPath },
      ]
      if (hasGst && gstDocumentPath) docs.push({ kind: 'gst', path: gstDocumentPath })
      if (incorporationDocumentPath) {
        docs.push({ kind: 'incorporation', path: incorporationDocumentPath })
      }
      if (ownershipDocumentPath) docs.push({ kind: 'ownership', path: ownershipDocumentPath })
      if (idFrontDocumentPath) docs.push({ kind: 'id_front', path: idFrontDocumentPath })
      if (idBackDocumentPath) docs.push({ kind: 'id_back', path: idBackDocumentPath })
      const { data: auth } = await supabase.auth.getUser()
      await Promise.all(
        docs.map((doc) =>
          supabase.from('shop_kyc_documents').upsert(
            {
              shop_id: shopId,
              kind: doc.kind,
              storage_path: doc.path,
              uploaded_by: auth.user?.id ?? null,
            },
            { onConflict: 'shop_id,kind' },
          ),
        ),
      )
      try {
        await dispatch(
          updateShopGst({
            shopId,
            userId: auth.user?.id,
            gst_revenue_above_20l: hasGst,
            gst_number: hasGst ? normalizePan(gstNumber) : '',
            gst_document_path: hasGst ? gstDocumentPath : '',
            gst_document_uri: '',
          }),
        ).unwrap()
      } catch {
        // KYC submit already succeeded; shop GST sync is best-effort.
      }
    }
    setSaving(false)
    if (error) {
      toast.show('Could not submit payout details', { tone: 'danger', message: error.message })
      return
    }
    toast.show('Verification submitted for review', { tone: 'success' })
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

  function setPanNameAndMaybeLegal(value: string) {
    setPanName(value)
    if (
      entityReqs.syncLegalWithPan &&
      (!legalName.trim() || normalizePersonLike(legalName) === normalizePersonLike(panName))
    ) {
      setLegalName(value)
    }
  }

  function setLegalNameAndMaybePan(value: string) {
    setLegalName(value)
    if (entityReqs.syncLegalWithPan && !panName.trim()) setPanName(value)
  }

  const showEntityDetails =
    entityReqs.requiresCin ||
    entityReqs.requiresLlpin ||
    entityReqs.requiresRegistrationNumber ||
    entityReqs.requiredAdminDocs.length > 0
  const sectionOffset = showEntityDetails ? 1 : 0

  return (
    <YStack gap="$4">
      {!embedded ? (
        <YStack gap="$1">
          <Text fontSize={16} fontWeight="800" color={ui.text}>
            PayU submerchant KYC
          </Text>
          <Text fontSize={13} color={ui.textSecondary} lineHeight={18}>
            Pick your business type — Individual, Pvt Ltd, Corporation, HUF, NGO, and more. The form
            adapts fields and documents. PayU still receives PAN, bank, Schedule C, and GST only;
            entity docs are for SHEconomy admin.
          </Text>
        </YStack>
      ) : null}

      <Text fontSize={13} fontWeight="700" color={ui.brand}>
        {STATUS_LABEL[status]}
      </Text>
      {adminNote && (status === 'changes_requested' || status === 'rejected') ? (
        <Text fontSize={13} color={ui.textSecondary}>
          Review note: {adminNote}
        </Text>
      ) : null}
      {status === 'payu_pending' ? (
        <Text fontSize={13} color={ui.textSecondary}>
          Details sent to PayU. Selling unlocks when verification finishes.
        </Text>
      ) : null}

      <FormSection
        title="1. Business type"
        hint="Every type uses a different PayU entity id, PAN rule, and admin document pack."
      >
        <Field label="Business type" error={errors.businessEntityId}>
          <YStack gap="$3">
            {PAYU_BUSINESS_ENTITY_GROUPS.map((group) => (
              <YStack key={group.id} gap="$1.5">
                <YStack gap="$0.5">
                  <Text fontSize={12} fontWeight="700" color={ui.text}>
                    {group.label}
                  </Text>
                  <Text fontSize={11} color={ui.textMuted}>
                    {group.hint}
                  </Text>
                </YStack>
                <XStack gap="$2" flexWrap="wrap">
                  {entitiesInGroup(group.id).map((entity) => {
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
              </YStack>
            ))}
          </YStack>
        </Field>
        <Text fontSize={12} color={ui.textSecondary} lineHeight={17}>
          {entityReqs.summary}
        </Text>
      </FormSection>

      <FormSection title="2. Names & contact" hint={entityReqs.legalNameHint}>
        <Field label={entityReqs.legalNameLabel} error={errors.legalName}>
          <Input
            value={legalName}
            onChangeText={setLegalNameAndMaybePan}
            editable={!locked}
            placeholder={entityReqs.legalNamePlaceholder}
          />
        </Field>
        <Field label={entityReqs.tradeNameLabel} error={errors.businessName}>
          <Input
            value={businessName}
            onChangeText={setBusinessName}
            editable={!locked}
            placeholder={entityReqs.tradeNamePlaceholder}
          />
        </Field>
        <Text fontSize={11} color={ui.textMuted}>
          {entityReqs.tradeNameHint}
        </Text>
        <Field label="Mobile" error={errors.mobile}>
          <PhoneInput value={mobile} onChange={setMobile} disabled={locked} />
        </Field>
        <Field label="Email" error={errors.email}>
          <Input
            value={email}
            onChangeText={setEmail}
            editable={!locked}
            autoCapitalize="none"
            placeholder="payouts@yourshop.com"
          />
        </Field>
      </FormSection>

      <FormSection title="3. PAN & tax" hint={entityReqs.panNameHint}>
        <Field label="PAN number" error={errors.panNumber || panHint || undefined}>
          <Input
            value={panNumber}
            onChangeText={(value) => setPanNumber(value.toUpperCase())}
            editable={!locked && !hasGst}
            autoCapitalize="characters"
            placeholder="ABCDE1234F"
          />
        </Field>
        <Field label="Name on PAN card" error={errors.panName}>
          <Input
            value={panName}
            onChangeText={setPanNameAndMaybeLegal}
            editable={!locked}
            placeholder={entityReqs.panNameHint}
          />
        </Field>
        <Field label="Expected monthly sales (₹)" error={errors.monthlyExpectedVolume}>
          <Input
            value={monthlyExpectedVolume}
            onChangeText={setMonthlyExpectedVolume}
            editable={!locked}
            keyboardType="number-pad"
            placeholder="50000"
          />
        </Field>
        {entityReqs.suggestGst && !hasGst ? (
          <Text fontSize={11} color={ui.textMuted}>
            Companies and firms often need a GSTIN. Add it if you have one.
          </Text>
        ) : null}
        <Button
          size="$3"
          tone={hasGst ? 'primary' : 'outline'}
          disabled={locked}
          onPress={() => setHasGst((value) => !value)}
        >
          {hasGst ? 'I have a GSTIN' : 'No GSTIN'}
        </Button>
        {hasGst ? (
          <YStack gap="$2">
            <Field label="GSTIN" error={errors.gstNumber}>
              <Input
                value={gstNumber}
                onChangeText={(value) => setGstNumber(value.toUpperCase())}
                editable={!locked}
                autoCapitalize="characters"
                placeholder="22AAAAA0000A1Z5"
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
      </FormSection>

      {showEntityDetails ? (
        <FormSection
          title={`4. ${entityReqs.registrationSectionTitle}`}
          hint={
            entityReqs.registrationSectionHint ||
            'Entity registration details and docs are for SHEconomy admin review.'
          }
        >
          {entityReqs.requiresCin ? (
            <Field label={entityReqs.cinLabel} error={errors.cin}>
              <Input
                value={cin}
                onChangeText={(value) => setCin(value.toUpperCase())}
                editable={!locked}
                autoCapitalize="characters"
                placeholder={entityReqs.cinPlaceholder}
              />
            </Field>
          ) : null}
          {entityReqs.requiresLlpin ? (
            <Field label={entityReqs.llpinLabel} error={errors.llpin}>
              <Input
                value={llpin}
                onChangeText={(value) => setLlpin(value.toUpperCase())}
                editable={!locked}
                autoCapitalize="characters"
                placeholder={entityReqs.llpinPlaceholder}
              />
            </Field>
          ) : null}
          {entityReqs.requiresRegistrationNumber ? (
            <Field label={entityReqs.registrationNumberLabel} error={errors.registrationNumber}>
              <Input
                value={registrationNumber}
                onChangeText={setRegistrationNumber}
                editable={!locked}
                placeholder={entityReqs.registrationNumberPlaceholder}
              />
            </Field>
          ) : null}
          {entityReqs.requiredAdminDocs.map((doc) => {
            const path =
              doc.kind === 'incorporation'
                ? incorporationDocumentPath
                : doc.kind === 'ownership'
                  ? ownershipDocumentPath
                  : doc.kind === 'id_front'
                    ? idFrontDocumentPath
                    : idBackDocumentPath
            const errorKey = `${doc.kind}DocumentPath`
            if (locked) {
              return path ? (
                <Text key={`reg-${doc.kind}`} fontSize={13} color={ui.textSecondary}>
                  {doc.label}: uploaded
                </Text>
              ) : null
            }
            return (
              <DocUploadButton
                key={`reg-${doc.kind}`}
                label={path ? `${doc.label} uploaded` : `Upload ${doc.label}`}
                done={Boolean(path)}
                error={errors[errorKey]}
                onPress={() => void upload(doc.kind)}
              />
            )
          })}
        </FormSection>
      ) : null}

      <FormSection
        title={`${4 + sectionOffset}. Bank account`}
        hint={entityReqs.bankHolderHint}
      >
        <Field label="Account number" error={errors.bankAccountNumber}>
          <Input
            value={bankAccountNumber}
            onChangeText={setBankAccountNumber}
            editable={!locked}
            keyboardType="number-pad"
            placeholder="9–18 digit account number"
          />
        </Field>
        <Field label="Account holder name" error={errors.bankHolderName}>
          <Input
            value={bankHolderName}
            onChangeText={setBankHolderName}
            editable={!locked}
            placeholder={entityReqs.bankHolderHint}
          />
        </Field>
        <Field label="IFSC" error={errors.ifsc}>
          <Input
            value={ifsc}
            onChangeText={(value) => setIfsc(value.toUpperCase())}
            editable={!locked}
            autoCapitalize="characters"
            placeholder="HDFC0001234"
          />
        </Field>
        {!locked && !bankHolderName.trim() && (panName.trim() || businessName.trim()) ? (
          <Button
            size="$2"
            tone="outline"
            alignSelf="flex-start"
            onPress={() => setBankHolderName(panName.trim() || businessName.trim())}
          >
            Use PAN / trade name as holder
          </Button>
        ) : null}
      </FormSection>

      {!locked ? (
        <FormSection
          title={`${5 + sectionOffset}. PayU documents`}
          hint="These go to PayU on approval. Entity registration docs above stay with SHEconomy admin."
        >
          <DocUploadButton
            label={panDocumentPath ? 'PAN card uploaded' : 'Upload PAN card'}
            done={Boolean(panDocumentPath)}
            error={errors.panDocumentPath}
            onPress={() => void upload('pan')}
          />
          <DocUploadButton
            label={
              bankDocumentPath ? 'Bank proof uploaded' : 'Upload cancelled cheque / bank proof'
            }
            done={Boolean(bankDocumentPath)}
            error={errors.bankDocumentPath}
            onPress={() => void upload('bank')}
          />
          <DocUploadButton
            label={scheduleCDocumentPath ? 'Schedule C uploaded' : 'Upload signed Schedule C'}
            done={Boolean(scheduleCDocumentPath)}
            error={errors.scheduleCDocumentPath}
            onPress={() => void upload('schedule_c')}
          />
          {hasGst ? (
            <DocUploadButton
              label={gstDocumentPath ? 'GST certificate uploaded' : 'Upload GST certificate'}
              done={Boolean(gstDocumentPath)}
              error={errors.gstDocumentPath}
              onPress={() => void upload('gst')}
            />
          ) : null}
          {entityReqs.optionalAdminDocs.map((doc) => {
            const path = doc.kind === 'id_front' ? idFrontDocumentPath : idBackDocumentPath
            return (
              <DocUploadButton
                key={doc.kind}
                label={path ? `${doc.label} uploaded` : `Upload ${doc.label} (optional)`}
                done={Boolean(path)}
                onPress={() => void upload(doc.kind)}
              />
            )
          })}
          <Button size="$4" tone="primary" disabled={saving} onPress={() => void submit()}>
            {saving ? 'Submitting…' : 'Submit for PayU KYC review'}
          </Button>
        </FormSection>
      ) : null}
    </YStack>
  )
}

function normalizePersonLike(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ')
}

function FormSection({
  title,
  hint,
  children,
}: {
  title: string
  hint: string
  children: ReactNode
}) {
  return (
    <YStack
      gap="$2.5"
      padding="$3.5"
      borderRadius={radius.card}
      borderWidth={1}
      borderColor="$borderColor"
      backgroundColor="$background"
    >
      <YStack gap="$0.5">
        <Text fontSize={14} fontWeight="800">
          {title}
        </Text>
        <Text fontSize={12} color="$color10" lineHeight={17}>
          {hint}
        </Text>
      </YStack>
      {children}
    </YStack>
  )
}

function DocUploadButton({
  label,
  done,
  error,
  onPress,
}: {
  label: string
  done: boolean
  error?: string
  onPress: () => void
}) {
  return (
    <YStack gap="$1">
      <Button size="$3" tone={done ? 'primary' : 'outline'} onPress={onPress}>
        {label}
      </Button>
      {error ? (
        <Text fontSize={12} color="#B91C1C">
          {error}
        </Text>
      ) : null}
    </YStack>
  )
}
