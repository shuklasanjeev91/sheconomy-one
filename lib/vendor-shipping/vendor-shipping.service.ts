/**
 * Vendor shipping providers service — Shiprocket + custom partners.
 *
 * Ported 1:1 from legacy `/api/vendor/shipping/*` routes.
 */

import { canManageShop } from '~/lib/shop/shop.utils'
import { supabase } from '~/lib/supabase'

import {
  CUSTOM_PARTNER_SELECT,
  CUSTOM_PROVIDER_TYPE,
  SHIPROCKET_PROVIDER_TYPE,
} from './vendor-shipping.constants'
import {
  VendorShippingError,
  VENDOR_SHIPPING_ERROR_CODES,
  toFriendlyVendorShippingError,
} from './vendor-shipping.errors'
import type {
  ConnectShiprocketInput,
  CustomPartnerInput,
  CustomShippingPartner,
  ShiprocketEdgeResponse,
  ShiprocketStatus,
  VendorShippingAccessContext,
  VendorShippingServiceResponse,
} from './vendor-shipping.type'
import { validateCustomPartnerInput } from './vendor-shipping.validation'

function ok<T>(data: T, message?: string | null): VendorShippingServiceResponse<T> {
  return { success: true, data, error: null, message: message ?? null }
}

function fail<T>(error: unknown, fallback?: string): VendorShippingServiceResponse<T> {
  return { success: false, data: null, error: toFriendlyVendorShippingError(error, fallback) }
}

async function resolveUserId(userId?: string | null): Promise<string> {
  if (userId) return userId
  const { data, error } = await supabase.auth.getUser()
  if (error || !data.user?.id) {
    throw new VendorShippingError(VENDOR_SHIPPING_ERROR_CODES.NOT_AUTHENTICATED)
  }
  return data.user.id
}

async function assertShopAccess(shopId: string, context?: VendorShippingAccessContext) {
  const userId = await resolveUserId(context?.userId)
  const { data: shop, error } = await supabase
    .from('shops')
    .select('id, user_id')
    .eq('id', shopId)
    .maybeSingle()

  if (error || !shop) {
    throw new VendorShippingError(VENDOR_SHIPPING_ERROR_CODES.SHOP_NOT_FOUND)
  }

  if (!canManageShop(shop, userId, context?.role)) {
    throw new VendorShippingError(VENDOR_SHIPPING_ERROR_CODES.SHOP_ACCESS_DENIED)
  }

  return { shopId: shop.id, userId }
}

async function invokeShiprocketEdge(body: {
  action: 'status' | 'connect' | 'disconnect'
  shopId: string
  email?: string
  password?: string
}): Promise<ShiprocketEdgeResponse> {
  const { data, error } = await supabase.functions.invoke('vendor-shipping-shiprocket', { body })
  if (error) {
    throw new VendorShippingError(VENDOR_SHIPPING_ERROR_CODES.SHIPROCKET_CONNECT_FAILED, error.message)
  }
  if (data?.error) {
    throw new VendorShippingError(
      body.action === 'connect'
        ? VENDOR_SHIPPING_ERROR_CODES.SHIPROCKET_AUTH_FAILED
        : VENDOR_SHIPPING_ERROR_CODES.UNKNOWN,
      String(data.error),
    )
  }
  return data as ShiprocketEdgeResponse
}

export async function getShiprocketStatus(
  shopId: string,
  context?: VendorShippingAccessContext,
): Promise<VendorShippingServiceResponse<ShiprocketStatus>> {
  try {
    await assertShopAccess(shopId, context)
    const payload = await invokeShiprocketEdge({ action: 'status', shopId })
    return ok({
      connected: Boolean(payload.connected),
      expired: payload.expired,
      message: payload.message,
      config: payload.config ?? null,
    })
  } catch (error) {
    return fail(error)
  }
}

export async function connectShiprocket(
  input: ConnectShiprocketInput,
): Promise<VendorShippingServiceResponse<ShiprocketStatus>> {
  try {
    await assertShopAccess(input.shopId, input.accessContext)
    const payload = await invokeShiprocketEdge({
      action: 'connect',
      shopId: input.shopId,
      email: input.email.trim(),
      password: input.password,
    })
    return ok(
      {
        connected: true,
        message: payload.message,
        config: payload.config ?? null,
      },
      payload.message ?? 'Shiprocket connected successfully',
    )
  } catch (error) {
    return fail(error, 'Could not connect Shiprocket.')
  }
}

export async function disconnectShiprocket(
  shopId: string,
  context?: VendorShippingAccessContext,
): Promise<VendorShippingServiceResponse<{ disconnected: true }>> {
  try {
    await assertShopAccess(shopId, context)
    await invokeShiprocketEdge({ action: 'disconnect', shopId })
    return ok({ disconnected: true }, 'Shiprocket disconnected successfully')
  } catch (error) {
    return fail(error, 'Could not disconnect Shiprocket.')
  }
}

export async function listCustomShippingPartners(
  shopId: string,
  context?: VendorShippingAccessContext,
): Promise<VendorShippingServiceResponse<CustomShippingPartner[]>> {
  try {
    await assertShopAccess(shopId, context)
    const { data, error } = await supabase
      .from('custom_shipping_partners')
      .select(CUSTOM_PARTNER_SELECT)
      .eq('shop_id', shopId)
      .order('created_at', { ascending: false })

    if (error) {
      throw new VendorShippingError(VENDOR_SHIPPING_ERROR_CODES.PARTNER_LOAD_FAILED, error.message)
    }

    return ok((data ?? []) as CustomShippingPartner[])
  } catch (error) {
    return fail(error)
  }
}

export async function createCustomShippingPartner(
  shopId: string,
  input: CustomPartnerInput,
  context?: VendorShippingAccessContext,
): Promise<VendorShippingServiceResponse<CustomShippingPartner>> {
  try {
    await assertShopAccess(shopId, context)
    const validation = validateCustomPartnerInput(input)
    if (!validation.isValid) {
      throw new VendorShippingError(
        VENDOR_SHIPPING_ERROR_CODES.VALIDATION_FAILED,
        validation.errors[0],
      )
    }

    const { data: provider, error: providerError } = await supabase
      .from('shipping_providers')
      .insert({
        shop_id: shopId,
        provider_type: CUSTOM_PROVIDER_TYPE,
        provider_name: validation.data!.partner_name,
        is_active: true,
        is_primary: false,
        priority: 10,
        configuration: {},
      })
      .select()
      .single()

    if (providerError || !provider) {
      throw new VendorShippingError(VENDOR_SHIPPING_ERROR_CODES.PARTNER_CREATE_FAILED, providerError?.message)
    }

    const { data: partner, error: partnerError } = await supabase
      .from('custom_shipping_partners')
      .insert({
        shipping_provider_id: provider.id,
        shop_id: shopId,
        partner_name: validation.data!.partner_name,
        contact_person: input.contact_person ?? null,
        phone: input.phone ?? null,
        email: input.email ?? null,
        website: input.website ?? null,
        tracking_url_template: input.tracking_url_template ?? null,
        pickup_address: input.pickup_address ?? null,
        service_areas: input.service_areas ?? [],
        is_verified: false,
      })
      .select(CUSTOM_PARTNER_SELECT)
      .single()

    if (partnerError || !partner) {
      throw new VendorShippingError(VENDOR_SHIPPING_ERROR_CODES.PARTNER_CREATE_FAILED, partnerError?.message)
    }

    return ok(partner as CustomShippingPartner, 'Custom shipping partner added successfully')
  } catch (error) {
    return fail(error)
  }
}
