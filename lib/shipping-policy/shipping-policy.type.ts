import type { Json, Tables, TablesInsert, TablesUpdate } from '~/lib/supabase'

import type {
  SHIPPING_RATE_TYPE_VALUES,
  SHIPPING_ZONE_TYPE_VALUES,
} from './shipping-policy.constants'

/** Full `delivery_profiles` row — shop-level shipping configuration. */
export type ShippingPolicy = Tables<'delivery_profiles'>

export type ShippingPolicyInsert = TablesInsert<'delivery_profiles'>
export type ShippingPolicyUpdate = TablesUpdate<'delivery_profiles'>

export type ListingDeliveryPolicyRow = Tables<'listing_delivery_profiles'>

export type ShippingRateType = (typeof SHIPPING_RATE_TYPE_VALUES)[number]
export type ShippingZoneType = (typeof SHIPPING_ZONE_TYPE_VALUES)[number]

export type ShippingRate = {
  fee: number
  min_order: number
  max_order?: number | null
  max_weight?: number | null
  estimated_days?: number | null
}

export type ShippingZone = {
  zone: ShippingZoneType | string
  zone_name?: string | null
  description?: string | null
  countries: string[]
  rates?: ShippingRate[]
}

/** Policy linked to a listing, including assignment timestamp. */
export type AssignedShippingPolicy = ShippingPolicy & {
  assigned_at: string
}

export type ShippingPolicyInput = {
  profile_name: string
  is_default?: boolean
  is_active?: boolean
  processing_time_min?: number
  processing_time_max?: number
  shipping_zones?: ShippingZone[]
  free_shipping_threshold?: number | null
  delivery_metadata?: Record<string, unknown> | null
  shipping_rate_type?: ShippingRateType | null
  fixed_fee?: number | null
}

export type ShippingPolicyFormData = {
  profile_name: string
  is_default: boolean
  is_active: boolean
  processing_time_min: number
  processing_time_max: number
  shipping_rate_type: ShippingRateType
  fixed_fee: number
  free_shipping_threshold: number | null
  shipping_zones: ShippingZone[]
  delivery_metadata: Record<string, unknown>
}

export type ShippingPolicyValidationResult = {
  isValid: boolean
  errors: Record<string, string>
  fieldErrors: string[]
}

export type ShippingPolicyServiceResponse<T> = {
  success: boolean
  data: T | null
  error: string | null
  message?: string | null
}

export type ShippingPolicyAccessContext = {
  userId?: string | null
  role?: string | null
}

export type ShippingPolicyFormatted = ShippingPolicy & {
  processing_time_display: string
  free_shipping_display: string
  zones_count: number
  is_default_display: string
  rate_type_display: string
}

export type DeleteShippingPolicyResult = {
  policyId: string
  profileName: string
  shopId: string
}

export type AssignShippingPolicyResult = {
  listingId: string
  deliveryProfileId: string
}

export type RemoveShippingPolicyResult = AssignShippingPolicyResult

export type ShippingChargeResult = {
  shippingAmount: number
  deliveryProfile: ShippingPolicy | null
  estimatedDays: number
  isFreeShipping: boolean
  freeShippingThreshold?: number | null
}

export const EMPTY_SHIPPING_POLICY_FORM_DATA: ShippingPolicyFormData = {
  profile_name: '',
  is_default: false,
  is_active: true,
  processing_time_min: 1,
  processing_time_max: 3,
  shipping_rate_type: 'fixed',
  fixed_fee: 0,
  free_shipping_threshold: null,
  shipping_zones: [],
  delivery_metadata: {},
}

/** Normalise JSON shipping_zones from Supabase into typed zones. */
export function parseShippingZonesFromJson(value: Json | null | undefined): ShippingZone[] {
  if (!value) return []
  if (Array.isArray(value)) return value as ShippingZone[]
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value) as unknown
      return Array.isArray(parsed) ? (parsed as ShippingZone[]) : []
    } catch {
      return []
    }
  }
  return []
}
