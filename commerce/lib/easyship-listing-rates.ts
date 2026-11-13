import { formatCurrency } from '~/lib/format'
import { supabase } from '~/lib/supabase/client'
import { isValidZip, normalizeZip } from '~/commerce/lib/delivery-zip'
import {
  formatGetItByLabel,
  shipsFromDetail,
  transitDaysFromLocations,
  type DeliveryGeoPoint,
} from '~/commerce/lib/location-delivery-estimate'

export type EasyshipListingRateQuote = {
  shop_id: string
  shipment_charge: number
  tax_amount: number
  duty_amount: number
  handling_fee: number
  shipping_amount: number
  total_charge: number
  currency: string
  courier_service_id: string | null
  courier_name: string | null
  estimated_days: number
  min_delivery_time: number | null
  max_delivery_time: number | null
}

export type WarehouseOrigin = DeliveryGeoPoint

export type DeliveryEstimate = {
  zip: string
  /** e.g. "Get it by Thu 19 Nov – Mon 23 Nov" */
  label: string
  earliestDays: number
  latestDays: number
  freeShippingEligible: boolean
  shippingAmount: number
  currency: string
  courierName: string | null
  /** Secondary line under the ETA. */
  detail: string
  source: 'location' | 'easyship' | 'digital'
}

type ListingRatesResponse = {
  ok?: boolean
  error?: string
  rates_error?: string | null
  requires_shipping?: boolean
  postal_code?: string
  country?: string
  origin?: {
    city?: string | null
    state?: string | null
    country?: string | null
    postal_code?: string | null
    latitude?: number | null
    longitude?: number | null
  } | null
  estimate?: {
    min_days?: number
    max_days?: number
    band?: string
    source?: string
  } | null
  quote?: EasyshipListingRateQuote | null
}

function quoteDetail(
  quote: EasyshipListingRateQuote,
  origin: WarehouseOrigin | null | undefined,
  zip: string,
): { freeShippingEligible: boolean; shippingAmount: number; currency: string; courierName: string | null; detail: string } {
  const total = Math.max(0, Number(quote.total_charge) || 0)
  const currency = (quote.currency || 'INR').toUpperCase()
  const freeShippingEligible = total <= 0
  const courier = quote.courier_name?.trim() || null
  const from = shipsFromDetail(origin, zip)

  let detail: string
  if (freeShippingEligible) {
    detail = courier ? `FREE delivery via ${courier}. ${from}` : `FREE delivery eligible. ${from}`
  } else {
    const amount = formatCurrency(total, currency, undefined, { convert: false })
    detail = courier
      ? `Shipping ${amount} via ${courier}. ${from}`
      : `Shipping ${amount}. ${from}`
  }

  return {
    freeShippingEligible,
    shippingAmount: total,
    currency,
    courierName: courier,
    detail: detail.trim(),
  }
}

/** Instant client ETA from current location + known warehouse (before/while API runs). */
export function estimateFromLocations(input: {
  postalCode: string
  destination: DeliveryGeoPoint
  origin?: WarehouseOrigin | null
  processingDays?: number
}): DeliveryEstimate | null {
  const zip = normalizeZip(input.postalCode)
  if (!isValidZip(zip)) return null

  const window = transitDaysFromLocations(
    input.origin,
    { ...input.destination, postalCode: zip },
    input.processingDays ?? 0,
  )

  return {
    zip,
    label: window.label,
    earliestDays: window.earliestDays,
    latestDays: window.latestDays,
    freeShippingEligible: false,
    shippingAmount: 0,
    currency: 'INR',
    courierName: null,
    detail: shipsFromDetail(input.origin, zip),
    source: 'location',
  }
}

/** Live warehouse + optional Easyship rate for a PDP listing + destination pin. */
export async function fetchEasyshipListingEstimate(input: {
  listingId: string
  postalCode: string
  country?: string
  quantity?: number
  city?: string | null
  state?: string | null
  latitude?: number | null
  longitude?: number | null
  /** Fallback origin from listing hydrate while waiting for edge. */
  originFallback?: WarehouseOrigin | null
}): Promise<{ estimate: DeliveryEstimate | null; error: string | null; ratesError: string | null }> {
  const zip = normalizeZip(input.postalCode)
  if (!input.listingId || !isValidZip(zip)) {
    return { estimate: null, error: 'Enter a valid postal code.', ratesError: null }
  }

  const dest: DeliveryGeoPoint = {
    postalCode: zip,
    country: (input.country || 'IN').toUpperCase().slice(0, 2),
    city: input.city,
    state: input.state,
    latitude: input.latitude,
    longitude: input.longitude,
  }

  const { data, error } = await supabase.functions.invoke<ListingRatesResponse>(
    'easyship-listing-rates',
    {
      body: {
        listing_id: input.listingId,
        postal_code: zip,
        country: dest.country,
        quantity: input.quantity ?? 1,
        city: input.city || undefined,
        state: input.state || undefined,
        latitude: Number.isFinite(Number(input.latitude)) ? Number(input.latitude) : undefined,
        longitude: Number.isFinite(Number(input.longitude)) ? Number(input.longitude) : undefined,
      },
    },
  )

  if (error && !data) {
    // Soft-fail to local location ETA so Get it by still shows.
    const local = estimateFromLocations({
      postalCode: zip,
      destination: dest,
      origin: input.originFallback,
    })
    return {
      estimate: local,
      error: local ? null : error.message || 'Could not load delivery estimate',
      ratesError: error.message || null,
    }
  }

  if (data?.error && !data?.estimate && !data?.ok) {
    const local = estimateFromLocations({
      postalCode: zip,
      destination: dest,
      origin: input.originFallback,
    })
    return {
      estimate: local,
      error: local ? null : data.error,
      ratesError: data.error,
    }
  }

  if (data?.requires_shipping === false) {
    return {
      estimate: {
        zip,
        label: 'No shipping required',
        earliestDays: 0,
        latestDays: 0,
        freeShippingEligible: true,
        shippingAmount: 0,
        currency: 'INR',
        courierName: null,
        detail: 'Digital item — available after purchase.',
        source: 'digital',
      },
      error: null,
      ratesError: null,
    }
  }

  const origin: WarehouseOrigin | null = data?.origin
    ? {
        city: data.origin.city,
        state: data.origin.state,
        country: data.origin.country,
        postalCode: data.origin.postal_code,
        latitude: data.origin.latitude,
        longitude: data.origin.longitude,
      }
    : input.originFallback ?? null

  const minDays = Math.max(
    1,
    Number(data?.estimate?.min_days) ||
      Number(data?.quote?.min_delivery_time) ||
      Number(data?.quote?.estimated_days) ||
      3,
  )
  const maxDays = Math.max(
    minDays,
    Number(data?.estimate?.max_days) ||
      Number(data?.quote?.max_delivery_time) ||
      Number(data?.quote?.estimated_days) ||
      minDays + 2,
  )

  if (data?.quote) {
    const priced = quoteDetail(data.quote, origin, zip)
    return {
      estimate: {
        zip,
        label: formatGetItByLabel(minDays, maxDays),
        earliestDays: minDays,
        latestDays: maxDays,
        ...priced,
        source: 'easyship',
      },
      error: null,
      ratesError: data.rates_error ?? null,
    }
  }

  const window = transitDaysFromLocations(origin, dest, 0)
  return {
    estimate: {
      zip,
      label: formatGetItByLabel(
        Number(data?.estimate?.min_days) || window.earliestDays,
        Number(data?.estimate?.max_days) || window.latestDays,
      ),
      earliestDays: Number(data?.estimate?.min_days) || window.earliestDays,
      latestDays: Number(data?.estimate?.max_days) || window.latestDays,
      freeShippingEligible: false,
      shippingAmount: 0,
      currency: 'INR',
      courierName: null,
      detail: shipsFromDetail(origin, zip),
      source: 'location',
    },
    error: null,
    ratesError: data?.rates_error ?? null,
  }
}
