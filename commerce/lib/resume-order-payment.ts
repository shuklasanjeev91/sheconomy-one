/**
 * Resume online payment for an order that is still awaiting_payment.
 *
 * Checkout never persists a durable PayU link — hosted sessions are minted
 * on demand and expire. The old "Complete payment" path only read
 * commerce_checkout_payment_steps.checkout_url, which is null for Platform
 * PayU and stale for SHEPay, so buyers got "Payment link unavailable".
 *
 * This helper mints a fresh session from the pending payment step /
 * order_payments row and returns an in-app PayU bridge href.
 */

import { createShepayPayuSession } from '~/commerce/lib/shepay'
import { savePayuBridgeSession } from '~/commerce/lib/payu-bridge'
import { toInAppPayUHref } from '~/commerce/lib/checkout-payment-route'
import { platformPayuService } from '~/lib/platform-payu'
import { supabase } from '~/lib/supabase/client'

export type ResumeOrderPaymentResult =
  | { ok: true; href: string }
  | { ok: false; error: string }

type PaymentStepRow = {
  id: string
  collection: string | null
  provider: string | null
  status: string | null
  checkout_url: string | null
  amount: number | string | null
}

type OrderPaymentRow = {
  id: string
  amount: number | string | null
  payment_status: string | null
  payment_gateway: string | null
  transaction_id: string | null
  payment_metadata: Record<string, unknown> | null
}

function bridgeHrefFromSession(actionUrl: string, fields: Record<string, string>, checkoutUrl?: string | null): string {
  savePayuBridgeSession(actionUrl, fields)
  if (checkoutUrl) return toInAppPayUHref(checkoutUrl)
  const params = new URLSearchParams({
    action: actionUrl,
    payload: JSON.stringify(fields),
  })
  return `/orders/payu?${params.toString()}`
}

function isPlatformPayuPayment(payment: OrderPaymentRow | null): boolean {
  if (!payment) return false
  const meta = payment.payment_metadata ?? {}
  if (meta.provider === 'platform_payu') return true
  const txnid = String(payment.transaction_id ?? '')
  return txnid.startsWith('TXN_')
}

/**
 * Mint a fresh PayU session for an unpaid order and return the in-app bridge path.
 */
export async function resumeOrderOnlinePayment(orderId: string): Promise<ResumeOrderPaymentResult> {
  if (!orderId.trim()) return { ok: false, error: 'Order not found.' }

  const [{ data: stepData }, { data: paymentData }, { data: orderData }] = await Promise.all([
    supabase
      .from('commerce_checkout_payment_steps' as never)
      .select('id, collection, provider, status, checkout_url, amount')
      .eq('order_id' as never, orderId)
      .in('status' as never, ['pending', 'requires_action'])
      .order('created_at' as never, { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('order_payments')
      .select('id, amount, payment_status, payment_gateway, transaction_id, payment_metadata')
      .eq('order_id', orderId)
      .eq('payment_mode', 'online')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('orders')
      .select('id, order_number, order_status, total_amount, customer_total_amount')
      .eq('id', orderId)
      .maybeSingle(),
  ])

  const step = stepData as PaymentStepRow | null
  const payment = paymentData as OrderPaymentRow | null
  const order = orderData as {
    id: string
    order_number: string | null
    order_status: string | null
    total_amount: number | string | null
    customer_total_amount: number | string | null
  } | null

  if (!order) return { ok: false, error: 'Order not found.' }
  if (order.order_status && order.order_status !== 'awaiting_payment') {
    return { ok: false, error: 'This order is no longer awaiting payment.' }
  }
  if (payment?.payment_status === 'completed' || payment?.payment_status === 'paid') {
    return { ok: false, error: 'This order is already paid.' }
  }

  // Prefer Platform PayU when that is what originally started the payment —
  // single-shop checkout writes order_payments with provider platform_payu
  // and may also leave a unused shepay step row behind.
  if (isPlatformPayuPayment(payment)) {
    const amount = Number(payment?.amount ?? order.customer_total_amount ?? order.total_amount ?? 0)
    if (!(amount > 0)) return { ok: false, error: 'Could not determine the amount to charge.' }

    const shopId =
      typeof payment?.payment_metadata?.shop_id === 'string'
        ? payment.payment_metadata.shop_id
        : undefined

    const payu = await platformPayuService.initiatePayment({
      order_id: orderId,
      amount,
      productinfo: order.order_number ? `Order ${order.order_number}` : 'Sheconomy order',
      shop_id: shopId,
    })
    if (!payu.success || !payu.data?.payuUrl || !payu.data?.params) {
      return { ok: false, error: payu.error ?? 'Could not start payment. Please try again.' }
    }

    return {
      ok: true,
      href: bridgeHrefFromSession(payu.data.payuUrl, payu.data.params),
    }
  }

  if (step && (step.collection === 'shepay' || step.provider === 'shepay' || step.provider === 'payu')) {
    const payu = await createShepayPayuSession(step.id, {
      checkoutStyle: 'hosted',
      seamless: false,
    })
    if (payu.error || !payu.data?.action_url || !payu.data?.fields) {
      return { ok: false, error: payu.error ?? 'Could not open the payment page. Please try again.' }
    }
    return {
      ok: true,
      href: bridgeHrefFromSession(payu.data.action_url, payu.data.fields, payu.data.checkout_url),
    }
  }

  // Last resort: a previously stored hosted URL (Razorpay / legacy).
  if (step?.checkout_url) {
    return { ok: true, href: toInAppPayUHref(step.checkout_url) }
  }

  return {
    ok: false,
    error: 'No payment session is available for this order. Please place a new order.',
  }
}
