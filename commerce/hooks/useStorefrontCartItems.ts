import { useEffect, useMemo, useState } from 'react'

import type { CartItemRow } from '~/commerce/lib/cart'
import { fetchActiveListingIdSet } from '~/commerce/lib/listing-visibility'

/** Cart lines limited to listings that are still active on the storefront. */
export function useStorefrontCartItems(cartItems: CartItemRow[]) {
  const [activeListingIds, setActiveListingIds] = useState<Set<string>>(new Set())
  const [isChecking, setIsChecking] = useState(false)

  useEffect(() => {
    const ids = cartItems.map((item) => item.listing_id)
    if (!ids.length) {
      setActiveListingIds(new Set())
      setIsChecking(false)
      return
    }

    let active = true
    setIsChecking(true)

    fetchActiveListingIdSet(ids)
      .then((next) => {
        if (!active) return
        setActiveListingIds(next)
      })
      .finally(() => {
        if (active) setIsChecking(false)
      })

    return () => {
      active = false
    }
  }, [cartItems])

  const items = useMemo(
    () => cartItems.filter((item) => activeListingIds.has(item.listing_id)),
    [activeListingIds, cartItems],
  )

  return { items, isChecking, hasInactiveItems: items.length < cartItems.length }
}
