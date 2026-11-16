/**
 * POST /functions/v1/easyship-process-shipment
 * Vendor JWT: re-rate, gate on seller shipping credit + platform Easyship balance,
 * create shipment/label, debit ledger, write order_delivery.
 */
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'

import { corsHeaders, jsonResponse } from '../_shared/cors.ts'
import {
  ShipAddressError,
  resolveBuyerDestination,
  resolveSellerOrigin,
  shipAddressErrorResponse,
  toEasyshipApiAddress,
} from '../_shared/easyship-addresses.ts'
import {
  EASYSHIP_DEFAULT_DIMS,
  EASYSHIP_DEFAULT_WEIGHT_KG,
  createShipment,
  getAccountCredit,
  insufficientShippingCreditResponse,
  pickBestDdpRate,
  requestDdpRates,
  resolveEasyshipConfig,
  withEasyshipCompany,
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
      'id, user_id, shop_name, shop_email, shop_phone_number, shop_address_id, shop_currency, easyship_company_id',
    )
    .eq('id', body.shopId)
    .maybeSingle()
  if (!shop || shop.user_id !== user.id) {
    return jsonResponse({ error: 'Shop not found' }, 404)
  }

  // Prefer shop child company (seller-funded EasyShip). Fall back to platform MOR.
  const shopCompanyId = String(shop.easyship_company_id ?? '').trim() || null
  const shipConfig = withEasyshipCompany(config, shopCompanyId)

  let itemsQuery = admin
    .from('order_items')
    .select(
      'id, order_id, vendor_id, listing_id, quantity, unit_price, item_status, product_title, product_sku, listings(title, listing_metadata, product_info, weight, dimensions)',
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

  // Avoid embedding profiles via orders.user_id — that column has two FKs
  // (auth.users + profiles), so PostgREST returns an embed error and data=null,
  // which previously surfaced as a misleading "Order not found".
  const { data: order, error: orderError } = await admin
    .from('orders')
    .select('id, order_number, user_id, shipping_amount, currency, order_metadata, shipping_address_id')
    .eq('id', body.orderId)
    .maybeSingle()
  if (orderError) return jsonResponse({ error: orderError.message }, 500)
  if (!order) return jsonResponse({ error: 'Order not found' }, 404)

  let originResolved
  let destResolved
  try {
    originResolved = await resolveSellerOrigin(admin, shop)
    destResolved = await resolveBuyerDestination(admin, order)
  } catch (err) {
    if (err instanceof ShipAddressError) {
      return jsonResponse(shipAddressErrorResponse(err), 400)
    }
    throw err
  }

  const originCountry = originResolved.address.country_alpha2
  const orderMeta = asAddress(order.order_metadata)
  const easyshipMeta = asAddress(orderMeta.easyship)
  const preferredCourierId = str(easyshipMeta.courier_service_id) || null

  const parcelItems: EasyshipParcelItem[] = items.map((item, index) => {
    const listing = Array.isArray(item.listings) ? item.listings[0] : item.listings
    const listingObj = (listing ?? {}) as Record<string, unknown>
    const meta = listingObj.listing_metadata
    const productInfo = listingObj.product_info
    const hs = readMeta(meta, 'hs_code') || '99999900'
    const origin =
      readMeta(meta, 'country_of_origin') ||
      readMeta(meta, 'origin_country') ||
      readMeta(productInfo, 'countryOfOrigin') ||
      readMeta(productInfo, 'country_of_origin') ||
      originCountry
    const weightCol = Number(listingObj.weight)
    const weightFromMeta = Number(readMeta(meta, 'weight_kg') || readMeta(meta, 'weight'))
    const weightRaw =
      Number.isFinite(weightCol) && weightCol > 0
        ? weightCol
        : Number.isFinite(weightFromMeta) && weightFromMeta > 0
          ? weightFromMeta
          : EASYSHIP_DEFAULT_WEIGHT_KG
    let dims = EASYSHIP_DEFAULT_DIMS
    const rawDims = listingObj.dimensions
    if (rawDims && typeof rawDims === 'object' && !Array.isArray(rawDims)) {
      const d = rawDims as Record<string, unknown>
      const length = Number(d.length ?? d.l)
      const width = Number(d.width ?? d.w)
      const height = Number(d.height ?? d.h)
      if (length > 0 && width > 0 && height > 0) {
        dims = { length, width, height }
      }
    }
    return {
      description: str(item.product_title || listingObj.title, `Item ${index + 1}`).slice(0, 200),
      sku: str(item.product_sku || item.listing_id, `sku-${index + 1}`),
      quantity: Number(item.quantity ?? 1) || 1,
      category: 'fashion',
      declared_currency: str(order.currency || shop.shop_currency, 'INR').toUpperCase(),
      declared_customs_value: Math.max(
        0.01,
        Number(item.unit_price ?? 0) * (Number(item.quantity ?? 1) || 1),
      ),
      hs_code: hs.replace(/\D/g, '').padEnd(8, '0').slice(0, 8),
      origin_country_alpha2: origin.slice(0, 2),
      actual_weight: weightRaw,
      dimensions: dims,
    }
  })

  const totalWeight = parcelItems.reduce(
    (sum, it) => sum + (Number(it.actual_weight) || EASYSHIP_DEFAULT_WEIGHT_KG) * it.quantity,
    0,
  )

  const originAddress = toEasyshipApiAddress(originResolved.address)
  const destinationAddress = toEasyshipApiAddress(destResolved.address)

  try {
    const rates = await requestDdpRates(shipConfig, {
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

    // Gate on the EasyShip company that will be charged (shop child when linked,
    // else platform MOR). Seller-funded child = SHEconomy does not float freight.
    const carrierCredit = await getAccountCredit(shipConfig).catch(() => null)
    if (
      carrierCredit &&
      carrierCredit.availableBalance + 1e-9 < shipmentCharge
    ) {
      return jsonResponse(
        insufficientShippingCreditResponse(
          shopCompanyId
            ? `EasyShip credit ${carrierCredit.availableBalance.toFixed(2)} is below freight ${shipmentCharge.toFixed(2)}. Top up EasyShip from Vendor → Wallet.`
            : `Platform EasyShip credit ${carrierCredit.availableBalance.toFixed(2)} is below freight ${shipmentCharge.toFixed(2)}. Link seller EasyShip accounts (partner) or top up the MOR account.`,
        ),
        402,
      )
    }

    const created = await createShipment(shipConfig, {
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
    const carrierName =
      created.courierName || best.courier_service?.name || 'Easyship'
    const deliveryPayload = {
      order_id: body.orderId,
      delivery_status: 'shipped',
      carrier_name: carrierName,
      courier_service_name: carrierName,
      tracking_number: created.trackingNumber,
      awb_code: created.trackingNumber,
      // Label PDF is not a public track URL — leave null until webhook/sync fills it.
      carrier_tracking_url: null as string | null,
      label_url: created.labelUrl,
      invoice_url: created.invoiceUrl,
      shipping_cost: debitAmount,
      shipped_at: now,
      status_history: [
        {
          status: 'shipped',
          at: now,
          note: created.trackingNumber
            ? `Label purchased · tracking ${created.trackingNumber}`
            : 'Shipping label purchased via Easyship',
          source: 'easyship-process-shipment',
        },
      ],
      delivery_metadata: {
        courier_slug: 'easyship',
        notify_customer: true,
        easyship_shipment_id: created.easyshipShipmentId,
        label_state: created.labelState,
        label_url: created.labelUrl,
        invoice_url: created.invoiceUrl,
        auto_tracking: true,
        origin_source: originResolved.source,
        origin_warehouse_id: originResolved.warehouseId,
        origin_address_id: originResolved.addressId,
        destination_address_id: destResolved.addressId,
        origin_snapshot: {
          line_1: originResolved.address.line_1,
          city: originResolved.address.city,
          state: originResolved.address.state,
          postal_code: originResolved.address.postal_code,
          country_alpha2: originResolved.address.country_alpha2,
        },
        destination_snapshot: {
          line_1: destResolved.address.line_1,
          city: destResolved.address.city,
          state: destResolved.address.state,
          postal_code: destResolved.address.postal_code,
          country_alpha2: destResolved.address.country_alpha2,
        },
      },
      updated_at: now,
    }

    const deliveryRows: Array<{ id: string }> = []
    for (const item of items) {
      const { data: existing } = await admin
        .from('order_delivery')
        .select('id, delivery_metadata, status_history')
        .eq('order_item_id', item.id)
        .maybeSingle()

      if (existing?.id) {
        const prevMeta =
          existing.delivery_metadata &&
            typeof existing.delivery_metadata === 'object' &&
            !Array.isArray(existing.delivery_metadata)
            ? (existing.delivery_metadata as Record<string, unknown>)
            : {}
        const prevHistory = Array.isArray(existing.status_history)
          ? existing.status_history
          : []
        const { data: updated } = await admin
          .from('order_delivery')
          .update({
            ...deliveryPayload,
            delivery_metadata: { ...prevMeta, ...deliveryPayload.delivery_metadata },
            status_history: [...prevHistory, ...deliveryPayload.status_history],
          })
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

      // Advance item into shipped; delivery trigger also syncs, but do it eagerly.
      await admin
        .from('order_items')
        .update({ item_status: 'shipped', updated_at: now })
        .eq('id', item.id)
        .not('item_status', 'in', '("cancelled","refunded","delivered")')
    }

    await admin
      .from('orders')
      .update({ order_status: 'shipped', updated_at: now })
      .eq('id', body.orderId)
      .not('order_status', 'in', '("cancelled","refunded","delivered")')

    return jsonResponse({
      success: true,
      easyshipShipmentId: created.easyshipShipmentId,
      trackingNumber: created.trackingNumber,
      labelUrl: created.labelUrl,
      invoiceUrl: created.invoiceUrl,
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
