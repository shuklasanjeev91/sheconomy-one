/**
 * POST /functions/v1/easyship-ddp-rates
 * Buyer JWT: DDP landed-cost quotes per shop for selected cart lines + address.
 */
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'

import { corsHeaders, jsonResponse } from '../_shared/cors.ts'
import {
  EASYSHIP_DEFAULT_DIMS,
  EASYSHIP_DEFAULT_WEIGHT_KG,
  pickBestDdpRate,
  rateToDdpShopQuote,
  requestDdpRates,
  resolveEasyshipConfig,
  type DdpShopQuote,
  type EasyshipParcelItem,
} from '../_shared/easyship.ts'

type CartLine = {
  id: string
  listing_id: string
  shop_id: string
  quantity: number
  unit_price: number
}

function countryFromAddress(row: Record<string, unknown> | null): string {
  const raw =
    (row?.country_code as string) ||
    (row?.country as string) ||
    (row?.country_alpha2 as string) ||
    'IN'
  return String(raw).trim().toUpperCase().slice(0, 2) || 'IN'
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
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !anonKey || !serviceRole) {
    return jsonResponse({ error: 'Service not configured' }, 503)
  }

  const config = resolveEasyshipConfig()
  if (!config) return jsonResponse({ error: 'Easyship is not configured' }, 503)

  const authHeader = request.headers.get('Authorization')
  if (!authHeader) return jsonResponse({ error: 'Unauthorized' }, 401)

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data: userData, error: userError } = await userClient.auth.getUser()
  if (userError || !userData.user) return jsonResponse({ error: 'Unauthorized' }, 401)

  const admin = createClient(supabaseUrl, serviceRole, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const body = (await request.json().catch(() => ({}))) as {
    cart_item_ids?: string[]
    shipping_address_id?: string
  }
  const cartItemIds = Array.isArray(body.cart_item_ids)
    ? body.cart_item_ids.filter((id) => typeof id === 'string')
    : []
  const shippingAddressId =
    typeof body.shipping_address_id === 'string' ? body.shipping_address_id : ''
  if (!cartItemIds.length || !shippingAddressId) {
    return jsonResponse({ error: 'cart_item_ids and shipping_address_id are required' }, 400)
  }

  const { data: address, error: addressError } = await admin
    .from('addresses')
    .select('*')
    .eq('id', shippingAddressId)
    .eq('user_id', userData.user.id)
    .maybeSingle()
  if (addressError || !address) {
    return jsonResponse({ error: 'Shipping address not found' }, 400)
  }

  const { data: lines, error: linesError } = await admin
    .from('cart_items')
    .select('id, listing_id, shop_id, quantity, unit_price, carts!inner(user_id)')
    .in('id', cartItemIds)
    .eq('carts.user_id', userData.user.id)
  if (linesError) return jsonResponse({ error: linesError.message }, 400)

  const cartLines = (lines ?? []) as unknown as CartLine[]
  if (!cartLines.length) return jsonResponse({ error: 'No cart items found' }, 400)

  const listingIds = [...new Set(cartLines.map((l) => l.listing_id))]
  const shopIds = [...new Set(cartLines.map((l) => l.shop_id).filter(Boolean))]

  const { data: listings } = await admin
    .from('listings')
    .select('id, title, price, shop_id, listing_type, shipping_required, metadata, currency')
    .in('id', listingIds)

  const { data: shops } = await admin
    .from('shops')
    .select('id, shop_name, shop_email, shop_phone_number, shop_address_id, shop_currency')
    .in('id', shopIds)

  const addressIds = [...new Set((shops ?? []).map((s) => s.shop_address_id).filter(Boolean))] as string[]
  const { data: shopAddresses } = addressIds.length
    ? await admin
        .from('addresses')
        .select('id, address_line_1, address_line_2, city, state, country, postal_code')
        .in('id', addressIds)
    : { data: [] as Array<Record<string, unknown>> }
  const shopAddressById = new Map((shopAddresses ?? []).map((a) => [a.id as string, a]))

  const listingById = new Map((listings ?? []).map((l) => [l.id as string, l]))
  const shopById = new Map((shops ?? []).map((s) => [s.id as string, s]))

  const destCountry = countryFromAddress(address as Record<string, unknown>)
  const byShop = new Map<string, CartLine[]>()
  for (const line of cartLines) {
    const list = byShop.get(line.shop_id) ?? []
    list.push(line)
    byShop.set(line.shop_id, list)
  }

  const quotes: DdpShopQuote[] = []
  const warnings: string[] = []

  for (const [shopId, shopLines] of byShop) {
    const shop = shopById.get(shopId)
    const physical = shopLines.filter((line) => {
      const listing = listingById.get(line.listing_id)
      if (!listing) return false
      if (listing.listing_type === 'digital') return false
      return listing.shipping_required !== false
    })
    if (!physical.length) {
      quotes.push({
        shop_id: shopId,
        shipment_charge: 0,
        tax_amount: 0,
        duty_amount: 0,
        handling_fee: 0,
        shipping_amount: 0,
        total_charge: 0,
        currency: 'USD',
        courier_service_id: null,
        courier_name: null,
        estimated_days: 0,
        min_delivery_time: null,
        max_delivery_time: null,
      })
      continue
    }

    const shopAddr = shop?.shop_address_id
      ? shopAddressById.get(String(shop.shop_address_id))
      : null
    const originCountry = String(
      (shopAddr as { country?: string } | undefined)?.country || 'IN',
    )
      .trim()
      .toUpperCase()
      .slice(0, 2)

    const items: EasyshipParcelItem[] = physical.map((line) => {
      const listing = listingById.get(line.listing_id)
      const meta = listing?.metadata
      const hs = readMeta(meta, 'hs_code') || '99999900'
      const origin =
        readMeta(meta, 'country_of_origin') ||
        readMeta(meta, 'origin_country') ||
        originCountry
      if (!readMeta(meta, 'hs_code')) {
        warnings.push(`Listing ${line.listing_id} missing hs_code; using fallback`)
      }
      const weightRaw = Number(readMeta(meta, 'weight_kg') || readMeta(meta, 'weight'))
      return {
        description: String(listing?.title || 'Item').slice(0, 200),
        quantity: line.quantity,
        declared_currency: String(listing?.currency || 'INR').toUpperCase(),
        declared_customs_value: Math.max(
          0.01,
          Number(line.unit_price) * Number(line.quantity),
        ),
        hs_code: hs.replace(/\D/g, '').padEnd(8, '0').slice(0, 8),
        origin_country_alpha2: origin.slice(0, 2),
        actual_weight: Number.isFinite(weightRaw) && weightRaw > 0
          ? weightRaw
          : EASYSHIP_DEFAULT_WEIGHT_KG,
        dimensions: EASYSHIP_DEFAULT_DIMS,
      }
    })

    try {
      const rates = await requestDdpRates(config, {
        origin_address: {
          line_1: String(
            (shopAddr as { address_line_1?: string } | undefined)?.address_line_1 || 'Warehouse',
          ),
          city: String((shopAddr as { city?: string } | undefined)?.city || 'City'),
          state: String((shopAddr as { state?: string } | undefined)?.state || ''),
          postal_code: String(
            (shopAddr as { postal_code?: string } | undefined)?.postal_code || '',
          ),
          country_alpha2: originCountry,
          contact_name: String((shop as { shop_name?: string } | undefined)?.shop_name || 'Seller'),
          contact_phone: String(
            (shop as { shop_phone_number?: string } | undefined)?.shop_phone_number || '',
          ),
          contact_email: String((shop as { shop_email?: string } | undefined)?.shop_email || ''),
        },
        destination_address: {
          line_1: String(
            (address as { address_line1?: string; line1?: string }).address_line1 ||
              (address as { line1?: string }).line1 ||
              'Address',
          ),
          line_2:
            (address as { address_line2?: string }).address_line2 ||
            (address as { line2?: string }).line2 ||
            null,
          city: String((address as { city?: string }).city || ''),
          state: String((address as { state?: string }).state || ''),
          postal_code: String(
            (address as { postal_code?: string; pincode?: string }).postal_code ||
              (address as { pincode?: string }).pincode ||
              '',
          ),
          country_alpha2: destCountry,
          contact_name: String((address as { full_name?: string }).full_name || 'Buyer'),
          contact_phone: String((address as { phone?: string }).phone || ''),
        },
        parcels: [{ items }],
        incoterms: 'DDP',
        calculate_tax_and_duties: true,
      })

      const best = pickBestDdpRate(rates)
      if (!best) {
        warnings.push(`No Easyship rates for shop ${shopId}`)
        quotes.push({
          shop_id: shopId,
          shipment_charge: 0,
          tax_amount: 0,
          duty_amount: 0,
          handling_fee: 0,
          shipping_amount: 0,
          total_charge: 0,
          currency: 'USD',
          courier_service_id: null,
          courier_name: null,
          estimated_days: 7,
          min_delivery_time: null,
          max_delivery_time: null,
        })
        continue
      }
      quotes.push(rateToDdpShopQuote(shopId, best))
    } catch (err) {
      const message = err instanceof Error ? err.message : 'rates failed'
      warnings.push(`Shop ${shopId}: ${message}`)
      return jsonResponse({ error: message, warnings }, 502)
    }
  }

  const by_shop: Record<string, DdpShopQuote> = {}
  for (const q of quotes) by_shop[q.shop_id] = q

  return jsonResponse({
    ok: true,
    by_shop,
    quotes,
    shipping_total: quotes.reduce((s, q) => s + q.total_charge, 0),
    warnings,
  })
})
