/**
 * Shared seller origin + buyer destination resolution for EasyShip rates/fulfill.
 * Prefer warehouses → shops.shop_address_id → addresses. Never invent street/postal.
 */
import type { SupabaseClient } from 'jsr:@supabase/supabase-js@2'

import type { EasyshipAddress } from './easyship.ts'

export const EASYSHIP_SELLER_ORIGIN_SETUP_PATH = '/vendor/settings?section=warehouse'

export type ShipAddressErrorCode =
  | 'seller_origin_incomplete'
  | 'buyer_destination_incomplete'

export class ShipAddressError extends Error {
  code: ShipAddressErrorCode
  setupPath?: string

  constructor(code: ShipAddressErrorCode, message: string, setupPath?: string) {
    super(message)
    this.name = 'ShipAddressError'
    this.code = code
    this.setupPath = setupPath
  }
}

export type ResolvedShipAddress = EasyshipAddress & {
  company_name?: string
  latitude?: number | null
  longitude?: number | null
}

export type SellerOriginResult = {
  address: ResolvedShipAddress
  source: 'warehouse' | 'shop_address'
  warehouseId: string | null
  addressId: string | null
}

export type BuyerDestinationResult = {
  address: ResolvedShipAddress
  addressId: string | null
}

type ShopOriginInput = {
  id: string
  shop_name?: string | null
  shop_email?: string | null
  shop_phone_number?: string | null
  shop_address_id?: string | null
}

type OrderDestInput = {
  id: string
  user_id: string
  shipping_address_id?: string | null
  order_metadata?: unknown
}

function trimStr(value: unknown, fallback = ''): string {
  if (value == null) return fallback
  const s = String(value).trim()
  return s || fallback
}

export function countryAlpha2(raw: unknown, fallback = ''): string {
  const code = trimStr(raw, fallback).toUpperCase()
  if (code === 'IND' || code === 'INDIA') return 'IN'
  if (code === 'USA' || code === 'UNITED STATES') return 'US'
  const sliced = code.slice(0, 2)
  return /^[A-Z]{2}$/.test(sliced) ? sliced : (fallback || '')
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

function phoneFromMeta(orderMetadata: unknown): string {
  const meta = asRecord(orderMetadata)
  const shipping = asRecord(meta.shipping)
  const checkout = asRecord(meta.checkout)
  return (
    trimStr(meta.shipping_phone) ||
    trimStr(meta.phone) ||
    trimStr(shipping.phone) ||
    trimStr(checkout.phone) ||
    trimStr(checkout.contact_phone) ||
    ''
  )
}

/** Require street, city, postal, and ISO country — no placeholders. */
export function assertShipAddressComplete(
  address: EasyshipAddress,
  kind: 'origin' | 'destination',
): void {
  const line1 = trimStr(address.line_1)
  const city = trimStr(address.city)
  const postal = trimStr(address.postal_code)
  const country = countryAlpha2(address.country_alpha2)

  const missing: string[] = []
  if (!line1 || /^(warehouse|address)$/i.test(line1)) missing.push('street')
  if (!city || /^city$/i.test(city)) missing.push('city')
  if (!postal || /^0+$/.test(postal)) missing.push('postal_code')
  if (!country || country.length !== 2) missing.push('country')

  if (!missing.length) return

  if (kind === 'origin') {
    throw new ShipAddressError(
      'seller_origin_incomplete',
      `Seller fulfillment address is incomplete (missing ${missing.join(', ')}). Update Fulfillment → Warehouse.`,
      EASYSHIP_SELLER_ORIGIN_SETUP_PATH,
    )
  }
  throw new ShipAddressError(
    'buyer_destination_incomplete',
    `Buyer delivery address is incomplete (missing ${missing.join(', ')}).`,
  )
}

export function shipAddressErrorResponse(error: ShipAddressError) {
  return {
    error: error.message,
    code: error.code,
    setupPath: error.setupPath ?? null,
  }
}

/**
 * Seller origin: active warehouses (default/primary first) → shops.shop_address_id.
 */
export async function resolveSellerOrigin(
  admin: SupabaseClient,
  shop: ShopOriginInput,
): Promise<SellerOriginResult> {
  const shopId = trimStr(shop.id)
  if (!shopId) {
    throw new ShipAddressError(
      'seller_origin_incomplete',
      'Shop id is required for seller origin.',
      EASYSHIP_SELLER_ORIGIN_SETUP_PATH,
    )
  }

  const { data: warehouses } = await admin
    .from('warehouses')
    .select(
      'id, warehouse_name, address_line_1, address_line_2, city, state, country, pin_code, mobile_number, contact_person, is_default, is_primary, status, latitude, longitude, updated_at',
    )
    .eq('shop_id', shopId)
    .eq('status', 'active')
    .order('is_default', { ascending: false })
    .order('is_primary', { ascending: false })
    .order('updated_at', { ascending: false })
    .limit(5)

  const warehouse = (warehouses ?? [])[0] as Record<string, unknown> | undefined
  if (warehouse) {
    const address: ResolvedShipAddress = {
      line_1: trimStr(warehouse.address_line_1),
      line_2: trimStr(warehouse.address_line_2) || null,
      city: trimStr(warehouse.city),
      state: trimStr(warehouse.state) || null,
      postal_code: trimStr(warehouse.pin_code),
      country_alpha2: countryAlpha2(warehouse.country, 'IN'),
      company_name: trimStr(shop.shop_name, 'Shop'),
      contact_name:
        trimStr(warehouse.contact_person) ||
        trimStr(warehouse.warehouse_name) ||
        trimStr(shop.shop_name, 'Shop'),
      contact_phone:
        trimStr(warehouse.mobile_number) || trimStr(shop.shop_phone_number) || undefined,
      contact_email: trimStr(shop.shop_email) || undefined,
      latitude: Number.isFinite(Number(warehouse.latitude))
        ? Number(warehouse.latitude)
        : null,
      longitude: Number.isFinite(Number(warehouse.longitude))
        ? Number(warehouse.longitude)
        : null,
    }
    assertShipAddressComplete(address, 'origin')
    return {
      address,
      source: 'warehouse',
      warehouseId: trimStr(warehouse.id) || null,
      addressId: null,
    }
  }

  const shopAddressId = trimStr(shop.shop_address_id)
  if (!shopAddressId) {
    throw new ShipAddressError(
      'seller_origin_incomplete',
      'No seller warehouse or shop fulfillment address is set. Add your shipping origin under Fulfillment → Warehouse.',
      EASYSHIP_SELLER_ORIGIN_SETUP_PATH,
    )
  }

  const { data: addr } = await admin
    .from('addresses')
    .select(
      'id, address_line_1, address_line_2, city, state, country, postal_code, latitude, longitude',
    )
    .eq('id', shopAddressId)
    .maybeSingle()

  if (!addr) {
    throw new ShipAddressError(
      'seller_origin_incomplete',
      'Shop fulfillment address was not found. Update Fulfillment → Warehouse.',
      EASYSHIP_SELLER_ORIGIN_SETUP_PATH,
    )
  }

  const row = addr as Record<string, unknown>
  const address: ResolvedShipAddress = {
    line_1: trimStr(row.address_line_1),
    line_2: trimStr(row.address_line_2) || null,
    city: trimStr(row.city),
    state: trimStr(row.state) || null,
    postal_code: trimStr(row.postal_code),
    country_alpha2: countryAlpha2(row.country, 'IN'),
    company_name: trimStr(shop.shop_name, 'Shop'),
    contact_name: trimStr(shop.shop_name, 'Shop'),
    contact_phone: trimStr(shop.shop_phone_number) || undefined,
    contact_email: trimStr(shop.shop_email) || undefined,
    latitude: Number.isFinite(Number(row.latitude)) ? Number(row.latitude) : null,
    longitude: Number.isFinite(Number(row.longitude)) ? Number(row.longitude) : null,
  }
  assertShipAddressComplete(address, 'origin')
  return {
    address,
    source: 'shop_address',
    warehouseId: null,
    addressId: trimStr(row.id) || shopAddressId,
  }
}

/**
 * Buyer destination from a loaded addresses row + optional profile/order contact.
 * Does not select nonexistent addresses.phone / addresses.full_name.
 */
export function buildBuyerDestinationFromAddressRow(
  addressRow: Record<string, unknown>,
  contact: {
    full_name?: string | null
    phone?: string | null
    email?: string | null
    order_metadata?: unknown
  } = {},
): BuyerDestinationResult {
  const addressId = trimStr(addressRow.id) || null
  const metaPhone = phoneFromMeta(contact.order_metadata)
  const address: ResolvedShipAddress = {
    line_1: trimStr(
      addressRow.address_line_1 ?? addressRow.address_line1 ?? addressRow.line_1,
    ),
    line_2:
      trimStr(
        addressRow.address_line_2 ?? addressRow.address_line2 ?? addressRow.line_2,
      ) || null,
    city: trimStr(addressRow.city),
    state: trimStr(addressRow.state) || null,
    postal_code: trimStr(addressRow.postal_code ?? addressRow.pincode),
    country_alpha2: countryAlpha2(
      addressRow.country_alpha2 ?? addressRow.country_code ?? addressRow.country,
    ),
    contact_name: trimStr(contact.full_name, 'Buyer'),
    contact_phone: trimStr(contact.phone) || metaPhone || undefined,
    contact_email: trimStr(contact.email) || undefined,
    latitude: Number.isFinite(Number(addressRow.latitude))
      ? Number(addressRow.latitude)
      : null,
    longitude: Number.isFinite(Number(addressRow.longitude))
      ? Number(addressRow.longitude)
      : null,
  }
  assertShipAddressComplete(address, 'destination')
  return { address, addressId }
}

/** Buyer destination: orders.shipping_address_id → addresses + profiles contact. */
export async function resolveBuyerDestination(
  admin: SupabaseClient,
  order: OrderDestInput,
): Promise<BuyerDestinationResult> {
  const shippingAddressId = trimStr(order.shipping_address_id)
  if (!shippingAddressId) {
    throw new ShipAddressError(
      'buyer_destination_incomplete',
      'Order has no shipping address.',
    )
  }

  const { data: addr, error } = await admin
    .from('addresses')
    .select('id, address_line_1, address_line_2, city, state, country, postal_code, latitude, longitude')
    .eq('id', shippingAddressId)
    .maybeSingle()

  if (error) {
    throw new ShipAddressError(
      'buyer_destination_incomplete',
      error.message || 'Could not load buyer shipping address.',
    )
  }
  if (!addr) {
    throw new ShipAddressError(
      'buyer_destination_incomplete',
      'Buyer shipping address was not found.',
    )
  }

  const { data: profile } = await admin
    .from('profiles')
    .select('full_name, email, phone')
    .eq('id', order.user_id)
    .maybeSingle()

  return buildBuyerDestinationFromAddressRow(addr as Record<string, unknown>, {
    full_name: profile?.full_name,
    phone: profile?.phone,
    email: profile?.email,
    order_metadata: order.order_metadata,
  })
}

/** Strip geo extras before sending to EasyShip API. */
export function toEasyshipApiAddress(
  resolved: ResolvedShipAddress,
): EasyshipAddress & { company_name?: string } {
  return {
    line_1: resolved.line_1,
    line_2: resolved.line_2 ?? null,
    city: resolved.city,
    state: resolved.state ?? null,
    postal_code: resolved.postal_code,
    country_alpha2: resolved.country_alpha2,
    company_name: resolved.company_name,
    contact_name: resolved.contact_name,
    contact_phone: resolved.contact_phone,
    contact_email: resolved.contact_email,
  }
}
