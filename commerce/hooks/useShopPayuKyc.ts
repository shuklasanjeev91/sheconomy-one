import { useCallback, useEffect, useState } from 'react'

import {
  kycAllowsStorefront,
  type PayuKycStatus,
} from '~/lib/payment/payu-kyc'
import { supabase } from '~/lib/supabase'

type UseShopPayuKycResult = {
  status: PayuKycStatus | null
  isLoading: boolean
  /** True only when status is payu_verified. */
  allowsSelling: boolean
  refresh: () => Promise<void>
}

/**
 * Current PayU KYC status for a shop. Missing row → status null → selling blocked.
 */
export function useShopPayuKyc(shopId?: string | null): UseShopPayuKycResult {
  const [status, setStatus] = useState<PayuKycStatus | null>(null)
  const [isLoading, setIsLoading] = useState(Boolean(shopId))

  const refresh = useCallback(async () => {
    if (!shopId) {
      setStatus(null)
      setIsLoading(false)
      return
    }
    setIsLoading(true)
    const { data } = await supabase
      .from('shop_payu_kyc')
      .select('status')
      .eq('shop_id', shopId)
      .maybeSingle()
    setStatus((data?.status as PayuKycStatus | undefined) ?? null)
    setIsLoading(false)
  }, [shopId])

  useEffect(() => {
    void refresh()
  }, [refresh])

  return {
    status,
    isLoading,
    allowsSelling: kycAllowsStorefront(status),
    refresh,
  }
}
