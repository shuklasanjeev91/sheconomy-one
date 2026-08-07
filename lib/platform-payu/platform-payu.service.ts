/**
 * Platform PayU service — calls platform-payu-initiate edge function and
 * reads order_payments by transaction_id.
 */

import type { SupabaseClient } from '@supabase/supabase-js'

import { supabase } from '~/lib/supabase'
import { PLATFORM_PAYU_EDGE_FUNCTIONS } from '~/lib/platform-payu/platform-payu.constants'
import type {
  PlatformPayuBinInfo,
  PlatformPayuChargeOptions,
  PlatformPayuChargeResult,
  PlatformPayuInitiateRequest,
  PlatformPayuInitiateResponse,
  PlatformPayuOrderPayment,
  PlatformPayuPaymentSummary,
  PlatformPayuServiceResponse,
  PlatformPayuVerifyResult,
} from '~/lib/platform-payu/platform-payu.type'
import { validatePlatformPayuInitiate } from '~/lib/platform-payu/platform-payu.validation'
import { submitPlatformPayuForm } from '~/lib/platform-payu/platform-payu.utils'
import { resolvePayuPaymentMode } from '~/commerce/lib/payu-payment-modes'

function ok<T>(data: T): PlatformPayuServiceResponse<T> {
  return { success: true, data, error: null }
}

function fail<T>(error: unknown, fallback = 'Payment request failed.'): PlatformPayuServiceResponse<T> {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === 'string'
        ? error
        : fallback
  return { success: false, data: null, error: message }
}

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
  return error?.message || 'Payment request failed.'
}

export function createPlatformPayuService(supabase: SupabaseClient) {
  return {
    async initiatePayment(
      payload: PlatformPayuInitiateRequest,
    ): Promise<PlatformPayuServiceResponse<PlatformPayuInitiateResponse>> {
      const validation = validatePlatformPayuInitiate(payload)
      if (!validation.success || !validation.data) {
        return fail(validation.error ?? 'Invalid payment request.')
      }

      try {
        const { data, error } = await supabase.functions.invoke<PlatformPayuInitiateResponse & {
          error?: string
        }>(PLATFORM_PAYU_EDGE_FUNCTIONS.INITIATE, { body: validation.data })

        if (error) {
          return fail(await edgeInvokeErrorMessage(error as never, data))
        }

        const result = data as PlatformPayuInitiateResponse & { error?: string }
        if (result?.error) return fail(result.error)
        if (!result?.payuUrl || !result?.params || !result?.txnid) {
          return fail('Platform PayU did not return payment fields.')
        }

        return ok(result)
      } catch (error) {
        return fail(error)
      }
    },

    /** Merchant-hosted S2S charge — buyer stays on our payment screen. */
    async chargePayment(
      orderPaymentId: string,
      options?: PlatformPayuChargeOptions,
    ): Promise<PlatformPayuServiceResponse<PlatformPayuChargeResult>> {
      if (!orderPaymentId.trim()) return fail('Payment id is required.')

      const mode = resolvePayuPaymentMode(options?.payuMode)
      const extraFields = {
        ...(mode.extraFields ?? {}),
        ...(options?.extraFields ?? {}),
      }

      try {
        const { data, error } = await supabase.functions.invoke<PlatformPayuChargeResult & {
          error?: string
        }>(PLATFORM_PAYU_EDGE_FUNCTIONS.CHARGE, {
          body: {
            order_payment_id: orderPaymentId,
            mode: mode.id,
            pg: options?.payuPg ?? mode.pg ?? null,
            bankcode: options?.payuBankcode ?? mode.bankcode ?? null,
            extra_fields: Object.keys(extraFields).length ? extraFields : null,
            client_ip: options?.clientIp ?? null,
            device_info: options?.deviceInfo ?? null,
            card: options?.card ?? null,
            three_ds2_request_data: options?.threeDs2RequestData ?? null,
          },
        })

        if (error) {
          return fail(await edgeInvokeErrorMessage(error as never, data))
        }

        const result = data as PlatformPayuChargeResult & { error?: string }
        if (result?.error) return fail(result.error)
        if (!result?.txnid) return fail('Platform PayU did not return a transaction id.')

        return ok(result)
      } catch (error) {
        return fail(error)
      }
    },

    async verifyPayment(input: {
      txnid?: string
      orderPaymentId?: string
    }): Promise<PlatformPayuServiceResponse<PlatformPayuVerifyResult>> {
      try {
        const { data, error } = await supabase.functions.invoke<PlatformPayuVerifyResult & {
          error?: string
        }>(PLATFORM_PAYU_EDGE_FUNCTIONS.VERIFY, {
          body: {
            txnid: input.txnid ?? null,
            order_payment_id: input.orderPaymentId ?? null,
          },
        })

        if (error) {
          return fail(await edgeInvokeErrorMessage(error as never, data))
        }

        const result = data as PlatformPayuVerifyResult & { error?: string }
        if (result?.error) return fail(result.error)
        return ok(result)
      } catch (error) {
        return fail(error)
      }
    },

    async fetchBinInfo(bin: string): Promise<PlatformPayuServiceResponse<PlatformPayuBinInfo>> {
      try {
        const { data, error } = await supabase.functions.invoke<PlatformPayuBinInfo & {
          error?: string
        }>(PLATFORM_PAYU_EDGE_FUNCTIONS.BIN, {
          body: { bin: String(bin).replace(/\D/g, '').slice(0, 6) },
        })

        if (error) {
          return fail(await edgeInvokeErrorMessage(error as never, data))
        }

        const result = data as PlatformPayuBinInfo & { error?: string }
        if (result?.error) return fail(result.error)
        if (!result?.bankcode) return fail('BIN lookup failed')
        return ok(result)
      } catch (error) {
        return fail(error)
      }
    },

    async getPaymentByTxnId(txnid: string): Promise<PlatformPayuServiceResponse<PlatformPayuOrderPayment>> {
      if (!txnid.trim()) return fail('Transaction id is required.')

      try {
        const { data, error } = await supabase
          .from('order_payments')
          .select('*')
          .eq('transaction_id', txnid.trim())
          .maybeSingle()

        if (error) return fail(error.message)
        if (!data) return fail('Payment record not found.')
        return ok(data)
      } catch (error) {
        return fail(error, 'Could not load payment status.')
      }
    },

    toPaymentSummary(payment: PlatformPayuOrderPayment): PlatformPayuPaymentSummary {
      return {
        txnid: payment.transaction_id ?? '',
        amount: Number(payment.amount ?? 0),
        payment_status: payment.payment_status,
        order_id: payment.order_id,
        gateway_transaction_id: payment.gateway_transaction_id,
        processed_at: payment.processed_at,
      }
    },

    redirectToPayU(payuUrl: string, params: Record<string, string>): void {
      submitPlatformPayuForm(payuUrl, params, '_self')
    },
  }
}

export type PlatformPayuService = ReturnType<typeof createPlatformPayuService>

export const platformPayuService = createPlatformPayuService(supabase)
