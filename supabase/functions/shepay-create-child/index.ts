/**
 * POST /functions/v1/shepay-create-child
 *
 * Admin-only. After a vendor payout application is approved, create the PayU
 * child merchant, save the bank account, store the child key + MID, mark the
 * shop verified, and release held settlements.
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
}

const CATEGORY_ID = 16
const SUB_CATEGORY_ID = 128

function digitsMobile(value: string): string {
  const digits = value.replace(/\D/g, '')
  return digits.length > 10 ? digits.slice(-10) : digits
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
      'shop_id, legal_name, mobile, email, pan_number, pan_name, gst_number, business_name, business_entity_id, monthly_expected_volume, bank_account_number, bank_holder_name, ifsc, status, payu_product_account_uuid',
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

    const listToken = await getPayuHubToken(hub, 'fetch_child_merchants')
    const child = await findPayuChildForShop(hub, listToken, {
      shopId,
      email: row.email,
      phone: row.mobile,
    })

    if (!child?.merchantKey || !(child.mid || createdMid)) {
      await admin
        .from('shop_payu_kyc')
        .update({
          status: 'payu_pending',
          payu_mid: createdMid || null,
          payu_onboarding_status: onboardingStatus,
          payu_document_status: documentStatus,
          payu_kyc_status: kycStatus,
          payu_error: 'Child merchant was created. The merchant key is not ready yet — retry.',
        })
        .eq('shop_id', shopId)
      return jsonResponse(
        { ok: false, error: 'Child merchant created, but the merchant key is not ready yet.' },
        502,
      )
    }

    const now = new Date().toISOString()
    const mid = child.mid || createdMid
    const { error: upsertError } = await admin.from('shop_payment_accounts').upsert(
      {
        shop_id: shopId,
        provider: 'payu',
        merchant_id: child.merchantKey,
        access_token: null,
        refresh_token: null,
        token_expiry: null,
        status: 'connected',
        connected_at: now,
        updated_at: now,
        metadata: {
          connection_type: 'credential',
          mode: 'live',
          onboarded_via: 'sheconomy',
          auto_synced: true,
          child_merchant_key: child.merchantKey,
          merchant_key: child.merchantKey,
          child_mid: mid,
          child_uuid: child.uuid ?? uuid,
          credentials: JSON.stringify({
            merchant_key: child.merchantKey,
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
        payment_connected: true,
        payment_account_label: child.merchantKey,
        updated_at: now,
      },
      { onConflict: 'shop_id' },
    )

    await admin
      .from('shops')
      .update({ verified: true, updated_at: now })
      .eq('id', shopId)

    await admin
      .from('shop_payu_kyc')
      .update({
        status: 'payu_verified',
        payu_mid: mid,
        payu_merchant_key: child.merchantKey,
        payu_product_account_uuid: uuid,
        payu_onboarding_status: onboardingStatus,
        payu_document_status: documentStatus,
        payu_kyc_status: kycStatus,
        payu_error: null,
      })
      .eq('shop_id', shopId)

    try {
      await fetch(`${supabaseUrl.replace(/\/$/, '')}/functions/v1/shepay-release-pending`, {
        method: 'POST',
        headers: {
          Authorization: authHeader,
          apikey: anonKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ shopId }),
      })
    } catch {
      // Held release is best-effort; the child merchant is already saved.
    }

    return jsonResponse({
      ok: true,
      status: 'payu_verified',
      childMid: mid,
      onboardingStatus,
      documentStatus,
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
