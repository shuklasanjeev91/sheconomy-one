/**
 * POST /functions/v1/easyship-listing-rates
 * Public PDP: warehouse origin + location ETA; optional live Easyship quote.
 * Auth optional (anon ok). Only active listings.
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
  type EasyshipParcelItem,
} from '../_shared/easyship.ts'

type OriginAddress = {
  city: string | null
  state: string | null
  country: string
  postal_code: string | null
  latitude: number | null
  longitude: number | null
  line_1: string | null
}

function readMeta(meta: unknown, key: string): string {
  if (!meta || typeof meta !== 'object') return ''
  const value = (meta as Record<string, unknown>)[key]
  return typeof value === 'string' ? value.trim() : ''
}

function normalizePostal(raw: unknown): string {
  return String(raw ?? '')
    .trim()
    .replace(/\s+/g, '')
    .toUpperCase()
}

function normalizeCountry(raw: unknown): string {
  const code = String(raw ?? 'IN')
    .trim()
    .toUpperCase()
  if (code === 'IND' || code === 'INDIA') return 'IN'
  const sliced = code.slice(0, 2)
  return /^[A-Z]{2}$/.test(sliced) ? sliced : 'IN'
}

function normalizeText(raw?: string | null): string {
  return String(raw ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
}

function haversineKm(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number },
): number {
  const toRad = (d: number) => (d * Math.PI) / 180
  const R = 6371
  const dLat = toRad(b.latitude - a.latitude)
  const dLon = toRad(b.longitude - a.longitude)
  const lat1 = toRad(a.latitude)
  const lat2 = toRad(b.latitude)
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)))
}

/** Business-day transit window: buyer pin/location ↔ warehouse. */
function locationTransitDays(
  origin: OriginAddress,
  dest: {
    postal_code: string
    country: string
    city?: string | null
    state?: string | null
    latitude?: number | null
    longitude?: number | null
  },
  processing = 0,
): { min_days: number; max_days: number; band: string } {
  const destCountry = normalizeCountry(dest.country)
  const originCountry = normalizeCountry(origin.country)
  let min = 3
  let max = 5
  let band = 'national'

  const oLat = Number(origin.latitude)
  const oLng = Number(origin.longitude)
  const dLat = Number(dest.latitude)
  const dLng = Number(dest.longitude)
  const hasCoords =
    Number.isFinite(oLat) &&
    Number.isFinite(oLng) &&
    Number.isFinite(dLat) &&
    Number.isFinite(dLng)

  if (originCountry !== destCountry) {
    min = 7
    max = 12
    band = 'international'
  } else if (hasCoords) {
    const km = haversineKm(
      { latitude: oLat, longitude: oLng },
      { latitude: dLat, longitude: dLng },
    )
    if (km <= 40) {
      min = 1
      max = 2
      band = 'local'
    } else if (km <= 200) {
      min = 2
      max = 4
      band = 'regional'
    } else if (km <= 800) {
      min = 3
      max = 5
      band = 'national'
    } else {
      min = 4
      max = 7
      band = 'national'
    }
  } else {
    const oCity = normalizeText(origin.city)
    const dCity = normalizeText(dest.city)
    const oState = normalizeText(origin.state)
    const dState = normalizeText(dest.state)
    const oPin = normalizePostal(origin.postal_code)
    const dPin = normalizePostal(dest.postal_code)

    if (oCity && dCity && oCity === dCity) {
      min = 1
      max = 2
      band = 'local'
    } else if (oState && dState && oState === dState) {
      min = 2
      max = 4
      band = 'regional'
    } else if (oPin.length >= 2 && dPin.length >= 2 && oPin.slice(0, 2) === dPin.slice(0, 2)) {
      min = 2
      max = 4
      band = 'regional'
    } else {
      min = 3
      max = 6
      band = 'national'
    }
  }

  return {
    min_days: processing + min,
    max_days: processing + max,
    band,
  }
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405)

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !serviceRole) {
    return jsonResponse({ error: 'Service not configured' }, 503)
  }

  const body = (await request.json().catch(() => ({}))) as {
    listing_id?: string
    postal_code?: string
    country?: string
    quantity?: number
    city?: string
    state?: string
    latitude?: number
    longitude?: number
  }

  const listingId = typeof body.listing_id === 'string' ? body.listing_id.trim() : ''
  const postalCode = normalizePostal(body.postal_code)
  const country = normalizeCountry(body.country)
  const quantity = Math.max(1, Math.min(99, Math.floor(Number(body.quantity) || 1)))
  const destCity = typeof body.city === 'string' ? body.city.trim() : ''
  const destState = typeof body.state === 'string' ? body.state.trim() : ''
  const destLat = Number(body.latitude)
  const destLng = Number(body.longitude)

  if (!listingId) return jsonResponse({ error: 'listing_id is required' }, 400)
  if (postalCode.length < 4 || postalCode.length > 10) {
    return jsonResponse({ error: 'Enter a valid postal code' }, 400)
  }

  const admin = createClient(supabaseUrl, serviceRole, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { data: listing, error: listingError } = await admin
    .from('listings')
    .select(
      'id, title, price, shop_id, listing_type, shipping_required, listing_metadata, weight, dimensions, listing_status, is_active',
    )
    .eq('id', listingId)
    .maybeSingle()

  if (listingError) return jsonResponse({ error: listingError.message }, 400)
  if (!listing || listing.listing_status !== 'active' || listing.is_active === false) {
    return jsonResponse({ error: 'Listing not found' }, 404)
  }
  if (listing.listing_type === 'digital' || listing.shipping_required === false) {
    return jsonResponse({
      ok: true,
      requires_shipping: false,
      postal_code: postalCode,
      country,
      quote: null,
      origin: null,
      estimate: { min_days: 0, max_days: 0, band: 'digital', source: 'digital' },
    })
  }

  const { data: shop, error: shopError } = await admin
    .from('shops')
    .select('id, shop_name, shop_email, shop_phone_number, shop_address_id, shop_currency, user_id')
    .eq('id', listing.shop_id)
    .maybeSingle()

  if (shopError) return jsonResponse({ error: shopError.message }, 400)
  if (!shop) return jsonResponse({ error: 'Shop not found' }, 404)

  // Warehouse: shop_addresses (id = shop id) → addresses via shop_address_id → seller address
  let origin: OriginAddress = {
    city: null,
    state: null,
    country: 'IN',
    postal_code: null,
    latitude: null,
    longitude: null,
    line_1: null,
  }

  const { data: shopAddressRow } = await admin
    .from('shop_addresses')
    .select('city, state, country, postal_code, latitude, longitude')
    .eq('id', shop.id)
    .maybeSingle()

  if (shopAddressRow) {
    origin = {
      city: (shopAddressRow.city as string) || null,
      state: (shopAddressRow.state as string) || null,
      country: normalizeCountry(shopAddressRow.country) || 'IN',
      postal_code: normalizePostal(shopAddressRow.postal_code) || null,
      latitude: Number.isFinite(Number(shopAddressRow.latitude))
        ? Number(shopAddressRow.latitude)
        : null,
      longitude: Number.isFinite(Number(shopAddressRow.longitude))
        ? Number(shopAddressRow.longitude)
        : null,
      line_1: null,
    }
  }

  if (shop.shop_address_id) {
    const { data } = await admin
      .from('addresses')
      .select('address_line_1, city, state, country, postal_code, latitude, longitude')
      .eq('id', shop.shop_address_id)
      .maybeSingle()
    if (data) {
      origin = {
        city: (data.city as string) || origin.city,
        state: (data.state as string) || origin.state,
        country: normalizeCountry(data.country) || origin.country,
        postal_code: normalizePostal(data.postal_code) || origin.postal_code,
        latitude: Number.isFinite(Number(data.latitude))
          ? Number(data.latitude)
          : origin.latitude,
        longitude: Number.isFinite(Number(data.longitude))
          ? Number(data.longitude)
          : origin.longitude,
        line_1: (data.address_line_1 as string) || null,
      }
    }
  }

  if (!origin.city && !origin.postal_code && shop.user_id) {
    const { data: sellerAddr } = await admin
      .from('addresses')
      .select('address_line_1, city, state, country, postal_code, latitude, longitude')
      .eq('user_id', shop.user_id)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (sellerAddr) {
      origin = {
        city: (sellerAddr.city as string) || null,
        state: (sellerAddr.state as string) || null,
        country: normalizeCountry(sellerAddr.country) || 'IN',
        postal_code: normalizePostal(sellerAddr.postal_code) || null,
        latitude: Number.isFinite(Number(sellerAddr.latitude))
          ? Number(sellerAddr.latitude)
          : null,
        longitude: Number.isFinite(Number(sellerAddr.longitude))
          ? Number(sellerAddr.longitude)
          : null,
        line_1: (sellerAddr.address_line_1 as string) || null,
      }
    }
  }

  const { data: profile } = await admin
    .from('delivery_profiles')
    .select('processing_time_min, processing_time_max, is_default, is_active')
    .eq('shop_id', shop.id)
    .eq('is_active', true)
    .order('is_default', { ascending: false })
    .limit(1)
    .maybeSingle()

  const processing = Math.max(0, Number(profile?.processing_time_min) || 0)

  const locationEstimate = locationTransitDays(
    origin,
    {
      postal_code: postalCode,
      country,
      city: destCity || null,
      state: destState || null,
      latitude: Number.isFinite(destLat) ? destLat : null,
      longitude: Number.isFinite(destLng) ? destLng : null,
    },
    processing,
  )

  const basePayload = {
    ok: true,
    requires_shipping: true,
    postal_code: postalCode,
    country,
    origin: {
      city: origin.city,
      state: origin.state,
      country: origin.country,
      postal_code: origin.postal_code,
      latitude: origin.latitude,
      longitude: origin.longitude,
    },
    estimate: {
      ...locationEstimate,
      source: 'location' as const,
    },
    quote: null as ReturnType<typeof rateToDdpShopQuote> | null,
    rates_error: null as string | null,
  }

  const config = resolveEasyshipConfig()
  if (!config) {
    return jsonResponse({
      ...basePayload,
      rates_error: 'Easyship is not configured',
    })
  }

  const meta = listing.listing_metadata
  const hs = readMeta(meta, 'hs_code') || '99999900'
  const originCountryAlpha =
    readMeta(meta, 'country_of_origin') ||
    readMeta(meta, 'origin_country') ||
    origin.country
  const weightFromMeta = Number(readMeta(meta, 'weight_kg') || readMeta(meta, 'weight'))
  const weightCol = Number(listing.weight)
  const weightRaw =
    Number.isFinite(weightCol) && weightCol > 0
      ? weightCol
      : Number.isFinite(weightFromMeta) && weightFromMeta > 0
        ? weightFromMeta
        : EASYSHIP_DEFAULT_WEIGHT_KG

  let dims = EASYSHIP_DEFAULT_DIMS
  const rawDims = listing.dimensions
  if (rawDims && typeof rawDims === 'object' && !Array.isArray(rawDims)) {
    const d = rawDims as Record<string, unknown>
    const length = Number(d.length ?? d.l)
    const width = Number(d.width ?? d.w)
    const height = Number(d.height ?? d.h)
    if (length > 0 && width > 0 && height > 0) {
      dims = { length, width, height }
    }
  }

  const item: EasyshipParcelItem = {
    description: String(listing.title || 'Item').slice(0, 200),
    quantity,
    declared_currency: String(shop.shop_currency || 'INR').toUpperCase(),
    declared_customs_value: Math.max(0.01, Number(listing.price) * quantity),
    hs_code: hs.replace(/\D/g, '').padEnd(8, '0').slice(0, 8),
    origin_country_alpha2: originCountryAlpha.slice(0, 2),
    actual_weight: weightRaw,
    dimensions: dims,
  }

  const sameCountry = origin.country === country
  try {
    const rates = await requestDdpRates(config, {
      origin_address: {
        line_1: String(origin.line_1 || 'Warehouse'),
        city: String(origin.city || destCity || 'City'),
        state: String(origin.state || ''),
        postal_code: String(origin.postal_code || ''),
        country_alpha2: origin.country,
        contact_name: String(shop.shop_name || 'Seller'),
        contact_phone: String(shop.shop_phone_number || ''),
        contact_email: String(shop.shop_email || ''),
      },
      destination_address: {
        line_1: 'Address',
        city: String(destCity || postalCode),
        state: String(destState || ''),
        postal_code: postalCode,
        country_alpha2: country,
        contact_name: 'Buyer',
        contact_phone: '',
      },
      parcels: [{ items: [item] }],
      incoterms: sameCountry ? 'DDU' : 'DDP',
      calculate_tax_and_duties: !sameCountry,
    })

    const best = pickBestDdpRate(rates)
    if (!best) {
      return jsonResponse({
        ...basePayload,
        rates_error: 'No courier rates available for this pin code',
      })
    }

    const quote = rateToDdpShopQuote(String(shop.id), best)
    const minDays = Math.max(
      1,
      Number(best.min_delivery_time ?? quote.min_delivery_time ?? locationEstimate.min_days) ||
        locationEstimate.min_days,
    )
    const maxDays = Math.max(
      minDays,
      Number(best.max_delivery_time ?? quote.max_delivery_time ?? locationEstimate.max_days) ||
        locationEstimate.max_days,
    )

    return jsonResponse({
      ...basePayload,
      quote: {
        ...quote,
        min_delivery_time: best.min_delivery_time ?? quote.min_delivery_time,
        max_delivery_time: best.max_delivery_time ?? quote.max_delivery_time,
      },
      estimate: {
        min_days: minDays,
        max_days: maxDays,
        band: locationEstimate.band,
        source: 'easyship',
      },
    })
  } catch (err) {
    const raw = err instanceof Error ? err.message : 'Easyship rates failed'
    const lower = raw.toLowerCase()
    const message =
      lower.includes('subscription is not active') || lower.includes('billing')
        ? 'Live courier rates are temporarily unavailable. Final shipping is confirmed at checkout.'
        : lower.includes('no rate') || lower.includes('no courier')
          ? 'No courier rates available for this pin code'
          : raw.length > 180
            ? 'Could not load a live delivery estimate. Final shipping is confirmed at checkout.'
            : raw
    // Always keep location-based Get it by even when rates fail.
    return jsonResponse({
      ...basePayload,
      rates_error: message,
    })
  }
})
