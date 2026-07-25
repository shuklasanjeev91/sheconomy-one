import {
  RETURN_POLICY_DISPLAY,
  RETURN_POLICY_VALIDATION,
  RETURN_SHIPPING_PAID_BY,
} from '~/lib/return-policy/return-policy.constants'
import { RETURN_POLICY_UI_COPY } from '~/lib/return-policy/return-policy-ui.copy'
import type {
  ReturnPolicy,
  ReturnPolicyFormData,
  ReturnPolicyInput,
  ReturnShippingPaidBy,
} from '~/lib/return-policy/return-policy.type'
import { buildDefaultReturnPolicyFormData } from '~/lib/return-policy/return-policy.validation'
import { formatReturnPolicy, sortReturnPolicies } from '~/lib/return-policy/return-policy.utils'

export type ReturnPolicyWindowOption = {
  value: number
  label: string
}

export type ReturnPolicyServiceOption = {
  id: 'accepts_returns' | 'accepts_exchanges' | 'accepts_refunds'
  label: string
  icon: 'Undo2' | 'Repeat' | 'Banknote'
}

export type ReturnPolicyHubStats = {
  activeCount: number
  totalCount: number
  defaultWindowDays: number | null
  shippingPaidBy: ReturnShippingPaidBy | null
  shippingPaidByLabel: string
  hasDefaultPolicy: boolean
}

export type ReturnPolicyBadge = {
  label: string
  tone: 'primary' | 'muted' | 'warning'
}

/** Common return-window presets for the select control. */
export function getReturnPolicyWindowOptions(): ReturnPolicyWindowOption[] {
  const presets = [7, 14, 30, 45, 60, 90, 120, 180, 365]
  return presets.map((value) => ({
    value,
    label: `${value} ${RETURN_POLICY_DISPLAY.WINDOW_SUFFIX}`,
  }))
}

export function getReturnPolicyServiceOptions(): ReturnPolicyServiceOption[] {
  return [
    { id: 'accepts_returns', label: RETURN_POLICY_UI_COPY.acceptReturns, icon: 'Undo2' },
    { id: 'accepts_exchanges', label: RETURN_POLICY_UI_COPY.acceptExchanges, icon: 'Repeat' },
    { id: 'accepts_refunds', label: RETURN_POLICY_UI_COPY.acceptRefunds, icon: 'Banknote' },
  ]
}

export function getReturnShippingOptions(): Array<{
  value: ReturnShippingPaidBy
  label: string
}> {
  return [
    { value: RETURN_SHIPPING_PAID_BY.BUYER, label: RETURN_POLICY_UI_COPY.customerPays },
    { value: RETURN_SHIPPING_PAID_BY.SELLER, label: RETURN_POLICY_UI_COPY.vendorPays },
  ]
}

export function createReturnPolicyFormData(shopName?: string | null): ReturnPolicyFormData {
  return buildDefaultReturnPolicyFormData(shopName)
}

export function returnPolicyToFormData(policy: ReturnPolicy): ReturnPolicyFormData {
  const shipping =
    policy.return_shipping_paid_by === RETURN_SHIPPING_PAID_BY.SELLER
      ? RETURN_SHIPPING_PAID_BY.SELLER
      : RETURN_SHIPPING_PAID_BY.BUYER

  return {
    policy_name: policy.policy_name,
    is_default: policy.is_default,
    return_window_days: policy.return_window_days,
    accepts_returns: policy.accepts_returns,
    accepts_exchanges: policy.accepts_exchanges,
    accepts_refunds: policy.accepts_refunds,
    condition_description: policy.condition_description ?? '',
    return_shipping_paid_by: shipping,
    policy_details: policy.policy_details ?? '',
    is_active: policy.is_active,
  }
}

export function formDataToReturnPolicyInput(form: ReturnPolicyFormData): ReturnPolicyInput {
  return {
    policy_name: form.policy_name.trim(),
    is_default: form.is_default,
    return_window_days: form.return_window_days,
    accepts_returns: form.accepts_returns,
    accepts_exchanges: form.accepts_exchanges,
    accepts_refunds: form.accepts_refunds,
    condition_description: form.condition_description.trim() || null,
    return_shipping_paid_by: form.return_shipping_paid_by,
    policy_details: form.policy_details.trim() || null,
    is_active: form.is_active,
  }
}

export function computeReturnPolicyHubStats(policies: ReturnPolicy[]): ReturnPolicyHubStats {
  const sorted = sortReturnPolicies(policies)
  const active = sorted.filter((row) => row.is_active)
  const defaultPolicy = sorted.find((row) => row.is_default) ?? active[0] ?? sorted[0] ?? null

  const shippingPaidBy =
    defaultPolicy?.return_shipping_paid_by === RETURN_SHIPPING_PAID_BY.SELLER
      ? RETURN_SHIPPING_PAID_BY.SELLER
      : defaultPolicy?.return_shipping_paid_by === RETURN_SHIPPING_PAID_BY.BUYER
        ? RETURN_SHIPPING_PAID_BY.BUYER
        : null

  return {
    activeCount: active.length,
    totalCount: sorted.length,
    defaultWindowDays: defaultPolicy?.return_window_days ?? null,
    shippingPaidBy,
    shippingPaidByLabel: shippingPaidBy
      ? shippingPaidBy === RETURN_SHIPPING_PAID_BY.SELLER
        ? RETURN_POLICY_DISPLAY.SHIPPING_SELLER
        : RETURN_POLICY_DISPLAY.SHIPPING_BUYER
      : '—',
    hasDefaultPolicy: Boolean(defaultPolicy?.is_default),
  }
}

export function getReturnPolicyBadge(policy: ReturnPolicy): ReturnPolicyBadge {
  if (!policy.is_active) {
    return { label: 'Inactive', tone: 'warning' }
  }
  if (policy.is_default) {
    return { label: 'Primary', tone: 'primary' }
  }
  return { label: RETURN_POLICY_DISPLAY.CUSTOM_LABEL, tone: 'muted' }
}

export function buildReturnPolicyTags(policy: ReturnPolicy): string[] {
  const formatted = formatReturnPolicy(policy)
  if (!formatted) return []

  const tags: string[] = []
  if (policy.accepts_returns) tags.push('Returns Accepted')
  if (policy.accepts_exchanges) tags.push('Exchanges Accepted')
  if (policy.accepts_refunds) tags.push('Refunds Accepted')
  if (!policy.accepts_returns && !policy.accepts_exchanges && !policy.accepts_refunds) {
    tags.push('No Returns')
  }
  tags.push(formatted.window_display)
  if (policy.condition_description?.trim()) tags.push('Condition Rules')
  return tags
}

export function formatReturnWindowLabel(days: number | null | undefined): string {
  if (days == null) return '—'
  return `${days} ${RETURN_POLICY_DISPLAY.WINDOW_SUFFIX}`
}

export function returnPolicySearchResultsCount(shown: number, total: number): string {
  return `${shown} of ${total} policies`
}

export function getCharacterLimit(field: 'condition' | 'details'): number {
  return field === 'condition'
    ? RETURN_POLICY_VALIDATION.CONDITION_DESCRIPTION.MAX_LENGTH
    : RETURN_POLICY_VALIDATION.POLICY_DETAILS.MAX_LENGTH
}
