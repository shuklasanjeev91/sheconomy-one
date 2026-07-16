import type { Tables, TablesInsert, TablesUpdate } from '~/lib/supabase'
import type { AddressSource } from '~/lib/location/types'

/** Full `addresses` row from Supabase. */
export type Address = Tables<'addresses'>

export type AddressInsert = TablesInsert<'addresses'>
export type AddressUpdate = TablesUpdate<'addresses'>

/** Stable address-type keys stored in `address_type`. */
export const ADDRESS_TYPE = {
  HOME: 'home',
  WORK: 'work',
  SHIPPING: 'shipping',
  BILLING: 'billing',
  BUSINESS: 'business',
} as const

export type AddressType = (typeof ADDRESS_TYPE)[keyof typeof ADDRESS_TYPE]

/** All supported address types in display order. */
export const ADDRESS_TYPES: readonly AddressType[] = [
  ADDRESS_TYPE.HOME,
  ADDRESS_TYPE.WORK,
  ADDRESS_TYPE.SHIPPING,
  ADDRESS_TYPE.BILLING,
  ADDRESS_TYPE.BUSINESS,
] as const

/** Human-readable labels keyed by `address_type`. */
export const ADDRESS_TYPE_LABELS: Record<AddressType, string> = {
  [ADDRESS_TYPE.HOME]: 'Home',
  [ADDRESS_TYPE.WORK]: 'Work',
  [ADDRESS_TYPE.SHIPPING]: 'Shipping',
  [ADDRESS_TYPE.BILLING]: 'Billing',
  [ADDRESS_TYPE.BUSINESS]: 'Business',
}

/** Sort priority when multiple addresses share the same default flag. */
export const ADDRESS_TYPE_PRIORITY: Record<AddressType, number> = {
  [ADDRESS_TYPE.HOME]: 1,
  [ADDRESS_TYPE.WORK]: 2,
  [ADDRESS_TYPE.SHIPPING]: 3,
  [ADDRESS_TYPE.BILLING]: 4,
  [ADDRESS_TYPE.BUSINESS]: 5,
}

/** Field-length and selection limits — single source of truth for Zod + UI. */
export const ADDRESS_VALIDATION = {
  ADDRESS_LINE_1: { MIN_LENGTH: 3, MAX_LENGTH: 255 },
  ADDRESS_LINE_2: { MAX_LENGTH: 255 },
  CITY: { MIN_LENGTH: 2, MAX_LENGTH: 100 },
  STATE: { MIN_LENGTH: 2, MAX_LENGTH: 100 },
  POSTAL_CODE: { MIN_LENGTH: 3, MAX_LENGTH: 20 },
  ADDRESS_LABEL: { MAX_LENGTH: 50 },
  SEARCH_MIN_LENGTH: 2,
  /** Skip refetch when data was loaded within this window (ms). */
  CACHE_TTL_MS: 30_000,
  /** How many days count as "recently added" in stats. */
  RECENT_DAYS: 7,
} as const

/** In-memory form buffer used by create/edit drawers. */
export type AddressFormData = {
  address_line_1: string
  address_line_2: string
  city: string
  state: string
  postal_code: string
  country: string
  address_type: AddressType
  is_default: boolean
  address_label: string
  latitude?: number | null
  longitude?: number | null
  place_id?: string | null
  source?: AddressSource | null
}

export type AddressValidationResult = {
  isValid: boolean
  errors: Partial<Record<keyof AddressFormData, string>>
}

/** Payload accepted by create/update service functions (snake_case). */
export type AddressInput = {
  address_line_1: string
  address_line_2?: string | null
  city: string
  state: string
  postal_code: string
  country?: string
  address_type?: AddressType
  is_default?: boolean
  address_label?: string | null
  latitude?: number | null
  longitude?: number | null
  place_id?: string | null
  source?: AddressSource | null
}

/** Aggregated counts shown in the address stats panel. */
export type AddressStats = {
  total: number
  byType: Partial<Record<AddressType, number>>
  defaultCount: number
  recentlyAdded: number
}

/** Standard service response envelope (mirrors shop module). */
export type AddressServiceResponse<T> = {
  data: T | null
  error: string | null
  success: boolean
}

/** Result from RPC helpers that return `{ success, message }`. */
export type AddressActionResult = {
  success: boolean
  message: string
}

export const EMPTY_ADDRESS_FORM_DATA: AddressFormData = {
  address_line_1: '',
  address_line_2: '',
  city: '',
  state: '',
  postal_code: '',
  country: '',
  address_type: ADDRESS_TYPE.HOME,
  is_default: false,
  address_label: '',
  latitude: null,
  longitude: null,
  place_id: null,
  source: 'manual',
}
