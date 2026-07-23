import { supabase } from '~/lib/supabase'
import {
  createDefaultGeoLocation,
  geoPartsToShopAddress,
  shopAddressToGeoParts,
  validateGeoLocationParts,
  type GeoLocationParts,
} from '~/lib/geo'
import type { ShopAddress } from '~/commerce/lib/shop-location'

export type ShopAddressInput = GeoLocationParts

export function normalizeVendorShopAddress(value: unknown): ShopAddress | null {
  if (!value) return null
  const row = Array.isArray(value) ? value[0] : value
  if (!row || typeof row !== 'object') return null
  return row as ShopAddress
}

export async function fetchShopAddressForOwner(
  shopId: string,
  userId: string,
): Promise<{ address: ShopAddress | null; error: string | null }> {
  const { data, error } = await supabase
    .from('shops')
    .select('shop_address_id, shop_addresses(city, state, country, postal_code)')
    .eq('id', shopId)
    .eq('user_id', userId)
    .maybeSingle()

  if (error) {
    return { address: null, error: error.message }
  }

  return {
    address: normalizeVendorShopAddress(data?.shop_addresses),
    error: null,
  }
}

export async function upsertShopAddress(
  shopId: string,
  userId: string,
  input: ShopAddressInput,
  shopName: string,
): Promise<{ address: ShopAddress | null; error: string | null }> {
  const validationError = validateGeoLocationParts(input, { requirePostal: true })
  if (validationError) {
    return { address: null, error: validationError }
  }

  const geo = geoPartsToShopAddress(input)

  const { data: shop, error: shopError } = await supabase
    .from('shops')
    .select('shop_address_id, shop_name')
    .eq('id', shopId)
    .eq('user_id', userId)
    .maybeSingle()

  if (shopError || !shop) {
    return { address: null, error: shopError?.message ?? 'Shop not found.' }
  }

  const addressPayload = {
    address_line_1: shopName.trim() || 'Business location',
    address_line_2: null,
    city: geo.city,
    state: geo.state,
    country: geo.country,
    postal_code: geo.postal_code,
    address_type: 'shop',
    address_label: 'Shop',
    is_default: false,
  }

  if (shop.shop_address_id) {
    const { error: updateError } = await supabase
      .from('addresses')
      .update(addressPayload)
      .eq('id', shop.shop_address_id)
      .eq('user_id', userId)

    if (updateError) {
      return { address: null, error: updateError.message }
    }
  } else {
    const { data: created, error: insertError } = await supabase
      .from('addresses')
      .insert({
        ...addressPayload,
        user_id: userId,
      })
      .select('id')
      .single()

    if (insertError || !created) {
      return { address: null, error: insertError?.message ?? 'Could not save shop address.' }
    }

    const { error: linkError } = await supabase
      .from('shops')
      .update({ shop_address_id: created.id })
      .eq('id', shopId)
      .eq('user_id', userId)

    if (linkError) {
      return { address: null, error: linkError.message }
    }
  }

  return fetchShopAddressForOwner(shopId, userId)
}

export type ShopAddressDetails = {
  address_line_1: string | null
  address_line_2: string | null
  city: string | null
  state: string | null
  country: string | null
  postal_code: string | null
}

/**
 * Full address detail for a shop, resolved through the linked `addresses` row.
 *
 * Note: `shops.shop_address_id` references the `addresses` **table** — the
 * `shop_addresses` relation is only a city-level view without street lines,
 * so we must embed `addresses` explicitly via the FK name here.
 *
 * RLS gates visibility (owner or admin), so no explicit user filter is needed
 * here — this lets both a vendor and an admin read the storefront address.
 */
export async function fetchShopAddressDetails(
  shopId: string,
): Promise<{ address: ShopAddressDetails | null; error: string | null }> {
  const { data, error } = await supabase
    .from('shops')
    .select(
      'shop_address:addresses!shops_shop_address_id_fkey(address_line_1, address_line_2, city, state, country, postal_code)',
    )
    .eq('id', shopId)
    .maybeSingle()

  if (error) {
    return { address: null, error: error.message }
  }

  const row = normalizeVendorShopAddress(data?.shop_address)
  return { address: (row as ShopAddressDetails | null) ?? null, error: null }
}

export function shopAddressInputFromRow(address: ShopAddress | null): ShopAddressInput {
  if (!address) {
    return createDefaultGeoLocation()
  }
  return shopAddressToGeoParts(address)
}

/** Full physical-address payload edited on the shop settings Connect page. */
export type ShopAddressDetailsInput = GeoLocationParts & {
  address_line_1: string
  address_line_2?: string | null
}

/**
 * Create or update the shop's linked `addresses` row with full street details
 * (unlike `upsertShopAddress`, which only stores city-level geo data). Links
 * the new row to `shops.shop_address_id` on first save.
 */
export async function upsertShopAddressDetails(
  shopId: string,
  userId: string,
  input: ShopAddressDetailsInput,
): Promise<{ address: ShopAddressDetails | null; error: string | null }> {
  const line1 = input.address_line_1.trim()
  if (line1.length < 3) {
    return { address: null, error: 'Enter a valid street address (at least 3 characters).' }
  }

  const validationError = validateGeoLocationParts(input, { requirePostal: true })
  if (validationError) {
    return { address: null, error: validationError }
  }

  const geo = geoPartsToShopAddress(input)

  const { data: shop, error: shopError } = await supabase
    .from('shops')
    .select('shop_address_id')
    .eq('id', shopId)
    .eq('user_id', userId)
    .maybeSingle()

  if (shopError || !shop) {
    return { address: null, error: shopError?.message ?? 'Shop not found.' }
  }

  const addressPayload = {
    address_line_1: line1,
    address_line_2: input.address_line_2?.trim() || null,
    city: geo.city,
    state: geo.state,
    country: geo.country,
    postal_code: geo.postal_code,
    address_type: 'shop',
    address_label: 'Shop',
    is_default: false,
  }

  if (shop.shop_address_id) {
    const { error: updateError } = await supabase
      .from('addresses')
      .update(addressPayload)
      .eq('id', shop.shop_address_id)
      .eq('user_id', userId)

    if (updateError) {
      return { address: null, error: updateError.message }
    }
  } else {
    const { data: created, error: insertError } = await supabase
      .from('addresses')
      .insert({ ...addressPayload, user_id: userId })
      .select('id')
      .single()

    if (insertError || !created) {
      return { address: null, error: insertError?.message ?? 'Could not save shop address.' }
    }

    const { error: linkError } = await supabase
      .from('shops')
      .update({ shop_address_id: created.id })
      .eq('id', shopId)
      .eq('user_id', userId)

    if (linkError) {
      return { address: null, error: linkError.message }
    }
  }

  return fetchShopAddressDetails(shopId)
}
