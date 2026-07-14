import { useEffect, useMemo, useState } from 'react'

import {
  arePartnersUniform,
  fetchShopCommerceSettings,
  type ShopPartnerInfo,
} from '~/commerce/lib/shop-commerce'

/**
 * Resolves per-shop payment + shipping partners for the given shop ids and
 * reports whether they're uniform (order can be placed together).
 */
export function useShopPartners(shopIds: string[]) {
  const [partners, setPartners] = useState<Map<string, ShopPartnerInfo>>(new Map())
  const [loading, setLoading] = useState(false)

  const key = useMemo(() => [...new Set(shopIds)].sort().join(','), [shopIds])

  useEffect(() => {
    const ids = key ? key.split(',') : []
    if (ids.length === 0) {
      setPartners(new Map())
      return
    }
    let active = true
    setLoading(true)
    fetchShopCommerceSettings(ids)
      .then((map) => {
        if (active) setPartners(map)
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [key])

  const uniform = useMemo(() => arePartnersUniform(partners.values()), [partners])

  return { partners, uniform, loading }
}
