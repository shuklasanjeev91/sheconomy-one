import type { Tables } from '~/lib/supabase'

import type { PlatformPayuCheckoutStatus } from '~/lib/platform-payu/platform-payu.constants'

export type PlatformPayuOrderPayment = Tables<'order_payments'>

export type PlatformPayuInitiateRequest = {
  order_id: string
  amount: number
  productinfo: string
  shop_id?: string
}

export type PlatformPayuInitiateResponse = {
  payuUrl: string
  params: Record<string, string>
  txnid: string
  order_payment_id: string
}

export type PlatformPayuChargeResult = {
  flow?: 's2s' | 'form_post'
  outcome?: string
  action_url: string
  fields: Record<string, string>
  txnid: string
  order_payment_id: string
  intent_uri?: string | null
  acs_html?: string | null
  redirect_url?: string | null
  payu_id?: string | null
  unmapped_status?: string | null
  message?: string | null
}

export type PlatformPayuCardPayload = {
  number: string
  name: string
  exp_mon: string
  exp_yr: string
  cvv: string
  bankcode?: string | null
}

export type PlatformPayuChargeOptions = {
  payuMode?: string | null
  payuPg?: string | null
  payuBankcode?: string | null
  extraFields?: Record<string, string> | null
  clientIp?: string | null
  deviceInfo?: string | null
  card?: PlatformPayuCardPayload | null
  threeDs2RequestData?: Record<string, unknown> | string | null
}

export type PlatformPayuVerifyResult = {
  txnid: string
  success: boolean
  status: string
  mihpayid?: string | null
}

export type PlatformPayuBinInfo = {
  bin: string
  card_type: string
  bankcode: string
  category: string | null
  issuing_bank: string | null
  is_domestic: boolean
}

export type PlatformPayuServiceResponse<T> = {
  success: boolean
  data: T | null
  error: string | null
}

export type PlatformPayuStoreState = {
  status: PlatformPayuCheckoutStatus
  txnid: string | null
  orderPaymentId: string | null
  error: string | null
}

export type PlatformPayuPaymentSummary = {
  txnid: string
  amount: number
  payment_status: string
  order_id: string
  gateway_transaction_id: string | null
  processed_at: string | null
}
