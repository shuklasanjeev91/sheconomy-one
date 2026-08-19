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

/**
 * Reverse pickup: the buyer is the pickup point, the seller's return address is
 * the delivery point. Booked platform-side on vendor approval — buyers never
 * enter an AWB.
 */
export type CreateReturnInput = {
  orderId: string
  orderNumber?: string | null
  partner?: 'shiprocket'
  /** Pickup = buyer / where the parcel is collected. */
  pickupCustomerName: string
  pickupPhone: string
  pickupEmail?: string
  pickupAddressLine1: string
  pickupAddressLine2?: string
  pickupCity: string
  pickupState: string
  pickupCountry?: string
  pickupPostcode: string
  /** Delivery = seller / where the parcel is returned to. */
  sellerName: string
  sellerPhone: string
  sellerEmail?: string
  sellerAddressLine1: string
  sellerAddressLine2?: string
  sellerCity: string
  sellerState: string
  sellerCountry?: string
  sellerPostcode: string
  weightKg: number
  lengthCm?: number
  breadthCm?: number
  heightCm?: number
  items: Array<{ name: string; sku?: string; units: number; sellingPrice: number }>
}

export type CreateReturnResult = {
  partner: SheDeliveryPartner
  shipmentId: string
  awb?: string | null
  trackingUrl?: string | null
  raw?: unknown
}

/**
 * Map our reverse payload → Shiprocket create-return body. Pickup and shipping
 * fields are swapped versus the forward order: pickup = buyer, shipping = seller.
 */
export function toShiprocketReturnBody(input: CreateReturnInput) {
  const subTotal = input.items.reduce((sum, item) => sum + item.sellingPrice * item.units, 0)
  return {
    order_id: `RET-${input.orderNumber || input.orderId}`,
    order_date: new Date().toISOString().slice(0, 10),
    // Pickup = buyer address (parcel collected here).
    pickup_customer_name: input.pickupCustomerName,
    pickup_last_name: '',
    pickup_address: input.pickupAddressLine1,
    pickup_address_2: input.pickupAddressLine2 ?? '',
    pickup_city: input.pickupCity,
    pickup_state: input.pickupState,
    pickup_country: input.pickupCountry ?? 'India',
    pickup_pincode: input.pickupPostcode,
    pickup_email: input.pickupEmail ?? '',
    pickup_phone: input.pickupPhone,
    // Shipping = seller return address (parcel delivered here).
    shipping_customer_name: input.sellerName,
    shipping_last_name: '',
    shipping_address: input.sellerAddressLine1,
    shipping_address_2: input.sellerAddressLine2 ?? '',
    shipping_city: input.sellerCity,
    shipping_country: input.sellerCountry ?? 'India',
    shipping_pincode: input.sellerPostcode,
    shipping_state: input.sellerState,
    shipping_email: input.sellerEmail ?? '',
    shipping_phone: input.sellerPhone,
    order_items: input.items.map((item) => ({
      name: item.name,
      sku: item.sku ?? item.name.slice(0, 32),
      units: item.units,
      selling_price: item.sellingPrice,
    })),
    payment_method: 'PREPAID',
    sub_total: subTotal,
    length: input.lengthCm ?? 10,
    breadth: input.breadthCm ?? 10,
    height: input.heightCm ?? 10,
    weight: input.weightKg,
  }
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

/** Invoke edge function to book a Shiprocket reverse pickup. */
export async function createSheDeliveryReturn(
  input: CreateReturnInput,
): Promise<{ data: CreateReturnResult | null; error: string | null }> {
  const partner = input.partner ?? 'shiprocket'
  const payload = toShiprocketReturnBody(input)

  const { data, error } = await supabase.functions.invoke('shedelivery-create-return', {
    body: {
      order_id: input.orderId,
      partner,
      payload,
    },
  })

  if (error) return { data: null, error: error.message }
  const respBody = data as {
    partner?: SheDeliveryPartner
    shipmentId?: string
    shipment_id?: string
    awb?: string | null
    trackingUrl?: string | null
    tracking_url?: string | null
    raw?: unknown
    error?: string
  }
  if (respBody?.error) return { data: null, error: respBody.error }
  const awb = respBody.awb ?? null
  if (!awb) return { data: null, error: 'Shiprocket did not return a return AWB' }
  return {
    data: {
      partner,
      shipmentId: String(respBody.shipmentId ?? respBody.shipment_id ?? ''),
      awb,
      trackingUrl: respBody.trackingUrl ?? respBody.tracking_url ?? null,
      raw: respBody.raw,
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
