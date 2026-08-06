import { useEffect, useMemo, useState } from 'react'

import type { CartItemRow } from '~/commerce/lib/cart'
import { fetchActiveListingIdSet } from '~/commerce/lib/listing-visibility'

/** Cart lines limited to listings that are still active on the storefront. */
export function useStorefrontCartItems(cartItems: CartItemRow[]) {
  const listingIdsKey = useMemo(
    () =>
      [...new Set(cartItems.map((item) => item.listing_id))]
        .filter(Boolean)
        .sort()
        .join(','),
    [cartItems],
  )

  const [activeListingIds, setActiveListingIds] = useState<Set<string>>(new Set())
  const [isChecking, setIsChecking] = useState(false)
  const [hasChecked, setHasChecked] = useState(false)
  const [checkedKey, setCheckedKey] = useState<string | null>(null)

  useEffect(() => {
    if (!listingIdsKey) {
      setActiveListingIds(new Set())
      setIsChecking(false)
      setHasChecked(true)
      setCheckedKey('')
      return
    }

    // Already resolved this exact id set — skip (avoids Strict Mode / identity churn loops).
    if (checkedKey === listingIdsKey) return

    let active = true
    setIsChecking(true)

    fetchActiveListingIdSet(listingIdsKey.split(','))
      .then((next) => {
        if (!active) return
        setActiveListingIds(next)
        setHasChecked(true)
        setCheckedKey(listingIdsKey)
      })
      .catch(() => {
        if (!active) return
        // Fail open: show cart lines rather than spin forever.
        setActiveListingIds(new Set(listingIdsKey.split(',')))
        setHasChecked(true)
        setCheckedKey(listingIdsKey)
      })
      .finally(() => {
        if (active) setIsChecking(false)
      })

    return () => {
      active = false
    }
  }, [listingIdsKey, checkedKey])

  const items = useMemo(() => {
    // Until the first visibility check finishes, keep showing cart lines so
    // checkout does not flash empty / redirect to cart.
    if (!hasChecked || checkedKey !== listingIdsKey) return cartItems
    return cartItems.filter((item) => activeListingIds.has(item.listing_id))
  }, [activeListingIds, cartItems, hasChecked, checkedKey, listingIdsKey])

  return {
    items,
    isChecking: isChecking || (Boolean(listingIdsKey) && checkedKey !== listingIdsKey),
    hasChecked: hasChecked && (listingIdsKey === '' || checkedKey === listingIdsKey),
    hasInactiveItems:
      hasChecked &&
      checkedKey === listingIdsKey &&
      items.length < cartItems.length,
  }
}
