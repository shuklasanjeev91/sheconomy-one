/**
 * Payment Service
 *
 * Payment processing and management for orders, migrated from the legacy
 * `paymentService`. Results come back in the shared `OrderServiceResponse`
 * envelope with friendly errors; access is resolved through the shared
 * `order.access` helpers (authenticated for mutations, admin-gated for the
 * platform-wide analytics).
 *
 * Schema note: the modern `order_payments` table has no `gateway_response`,
 * `failed_at`, `refunded_at`, `refund_amount`, `cod_receipt_number` or
 * `payment_notes` columns — those legacy values are folded into the
 * `payment_metadata` JSON blob so nothing is lost.
 */

import { supabase, type TablesUpdate } from '~/lib/supabase'

import { fail, isAdminUser, ok, resolveUserId } from '~/lib/orders/order.access'
import { PAYMENT_MODE, PAYMENT_STATUS, type PaymentMode, type PaymentStatus } from '~/lib/orders/order.constants'
import { validatePaymentData } from '~/lib/orders/payment.validation'
import type {
  CODCollectionInput,
  OrderPayment,
  OrderServiceResponse,
  PaymentAnalytics,
  PaymentAnalyticsFilters,
  PaymentWithOrder,
  ProcessPaymentInput,
  UpdatePaymentStatusMetadata,
} from '~/lib/orders/payment.type'

type PaymentUpdate = TablesUpdate<'order_payments'>

/** Merge extra keys into an existing `payment_metadata` object without clobbering it. */
function mergeMetadata(
  existing: OrderPayment['payment_metadata'] | null | undefined,
  extra: Record<string, unknown>,
): PaymentUpdate['payment_metadata'] {
  const base =
    existing && typeof existing === 'object' && !Array.isArray(existing)
      ? (existing as Record<string, unknown>)
      : {}
  const cleaned = Object.fromEntries(Object.entries(extra).filter(([, v]) => v !== undefined))
  return { ...base, ...cleaned } as unknown as PaymentUpdate['payment_metadata']
}

async function fetchPaymentByOrderMode(
  orderId: string,
  paymentMode: PaymentMode,
): Promise<OrderPayment | null> {
  const { data } = await supabase
    .from('order_payments')
    .select('*')
    .eq('order_id', orderId)
    .eq('payment_mode', paymentMode)
    .maybeSingle()
  return (data as OrderPayment | null) ?? null
}

// ============= MUTATIONS =============

/** Mark an order's payment as processing and attach gateway details. */
export async function processPayment(
  input: ProcessPaymentInput,
  userId?: string | null,
): Promise<OrderServiceResponse<OrderPayment>> {
  const id = await resolveUserId(userId)
  if (!id) return fail('User not authenticated')

  const validation = validatePaymentData(input)
  if (!validation.isValid) return fail(validation.errors.join(', '))

  try {
    const existing = await fetchPaymentByOrderMode(input.order_id, input.payment_mode)
    if (!existing) return fail('Payment record not found')

    const updates: PaymentUpdate = {
      payment_status: PAYMENT_STATUS.PROCESSING,
      transaction_id: input.transaction_id ?? undefined,
      payment_gateway: input.payment_gateway ?? undefined,
      processed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
    if (input.gateway_response !== undefined) {
      updates.payment_metadata = mergeMetadata(existing.payment_metadata, {
        gateway_response: input.gateway_response,
      })
    }

    const { data, error } = await supabase
      .from('order_payments')
      .update(updates)
      .eq('id', existing.id)
      .select('*')
      .single()

    if (error) return fail(error, 'Failed to process payment')
    return ok(data as OrderPayment)
  } catch (error) {
    return fail(error, 'An unexpected error occurred while processing payment')
  }
}

/** Update a payment's status, attaching status-specific metadata. */
export async function updatePaymentStatus(
  paymentId: string,
  status: PaymentStatus,
  metadata: UpdatePaymentStatusMetadata = {},
  userId?: string | null,
): Promise<OrderServiceResponse<OrderPayment>> {
  const id = await resolveUserId(userId)
  if (!id) return fail('User not authenticated')

  if (!paymentId || !status) return fail('Payment ID and status are required')
  if (!(Object.values(PAYMENT_STATUS) as string[]).includes(status)) {
    return fail('Invalid payment status')
  }

  try {
    const { data: existing } = await supabase
      .from('order_payments')
      .select('*')
      .eq('id', paymentId)
      .maybeSingle()
    if (!existing) return fail('Payment record not found')

    const updates: PaymentUpdate = {
      payment_status: status,
      updated_at: new Date().toISOString(),
    }

    if (status === PAYMENT_STATUS.COMPLETED) {
      updates.processed_at = new Date().toISOString()
    } else if (status === PAYMENT_STATUS.FAILED) {
      updates.failure_reason = metadata.failure_reason ?? undefined
      updates.failure_code = metadata.failure_code ?? undefined
    } else if (status === PAYMENT_STATUS.REFUNDED && metadata.refund_amount != null) {
      updates.payment_metadata = mergeMetadata((existing as OrderPayment).payment_metadata, {
        refund_amount: metadata.refund_amount,
        refunded_at: new Date().toISOString(),
      })
    }

    const { data, error } = await supabase
      .from('order_payments')
      .update(updates)
      .eq('id', paymentId)
      .select('*')
      .single()

    if (error) return fail(error, 'Failed to update payment status')
    return ok(data as OrderPayment)
  } catch (error) {
    return fail(error, 'An unexpected error occurred while updating payment status')
  }
}

/** Record a cash-on-delivery collection against an order's COD payment. */
export async function collectCODPayment(
  orderId: string,
  collection: CODCollectionInput = {},
  userId?: string | null,
): Promise<OrderServiceResponse<OrderPayment>> {
  const id = await resolveUserId(userId)
  if (!id) return fail('User not authenticated')
  if (!orderId) return fail('Order ID is required')

  try {
    const existing = await fetchPaymentByOrderMode(orderId, PAYMENT_MODE.COD)
    if (!existing) return fail('COD payment record not found')

    const updates: PaymentUpdate = {
      payment_status: PAYMENT_STATUS.COMPLETED,
      cod_collected_at: new Date().toISOString(),
      cod_collected_by: collection.collected_by ?? id,
      cod_amount: collection.amount ?? existing.cod_amount ?? existing.amount,
      updated_at: new Date().toISOString(),
    }
    if (collection.receipt_number != null || collection.notes != null) {
      updates.payment_metadata = mergeMetadata(existing.payment_metadata, {
        cod_receipt_number: collection.receipt_number ?? undefined,
        payment_notes: collection.notes ?? undefined,
      })
    }

    const { data, error } = await supabase
      .from('order_payments')
      .update(updates)
      .eq('id', existing.id)
      .select('*')
      .single()

    if (error) return fail(error, 'Failed to record COD collection')
    return ok(data as OrderPayment)
  } catch (error) {
    return fail(error, 'An unexpected error occurred while collecting COD payment')
  }
}

// ============= READS =============

/** All payment records for an order, newest first. */
export async function getOrderPayments(
  orderId: string,
  userId?: string | null,
): Promise<OrderServiceResponse<OrderPayment[]>> {
  const id = await resolveUserId(userId)
  if (!id) return fail('User not authenticated')
  if (!orderId) return fail('Order ID is required')

  try {
    const { data, error } = await supabase
      .from('order_payments')
      .select('*')
      .eq('order_id', orderId)
      .order('created_at', { ascending: false })

    if (error) return fail(error, 'Failed to fetch payment details')
    return ok((data as OrderPayment[]) ?? [])
  } catch (error) {
    return fail(error, 'An unexpected error occurred while fetching payment details')
  }
}

// ============= ANALYTICS (admin) =============

/**
 * Platform-wide payment analytics (admin only): totals, per-mode / per-status
 * breakdowns and a completed-payment success rate.
 */
export async function getPaymentAnalytics(
  filters: PaymentAnalyticsFilters = {},
  userId?: string | null,
): Promise<OrderServiceResponse<PaymentAnalytics>> {
  const id = await resolveUserId(userId)
  if (!id) return fail('User not authenticated')
  if (!(await isAdminUser(id))) return fail('Access denied for admin operations')

  try {
    let query = supabase
      .from('order_payments')
      .select('payment_mode, payment_status, amount, created_at, order_id, orders ( order_status )')

    if (filters.date_from) query = query.gte('created_at', filters.date_from)
    if (filters.date_to) query = query.lte('created_at', filters.date_to)
    if (filters.payment_mode) query = query.eq('payment_mode', filters.payment_mode)
    if (filters.payment_status) query = query.eq('payment_status', filters.payment_status)

    const { data, error } = await query
    if (error) return fail(error, 'Failed to fetch payment analytics')

    const rows = (data ?? []) as unknown as PaymentWithOrder[]

    const byMode: Record<string, number> = {}
    const byStatus: Record<string, number> = {}
    let totalAmount = 0

    for (const payment of rows) {
      totalAmount += Number(payment.amount) || 0
      if (payment.payment_mode) byMode[payment.payment_mode] = (byMode[payment.payment_mode] ?? 0) + 1
      if (payment.payment_status) {
        byStatus[payment.payment_status] = (byStatus[payment.payment_status] ?? 0) + 1
      }
    }

    const successful = byStatus[PAYMENT_STATUS.COMPLETED] ?? 0
    const successRate = rows.length > 0 ? (successful / rows.length) * 100 : 0

    return ok({
      total_payments: rows.length,
      total_amount: totalAmount,
      by_mode: byMode,
      by_status: byStatus,
      success_rate: successRate,
    })
  } catch (error) {
    return fail(error, 'An unexpected error occurred while calculating payment analytics')
  }
}
