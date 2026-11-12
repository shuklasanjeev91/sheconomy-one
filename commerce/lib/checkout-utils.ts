export type CheckoutPaymentStep = {
  id: string
  orderId: string
  shopId: string
  collection: 'direct' | 'shepay' | 'cod'
  provider: string | null
  status: string
  amount: number
  checkoutUrl: string | null
}

export type AtomicCheckoutResult = {
  checkoutGroupId: string
  status: string
  orderIds: string[]
  orderNumbers: string[]
  subtotalAmount: number
  discountAmount: number
  shippingAmount: number
  /** Always 0 — SHEconomy takes no platform fee on checkout. */
  platformFeeAmount: number
  totalAmount: number
  paymentSteps: CheckoutPaymentStep[]
}

/** Maps the atomic checkout RPC JSON into a typed client result. */
export function parseAtomicCheckoutPayload(
  payload: Record<string, unknown> | null | undefined,
): { data: AtomicCheckoutResult | null; error: string | null } {
  if (!payload || payload.success === false || typeof payload.checkout_group_id !== 'string') {
    return {
      data: null,
      error:
        typeof payload?.message === 'string' ? payload.message : 'Checkout could not be created',
    }
  }

  const steps = Array.isArray(payload.payment_steps)
    ? payload.payment_steps.map((step) => {
        const row = step as Record<string, unknown>
        return {
          id: String(row.id ?? ''),
          orderId: String(row.order_id ?? ''),
          shopId: String(row.shop_id ?? ''),
          collection: String(row.collection ?? 'shepay') as CheckoutPaymentStep['collection'],
          provider: typeof row.provider === 'string' ? row.provider : null,
          status: String(row.status ?? 'pending'),
          amount: Number(row.amount ?? 0),
          checkoutUrl: typeof row.checkout_url === 'string' ? row.checkout_url : null,
        }
      })
    : []

  return {
    data: {
      checkoutGroupId: payload.checkout_group_id,
      status: String(payload.status ?? 'created'),
      orderIds: Array.isArray(payload.order_ids) ? payload.order_ids.map(String) : [],
      orderNumbers: Array.isArray(payload.order_numbers) ? payload.order_numbers.map(String) : [],
      subtotalAmount: Number(payload.subtotal_amount ?? 0),
      discountAmount: Number(payload.discount_amount ?? 0),
      shippingAmount: Number(payload.shipping_amount ?? 0),
      platformFeeAmount: Number(payload.platform_fee_amount ?? 0),
      totalAmount: Number(payload.total_amount ?? 0),
      paymentSteps: steps,
    },
    error: null,
  }
}

/** Prefer the first provider checkout URL from a resume/create payment-step list. */
export function firstCheckoutUrlFromSteps(
  steps: Array<{ checkout_url?: unknown; checkoutUrl?: unknown }>,
): string | null {
  for (const step of steps) {
    if (typeof step.checkoutUrl === 'string' && step.checkoutUrl) return step.checkoutUrl
    if (typeof step.checkout_url === 'string' && step.checkout_url) return step.checkout_url
  }
  return null
}
