import { Platform } from 'react-native'

import { supabase } from '~/lib/supabase/client'
import { submitPlatformPayuForm } from '~/lib/platform-payu/platform-payu.utils'

export type PlatformWalletOwnerType = 'user' | 'shop'

export type PlatformWalletLedgerRow = {
  id: string
  entry_type: string
  amount: number
  currency: string
  direction: 'credit' | 'debit'
  balance_after: number | null
  description: string | null
  created_at: string
}

export type PlatformWalletStatus = {
  walletId: string
  ownerType: PlatformWalletOwnerType
  ownerId: string
  balance: number
  currency: string
  updatedAt: string | null
  ledger: PlatformWalletLedgerRow[]
  lowBalance: boolean
}

export const WALLET_TOPUP_PRESETS = [100, 250, 500, 1000, 2500, 5000] as const
export const WALLET_MIN_TOPUP = 100

export async function ensurePlatformWallet(
  ownerType: PlatformWalletOwnerType,
  ownerId: string,
): Promise<{ walletId: string | null; error: string | null }> {
  const { data, error } = await supabase.rpc(
    'platform_wallet_get_or_create' as never,
    {
      p_owner_type: ownerType,
      p_owner_id: ownerId,
      p_currency: 'INR',
    } as never,
  )
  if (error) return { walletId: null, error: error.message }
  const row = data as { id?: string } | null
  return { walletId: row?.id ?? null, error: null }
}

export async function fetchPlatformWalletStatus(
  ownerType: PlatformWalletOwnerType,
  ownerId: string,
): Promise<PlatformWalletStatus | null> {
  const ensured = await ensurePlatformWallet(ownerType, ownerId)
  if (!ensured.walletId) return null

  const { data: wallet } = await supabase
    .from('platform_wallets' as never)
    .select('id, owner_type, owner_id, available_balance, currency, updated_at')
    .eq('id', ensured.walletId)
    .maybeSingle()

  const walletRow = wallet as {
    id: string
    owner_type: string
    owner_id: string
    available_balance: number
    currency: string
    updated_at: string | null
  } | null
  if (!walletRow) return null

  const { data: ledger } = await supabase
    .from('platform_wallet_ledger' as never)
    .select(
      'id, entry_type, amount, currency, direction, balance_after, description, created_at',
    )
    .eq('wallet_id', walletRow.id)
    .order('created_at', { ascending: false })
    .limit(40)

  const balance = Number(walletRow.available_balance ?? 0)
  return {
    walletId: walletRow.id,
    ownerType: walletRow.owner_type as PlatformWalletOwnerType,
    ownerId: walletRow.owner_id,
    balance,
    currency: String(walletRow.currency || 'INR'),
    updatedAt: walletRow.updated_at ?? null,
    ledger: ((ledger ?? []) as Array<Record<string, unknown>>).map((row) => ({
      id: String(row.id),
      entry_type: String(row.entry_type),
      amount: Number(row.amount),
      currency: String(row.currency || 'INR'),
      direction: row.direction as 'credit' | 'debit',
      balance_after: row.balance_after == null ? null : Number(row.balance_after),
      description: (row.description as string | null) ?? null,
      created_at: String(row.created_at),
    })),
    lowBalance: balance < 100,
  }
}

export async function beginPlatformWalletPayuTopup(input: {
  ownerType: PlatformWalletOwnerType
  ownerId: string
  amount: number
}): Promise<{ ok: true; txnid: string } | { ok: false; error: string }> {
  const amount = Math.round(Number(input.amount) * 100) / 100
  if (!(amount >= WALLET_MIN_TOPUP)) {
    return { ok: false, error: `Minimum top-up is ₹${WALLET_MIN_TOPUP}` }
  }
  if (Platform.OS !== 'web') {
    return {
      ok: false,
      error: 'Wallet top-up via PayU is available on the website.',
    }
  }

  const { data, error } = await supabase.functions.invoke('wallet-payu-topup', {
    body: {
      owner_type: input.ownerType,
      owner_id: input.ownerId,
      amount,
      client_platform: 'web',
    },
  })

  if (error) {
    const context = error as { context?: Response; message?: string }
    let message = context.message || 'Could not start top-up'
    try {
      if (context.context) {
        const body = (await context.context.json()) as { error?: string }
        if (body.error) message = body.error
      }
    } catch {
      // keep message
    }
    return { ok: false, error: message }
  }

  const payload = (data ?? {}) as {
    payuUrl?: string
    params?: Record<string, string>
    txnid?: string
    error?: string
  }
  if (payload.error || !payload.payuUrl || !payload.params || !payload.txnid) {
    return { ok: false, error: payload.error || 'Could not start top-up' }
  }

  submitPlatformPayuForm(payload.payuUrl, payload.params, '_self')
  return { ok: true, txnid: payload.txnid }
}

export async function payCheckoutWithWallet(input: {
  amount: number
  orderId: string
  idempotencyKey?: string
}): Promise<{ ok: boolean; balance?: number; error?: string; amount?: number }> {
  const { data, error } = await supabase.rpc(
    'platform_wallet_pay_checkout' as never,
    {
      p_amount: input.amount,
      p_order_id: input.orderId,
      p_idempotency_key: input.idempotencyKey ?? null,
    } as never,
  )
  if (error) return { ok: false, error: error.message }
  const result = (data ?? {}) as {
    ok?: boolean
    error?: string
    balance?: number
    amount?: number
  }
  if (!result.ok) {
    return {
      ok: false,
      error: result.error === 'insufficient_credit' ? 'Insufficient wallet balance' : result.error,
      balance: result.balance,
    }
  }
  return { ok: true, balance: result.balance, amount: result.amount }
}

export async function settleCheckoutWithWallet(input: {
  checkoutGroupId?: string | null
  orderId?: string | null
  amount: number
}): Promise<{
  ok: boolean
  fullySettled?: boolean
  error?: string
  applied?: number
}> {
  const { data, error } = await supabase.rpc(
    'platform_wallet_settle_checkout' as never,
    {
      p_checkout_group_id: input.checkoutGroupId ?? null,
      p_order_id: input.orderId ?? null,
      p_amount: input.amount,
    } as never,
  )
  if (error) return { ok: false, error: error.message }
  const result = (data ?? {}) as {
    ok?: boolean
    error?: string
    fully_settled?: boolean
    applied?: number
  }
  if (!result.ok) {
    return {
      ok: false,
      error:
        result.error === 'insufficient_credit'
          ? 'Insufficient wallet balance'
          : result.error || 'Wallet settle failed',
    }
  }
  return {
    ok: true,
    fullySettled: Boolean(result.fully_settled),
    applied: result.applied,
  }
}

export async function fetchReferralRewards(limit = 30): Promise<
  Array<{
    id: string
    program: string
    amount: number
    currency: string
    status: string
    credited_at: string | null
    created_at: string
  }>
> {
  const { data } = await supabase
    .from('referral_rewards' as never)
    .select('id, program, amount, currency, status, credited_at, created_at')
    .order('created_at', { ascending: false })
    .limit(limit)
  return ((data ?? []) as Array<Record<string, unknown>>).map((row) => ({
    id: String(row.id),
    program: String(row.program),
    amount: Number(row.amount),
    currency: String(row.currency || 'INR'),
    status: String(row.status),
    credited_at: (row.credited_at as string | null) ?? null,
    created_at: String(row.created_at),
  }))
}

export function ledgerLabel(entryType: string, direction: string): string {
  switch (entryType) {
    case 'topup':
      return 'PayU top-up'
    case 'spend_shipping':
      return 'Shipping label'
    case 'spend_ads':
      return 'Sponsored ads'
    case 'spend_checkout':
      return 'Order payment'
    case 'referral_credit':
      return 'Referral reward'
    case 'referral_clawback':
      return 'Referral clawback'
    case 'migration':
      return 'Migrated balance'
    case 'adjustment':
      return 'Adjustment'
    default:
      return direction === 'debit' ? 'Debit' : 'Credit'
  }
}
