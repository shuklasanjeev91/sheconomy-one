/**
 * Seller default ship-from warehouse (EasyShip origin).
 */
import { fetchShopAddressDetails } from '~/commerce/lib/shop-address'
import {
  createDefaultGeoLocation,
  geoPartsToShopAddress,
  shopAddressToGeoParts,
  validateGeoLocationParts,
  type GeoLocationParts,
} from '~/lib/geo'
import { isValidPhone, normalizePhoneNumber } from '~/lib/phone/phone'
import { supabase } from '~/lib/supabase'
import type { Database } from '~/lib/supabase/database.types'

export type WarehouseRow = Database['public']['Tables']['warehouses']['Row']

export type WarehouseFormInput = {
  warehouse_name: string
  contact_person: string
  mobile_number: string
  address_line_1: string
  address_line_2?: string | null
  geo: GeoLocationParts
}

export type WarehouseFormState = WarehouseFormInput & {
  id: string | null
  warehouse_code: string | null
}

const WAREHOUSE_SELECT =
  'id, shop_id, warehouse_name, warehouse_code, address_line_1, address_line_2, city, state, country, pin_code, contact_person, mobile_number, is_default, is_primary, status, warehouse_type, latitude, longitude, updated_at'

function trim(value: unknown, fallback = ''): string {
  if (value == null) return fallback
  return String(value).trim() || fallback
}

function makeWarehouseCode(shopId: string): string {
  const short = shopId.replace(/-/g, '').slice(0, 8).toUpperCase()
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase()
  return `WH-${short}-${rand}`
}

export function emptyWarehouseForm(defaults?: {
  warehouse_name?: string
  contact_person?: string
  mobile_number?: string
}): WarehouseFormState {
  return {
    id: null,
    warehouse_code: null,
    warehouse_name: defaults?.warehouse_name ?? 'Main warehouse',
    contact_person: defaults?.contact_person ?? '',
    mobile_number: defaults?.mobile_number ?? '',
    address_line_1: '',
    address_line_2: '',
    geo: createDefaultGeoLocation(),
  }
}

export function warehouseToFormState(row: WarehouseRow): WarehouseFormState {
  return {
    id: row.id,
    warehouse_code: row.warehouse_code,
    warehouse_name: row.warehouse_name,
    contact_person: row.contact_person,
    mobile_number: row.mobile_number,
    address_line_1: row.address_line_1,
    address_line_2: row.address_line_2 ?? '',
    geo: shopAddressToGeoParts({
      city: row.city,
      state: row.state,
      country: row.country,
      postal_code: row.pin_code,
    }),
  }
}

/** Active default/primary warehouse, else latest active for the shop. */
export async function fetchDefaultWarehouse(
  shopId: string,
): Promise<{ warehouse: WarehouseRow | null; error: string | null }> {
  if (!shopId) return { warehouse: null, error: 'Shop id is required.' }

  const { data: defaults, error: defaultError } = await supabase
    .from('warehouses')
    .select(WAREHOUSE_SELECT)
    .eq('shop_id', shopId)
    .eq('status', 'active')
    .order('is_default', { ascending: false })
    .order('is_primary', { ascending: false })
    .order('updated_at', { ascending: false })
    .limit(1)

  if (defaultError) {
    return { warehouse: null, error: defaultError.message }
  }

  const row = (defaults?.[0] as WarehouseRow | undefined) ?? null
  return { warehouse: row, error: null }
}

/**
 * Prefill form from warehouse, else Connect shop address + shop contact fields.
 */
export async function loadWarehouseFormState(input: {
  shopId: string
  shopName?: string | null
  shopPhone?: string | null
  contactName?: string | null
}): Promise<{ form: WarehouseFormState; error: string | null }> {
  const { warehouse, error } = await fetchDefaultWarehouse(input.shopId)
  if (error) {
    return {
      form: emptyWarehouseForm({
        warehouse_name: `${trim(input.shopName, 'Shop')} warehouse`,
        contact_person: trim(input.contactName),
        mobile_number: trim(input.shopPhone),
      }),
      error,
    }
  }

  if (warehouse) {
    return { form: warehouseToFormState(warehouse), error: null }
  }

  const form = emptyWarehouseForm({
    warehouse_name: `${trim(input.shopName, 'Shop')} warehouse`,
    contact_person: trim(input.contactName),
    mobile_number: trim(input.shopPhone),
  })

  const { address } = await fetchShopAddressDetails(input.shopId)
  if (address) {
    form.address_line_1 = trim(address.address_line_1)
    form.address_line_2 = trim(address.address_line_2)
    form.geo = shopAddressToGeoParts({
      city: address.city,
      state: address.state,
      country: address.country,
      postal_code: address.postal_code,
    })
  }

  return { form, error: null }
}

export async function upsertDefaultWarehouse(
  shopId: string,
  userId: string,
  input: WarehouseFormInput,
): Promise<{ warehouse: WarehouseRow | null; error: string | null }> {
  if (!shopId || !userId) {
    return { warehouse: null, error: 'Shop and user are required.' }
  }

  const { data: shop, error: shopError } = await supabase
    .from('shops')
    .select('id, user_id')
    .eq('id', shopId)
    .eq('user_id', userId)
    .maybeSingle()

  if (shopError || !shop) {
    return { warehouse: null, error: shopError?.message ?? 'Shop not found.' }
  }

  const warehouseName = trim(input.warehouse_name)
  if (warehouseName.length < 2) {
    return { warehouse: null, error: 'Enter a warehouse name.' }
  }

  const contactPerson = trim(input.contact_person)
  if (contactPerson.length < 2) {
    return { warehouse: null, error: 'Enter a contact person name.' }
  }

  const line1 = trim(input.address_line_1)
  if (line1.length < 3) {
    return { warehouse: null, error: 'Enter a valid street address (at least 3 characters).' }
  }

  const geoError = validateGeoLocationParts(input.geo, { requirePostal: true })
  if (geoError) return { warehouse: null, error: geoError }

  const phoneRaw = trim(input.mobile_number)
  if (!phoneRaw || !isValidPhone(phoneRaw)) {
    return { warehouse: null, error: 'Enter a valid mobile number with country code.' }
  }
  const mobile = normalizePhoneNumber(phoneRaw) || phoneRaw

  const geo = geoPartsToShopAddress(input.geo)
  const pinCode = geo.postal_code
  if (!pinCode) {
    return { warehouse: null, error: 'Enter a valid postal / PIN code.' }
  }

  const { warehouse: existing } = await fetchDefaultWarehouse(shopId)

  const payload = {
    shop_id: shopId,
    warehouse_name: warehouseName,
    address_line_1: line1,
    address_line_2: trim(input.address_line_2) || null,
    city: geo.city,
    state: geo.state,
    country: geo.country,
    pin_code: pinCode,
    contact_person: contactPerson,
    mobile_number: mobile,
    is_default: true,
    is_primary: true,
    status: 'active' as const,
    warehouse_type: 'self' as const,
    updated_at: new Date().toISOString(),
    full_address: [line1, trim(input.address_line_2), geo.city, geo.state, pinCode, geo.country]
      .filter(Boolean)
      .join(', '),
  }

  // Clear default flags on other rows for this shop (app-enforced single default).
  await supabase
    .from('warehouses')
    .update({ is_default: false, is_primary: false, updated_at: new Date().toISOString() })
    .eq('shop_id', shopId)
    .neq('id', existing?.id ?? '00000000-0000-0000-0000-000000000000')

  if (existing?.id) {
    const { data, error } = await supabase
      .from('warehouses')
      .update(payload)
      .eq('id', existing.id)
      .eq('shop_id', shopId)
      .select(WAREHOUSE_SELECT)
      .maybeSingle()

    if (error) return { warehouse: null, error: error.message }
    return { warehouse: (data as WarehouseRow | null) ?? null, error: null }
  }

  const { data, error } = await supabase
    .from('warehouses')
    .insert({
      ...payload,
      warehouse_code: makeWarehouseCode(shopId),
    })
    .select(WAREHOUSE_SELECT)
    .maybeSingle()

  if (error) return { warehouse: null, error: error.message }
  return { warehouse: (data as WarehouseRow | null) ?? null, error: null }
}
