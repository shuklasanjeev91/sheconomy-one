import { useEffect, useMemo, useState } from 'react'

import { supabase } from '~/lib/supabase/client'

/** Buyer-facing shop header info surfaced in cart/checkout shop groups. */
export type ShopHeaderInfo = {
  shopId: string
  rating: number | null
  reviews: number
  verified: boolean
}

async function fetchShopHeaders(shopIds: string[]): Promise<Map<string, ShopHeaderInfo>> {
  const result = new Map<string, ShopHeaderInfo>()
  const unique = [...new Set(shopIds.filter(Boolean))]
  if (unique.length === 0) return result

  const { data } = await supabase
    .from('shops')
    .select('id, average_rating, total_reviews, verified')
    .in('id', unique)

  for (const row of data ?? []) {
    result.set(row.id, {
      shopId: row.id,
      rating: typeof row.average_rating === 'number' ? row.average_rating : null,
      reviews: row.total_reviews ?? 0,
      verified: !!row.verified,
    })
  }
  return result
}

export function useShopHeaders(shopIds: string[]) {
  const key = useMemo(() => [...new Set(shopIds.filter(Boolean))].sort().join(','), [shopIds])
  const [headers, setHeaders] = useState<Map<string, ShopHeaderInfo>>(new Map())

  useEffect(() => {
    if (!key) {
      setHeaders(new Map())
      return
    }
    let active = true
    void fetchShopHeaders(key.split(',')).then((map) => {
      if (active) setHeaders(map)
    })
    return () => {
      active = false
    }
  }, [key])

  return headers
}
