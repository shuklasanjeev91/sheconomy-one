import type { Json, Tables } from '~/lib/supabase'

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
