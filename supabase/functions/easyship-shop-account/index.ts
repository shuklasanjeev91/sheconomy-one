/**
 * POST /functions/v1/easyship-shop-account
 * Vendor JWT — EasyShip partner child-company for a shop (PayU-child analogue).
 *
 * actions:
 * - status: EasyShip credit for the shop's company (or platform parent if unlinked)
 * - ensure: create/link child company when partner credentials exist
 * - topup: charge seller's EasyShip payment source → credit on that company
 */
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'

import { corsHeaders, jsonResponse } from '../_shared/cors.ts'
import {
  addAccountCredit,
  easyshipPartnerReady,
  getAccountCredit,
  resolveEasyshipConfig,
  withEasyshipCompany,
} from '../_shared/easyship.ts'

type Body = {
  action?: 'status' | 'ensure' | 'topup'
  shopId?: string
  amount?: number
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405)

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const anon = Deno.env.get('SUPABASE_ANON_KEY')
  const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !anon || !serviceRole) return jsonResponse({ error: 'Not configured' }, 503)

  const config = resolveEasyshipConfig()
  if (!config) return jsonResponse({ error: 'Easyship is not configured' }, 503)

  const authHeader = request.headers.get('Authorization')
  if (!authHeader) return jsonResponse({ error: 'Unauthorized' }, 401)

  let body: Body
  try {
    body = (await request.json()) as Body
  } catch {
    return jsonResponse({ error: 'Invalid JSON' }, 400)
  }

  const shopId = String(body.shopId ?? '').trim()
  const action = body.action ?? 'status'
  if (!shopId) return jsonResponse({ error: 'shopId is required' }, 400)

  const userClient = createClient(supabaseUrl, anon, {
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

  const { data: shop } = await admin
    .from('shops')
    .select(
      'id, user_id, shop_name, shop_email, shop_phone_number, easyship_company_id, easyship_payment_source_id, easyship_linked_at',
    )
    .eq('id', shopId)
    .maybeSingle()
  if (!shop || shop.user_id !== user.id) {
    return jsonResponse({ error: 'Shop not found' }, 404)
  }

  const linkedCompanyId = (shop.easyship_company_id as string | null)?.trim() || null
  const shopConfig = withEasyshipCompany(config, linkedCompanyId)
  const partnerReady = easyshipPartnerReady()

  if (action === 'status') {
    try {
      const credit = await getAccountCredit(shopConfig)
      return jsonResponse({
        ok: true,
        model: linkedCompanyId ? 'seller_easyship_child' : 'platform_mor_fallback',
        partnerReady,
        shopId,
        easyshipCompanyId: linkedCompanyId || shopConfig.companyId || null,
        paymentSourceId: shop.easyship_payment_source_id ?? null,
        linkedAt: shop.easyship_linked_at ?? null,
        availableBalance: credit.availableBalance,
        balance: credit.balance,
        currency: credit.currency,
        note: linkedCompanyId
          ? 'Labels charge this shop EasyShip credit. Top up via Vendor Wallet → EasyShip (card on file).'
          : partnerReady
            ? 'Call action=ensure to create this shop’s EasyShip child company.'
            : 'Waiting for EasyShip partner/enterprise credentials. Until then labels use the platform MOR account (ops must keep parent credit funded).',
      })
    } catch (error) {
      return jsonResponse(
        { error: error instanceof Error ? error.message : 'Could not read EasyShip credit' },
        502,
      )
    }
  }

  if (action === 'ensure') {
    if (linkedCompanyId) {
      return jsonResponse({
        ok: true,
        created: false,
        easyshipCompanyId: linkedCompanyId,
        paymentSourceId: shop.easyship_payment_source_id ?? null,
      })
    }
    if (!partnerReady) {
      return jsonResponse(
        {
          error:
            'EasyShip partner credentials are not configured yet (EASYSHIP_PARTNER_CLIENT_ID / SECRET). Application was submitted — set secrets when EasyShip sends them, then retry ensure.',
          code: 'easyship_partner_pending',
          partnerReady: false,
        },
        503,
      )
    }
    // Enterprise Create Company requires OAuth client-credentials token + organization id.
    // Wire when partner credentials arrive (see doc/vendor-shipping/easyship-partner.md).
    return jsonResponse(
      {
        error:
          'Child-company create is ready for partner credentials but organization create is not enabled in this deploy yet. Paste client_id/secret into secrets and we will finish ensure.',
        code: 'easyship_ensure_not_implemented',
        partnerReady: true,
      },
      501,
    )
  }

  if (action === 'topup') {
    const amount = Number(body.amount)
    const paymentSourceId = String(shop.easyship_payment_source_id ?? '').trim()
    if (!linkedCompanyId) {
      return jsonResponse(
        {
          error:
            'This shop has no EasyShip child company yet. After partner approval, ensure the shop account, add a card, then top up.',
          code: 'easyship_shop_unlinked',
        },
        400,
      )
    }
    if (!paymentSourceId) {
      return jsonResponse(
        {
          error:
            'Add a card on this shop’s EasyShip account first (payment source). Then top up shipping credit from Vendor Wallet.',
          code: 'easyship_payment_source_missing',
        },
        400,
      )
    }
    try {
      const credit = await addAccountCredit(shopConfig, { paymentSourceId, amount })
      if (credit.actionRequired) {
        return jsonResponse({
          ok: false,
          code: 'easyship_3ds_required',
          actionRequired: credit.actionRequired,
          message: 'Complete 3-D Secure in the client, then confirm the credit.',
        }, 202)
      }
      // Mirror into platform_wallets so existing fulfill gates stay consistent.
      const { error: mirrorError } = await admin.rpc('platform_wallet_credit', {
        p_owner_type: 'shop',
        p_owner_id: shopId,
        p_amount: amount,
        p_entry_type: 'topup',
        p_idempotency_key: `easyship_credit:${shopId}:${Date.now()}`,
        p_currency: credit.currency || 'INR',
        p_description: 'EasyShip credit top-up (seller card)',
        p_metadata: {
          source: 'easyship_account_credit',
          easyship_company_id: linkedCompanyId,
        },
        p_topup_id: null,
        p_order_id: null,
        p_shop_id: shopId,
        p_campaign_id: null,
        p_referral_reward_id: null,
      })
      if (mirrorError) {
        console.warn('platform_wallet mirror after EasyShip top-up failed', mirrorError.message)
      }
      return jsonResponse({
        ok: true,
        availableBalance: credit.availableBalance,
        balance: credit.balance,
        currency: credit.currency,
        mirroredWallet: !mirrorError,
      })
    } catch (error) {
      return jsonResponse(
        { error: error instanceof Error ? error.message : 'EasyShip top-up failed' },
        502,
      )
    }
  }

  return jsonResponse({ error: 'Unknown action' }, 400)
})
