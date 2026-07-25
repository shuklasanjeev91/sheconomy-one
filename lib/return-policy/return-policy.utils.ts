import {
  DEFAULT_RETURN_POLICY_VALUES,
  RETURN_POLICY_DISPLAY,
  RETURN_POLICY_VALIDATION,
  RETURN_SHIPPING_PAID_BY,
} from '~/lib/return-policy/return-policy.constants'
import type {
  AssignedReturnPolicy,
  ReturnPolicy,
  ReturnPolicyFormatted,
  ReturnPolicyInput,
} from '~/lib/return-policy/return-policy.type'

// ============= DEFAULTS =============

/** Generates default return policy input for a new shop policy. */
export function getDefaultReturnPolicy(shopName?: string | null): ReturnPolicyInput {
  const name = shopName?.trim() || RETURN_POLICY_DISPLAY.FALLBACK_SHOP_NAME
  return {
    policy_name: `${name} Return Policy`,
    is_default: DEFAULT_RETURN_POLICY_VALUES.IS_DEFAULT,
    return_window_days: DEFAULT_RETURN_POLICY_VALUES.RETURN_WINDOW_DAYS,
    accepts_returns: DEFAULT_RETURN_POLICY_VALUES.ACCEPTS_RETURNS,
    accepts_exchanges: DEFAULT_RETURN_POLICY_VALUES.ACCEPTS_EXCHANGES,
    accepts_refunds: DEFAULT_RETURN_POLICY_VALUES.ACCEPTS_REFUNDS,
    return_shipping_paid_by: DEFAULT_RETURN_POLICY_VALUES.RETURN_SHIPPING_PAID_BY,
    condition_description: DEFAULT_RETURN_POLICY_VALUES.CONDITION_DESCRIPTION,
    policy_details: DEFAULT_RETURN_POLICY_VALUES.POLICY_DETAILS,
    is_active: DEFAULT_RETURN_POLICY_VALUES.IS_ACTIVE,
  }
}

// ============= SORT / FILTER =============

/** Sort policies with default first, then newest created. */
export function sortReturnPolicies<T extends Pick<ReturnPolicy, 'is_default' | 'created_at'>>(
  policies: T[] | null | undefined,
): T[] {
  if (!Array.isArray(policies)) return []

  return [...policies].sort((a, b) => {
    if (a.is_default && !b.is_default) return -1
    if (!a.is_default && b.is_default) return 1
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  })
}

/** Case-insensitive search across policy name and details. */
export function filterReturnPoliciesByQuery<T extends Pick<ReturnPolicy, 'policy_name' | 'policy_details'>>(
  policies: T[],
  query: string,
): T[] {
  const needle = query.trim().toLowerCase()
  if (!needle) return policies

  return policies.filter((policy) => {
    const name = policy.policy_name?.toLowerCase() ?? ''
    const details = policy.policy_details?.toLowerCase() ?? ''
    return name.includes(needle) || details.includes(needle)
  })
}

// ============= FORMAT =============

function buildServicesDisplay(policy: Pick<ReturnPolicy, 'accepts_returns' | 'accepts_exchanges' | 'accepts_refunds'>): string {
  const accepted: string[] = []
  if (policy.accepts_returns) accepted.push(RETURN_POLICY_DISPLAY.SERVICE_RETURNS)
  if (policy.accepts_exchanges) accepted.push(RETURN_POLICY_DISPLAY.SERVICE_EXCHANGES)
  if (policy.accepts_refunds) accepted.push(RETURN_POLICY_DISPLAY.SERVICE_REFUNDS)
  return accepted.join(', ') || RETURN_POLICY_DISPLAY.SERVICE_NONE
}

function buildShippingDisplay(returnShippingPaidBy: string | null | undefined): string {
  return returnShippingPaidBy === RETURN_SHIPPING_PAID_BY.SELLER
    ? RETURN_POLICY_DISPLAY.SHIPPING_SELLER
    : RETURN_POLICY_DISPLAY.SHIPPING_BUYER
}

/** Adds display-friendly fields for cards and tables. */
export function formatReturnPolicy(
  policy: ReturnPolicy | null | undefined,
): ReturnPolicyFormatted | null {
  if (!policy) return null

  return {
    ...policy,
    window_display: `${policy.return_window_days} ${RETURN_POLICY_DISPLAY.WINDOW_SUFFIX}`,
    services_display: buildServicesDisplay(policy),
    shipping_display: buildShippingDisplay(policy.return_shipping_paid_by),
    is_default_display: policy.is_default
      ? RETURN_POLICY_DISPLAY.DEFAULT_LABEL
      : RETURN_POLICY_DISPLAY.CUSTOM_LABEL,
  }
}

export function formatReturnPolicies(
  policies: ReturnPolicy[] | null | undefined,
): ReturnPolicyFormatted[] {
  return sortReturnPolicies(policies ?? [])
    .map((policy) => formatReturnPolicy(policy))
    .filter((row): row is ReturnPolicyFormatted => row !== null)
}

// ============= STATE HELPERS =============

/** When one policy becomes default, clear the flag on all others in the same shop. */
export function applyDefaultPolicyChange(
  policies: ReturnPolicy[],
  policyId: string,
  isDefault: boolean,
): ReturnPolicy[] {
  if (!isDefault) {
    return policies.map((policy) =>
      policy.id === policyId ? { ...policy, is_default: false } : policy,
    )
  }

  const target = policies.find((policy) => policy.id === policyId)
  if (!target) return policies

  return policies.map((policy) => {
    if (policy.id === policyId) return { ...policy, is_default: true }
    if (policy.shop_id === target.shop_id && policy.is_default) {
      return { ...policy, is_default: false }
    }
    return policy
  })
}

export function upsertReturnPolicy(policies: ReturnPolicy[], policy: ReturnPolicy): ReturnPolicy[] {
  const next = policies.some((row) => row.id === policy.id)
    ? policies.map((row) => (row.id === policy.id ? policy : row))
    : [...policies, policy]

  return sortReturnPolicies(
    policy.is_default ? applyDefaultPolicyChange(next, policy.id, true) : next,
  )
}

export function removeReturnPolicyById(policies: ReturnPolicy[], policyId: string): ReturnPolicy[] {
  return policies.filter((policy) => policy.id !== policyId)
}

export function upsertListingAssignment(
  assignments: AssignedReturnPolicy[],
  policy: AssignedReturnPolicy,
): AssignedReturnPolicy[] {
  if (assignments.some((row) => row.id === policy.id)) return assignments
  return [...assignments, policy]
}

export function removeListingAssignment(
  assignments: AssignedReturnPolicy[],
  returnPolicyId: string,
): AssignedReturnPolicy[] {
  return assignments.filter((row) => row.id !== returnPolicyId)
}

export function shouldUseReturnPolicyCache(
  lastFetch: number | null | undefined,
  forceRefresh?: boolean,
): boolean {
  if (forceRefresh) return false
  if (!lastFetch) return false
  return Date.now() - lastFetch < RETURN_POLICY_VALIDATION.CACHE_TTL_MS
}

export function buildOptimisticReturnPolicy(
  requestId: string,
  shopId: string,
  input: ReturnPolicyInput,
): ReturnPolicy {
  const now = new Date().toISOString()
  return {
    id: `temp-${requestId}`,
    shop_id: shopId,
    policy_name: input.policy_name.trim(),
    is_default: input.is_default ?? false,
    return_window_days: input.return_window_days ?? DEFAULT_RETURN_POLICY_VALUES.RETURN_WINDOW_DAYS,
    accepts_returns: input.accepts_returns ?? DEFAULT_RETURN_POLICY_VALUES.ACCEPTS_RETURNS,
    accepts_exchanges: input.accepts_exchanges ?? DEFAULT_RETURN_POLICY_VALUES.ACCEPTS_EXCHANGES,
    accepts_refunds: input.accepts_refunds ?? DEFAULT_RETURN_POLICY_VALUES.ACCEPTS_REFUNDS,
    condition_description: input.condition_description?.trim() || null,
    return_shipping_paid_by: input.return_shipping_paid_by ?? DEFAULT_RETURN_POLICY_VALUES.RETURN_SHIPPING_PAID_BY,
    policy_details: input.policy_details?.trim() || null,
    is_active: input.is_active ?? DEFAULT_RETURN_POLICY_VALUES.IS_ACTIVE,
    created_at: now,
    updated_at: now,
  }
}

export function buildOptimisticListingAssignment(
  policy: ReturnPolicy,
  assignedAt?: string,
): AssignedReturnPolicy {
  return {
    ...policy,
    assigned_at: assignedAt ?? new Date().toISOString(),
  }
}
