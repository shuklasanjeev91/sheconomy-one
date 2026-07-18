/** SHEdelivery partner adapters — request/response mappers (platform credentials via edge). */

import { supabase } from '~/lib/supabase/client'

export type SheDeliveryPartner = 'shiprocket' | 'pickrr'

export type CreateShipmentInput = {
  orderId: string
  orderNumber?: string | null
  shopId: string
  partner?: SheDeliveryPartner
  pickupPostcode: string
  deliveryPostcode: string
  weightKg: number
  paymentMethod: 'prepaid' | 'cod'
  codAmount?: number
  customerName: string
  customerPhone: string
  customerEmail?: string
  addressLine1: string
  addressLine2?: string
  city: string
  state: string
  country?: string
  items: Array<{ name: string; sku?: string; units: number; sellingPrice: number }>
}

export type CreateShipmentResult = {
  partner: SheDeliveryPartner
  shipmentId: string
  awb?: string | null
  trackingUrl?: string | null
  raw?: unknown
}

export type TrackingEvent = {
  status: string
  location?: string | null
  occurredAt?: string | null
  remark?: string | null
}

/** Map our create payload → Shiprocket create-order body shape. */
export function toShiprocketCreateOrderBody(input: CreateShipmentInput) {
  return {
    order_id: input.orderNumber || input.orderId,
    order_date: new Date().toISOString().slice(0, 10),
    pickup_location: 'Primary',
    billing_customer_name: input.customerName,
    billing_last_name: '',
    billing_address: input.addressLine1,
    billing_address_2: input.addressLine2 ?? '',
    billing_city: input.city,
    billing_pincode: input.deliveryPostcode,
    billing_state: input.state,
    billing_country: input.country ?? 'India',
    billing_email: input.customerEmail ?? '',
    billing_phone: input.customerPhone,
    shipping_is_billing: true,
    payment_method: input.paymentMethod === 'cod' ? 'COD' : 'Prepaid',
    sub_total: input.items.reduce((sum, item) => sum + item.sellingPrice * item.units, 0),
    weight: input.weightKg,
    order_items: input.items.map((item) => ({
      name: item.name,
      sku: item.sku ?? item.name.slice(0, 32),
      units: item.units,
      selling_price: item.sellingPrice,
    })),
  }
}

/** Map our create payload → Pickrr create body shape. */
export function toPickrrCreateBody(input: CreateShipmentInput) {
  return {
    item_name: input.items.map((i) => i.name).join(', ').slice(0, 200),
    from_pincode: input.pickupPostcode,
    to_pincode: input.deliveryPostcode,
    to_name: input.customerName,
    to_phone_number: input.customerPhone,
    to_email: input.customerEmail ?? '',
    to_address: [input.addressLine1, input.addressLine2].filter(Boolean).join(', '),
    to_city: input.city,
    to_state: input.state,
    cod_amount: input.paymentMethod === 'cod' ? input.codAmount ?? 0 : 0,
    total_amount: input.items.reduce((sum, item) => sum + item.sellingPrice * item.units, 0),
    quantity: input.items.reduce((sum, item) => sum + item.units, 0),
    client_order_id: input.orderNumber || input.orderId,
  }
}

export function normalizeShiprocketTracking(payload: Record<string, unknown>): TrackingEvent[] {
  const tracking = (payload.tracking_data ?? payload) as Record<string, unknown>
  const activities = (tracking.shipment_track_activities ??
    tracking.track_activities ??
    []) as Array<Record<string, unknown>>
  return activities.map((row) => ({
    status: String(row.activity ?? row.status ?? 'update'),
    location: row.location == null ? null : String(row.location),
    occurredAt: row.date == null ? null : String(row.date),
    remark: row['sr-status-label'] == null ? null : String(row['sr-status-label']),
  }))
}

export function normalizePickrrTracking(payload: Record<string, unknown>): TrackingEvent[] {
  const status = payload.status ?? payload.track_status
  const history = (payload.track_arr ?? payload.history ?? []) as Array<Record<string, unknown>>
  if (Array.isArray(history) && history.length) {
    return history.map((row) => ({
      status: String(row.status_body ?? row.status ?? 'update'),
      location: row.location == null ? null : String(row.location),
      occurredAt: row.status_time == null ? null : String(row.status_time),
      remark: row.pickup_location == null ? null : String(row.pickup_location),
    }))
  }
  return [{ status: String(status ?? 'unknown') }]
}

/** Invoke edge function to create a Shiprocket/Pickrr shipment. */
export async function createSheDeliveryShipment(
  input: CreateShipmentInput,
): Promise<{ data: CreateShipmentResult | null; error: string | null }> {
  const partner = input.partner ?? 'shiprocket'
  const payload =
    partner === 'pickrr' ? toPickrrCreateBody(input) : toShiprocketCreateOrderBody(input)

  const { data, error } = await supabase.functions.invoke('shedelivery-create-shipment', {
    body: {
      order_id: input.orderId,
      partner,
      payload,
    },
  })

  if (error) return { data: null, error: error.message }
  const body = data as {
    partner?: SheDeliveryPartner
    shipmentId?: string
    shipment_id?: string
    awb?: string | null
    trackingUrl?: string | null
    tracking_url?: string | null
    raw?: unknown
    error?: string
  }
  if (body?.error) return { data: null, error: body.error }
  const shipmentId = String(body.shipmentId ?? body.shipment_id ?? '')
  const awb = body.awb ?? null
  if (!shipmentId && !awb) {
    return { data: null, error: 'SHEdelivery did not return a shipment id' }
  }
  return {
    data: {
      partner,
      shipmentId,
      awb,
      trackingUrl: body.trackingUrl ?? body.tracking_url ?? null,
      raw: body.raw,
    },
    error: null,
  }
}

export function isSheDeliveryCourier(slug: string | null | undefined): boolean {
  return slug === 'shiprocket' || slug === 'pickrr'
}

export function sheDeliveryPartnerFromCourier(
  slug: string | null | undefined,
): SheDeliveryPartner | null {
  if (slug === 'pickrr') return 'pickrr'
  if (slug === 'shiprocket') return 'shiprocket'
  return null
}
