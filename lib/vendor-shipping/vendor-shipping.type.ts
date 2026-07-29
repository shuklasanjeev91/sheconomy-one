import type { Json, Tables } from '~/lib/supabase'

export type ShiprocketConfigRow = Tables<'shiprocket_config'>
export type ShippingProviderRow = Tables<'shipping_providers'>
export type CustomShippingPartnerRow = Tables<'custom_shipping_partners'>

export type PickupAddress = {
  address_line1?: string
  address_line2?: string
  city?: string
  state?: string
  pincode?: string
  country?: string
}

export type ShiprocketPublicConfig = {
  id: string
  email: string
  is_connected: boolean | null
  company_id: number | null
  channel_id: number | null
  pickup_location_id: number | null
  auto_ship_enabled: boolean | null
  last_sync_at: string | null
}

export type ShiprocketStatus = {
  connected: boolean
  expired?: boolean
  message?: string
  config?: ShiprocketPublicConfig | null
}

export type CustomShippingPartner = CustomShippingPartnerRow & {
  pickup_address?: PickupAddress | null
  shipping_providers?: Pick<
    ShippingProviderRow,
    'id' | 'provider_name' | 'is_active' | 'is_primary' | 'priority'
  > | null
}

export type CustomPartnerInput = {
  partner_name: string
  contact_person?: string | null
  phone?: string | null
  email?: string | null
  website?: string | null
  tracking_url_template?: string | null
  pickup_address?: PickupAddress | null
  service_areas?: string[]
}

export type VendorShippingAccessContext = {
  userId?: string | null
  role?: string | null
}

export type VendorShippingServiceResponse<T> = {
  success: boolean
  data: T | null
  error: string | null
  message?: string | null
}

export type ConnectShiprocketInput = {
  shopId: string
  email: string
  password: string
  accessContext?: VendorShippingAccessContext
}

export type ShiprocketEdgeAction = 'status' | 'connect' | 'disconnect'

export type ShiprocketEdgeRequest = {
  action: ShiprocketEdgeAction
  shopId: string
  email?: string
  password?: string
}

export type ShiprocketEdgeResponse = ShiprocketStatus & {
  success?: boolean
  message?: string
}

export type CustomPartnerFormInput = {
  partner_name: string
  contact_person: string
  phone: string
  email: string
  website: string
  tracking_url_template: string
  pickup_address: Required<PickupAddress>
  service_areas: string[]
}

export function emptyCustomPartnerForm(): CustomPartnerFormInput {
  return {
    partner_name: '',
    contact_person: '',
    phone: '',
    email: '',
    website: '',
    tracking_url_template: '',
    pickup_address: {
      address_line1: '',
      address_line2: '',
      city: '',
      state: '',
      pincode: '',
      country: 'India',
    },
    service_areas: [],
  }
}

export function parsePickupAddress(value: Json | null | undefined): PickupAddress | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return value as PickupAddress
}
