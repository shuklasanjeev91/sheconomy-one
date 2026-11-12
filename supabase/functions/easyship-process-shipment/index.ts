/**
 * POST /functions/v1/easyship-process-shipment
 * Vendor JWT: re-rate, gate on seller shipping credit + platform Easyship balance,
 * create shipment/label, debit ledger, write order_delivery.
 */
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'

import { corsHeaders, jsonResponse } from '../_shared/cors.ts'
import {
  EASYSHIP_DEFAULT_DIMS,
  EASYSHIP_DEFAULT_WEIGHT_KG,
  createShipment,
  getAccountCredit,
  insufficientShippingCreditResponse,
  pickBestDdpRate,
  requestDdpRates,
  resolveEasyshipConfig,
  type EasyshipParcelItem,
} from '../_shared/easyship.ts'

type Body = {
  shopId: string
  orderId: string
  orderItemIds?: string[]
}

function asAddress(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>
  }
  return {}
}

function str(value: unknown, fallback = ''): string {
  if (value == null) return fallback
  return String(value).trim() || fallback
}

function countryAlpha2(raw: unknown, fallback = 'IN'): string {
  return str(raw, fallback).toUpperCase().slice(0, 2) || fallback
}

function readMeta(meta: unknown, key: string): string {
  if (!meta || typeof meta !== 'object') return ''
  const value = (meta as Record<string, unknown>)[key]
  return typeof value === 'string' ? value.trim() : ''
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
  if (!body.shopId || !body.orderId) {
    return jsonResponse({ error: 'shopId and orderId are required' }, 400)
  }

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
      'id, user_id, shop_name, shop_email, shop_phone_number, shop_address_id, shop_currency',
    )
    .eq('id', body.shopId)
    .maybeSingle()
  if (!shop || shop.user_id !== user.id) {
    return jsonResponse({ error: 'Shop not found' }, 404)
  }

  let shopAddress: Record<string, unknown> = {}
  if (shop.shop_address_id) {
    const { data: addr } = await admin
      .from('addresses')
      .select('address_line_1, address_line_2, city, state, country, postal_code')
      .eq('id', shop.shop_address_id)
      .maybeSingle()
    shopAddress = (addr ?? {}) as Record<string, unknown>
  }

  let itemsQuery = admin
    .from('order_items')
    .select(
      'id, order_id, vendor_id, listing_id, quantity, unit_price, item_status, product_title, product_sku, listings(title, metadata, currency)',
    )
    .eq('order_id', body.orderId)
    .eq('vendor_id', body.shopId)
    .not('item_status', 'in', '("cancelled","refunded")')

  if (body.orderItemIds?.length) {
    itemsQuery = itemsQuery.in('id', body.orderItemIds)
  }

  const { data: items, error: itemsError } = await itemsQuery
  if (itemsError) return jsonResponse({ error: itemsError.message }, 500)
  if (!items?.length) return jsonResponse({ error: 'No shippable items for this shop/order' }, 400)

  const { data: order } = await admin
    .from('orders')
    .select(
      `
      id, order_number, user_id, shipping_amount, currency, order_metadata,
      shipping_address:addresses!shipping_address_id (
        address_line_1, address_line_2, city, state, country, postal_code, phone, full_name
      ),
      profiles:user_id ( full_name, email, phone )
    `,
    )
    .eq('id', body.orderId)
    .maybeSingle()
  if (!order) return jsonResponse({ error: 'Order not found' }, 404)

  const shipping = asAddress(order.shipping_address)
  const profile = asAddress(order.profiles)
  const destCountry = countryAlpha2(shipping.country, 'US')
  const originCountry = countryAlpha2(shopAddress.country, 'IN')

  const orderMeta = asAddress(order.order_metadata)
  const easyshipMeta = asAddress(orderMeta.easyship)
  const preferredCourierId = str(easyshipMeta.courier_service_id) || null

  const parcelItems: EasyshipParcelItem[] = items.map((item, index) => {
    const listing = Array.isArray(item.listings) ? item.listings[0] : item.listings
    const listingObj = (listing ?? {}) as Record<string, unknown>
    const meta = listingObj.metadata
    const hs = readMeta(meta, 'hs_code') || '99999900'
    const origin =
      readMeta(meta, 'country_of_origin') ||
      readMeta(meta, 'origin_country') ||
      originCountry
    const weightRaw = Number(readMeta(meta, 'weight_kg') || readMeta(meta, 'weight'))
    return {
      description: str(item.product_title || listingObj.title, `Item ${index + 1}`).slice(0, 200),
      sku: str(item.product_sku || item.listing_id, `sku-${index + 1}`),
      quantity: Number(item.quantity ?? 1) || 1,
      category: 'fashion',
      declared_currency: str(
        listingObj.currency || order.currency || shop.shop_currency,
        'INR',
      ).toUpperCase(),
      declared_customs_value: Math.max(
        0.01,
        Number(item.unit_price ?? 0) * (Number(item.quantity ?? 1) || 1),
      ),
      hs_code: hs.replace(/\D/g, '').padEnd(8, '0').slice(0, 8),
      origin_country_alpha2: origin.slice(0, 2),
      actual_weight:
        Number.isFinite(weightRaw) && weightRaw > 0 ? weightRaw : EASYSHIP_DEFAULT_WEIGHT_KG,
      dimensions: EASYSHIP_DEFAULT_DIMS,
    }
  })

  const totalWeight = parcelItems.reduce(
    (sum, it) => sum + (Number(it.actual_weight) || EASYSHIP_DEFAULT_WEIGHT_KG) * it.quantity,
    0,
  )

  const originAddress = {
    line_1: str(shopAddress.address_line_1, 'Warehouse'),
    line_2: str(shopAddress.address_line_2) || null,
    city: str(shopAddress.city, 'City'),
    state: str(shopAddress.state, ''),
    postal_code: str(shopAddress.postal_code, '000000'),
    country_alpha2: originCountry,
    company_name: str(shop.shop_name, 'Shop'),
    contact_name: str(shop.shop_name, 'Shop'),
    contact_phone: str(shop.shop_phone_number, '+910000000000'),
    contact_email: str(shop.shop_email, 'shipping@sheconomy.in'),
  }
  const destinationAddress = {
    line_1: str(shipping.address_line_1, 'Address'),
    line_2: str(shipping.address_line_2) || null,
    city: str(shipping.city, 'City'),
    state: str(shipping.state, ''),
    postal_code: str(shipping.postal_code, ''),
    country_alpha2: destCountry,
    contact_name: str(profile.full_name, 'Buyer'),
    contact_phone: str(profile.phone, '+10000000000'),
    contact_email: str(profile.email, 'buyer@example.com'),
  }

  try {
    const rates = await requestDdpRates(config, {
      origin_address: originAddress,
      destination_address: destinationAddress,
      parcels: [{ total_actual_weight: totalWeight || EASYSHIP_DEFAULT_WEIGHT_KG, items: parcelItems }],
      incoterms: 'DDP',
      calculate_tax_and_duties: true,
    })
    const best = pickBestDdpRate(rates)
    if (!best) {
      return jsonResponse({ error: 'No Easyship rates available for this shipment' }, 422)
    }

    const shipmentCharge = round2(
      Number(best.shipment_charge ?? best.total_charge ?? 0),
    )
    const courierServiceId =
      preferredCourierId || best.courier_service?.id || null

    const { data: walletRow } = await admin.rpc('platform_wallet_get_or_create', {
      p_owner_type: 'shop',
      p_owner_id: body.shopId,
      p_currency: 'INR',
    })
    const sellerBalance = Number(walletRow?.available_balance ?? 0)
    const walletCurrency = String(walletRow?.currency || 'INR')
    if (sellerBalance + 1e-9 < shipmentCharge) {
      return jsonResponse(
        insufficientShippingCreditResponse(
          `Wallet ${sellerBalance.toFixed(2)} is below freight ${shipmentCharge.toFixed(2)}. Top up under Vendor → Wallet to ship.`,
        ),
        402,
      )
    }

    // Carrier labels are funded only from the seller shipping wallet (0% platform commission).
    // Shared Easyship MOR balance is ops plumbing; never block with "platform retained DDP".
    const platformCredit = await getAccountCredit(config).catch(() => null)
    if (
      platformCredit &&
      platformCredit.availableBalance + 1e-9 < shipmentCharge
    ) {
      return jsonResponse(
        insufficientShippingCreditResponse(
          `Carrier wallet cannot cover freight ${shipmentCharge.toFixed(2)}. Top up shipping credit and retry.`,
        ),
        402,
      )
    }

    const created = await createShipment(config, {
      origin_address: originAddress,
      destination_address: destinationAddress,
      parcels: [{ total_actual_weight: totalWeight || EASYSHIP_DEFAULT_WEIGHT_KG, items: parcelItems }],
      courier_service_id: courierServiceId,
      buy_label: true,
    })

    const debitAmount = round2(
      Number(created.shipmentCharge ?? shipmentCharge),
    )
    const { data: debitResult, error: debitError } = await admin.rpc(
      'platform_wallet_debit',
      {
        p_owner_type: 'shop',
        p_owner_id: body.shopId,
        p_amount: debitAmount,
        p_entry_type: 'spend_shipping',
        p_idempotency_key: `spend_shipping:${created.easyshipShipmentId}`,
        p_currency: created.currency || walletCurrency || 'INR',
        p_description: 'Easyship shipping label',
        p_metadata: {
          easyship_shipment_id: created.easyshipShipmentId,
          rate: best,
          shipment: created.raw,
        },
        p_order_id: body.orderId,
        p_shop_id: body.shopId,
        p_campaign_id: null,
      },
    )
    if (debitError) {
      return jsonResponse({ error: debitError.message, shipment: created }, 500)
    }
    const debitJson = (debitResult ?? {}) as Record<string, unknown>
    if (debitJson.ok === false && debitJson.error === 'insufficient_credit') {
      return jsonResponse(insufficientShippingCreditResponse(), 402)
    }

    const now = new Date().toISOString()
    const deliveryPayload = {
      order_id: body.orderId,
      courier_name: created.courierName || best.courier_service?.name || 'Easyship',
      tracking_number: created.trackingNumber,
      tracking_url: created.labelUrl,
      shipping_status: 'shipped',
      shipping_cost: debitAmount,
      shipped_at: now,
      delivery_metadata: {
        courier_slug: 'easyship',
        notify_customer: true,
        easyship_shipment_id: created.easyshipShipmentId,
        label_state: created.labelState,
        label_url: created.labelUrl,
      },
      updated_at: now,
    }

    const deliveryRows: Array<{ id: string }> = []
    for (const item of items) {
      const { data: existing } = await admin
        .from('order_delivery')
        .select('id')
        .eq('order_item_id', item.id)
        .maybeSingle()

      if (existing?.id) {
        const { data: updated } = await admin
          .from('order_delivery')
          .update(deliveryPayload)
          .eq('id', existing.id)
          .select('id')
          .maybeSingle()
        if (updated) deliveryRows.push(updated)
      } else {
        const { data: inserted } = await admin
          .from('order_delivery')
          .insert({ ...deliveryPayload, order_item_id: item.id })
          .select('id')
          .maybeSingle()
        if (inserted) deliveryRows.push(inserted)
      }
    }

    return jsonResponse({
      success: true,
      easyshipShipmentId: created.easyshipShipmentId,
      trackingNumber: created.trackingNumber,
      labelUrl: created.labelUrl,
      courierName: created.courierName,
      freight: debitAmount,
      debit: debitJson,
      deliveryIds: deliveryRows.map((row) => row.id),
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Easyship fulfill failed'
    return jsonResponse({ error: message }, 502)
  }
})

function round2(n: number) {
  return Math.round((Number.isFinite(n) ? n : 0) * 100) / 100
}
