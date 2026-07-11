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

export function shopAddressInputFromRow(address: ShopAddress | null): ShopAddressInput {
  if (!address) {
    return createDefaultGeoLocation()
  }
  return shopAddressToGeoParts(address)
}
