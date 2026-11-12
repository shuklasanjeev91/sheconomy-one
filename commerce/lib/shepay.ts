import { supabase } from '~/lib/supabase/client'
import { savePayuBridgeSession } from '~/commerce/lib/payu-bridge'
import {
  resolvePayuPaymentMode,
  type PayuPaymentModeId,
} from '~/commerce/lib/payu-payment-modes'

export type ShepayPayuCreateResult = {
  flow?: 's2s' | 'upi_s2s' | 'form_post'
  outcome?:
    | 'upi_intent'
    | 'acs'
    | 'redirect'
    | 'success'
    | 'pending'
    | 'failure'
    | string
  checkout_url: string
  action_url: string
  fields: Record<string, string>
  txnid: string
  payment_step_id: string
  intent_uri?: string | null
  acs_html?: string | null
  redirect_url?: string | null
  payu_id?: string | null
  unmapped_status?: string | null
  message?: string | null
}

export type ShepayPayuCardPayload = {
  number: string
  name: string
  exp_mon: string
  exp_yr: string
  cvv: string
  bankcode?: string | null
}

export type ShepayPayuSessionOptions = {
  paymentMethodId?: string | null
  payuMode?: PayuPaymentModeId | string | null
  payuPg?: string | null
  payuBankcode?: string | null
  extraFields?: Record<string, string> | null
  /** @deprecated Prefer seamless S2S */
  inline?: boolean
  seamless?: boolean
  /** Default `hosted` — PayU Hosted Checkout (buyer picks method on PayU). */
  checkoutStyle?: 'hosted' | 's2s' | null
  clientIp?: string | null
  deviceInfo?: string | null
  card?: ShepayPayuCardPayload | null
  threeDs2RequestData?: Record<string, unknown> | string | null
}

function clientDeviceHints(): { clientIp: string | null; deviceInfo: string | null } {
  if (typeof navigator === 'undefined') return { clientIp: null, deviceInfo: null }
  return {
    clientIp: null,
    deviceInfo: navigator.userAgent || null,
  }
}

/** Prefer PayU/edge JSON `error` over generic “non-2xx status code”. */
async function edgeInvokeErrorMessage(
  error: { message?: string; context?: Response } | null,
  data: unknown,
): Promise<string> {
  const fromData =
    data && typeof data === 'object' && 'error' in data
      ? String((data as { error?: string }).error ?? '')
      : ''
  if (fromData) return fromData

  const response = error?.context
  if (response && typeof response.json === 'function') {
    try {
      const body = (await response.clone().json()) as { error?: string; message?: string }
      if (body?.error) return String(body.error)
      if (body?.message) return String(body.message)
    } catch {
      // ignore
    }
  }
  return error?.message || 'Payment request failed'
}

/** Create + charge PayU via merchant-hosted S2S `_payment`. */
export async function createShepayPayuSession(
  paymentStepId: string,
  options?: ShepayPayuSessionOptions,
): Promise<{
  data: ShepayPayuCreateResult | null
  error: string | null
}> {
  const checkoutStyle = options?.checkoutStyle ?? 'hosted'
  const mode = resolvePayuPaymentMode(options?.payuMode)
  const hints = clientDeviceHints()
  const extraFields = {
    ...(mode.extraFields ?? {}),
    ...(options?.extraFields ?? {}),
  }
  const seamless = checkoutStyle === 'hosted' ? false : options?.seamless !== false
  const { data, error } = await supabase.functions.invoke('shepay-payu-create', {
    body: {
      payment_step_id: paymentStepId,
      payment_method_id: options?.paymentMethodId ?? null,
      mode: checkoutStyle === 'hosted' ? 'hosted' : mode.id,
      pg: checkoutStyle === 'hosted' ? null : (options?.payuPg ?? mode.pg ?? null),
      bankcode: checkoutStyle === 'hosted' ? null : (options?.payuBankcode ?? mode.bankcode ?? null),
      extra_fields:
        checkoutStyle === 'hosted'
          ? null
          : Object.keys(extraFields).length
            ? extraFields
            : null,
      inline: seamless ? false : (options?.inline ?? true),
      seamless,
      checkout_style: checkoutStyle,
      client_ip: options?.clientIp ?? hints.clientIp,
      device_info: options?.deviceInfo ?? hints.deviceInfo,
      card: checkoutStyle === 'hosted' ? null : (options?.card ?? null),
      three_ds2_request_data:
        checkoutStyle === 'hosted' ? null : (options?.threeDs2RequestData ?? null),
    },
  })

  if (error) {
    return { data: null, error: await edgeInvokeErrorMessage(error as never, data) }
  }

  const payload = data as ShepayPayuCreateResult & { error?: string }
  if (payload?.error) return { data: null, error: payload.error }
  if (!payload?.txnid && !payload?.action_url) {
    return { data: null, error: 'SHEPay did not return payment fields' }
  }

  if (payload.flow === 'form_post' && payload.action_url && payload.fields) {
    savePayuBridgeSession(payload.action_url, payload.fields)
  }

  return { data: payload, error: null }
}

export type PayuBinInfo = {
  bin: string
  card_type: string
  bankcode: string
  category: string | null
  issuing_bank: string | null
  is_domestic: boolean
}

export type PayuCheckoutDetailsResult = {
  upi?: { enabled?: boolean; isDown?: boolean }
  cards?: { enabled?: boolean }
  netbanking?: Array<{
    bankcode: string
    title: string
    shortName?: string | null
    isDown?: boolean
  }>
  wallets?: Array<{
    bankcode: string
    title: string
    shortName?: string | null
    isDown?: boolean
  }>
  emi?: Array<{
    bankcode: string
    title: string
    shortName?: string | null
    tenure?: number | null
    monthlyEmi?: number | null
    isDown?: boolean
  }>
  bnpl?: Array<{
    bankcode: string
    title: string
    shortName?: string | null
    isDown?: boolean
  }>
  paypal?: boolean
  pluxee?: boolean
  neft?: boolean
}

/** Live PayU instruments for the checkout accordion (get_checkout_details). */
export async function fetchPayuCheckoutDetails(amount: number): Promise<{
  data: PayuCheckoutDetailsResult | null
  error: string | null
}> {
  const { data, error } = await supabase.functions.invoke('shepay-payu-checkout-details', {
    body: { amount },
  })
  if (error) return { data: null, error: await edgeInvokeErrorMessage(error as never, data) }
  const payload = data as PayuCheckoutDetailsResult & { error?: string }
  if (payload?.error) return { data: null, error: payload.error }
  return { data: payload, error: null }
}

/** Step 1 — validate card BIN via PayU getBinInfo. */
export async function fetchPayuBinInfo(bin: string): Promise<{
  data: PayuBinInfo | null
  error: string | null
}> {
  const { data, error } = await supabase.functions.invoke('shepay-payu-bin', {
    body: { bin: String(bin).replace(/\D/g, '').slice(0, 6) },
  })
  if (error) return { data: null, error: await edgeInvokeErrorMessage(error as never, data) }
  const payload = data as PayuBinInfo & { error?: string }
  if (payload?.error) return { data: null, error: payload.error }
  if (!payload?.bankcode) return { data: null, error: 'BIN lookup failed' }
  return { data: payload, error: null }
}

export type PayuVerifyResult = {
  txnid: string
  success: boolean
  status: string
  mihpayid?: string | null
}

/** Step 4 — verify_payment (+ webhook still authoritative). */
export async function verifyShepayPayuPayment(input: {
  txnid?: string
  paymentStepId?: string
}): Promise<{ data: PayuVerifyResult | null; error: string | null }> {
  const { data, error } = await supabase.functions.invoke('shepay-payu-verify', {
    body: {
      txnid: input.txnid ?? null,
      payment_step_id: input.paymentStepId ?? null,
    },
  })
  if (error) return { data: null, error: await edgeInvokeErrorMessage(error as never, data) }
  const payload = data as PayuVerifyResult & { error?: string }
  if (payload?.error) return { data: null, error: payload.error }
  return { data: payload, error: null }
}

export type ShepayCheckoutSetup = {
  checkoutUrl: string | null
  error: string | null
  inline: {
    actionUrl: string
    fields: Record<string, string>
    txnid: string
    paymentStepId: string
  } | null
}

/** Defer PayU `_payment` until buyer hits Pay — return step id for the panel. */
export async function ensureShepayCheckoutUrl(
  paymentSteps: Array<{ id: string; collection?: string; checkoutUrl?: string | null }>,
  _options?: ShepayPayuSessionOptions,
): Promise<ShepayCheckoutSetup> {
  const shepaySteps = paymentSteps.filter((step) => step.collection === 'shepay')
  const needingSession = shepaySteps.filter((step) => !step.checkoutUrl)
  if (!needingSession.length) {
    return {
      checkoutUrl:
        shepaySteps.find((s) => s.checkoutUrl)?.checkoutUrl ??
        paymentSteps.find((s) => s.checkoutUrl)?.checkoutUrl ??
        null,
      error: null,
      inline: shepaySteps[0]
        ? {
            actionUrl: '',
            fields: {},
            txnid: '',
            paymentStepId: shepaySteps[0].id,
          }
        : null,
    }
  }

  const first = needingSession[0]
  return {
    checkoutUrl: null,
    error: null,
    inline: {
      actionUrl: '',
      fields: {},
      txnid: '',
      paymentStepId: first.id,
    },
  }
}
