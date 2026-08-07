/**
 * Lightweight checkout store for Platform PayU (no Zustand — project uses Redux elsewhere).
 * Ephemeral payment flow state for initiate → redirect → verify.
 */

import { useCallback, useSyncExternalStore } from 'react'

import type { PlatformPayuCheckoutStatus } from '~/lib/platform-payu/platform-payu.constants'
import {
  platformPayuService,
  type PlatformPayuService,
} from '~/lib/platform-payu/platform-payu.service'
import type {
  PlatformPayuInitiateRequest,
  PlatformPayuStoreState,
} from '~/lib/platform-payu/platform-payu.type'

const initialState: PlatformPayuStoreState = {
  status: 'idle',
  txnid: null,
  orderPaymentId: null,
  error: null,
}

let state: PlatformPayuStoreState = { ...initialState }
const listeners = new Set<() => void>()

function emit() {
  for (const listener of listeners) listener()
}

function patch(partial: Partial<PlatformPayuStoreState>) {
  state = { ...state, ...partial }
  emit()
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function getSnapshot() {
  return state
}

export function resetPlatformPayuStore() {
  state = { ...initialState }
  emit()
}

export function getPlatformPayuStoreSnapshot(): PlatformPayuStoreState {
  return getSnapshot()
}

export function usePlatformPayuStore(): PlatformPayuStoreState & {
  initiatePayment: (payload: PlatformPayuInitiateRequest) => Promise<void>
  verifyPayment: (txnid: string) => Promise<void>
  reset: () => void
} {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getSnapshot)

  const initiatePayment = useCallback(async (payload: PlatformPayuInitiateRequest) => {
    patch({ status: 'initiating', error: null })
    const result = await platformPayuService.initiatePayment(payload)
    if (!result.success || !result.data) {
      patch({ status: 'failed', error: result.error ?? 'Could not start payment.' })
      return
    }

    patch({
      status: 'redirecting',
      txnid: result.data.txnid,
      orderPaymentId: result.data.order_payment_id,
      error: null,
    })

    platformPayuService.redirectToPayU(result.data.payuUrl, result.data.params)
  }, [])

  const verifyPayment = useCallback(async (txnid: string) => {
    patch({ status: 'verifying', txnid, error: null })
    const result = await platformPayuService.getPaymentByTxnId(txnid)
    if (!result.success || !result.data) {
      patch({ status: 'failed', error: result.error ?? 'Could not verify payment.' })
      return
    }

    const paymentStatus = result.data.payment_status
    if (paymentStatus === 'completed') {
      patch({
        status: 'success',
        txnid,
        orderPaymentId: result.data.id,
        error: null,
      })
      return
    }

    if (paymentStatus === 'failed' || paymentStatus === 'cancelled') {
      patch({
        status: 'failed',
        txnid,
        orderPaymentId: result.data.id,
        error: result.data.failure_reason ?? 'Payment failed.',
      })
      return
    }

    patch({
      status: 'verifying',
      txnid,
      orderPaymentId: result.data.id,
      error: null,
    })
  }, [])

  const reset = useCallback(() => {
    resetPlatformPayuStore()
  }, [])

  return {
    ...snapshot,
    initiatePayment,
    verifyPayment,
    reset,
  }
}

/** Factory for tests or alternate Supabase clients. */
export function createPlatformPayuActions(service: PlatformPayuService) {
  return {
    async initiatePayment(payload: PlatformPayuInitiateRequest): Promise<PlatformPayuCheckoutStatus> {
      patch({ status: 'initiating', error: null })
      const result = await service.initiatePayment(payload)
      if (!result.success || !result.data) {
        patch({ status: 'failed', error: result.error ?? 'Could not start payment.' })
        return 'failed'
      }
      patch({
        status: 'redirecting',
        txnid: result.data.txnid,
        orderPaymentId: result.data.order_payment_id,
        error: null,
      })
      service.redirectToPayU(result.data.payuUrl, result.data.params)
      return 'redirecting'
    },

    async verifyPayment(txnid: string): Promise<PlatformPayuCheckoutStatus> {
      patch({ status: 'verifying', txnid, error: null })
      const result = await service.getPaymentByTxnId(txnid)
      if (!result.success || !result.data) {
        patch({ status: 'failed', error: result.error ?? 'Could not verify payment.' })
        return 'failed'
      }
      if (result.data.payment_status === 'completed') {
        patch({ status: 'success', txnid, orderPaymentId: result.data.id, error: null })
        return 'success'
      }
      if (result.data.payment_status === 'failed' || result.data.payment_status === 'cancelled') {
        patch({
          status: 'failed',
          txnid,
          orderPaymentId: result.data.id,
          error: result.data.failure_reason ?? 'Payment failed.',
        })
        return 'failed'
      }
      patch({ status: 'verifying', txnid, orderPaymentId: result.data.id, error: null })
      return 'verifying'
    },

    reset() {
      resetPlatformPayuStore()
    },
  }
}
