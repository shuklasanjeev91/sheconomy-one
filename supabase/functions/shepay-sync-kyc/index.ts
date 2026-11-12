/**
 * POST /functions/v1/shepay-sync-kyc
 *
 * Cron (x-cron-secret) or service-role. Polls PayU for child merchants in
 * payu_pending and promotes to payu_verified or changes_requested.
 */
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'

import { corsHeaders, jsonResponse } from '../_shared/cors.ts'
import {
  fetchPayuProductAccount,
  findPayuChildForShop,
  getPayuHubToken,
  resolvePayuHubConfig,
} from '../_shared/payu-hub.ts'

type PendingRow = {
  shop_id: string
  email: string
  mobile: string
  legal_name: string
  payu_product_account_uuid: string | null
  payu_mid: string | null
  payu_merchant_key: string | null
  payu_onboarding_status: string | null
  payu_document_status: string | null
  payu_kyc_status: string | null
}

function isActive(input: {
  onboardingStatus: string | null
  documentStatus: string | null
  kycStatus: string | null
  onboardingCompleted?: boolean
}): boolean {
  const onboarding = (input.onboardingStatus || '').toLowerCase()
  const docs = (input.documentStatus || '').toLowerCase()
  const kyc = (input.kycStatus || '').toLowerCase()
  if (input.onboardingCompleted) return true
  if (onboarding.includes('complete') || onboarding === 'active' || onboarding === 'approved') {
    return true
  }
  if (docs.includes('approved') || docs === 'complete' || docs === 'completed') {
    if (kyc.includes('approved') || kyc.includes('complete') || kyc === 'active' || !kyc) {
      return true
    }
  }
  if (kyc.includes('approved') || kyc === 'active' || kyc.includes('verified')) return true
  return false
}

function isRejected(input: {
  onboardingStatus: string | null
  documentStatus: string | null
  kycStatus: string | null
}): string | null {
  const parts = [input.onboardingStatus, input.documentStatus, input.kycStatus]
    .filter(Boolean)
    .map((v) => String(v))
  for (const part of parts) {
    const lower = part.toLowerCase()
    if (lower.includes('reject') || lower.includes('failed') || lower.includes('declin')) {
      return part
    }
  }
  return null
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405)

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  if (!supabaseUrl || !serviceRole) {
    return jsonResponse({ error: 'Service not configured' }, 503)
  }

  const cronSecret = Deno.env.get('NOTIFICATION_CRON_SECRET')
  const headerSecret = request.headers.get('x-cron-secret')
  const authHeader = request.headers.get('Authorization')
  const isCron = Boolean(cronSecret && headerSecret && headerSecret === cronSecret)
  const isService = Boolean(serviceRole && authHeader === `Bearer ${serviceRole}`)
  if (!isCron && !isService) {
    return jsonResponse({ error: 'Unauthorized' }, 401)
  }

  const hub = resolvePayuHubConfig()
  if (!hub) return jsonResponse({ error: 'PayU Hub is not configured' }, 503)

  const admin = createClient(supabaseUrl, serviceRole, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { data: pending, error } = await admin
    .from('shop_payu_kyc')
    .select(
      'shop_id, email, mobile, legal_name, payu_product_account_uuid, payu_mid, payu_merchant_key, payu_onboarding_status, payu_document_status, payu_kyc_status',
    )
    .eq('status', 'payu_pending')
    .limit(100)

  if (error) return jsonResponse({ error: error.message }, 500)
  const rows = (pending ?? []) as PendingRow[]
  if (rows.length === 0) return jsonResponse({ ok: true, checked: 0, activated: 0, rejected: 0 })

  const token = await getPayuHubToken(hub, 'fetch_child_merchants')
  let activated = 0
  let rejected = 0
  const failures: Array<{ shopId: string; error: string }> = []

  for (const row of rows) {
    try {
      let onboardingStatus = row.payu_onboarding_status
      let documentStatus = row.payu_document_status
      let kycStatus = row.payu_kyc_status
      let mid = row.payu_mid
      let merchantKey = row.payu_merchant_key
      let onboardingCompleted = false

      if (row.payu_product_account_uuid) {
        try {
          const account = await fetchPayuProductAccount(hub, token, row.payu_product_account_uuid)
          onboardingStatus = account.onboardingStatus ?? onboardingStatus
          documentStatus = account.documentStatus ?? documentStatus
          kycStatus = account.kycStatus ?? kycStatus
          if (account.mid) mid = account.mid
          const rawCompleted = account.raw.onboarding_completed
          onboardingCompleted = Boolean(rawCompleted)
        } catch {
          // Fall through to listing lookup.
        }
      }

      const child = await findPayuChildForShop(hub, token, {
        shopId: row.shop_id,
        email: row.email,
        phone: row.mobile,
      })
      if (child) {
        mid = child.mid || mid
        merchantKey = child.merchantKey || merchantKey
        onboardingCompleted = onboardingCompleted || child.onboardingCompleted
      }

      const rejection = isRejected({ onboardingStatus, documentStatus, kycStatus })
      if (rejection) {
        const reason = `PayU rejected KYC: ${rejection}`
        await admin
          .from('shop_payu_kyc')
          .update({
            status: 'changes_requested',
            admin_note: reason.slice(0, 1000),
            payu_onboarding_status: onboardingStatus,
            payu_document_status: documentStatus,
            payu_kyc_status: kycStatus,
            payu_mid: mid,
            payu_merchant_key: merchantKey,
            payu_error: reason.slice(0, 2000),
          })
          .eq('shop_id', row.shop_id)

        const { data: shop } = await admin
          .from('shops')
          .select('user_id, shop_name')
          .eq('id', row.shop_id)
          .maybeSingle()
        if (shop?.user_id) {
          await admin.rpc('create_notification_from_template', {
            p_template_key: 'payu_kyc_rejected',
            p_recipient_id: shop.user_id,
            p_variables: {
              seller_name: row.legal_name || 'there',
              shop_name: shop.shop_name || 'your shop',
              reason,
              action_url: '/vendor/settings?section=verification',
            },
            p_context_type: 'shop',
            p_context_id: row.shop_id,
          })
        }
        rejected += 1
        continue
      }

      if (
        !isActive({
          onboardingStatus,
          documentStatus,
          kycStatus,
          onboardingCompleted,
        })
      ) {
        await admin
          .from('shop_payu_kyc')
          .update({
            payu_onboarding_status: onboardingStatus,
            payu_document_status: documentStatus,
            payu_kyc_status: kycStatus,
            payu_mid: mid,
            payu_merchant_key: merchantKey,
          })
          .eq('shop_id', row.shop_id)
        continue
      }

      if (!merchantKey || !mid) {
        await admin
          .from('shop_payu_kyc')
          .update({
            payu_onboarding_status: onboardingStatus,
            payu_document_status: documentStatus,
            payu_kyc_status: kycStatus,
            payu_error: 'PayU looks active but child merchant key is missing.',
          })
          .eq('shop_id', row.shop_id)
        continue
      }

      const now = new Date().toISOString()
      await admin.from('shop_payment_accounts').upsert(
        {
          shop_id: row.shop_id,
          provider: 'payu',
          merchant_id: merchantKey,
          status: 'connected',
          connected_at: now,
          updated_at: now,
          metadata: {
            connection_type: 'credential',
            mode: 'live',
            onboarded_via: 'sheconomy',
            auto_synced: true,
            child_merchant_key: merchantKey,
            merchant_key: merchantKey,
            child_mid: mid,
            child_uuid: row.payu_product_account_uuid,
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

      await admin.from('shop_commerce_settings').upsert(
        {
          shop_id: row.shop_id,
          payment_mode: 'shepay',
          payment_gateway: 'payu',
          payment_connected: true,
          payment_account_label: merchantKey,
          updated_at: now,
        },
        { onConflict: 'shop_id' },
      )

      await admin.from('shops').update({ verified: true, updated_at: now }).eq('id', row.shop_id)

      await admin
        .from('shop_payu_kyc')
        .update({
          status: 'payu_verified',
          payu_mid: mid,
          payu_merchant_key: merchantKey,
          payu_onboarding_status: onboardingStatus,
          payu_document_status: documentStatus,
          payu_kyc_status: kycStatus,
          payu_error: null,
        })
        .eq('shop_id', row.shop_id)

      try {
        await fetch(`${supabaseUrl.replace(/\/$/, '')}/functions/v1/shepay-release-pending`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${serviceRole}`,
            apikey: anonKey || serviceRole,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ shopId: row.shop_id }),
        })
      } catch {
        // Held release is best-effort.
      }

      const { data: shop } = await admin
        .from('shops')
        .select('user_id, shop_name')
        .eq('id', row.shop_id)
        .maybeSingle()
      if (shop?.user_id) {
        await admin.rpc('create_notification_from_template', {
          p_template_key: 'payu_kyc_active',
          p_recipient_id: shop.user_id,
          p_variables: {
            seller_name: row.legal_name || 'there',
            shop_name: shop.shop_name || 'your shop',
            action_url: '/vendor/settings?section=verification',
          },
          p_context_type: 'shop',
          p_context_id: row.shop_id,
        })
      }

      activated += 1
    } catch (err) {
      failures.push({
        shopId: row.shop_id,
        error: err instanceof Error ? err.message : 'sync failed',
      })
    }
  }

  return jsonResponse({
    ok: true,
    checked: rows.length,
    activated,
    rejected,
    failures,
  })
})
