/**
 * POST /functions/v1/easyship-ddp-rates
 * Buyer JWT: DDP landed-cost quotes per shop for selected cart lines + address.
 */
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'

import { corsHeaders, jsonResponse } from '../_shared/cors.ts'
import {
  ShipAddressError,
  buildBuyerDestinationFromAddressRow,
  resolveSellerOrigin,
  toEasyshipApiAddress,
} from '../_shared/easyship-addresses.ts'
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
    .select('id, address_line_1, address_line_2, city, state, country, postal_code, latitude, longitude')
    .eq('id', shippingAddressId)
    .eq('user_id', userData.user.id)
    .maybeSingle()
  if (addressError || !address) {
    return jsonResponse({ error: 'Shipping address not found' }, 400)
  }

  const { data: profile } = await admin
    .from('profiles')
    .select('full_name, email, phone')
    .eq('id', userData.user.id)
    .maybeSingle()

  let destResolved
  try {
    destResolved = buildBuyerDestinationFromAddressRow(address as Record<string, unknown>, {
      full_name: profile?.full_name,
      phone: profile?.phone,
      email: profile?.email,
    })
  } catch (err) {
    if (err instanceof ShipAddressError) {
      return jsonResponse({ error: err.message, code: err.code }, 400)
    }
    throw err
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
    .select(
      'id, title, price, shop_id, listing_type, shipping_required, listing_metadata, product_info, weight, dimensions',
    )
    .in('id', listingIds)

  const { data: shops } = await admin
    .from('shops')
    .select('id, shop_name, shop_email, shop_phone_number, shop_address_id, shop_currency')
    .in('id', shopIds)

  const listingById = new Map((listings ?? []).map((l) => [l.id as string, l]))
  const shopById = new Map((shops ?? []).map((s) => [s.id as string, s]))

  const destinationAddress = toEasyshipApiAddress(destResolved.address)
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

    let originResolved
    try {
      if (!shop) throw new ShipAddressError('seller_origin_incomplete', 'Shop not found')
      originResolved = await resolveSellerOrigin(admin, shop)
    } catch (err) {
      const message =
        err instanceof ShipAddressError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'Seller origin incomplete'
      warnings.push(`Shop ${shopId}: ${message}`)
      return jsonResponse(
        {
          error: message,
          code: err instanceof ShipAddressError ? err.code : 'seller_origin_incomplete',
          warnings,
        },
        400,
      )
    }

    const originCountry = originResolved.address.country_alpha2
    const originAddress = toEasyshipApiAddress(originResolved.address)

    const items: EasyshipParcelItem[] = physical.map((line) => {
      const listing = listingById.get(line.listing_id)
      const meta = listing?.listing_metadata
      const productInfo = listing?.product_info
      const hs = readMeta(meta, 'hs_code') || '99999900'
      const origin =
        readMeta(meta, 'country_of_origin') ||
        readMeta(meta, 'origin_country') ||
        readMeta(productInfo, 'countryOfOrigin') ||
        readMeta(productInfo, 'country_of_origin') ||
        originCountry
      if (!readMeta(meta, 'hs_code')) {
        warnings.push(`Listing ${line.listing_id} missing hs_code; using fallback`)
      }
      const weightCol = Number(listing?.weight)
      const weightFromMeta = Number(readMeta(meta, 'weight_kg') || readMeta(meta, 'weight'))
      const weightRaw =
        Number.isFinite(weightCol) && weightCol > 0
          ? weightCol
          : Number.isFinite(weightFromMeta) && weightFromMeta > 0
            ? weightFromMeta
            : EASYSHIP_DEFAULT_WEIGHT_KG
      return {
        description: String(listing?.title || 'Item').slice(0, 200),
        quantity: line.quantity,
        declared_currency: String(shop?.shop_currency || 'INR').toUpperCase(),
        declared_customs_value: Math.max(
          0.01,
          Number(line.unit_price) * Number(line.quantity),
        ),
        hs_code: hs.replace(/\D/g, '').padEnd(8, '0').slice(0, 8),
        origin_country_alpha2: origin.slice(0, 2),
        actual_weight: weightRaw,
        dimensions: EASYSHIP_DEFAULT_DIMS,
      }
    })

    try {
      const rates = await requestDdpRates(config, {
        origin_address: originAddress,
        destination_address: destinationAddress,
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
