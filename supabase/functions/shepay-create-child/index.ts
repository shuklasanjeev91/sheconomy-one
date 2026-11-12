/**
 * POST /functions/v1/shepay-create-child
 *
 * Admin-only. After a vendor payout application is approved, create the PayU
 * child merchant, save the bank account, upload KYC documents, store the
 * child key + MID, and leave status as payu_pending until KYC sync activates.
 *
 * Body: { shopId }
 */
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'

import { corsHeaders, jsonResponse } from '../_shared/cors.ts'
import {
  createPayuChildMerchant,
  findPayuChildForShop,
  getPayuHubToken,
  resolvePayuHubConfig,
  updatePayuChildBank,
  uploadPayuKycDocument,
} from '../_shared/payu-hub.ts'

type KycRow = {
  shop_id: string
  legal_name: string
  mobile: string
  email: string
  pan_number: string
  pan_name: string
  gst_number: string | null
  business_name: string
  business_entity_id: number
  monthly_expected_volume: number
  bank_account_number: string
  bank_holder_name: string
  ifsc: string
  status: string
  payu_product_account_uuid: string | null
  pan_document_path: string | null
  bank_document_path: string | null
  gst_document_path: string | null
  schedule_c_document_path: string | null
}

type DocKind = 'pan' | 'bank' | 'schedule_c' | 'gst'

const CATEGORY_ID = 16
const SUB_CATEGORY_ID = 128
const KYC_BUCKET = 'shop-kyc-documents'

function digitsMobile(value: string): string {
  const digits = value.replace(/\D/g, '')
  return digits.length > 10 ? digits.slice(-10) : digits
}

function fileNameFromPath(path: string, kind: string): string {
  const base = path.split('/').pop() || `${kind}.pdf`
  return base.includes('.') ? base : `${base}.pdf`
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405)

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !anonKey || !serviceRole) {
    return jsonResponse({ error: 'Service not configured' }, 503)
  }

  const authHeader = request.headers.get('Authorization')
  if (!authHeader) return jsonResponse({ error: 'Unauthorized' }, 401)

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const {
    data: { user },
  } = await userClient.auth.getUser()
  if (!user) return jsonResponse({ error: 'Unauthorized' }, 401)

  const admin = createClient(supabaseUrl, serviceRole, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { data: profile } = await admin
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()
  if (profile?.role !== 'A') return jsonResponse({ error: 'Forbidden' }, 403)

  let shopId = ''
  try {
    const body = (await request.json()) as { shopId?: string }
    shopId = String(body.shopId ?? '').trim()
  } catch {
    return jsonResponse({ error: 'Invalid JSON' }, 400)
  }
  if (!shopId) return jsonResponse({ error: 'shopId is required' }, 400)

  const hub = resolvePayuHubConfig()
  if (!hub) return jsonResponse({ error: 'PayU Hub is not configured' }, 503)

  const { data: kyc } = await admin
    .from('shop_payu_kyc')
    .select(
      'shop_id, legal_name, mobile, email, pan_number, pan_name, gst_number, business_name, business_entity_id, monthly_expected_volume, bank_account_number, bank_holder_name, ifsc, status, payu_product_account_uuid, pan_document_path, bank_document_path, gst_document_path, schedule_c_document_path',
    )
    .eq('shop_id', shopId)
    .maybeSingle()

  const row = kyc as KycRow | null
  if (!row) return jsonResponse({ error: 'No payout application for this shop' }, 404)
  if (row.status !== 'submitted' && row.status !== 'payu_pending') {
    return jsonResponse({ error: 'Application is not ready to send to PayU' }, 409)
  }

  await admin
    .from('shop_payu_kyc')
    .update({
      status: 'payu_pending',
      payu_error: null,
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
    })
    .eq('shop_id', shopId)

  try {
    const token = await getPayuHubToken(hub, 'refer_child_merchant')
    let uuid = row.payu_product_account_uuid?.trim() || ''
    let createdMid = ''
    let onboardingStatus: string | null = null
    let documentStatus: string | null = null
    let kycStatus: string | null = null

    if (!uuid) {
      const gst = row.gst_number?.trim().toUpperCase() || ''
      const created = await createPayuChildMerchant(hub, token, {
        product: 'PayUbiz',
        name: row.legal_name.trim(),
        email: row.email.trim(),
        mobile: digitsMobile(row.mobile),
        aggregator_parent_mid: hub.parentMid,
        merchant_type: 'aggregator',
        merchant_defined_identifier: shopId,
        business_entity_id: row.business_entity_id,
        pancard_number: row.pan_number.trim().toUpperCase(),
        pancard_name: row.pan_name.trim(),
        business_name: row.business_name.trim(),
        business_category_id: CATEGORY_ID,
        business_sub_category_id: SUB_CATEGORY_ID,
        monthly_expected_volume: Math.round(Number(row.monthly_expected_volume) || 0),
        ...(gst ? { gst_number: gst } : {}),
      })
      uuid = created.uuid
      createdMid = created.mid
      onboardingStatus = created.onboardingStatus
      documentStatus = created.documentStatus
      kycStatus = created.kycStatus
      await admin
        .from('shop_payu_kyc')
        .update({
          payu_product_account_uuid: uuid,
          payu_mid: createdMid || null,
          payu_onboarding_status: onboardingStatus,
          payu_document_status: documentStatus,
          payu_kyc_status: kycStatus,
        })
        .eq('shop_id', shopId)
    }

    const bank = await updatePayuChildBank(hub, token, uuid, {
      bank_account_number: row.bank_account_number.replace(/\s+/g, ''),
      holder_name: row.bank_holder_name.trim(),
      ifsc_code: row.ifsc.trim().toUpperCase(),
    })
    onboardingStatus = bank.onboardingStatus ?? onboardingStatus
    documentStatus = bank.documentStatus ?? documentStatus
    kycStatus = bank.kycStatus ?? kycStatus
    createdMid = bank.mid || createdMid

    const { data: metaDocs } = await admin
      .from('shop_kyc_documents')
      .select('kind, storage_path, mime_type')
      .eq('shop_id', shopId)

    const pathByKind = new Map<DocKind, { path: string; mime: string }>()
    for (const doc of metaDocs ?? []) {
      const kind = doc.kind as DocKind
      if (doc.storage_path) {
        pathByKind.set(kind, {
          path: doc.storage_path,
          mime: (doc.mime_type as string) || 'application/pdf',
        })
      }
    }
    const legacy: Array<[DocKind, string | null]> = [
      ['pan', row.pan_document_path],
      ['bank', row.bank_document_path],
      ['schedule_c', row.schedule_c_document_path],
      ['gst', row.gst_document_path],
    ]
    for (const [kind, path] of legacy) {
      if (path && !pathByKind.has(kind)) {
        pathByKind.set(kind, { path, mime: 'application/pdf' })
      }
    }

    const midForDocs = createdMid
    const docErrors: string[] = []
    if (midForDocs) {
      for (const kind of ['pan', 'bank', 'schedule_c', 'gst'] as DocKind[]) {
        const entry = pathByKind.get(kind)
        if (!entry) {
          if (kind === 'gst') continue
          docErrors.push(`Missing ${kind} document`)
          continue
        }
        const { data: blob, error: downloadError } = await admin.storage
          .from(KYC_BUCKET)
          .download(entry.path)
        if (downloadError || !blob) {
          docErrors.push(`${kind}: ${downloadError?.message || 'download failed'}`)
          continue
        }
        const bytes = new Uint8Array(await blob.arrayBuffer())
        const uploaded = await uploadPayuKycDocument(hub, token, {
          mid: midForDocs,
          productAccountUuid: uuid,
          kind,
          fileName: fileNameFromPath(entry.path, kind),
          mimeType: entry.mime || blob.type || 'application/pdf',
          bytes,
        })
        if (uploaded.error) {
          docErrors.push(`${kind}: ${uploaded.error}`)
          continue
        }
        await admin.from('shop_kyc_documents').upsert(
          {
            shop_id: shopId,
            kind,
            storage_path: entry.path,
            mime_type: entry.mime,
            payu_document_uuid: uploaded.uuid,
            payu_document_status: uploaded.status,
            rejection_reason: null,
          },
          { onConflict: 'shop_id,kind' },
        )
      }
    } else {
      docErrors.push('Child MID not available yet for document upload')
    }

    const listToken = await getPayuHubToken(hub, 'fetch_child_merchants')
    const child = await findPayuChildForShop(hub, listToken, {
      shopId,
      email: row.email,
      phone: row.mobile,
    })

    const now = new Date().toISOString()
    const mid = child?.mid || createdMid
    const merchantKey = child?.merchantKey || null

    if (merchantKey && mid) {
      const { error: upsertError } = await admin.from('shop_payment_accounts').upsert(
        {
          shop_id: shopId,
          provider: 'payu',
          merchant_id: merchantKey,
          access_token: null,
          refresh_token: null,
          token_expiry: null,
          status: 'pending',
          connected_at: null,
          updated_at: now,
          metadata: {
            connection_type: 'credential',
            mode: 'live',
            onboarded_via: 'sheconomy',
            auto_synced: true,
            child_merchant_key: merchantKey,
            merchant_key: merchantKey,
            child_mid: mid,
            child_uuid: child?.uuid ?? uuid,
            credentials: JSON.stringify({
              merchant_key: merchantKey,
              child_mid: mid,
              salt_key: 'platform',
              onboarded_via: 'sheconomy',
            }),
            configured_at: now,
          },
        },
        { onConflict: 'shop_id,provider', ignoreDuplicates: false },
      )
      if (upsertError) throw new Error(upsertError.message)

      await admin.from('shop_commerce_settings').upsert(
        {
          shop_id: shopId,
          payment_mode: 'shepay',
          payment_gateway: 'payu',
          payment_connected: false,
          payment_account_label: merchantKey,
          updated_at: now,
        },
        { onConflict: 'shop_id' },
      )
    }

    const payuError =
      docErrors.length > 0
        ? `Docs: ${docErrors.join('; ').slice(0, 1800)}`
        : !merchantKey
          ? 'Child merchant was created. The merchant key is not ready yet — sync will retry.'
          : null

    await admin
      .from('shop_payu_kyc')
      .update({
        status: 'payu_pending',
        payu_mid: mid || null,
        payu_merchant_key: merchantKey,
        payu_product_account_uuid: uuid,
        payu_onboarding_status: onboardingStatus,
        payu_document_status: documentStatus,
        payu_kyc_status: kycStatus,
        payu_error: payuError,
      })
      .eq('shop_id', shopId)

    return jsonResponse({
      ok: true,
      status: 'payu_pending',
      childMid: mid || null,
      merchantKeyReady: Boolean(merchantKey),
      onboardingStatus,
      documentStatus,
      documentErrors: docErrors,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not create the child merchant'
    await admin
      .from('shop_payu_kyc')
      .update({ status: 'payu_pending', payu_error: message.slice(0, 2000) })
      .eq('shop_id', shopId)
    return jsonResponse({ ok: false, error: message }, 502)
  }
})
