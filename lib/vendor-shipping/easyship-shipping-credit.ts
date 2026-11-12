/**
 * Easyship seller shipping credit helpers.
 */

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

export function canAffordEasyshipShip(
  balance: number | null | undefined,
  quoteAmount: number | null | undefined,
) {
  if (quoteAmount == null || !Number.isFinite(quoteAmount)) return true
  if (balance == null || !Number.isFinite(balance)) return false
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
  if (error) {
    return { success: false, error: error.message || 'Could not process Easyship shipment' }
  }
  if (data?.error) {
    return {
      success: false,
      error: String(data.error),
      code: data.code ? String(data.code) : undefined,
      rechargeUrl: data.rechargeUrl ? String(data.rechargeUrl) : EASYSHIP_SELLER_RECHARGE_PATH,
    }
  }
  return {
    success: true,
    trackingNumber: data?.trackingNumber ?? null,
    labelUrl: data?.labelUrl ?? null,
    freight: data?.freight != null ? Number(data.freight) : null,
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
