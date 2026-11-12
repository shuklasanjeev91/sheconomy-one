/**
 * Easyship seller shipping credit helpers.
 */

import { readSupabaseFunctionError } from '~/lib/supabase/function-error'
import { supabase } from '~/lib/supabase'

export const EASYSHIP_SELLER_RECHARGE_PATH = '/vendor/wallet'

export type EasyshipShippingCreditStatus = {
  balance: number
  currency: string
  pendingCost: number
  pendingOrderCount: number
  lowBalance: boolean
  rechargeUrl: string
  updatedAt: string | null
  ledger: Array<{
    id: string
    order_id: string | null
    entry_type: string
    amount: number
    currency: string
    easyship_shipment_id: string | null
    created_at: string
  }>
}

/**
 * Buyer `shipping_amount` can be FREE (0) while the carrier label still costs the
 * seller. Empty wallets must never look "affordable".
 */
export function canAffordEasyshipShip(
  balance: number | null | undefined,
  quoteAmount: number | null | undefined,
) {
  if (balance == null || !Number.isFinite(balance) || balance <= 0) return false
  // Unknown / FREE buyer freight — allow the attempt; server re-rates and gates.
  if (quoteAmount == null || !Number.isFinite(quoteAmount) || quoteAmount <= 0) return true
  return balance + 1e-9 >= quoteAmount
}

export async function fetchEasyshipShippingCredit(
  shopId: string,
): Promise<EasyshipShippingCreditStatus | null> {
  if (!shopId) return null
  const { data, error } = await supabase.functions.invoke('easyship-shipping-credit', {
    body: { shopId, action: 'status' },
  })
  if (error || !data || data.error) return null
  return {
    balance: Number(data.balance ?? 0),
    currency: String(data.currency ?? 'INR'),
    pendingCost: Number(data.pendingCost ?? 0),
    pendingOrderCount: Number(data.pendingOrderCount ?? 0),
    lowBalance: Boolean(data.lowBalance),
    rechargeUrl: String(data.rechargeUrl || EASYSHIP_SELLER_RECHARGE_PATH),
    updatedAt: data.updatedAt ? String(data.updatedAt) : null,
    ledger: Array.isArray(data.ledger) ? data.ledger : [],
  }
}

export async function processEasyshipShipment(input: {
  shopId: string
  orderId: string
  orderItemIds?: string[]
}): Promise<{
  success: boolean
  error?: string
  code?: string
  rechargeUrl?: string
  trackingNumber?: string | null
  labelUrl?: string | null
  freight?: number | null
}> {
  const { data, error } = await supabase.functions.invoke('easyship-process-shipment', {
    body: input,
  })

  const payload = (data ?? null) as Record<string, unknown> | null
  if (error || payload?.error) {
    let code =
      payload?.code != null ? String(payload.code) : undefined
    let rechargeUrl =
      payload?.rechargeUrl != null
        ? String(payload.rechargeUrl)
        : EASYSHIP_SELLER_RECHARGE_PATH

    // Non-2xx responses often put the body only on error.context.
    if (!code && error && typeof error === 'object' && 'context' in error) {
      try {
        const context = (error as { context?: Response }).context
        if (context && typeof context.clone === 'function') {
          const body = (await context.clone().json()) as {
            code?: unknown
            rechargeUrl?: unknown
          }
          if (body?.code != null) code = String(body.code)
          if (body?.rechargeUrl != null) rechargeUrl = String(body.rechargeUrl)
        }
      } catch {
        // keep defaults
      }
    }

    return {
      success: false,
      error: await readSupabaseFunctionError(
        error,
        payload,
        'Could not process Easyship shipment',
      ),
      code,
      rechargeUrl,
    }
  }
  return {
    success: true,
    trackingNumber: payload?.trackingNumber != null ? String(payload.trackingNumber) : null,
    labelUrl: payload?.labelUrl != null ? String(payload.labelUrl) : null,
    freight: payload?.freight != null ? Number(payload.freight) : null,
  }
}

/** Freight estimate from stored order easyship / shipping_amount (no live re-rate). */
export async function fetchOrderEasyshipFreight(orderId: string): Promise<number | null> {
  const { data, error } = await supabase
    .from('orders')
    .select('shipping_amount, order_metadata')
    .eq('id', orderId)
    .maybeSingle()
  if (error || !data) return null
  const meta = (data.order_metadata ?? {}) as Record<string, unknown>
  const easyship = (meta.easyship ?? {}) as Record<string, unknown>
  const amount = Number(
    easyship.shipment_charge ?? easyship.shipping_amount ?? data.shipping_amount ?? NaN,
  )
  return Number.isFinite(amount) ? amount : null
}
