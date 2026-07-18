import type { CardFundingType } from '~/commerce/lib/payment-methods'
import { supabase } from '~/lib/supabase/client'
import type { Tables } from '~/lib/supabase'

export type CustomerOrderHistoryRow = {
  order_id: string
  order_number: string | null
  order_status: string | null
  payment_status: string | null
  payment_mode: string | null
  total_amount: number | null
  currency: string | null
  shop_names: string | null
  item_count: number | null
  created_at: string | null
  tracking_numbers: string | null
  progress_percentage: number | null
  delivered_at: string | null
}

export type BuyerPaymentMethod = Tables<'buyer_payment_methods'>

async function clearDefaultPaymentMethods(userId: string) {
  await supabase
    .from('buyer_payment_methods')
    .update({ is_default: false })
    .eq('user_id', userId)
}

export async function fetchCustomerOrderHistory(userId: string): Promise<{
  orders: CustomerOrderHistoryRow[]
  error: string | null
}> {
  const { data, error } = await supabase
    .from('customer_order_history_view')
    .select(
      'order_id, order_number, order_status, payment_status, payment_mode, total_amount, currency, shop_names, item_count, created_at, tracking_numbers, progress_percentage, delivered_at',
    )
    .eq('customer_id', userId)
    .order('created_at', { ascending: false })
    .limit(100)

  if (error) {
    return { orders: [], error: error.message }
  }

  const orders: CustomerOrderHistoryRow[] = []
  for (const row of data ?? []) {
    if (!row.order_id) continue
    orders.push({
      order_id: row.order_id,
      order_number: row.order_number,
      order_status: row.order_status,
      payment_status: row.payment_status,
      payment_mode: row.payment_mode,
      total_amount: row.total_amount,
      currency: row.currency,
      shop_names: row.shop_names,
      item_count: row.item_count,
      created_at: row.created_at,
      tracking_numbers: row.tracking_numbers,
      progress_percentage: row.progress_percentage,
      delivered_at: row.delivered_at,
    })
  }

  return { orders, error: null }
}

export async function fetchBuyerPaymentMethods(userId: string): Promise<{
  methods: BuyerPaymentMethod[]
  error: string | null
}> {
  const { data, error } = await supabase
    .from('buyer_payment_methods')
    .select('*')
    .eq('user_id', userId)
    .order('is_default', { ascending: false })
    .order('created_at', { ascending: false })

  if (error) {
    return { methods: [], error: error.message }
  }

  return { methods: data ?? [], error: null }
}

export async function addBuyerCardPaymentMethod(
  userId: string,
  input: {
    label?: string
    cardBrand: string
    lastFour: string
    cardholderName: string
    cardType: CardFundingType
    expMonth: number
    expYear: number
    isDefault?: boolean
  },
): Promise<{ method: BuyerPaymentMethod | null; error: string | null }> {
  if (input.isDefault) {
    await clearDefaultPaymentMethods(userId)
  }

  const fundingLabel = input.cardType === 'debit' ? 'Debit' : 'Credit'
  const label =
    input.label?.trim() ||
    `${input.cardBrand} ${fundingLabel} ·••• ${input.lastFour}`

  const { data, error } = await supabase
    .from('buyer_payment_methods')
    .insert({
      user_id: userId,
      label,
      card_brand: input.cardBrand,
      last_four: input.lastFour,
      exp_month: input.expMonth,
      exp_year: input.expYear,
      cardholder_name: input.cardholderName.trim(),
      method_type: 'card',
      card_type: input.cardType,
      provider: 'wallet',
      is_default: input.isDefault ?? false,
      metadata: {
        method_type: 'card',
        card_type: input.cardType,
        cardholder_name: input.cardholderName.trim(),
      },
    })
    .select('*')
    .single()

  if (error) {
    return { method: null, error: error.message }
  }

  return { method: data, error: null }
}

export async function addBuyerUpiPaymentMethod(
  userId: string,
  input: {
    label?: string
    upiId: string
    isDefault?: boolean
  },
): Promise<{ method: BuyerPaymentMethod | null; error: string | null }> {
  if (input.isDefault) {
    await clearDefaultPaymentMethods(userId)
  }

  const upiId = input.upiId.trim().toLowerCase()
  const label = input.label?.trim() || `UPI · ${upiId}`

  const { data, error } = await supabase
    .from('buyer_payment_methods')
    .insert({
      user_id: userId,
      label,
      card_brand: 'UPI',
      provider: 'wallet',
      method_type: 'upi',
      upi_id: upiId,
      is_default: input.isDefault ?? false,
      metadata: {
        method_type: 'upi',
        upi_id: upiId,
      },
    })
    .select('*')
    .single()

  if (error) {
    return { method: null, error: error.message }
  }

  return { method: data, error: null }
}

/** @deprecated Use addBuyerCardPaymentMethod or addBuyerUpiPaymentMethod */
export async function addBuyerPaymentMethod(
  userId: string,
  input: {
    label: string
    cardBrand: string
    lastFour: string
    expMonth?: number
    expYear?: number
    isDefault?: boolean
  },
): Promise<{ method: BuyerPaymentMethod | null; error: string | null }> {
  return addBuyerCardPaymentMethod(userId, {
    label: input.label,
    cardBrand: input.cardBrand,
    lastFour: input.lastFour,
    cardholderName: input.label,
    cardType: 'credit',
    expMonth: input.expMonth ?? 12,
    expYear: input.expYear ?? new Date().getFullYear() + 3,
    isDefault: input.isDefault,
  })
}

export async function setDefaultBuyerPaymentMethod(
  userId: string,
  methodId: string,
): Promise<{ error: string | null }> {
  await clearDefaultPaymentMethods(userId)

  const { error } = await supabase
    .from('buyer_payment_methods')
    .update({ is_default: true })
    .eq('id', methodId)
    .eq('user_id', userId)

  return { error: error?.message ?? null }
}

export async function removeBuyerPaymentMethod(
  userId: string,
  methodId: string,
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('buyer_payment_methods')
    .delete()
    .eq('id', methodId)
    .eq('user_id', userId)

  return { error: error?.message ?? null }
}
