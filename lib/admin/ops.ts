import { FunctionsHttpError } from '@supabase/supabase-js'

import { supabase } from '~/lib/supabase/client'

async function invokeAdminOps<T>(body: Record<string, unknown>): Promise<{
  data: T | null
  error: string | null
}> {
  const { data, error } = await supabase.functions.invoke('admin-ops', { body })
  if (error) {
    let message = error.message
    if (error instanceof FunctionsHttpError) {
      try {
        const payload = await error.context.json()
        if (payload && typeof payload === 'object' && 'error' in payload) {
          message = String((payload as { error: unknown }).error)
        }
      } catch {
        // keep default
      }
    }
    return { data: null, error: message }
  }
  if (data && typeof data === 'object' && 'error' in data && !(data as { ok?: boolean }).ok) {
    return { data: null, error: String((data as { error: unknown }).error) }
  }
  return { data: data as T, error: null }
}

export async function adminSearchOrders(query: string) {
  return invokeAdminOps<{
    ok: boolean
    orders: Array<Record<string, unknown>>
    settlements: Array<Record<string, unknown>>
    deliveries: Array<Record<string, unknown>>
  }>({ action: 'search_orders', query })
}

export async function adminListSellers(limit = 50) {
  return invokeAdminOps<{
    ok: boolean
    sellers: Array<{
      id: string
      shop_name: string | null
      slug: string | null
      verified: boolean | null
      payment_connected: boolean | null
      payu_kyc: { status?: string; payu_mid?: string | null } | null
      easyship_shipping_credit: {
        balance_amount?: number
        currency?: string
        updated_at?: string
      } | null
      open_dispute_count: number
    }>
  }>({ action: 'list_sellers', limit })
}

export async function adminRetrySplit(settlementId: string) {
  return invokeAdminOps<{ ok: boolean }>({ action: 'retry_split', settlementId })
}

export async function adminManualRelease(settlementId: string, reason?: string) {
  return invokeAdminOps<{ ok: boolean }>({ action: 'manual_release', settlementId, reason })
}

export async function adminResyncShipment(input: {
  orderId?: string
  deliveryId?: string
  awb?: string
}) {
  return invokeAdminOps<{ ok: boolean; updated?: number }>({
    action: 'resync_shipment',
    ...input,
  })
}

export async function adminRunReconciliation(limit = 100) {
  return invokeAdminOps<{ ok: boolean; run_id?: string }>({
    action: 'run_reconciliation',
    limit,
  })
}

export async function logAdminClientAction(
  action: string,
  details: Record<string, unknown> = {},
) {
  const { error } = await supabase.rpc('log_admin_action', {
    p_action: action,
    p_details: details,
  })
  return { error: error?.message ?? null }
}
