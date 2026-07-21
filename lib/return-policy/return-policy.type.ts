import type { Tables, TablesInsert, TablesUpdate } from '~/lib/supabase'

import type { RETURN_SHIPPING_PAID_BY_VALUES } from './return-policy.constants'

/** Full `return_policies` row from Supabase. */
export type ReturnPolicy = Tables<'return_policies'>

export type ReturnPolicyInsert = TablesInsert<'return_policies'>
export type ReturnPolicyUpdate = TablesUpdate<'return_policies'>

export type ListingReturnPolicyRow = Tables<'listing_return_policies'>

export type ReturnShippingPaidBy = (typeof RETURN_SHIPPING_PAID_BY_VALUES)[number]

/** Policy linked to a listing, including assignment timestamp. */
export type AssignedReturnPolicy = ReturnPolicy & {
  assigned_at: string
}

/** Create / edit form payload (camelCase-friendly alias also supported via normalisation). */
export type ReturnPolicyInput = {
  policy_name: string
  is_default?: boolean
  return_window_days?: number
  accepts_returns?: boolean
  accepts_exchanges?: boolean
  accepts_refunds?: boolean
  condition_description?: string | null
  return_shipping_paid_by?: ReturnShippingPaidBy | null
  policy_details?: string | null
  is_active?: boolean
}

/** In-memory form buffer for create/edit drawers. */
export type ReturnPolicyFormData = {
  policy_name: string
  is_default: boolean
  return_window_days: number
  accepts_returns: boolean
  accepts_exchanges: boolean
  accepts_refunds: boolean
  condition_description: string
  return_shipping_paid_by: ReturnShippingPaidBy
  policy_details: string
  is_active: boolean
}

export type ReturnPolicyValidationResult = {
  isValid: boolean
  errors: Record<string, string>
  fieldErrors: string[]
}

export type ReturnPolicyServiceResponse<T> = {
  success: boolean
  data: T | null
  error: string | null
  message?: string | null
}

/** Optional caller context for vendor, admin, or impersonation flows. */
export type ReturnPolicyAccessContext = {
  userId?: string | null
  role?: string | null
}

export type ReturnPolicyFormatted = ReturnPolicy & {
  window_display: string
  services_display: string
  shipping_display: string
  is_default_display: string
}

export type DeleteReturnPolicyResult = {
  policyId: string
  policyName: string
  shopId: string
}

export type AssignReturnPolicyResult = {
  listingId: string
  returnPolicyId: string
}

export type RemoveReturnPolicyResult = AssignReturnPolicyResult

export const EMPTY_RETURN_POLICY_FORM_DATA: ReturnPolicyFormData = {
  policy_name: '',
  is_default: false,
  return_window_days: 30,
  accepts_returns: true,
  accepts_exchanges: true,
  accepts_refunds: true,
  condition_description: '',
  return_shipping_paid_by: 'buyer',
  policy_details: '',
  is_active: true,
}
