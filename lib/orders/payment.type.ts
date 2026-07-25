/**
 * Types for the order payments domain.
 *
 * Rows come from the generated Supabase types; extra fields the legacy service
 * kept in bespoke columns (`gateway_response`, `refund_amount`,
 * `cod_receipt_number`, …) now live inside `payment_metadata` (Json).
 */

import type { Tables } from '~/lib/supabase'

import type { OrderStatus, PaymentMode, PaymentStatus } from '~/lib/orders/order.constants'
import type { OrderServiceResponse } from '~/lib/orders/vendor-orders.type'

// Shared response envelope, re-exported so payment code is a one-stop import.
export type { OrderServiceResponse }

// ============= BASE ROWS =============

export type OrderPayment = Tables<'order_payments'>

// ============= INPUTS =============

export type ProcessPaymentInput = {
  order_id: string
  payment_mode: PaymentMode
  amount: number
  transaction_id?: string | null
  payment_gateway?: string | null
  /** Raw gateway payload — stored under `payment_metadata.gateway_response`. */
  gateway_response?: unknown
}

export type UpdatePaymentStatusMetadata = {
  failure_reason?: string | null
  failure_code?: string | null
  refund_amount?: number | null
  [key: string]: unknown
}

export type CODCollectionInput = {
  collected_by?: string | null
  amount?: number | null
  receipt_number?: string | null
  notes?: string | null
}

// ============= ANALYTICS =============

export type PaymentAnalyticsFilters = {
  date_from?: string
  date_to?: string
  payment_mode?: PaymentMode
  payment_status?: PaymentStatus
}

export type PaymentAnalytics = {
  total_payments: number
  total_amount: number
  by_mode: Record<string, number>
  by_status: Record<string, number>
  /** Percentage (0–100) of payments that reached `completed`. */
  success_rate: number
}

/** A payment row joined with its parent order status (analytics query shape). */
export type PaymentWithOrder = Pick<
  OrderPayment,
  'payment_mode' | 'payment_status' | 'amount' | 'created_at' | 'order_id'
> & {
  orders?: { order_status: OrderStatus } | null
}
