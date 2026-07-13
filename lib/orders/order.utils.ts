/**
 * Shared, pure order helpers (no I/O).
 *
 * Migrated from the legacy `lib/utils/orders/formatters.js`, aligned to the
 * generated enums and this project's `formatCurrency`. Role-aware where the
 * legacy code was (admins get override transitions).
 */

import { formatCurrency } from '~/lib/format'
import { USER_ROLES, type UserRole } from '~/lib/profile/profile.type'

import {
  ADMIN_OVERRIDE_STATUSES,
  FINAL_ORDER_STATUSES,
  ORDER_DEFAULTS,
  ORDER_STATUS,
  ORDER_STATUS_DISPLAY,
  ORDER_STATUS_PROGRESS,
  VALID_STATUS_TRANSITIONS,
  type OrderStatus,
  type OrderStatusDisplay,
} from './order.constants'

// ============= MONEY / DATES =============

/** Format an order amount using the order/shop currency (default INR). */
export function formatOrderAmount(
  amount: number | string | null | undefined,
  currency = ORDER_DEFAULTS.CURRENCY,
): string {
  const numeric = typeof amount === 'number' ? amount : Number(amount ?? 0)
  if (!Number.isFinite(numeric)) return formatCurrency(0, currency || ORDER_DEFAULTS.CURRENCY)
  return formatCurrency(numeric, currency || ORDER_DEFAULTS.CURRENCY)
}

/** Localised order date (e.g. "05 Jul 2026"); optionally with time. */
export function formatOrderDate(
  date: string | Date | null | undefined,
  withTime = false,
): string {
  if (!date) return 'N/A'
  const dateObj = new Date(date)
  if (Number.isNaN(dateObj.getTime())) return 'Invalid Date'
  return dateObj.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    ...(withTime ? { hour: '2-digit', minute: '2-digit', hour12: true } : {}),
  })
}

// ============= STATUS PRESENTATION =============

const UNKNOWN_STATUS_DISPLAY: OrderStatusDisplay = {
  label: 'Unknown',
  tone: 'gray',
  icon: 'HelpCircle',
  description: 'Unknown status',
}

/** Presentation data (label / tone / icon) for an order status. */
export function getOrderStatusDisplay(status: OrderStatus | string | null | undefined): OrderStatusDisplay {
  if (!status) return UNKNOWN_STATUS_DISPLAY
  return ORDER_STATUS_DISPLAY[status as OrderStatus] ?? { ...UNKNOWN_STATUS_DISPLAY, label: String(status) }
}

/** Progress percentage (0–100) for tracking bars. */
export function getOrderProgress(status: OrderStatus | string | null | undefined): number {
  if (!status) return 0
  return ORDER_STATUS_PROGRESS[status as OrderStatus] ?? 0
}

export function isFinalOrderStatus(status: OrderStatus | string | null | undefined): boolean {
  return Boolean(status) && FINAL_ORDER_STATUSES.includes(status as OrderStatus)
}

// ============= STATUS MACHINE =============

/** Next statuses reachable from `current`, widened for admins. */
export function getNextPossibleStatuses(
  current: OrderStatus | string | null | undefined,
  role: UserRole | string | null = USER_ROLES.USER,
): OrderStatus[] {
  const base = current ? VALID_STATUS_TRANSITIONS[current as OrderStatus] ?? [] : []
  if (role === USER_ROLES.ADMIN) {
    return [...new Set([...base, ...ADMIN_OVERRIDE_STATUSES])]
  }
  return [...base]
}

/**
 * Whether a status transition is allowed. Admins may force the override
 * statuses (cancel / refund / hold) from any non-final status.
 */
export function isValidStatusTransition(
  current: OrderStatus | string | null | undefined,
  next: OrderStatus | string | null | undefined,
  role: UserRole | string | null = USER_ROLES.USER,
): boolean {
  if (!current || !next) return false
  if (role === USER_ROLES.ADMIN && ADMIN_OVERRIDE_STATUSES.includes(next as OrderStatus)) {
    return !isFinalOrderStatus(current)
  }
  return (VALID_STATUS_TRANSITIONS[current as OrderStatus] ?? []).includes(next as OrderStatus)
}

export type StatusTransitionValidation = { isValid: boolean; error: string | null }

/** Structured transition validation (used by the service before writing). */
export function validateStatusTransition(
  current: OrderStatus | string | null | undefined,
  next: OrderStatus | string | null | undefined,
  role: UserRole | string | null = USER_ROLES.USER,
): StatusTransitionValidation {
  if (!current || !next) {
    return { isValid: false, error: 'Both current and new status are required' }
  }
  const known = Object.values(ORDER_STATUS) as string[]
  if (!known.includes(current as string)) return { isValid: false, error: 'Invalid current status' }
  if (!known.includes(next as string)) return { isValid: false, error: 'Invalid new status' }
  if (!isValidStatusTransition(current, next, role)) {
    return { isValid: false, error: `Cannot transition from ${current} to ${next}` }
  }
  return { isValid: true, error: null }
}
