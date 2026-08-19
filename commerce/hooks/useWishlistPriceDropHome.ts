import { useCallback, useEffect, useMemo, useState } from 'react'

import { useFavorites } from '~/commerce/hooks/useFavorites'
import { fetchListingsByIds } from '~/commerce/lib/commerce'
import {
  buildWishlistPriceDropCards,
  type WishlistPriceDropCard,
} from '~/commerce/lib/wishlist-price-drops-home'
import { readSavedFromCartWishlistMap } from '~/commerce/lib/wishlist-reactivation'
import { buildWishlistReactivation } from '~/commerce/lib/wishlist-reactivation'
import { INVALIDATION_TOPICS } from '~/lib/cache/invalidation'
import { useAutoRefresh } from '~/lib/cache/useAutoRefresh'

export function useWishlistPriceDropHome(limit = 6) {
  const favorites = useFavorites()
  const [cards, setCards] = useState<WishlistPriceDropCard[]>([])
  const [loading, setLoading] = useState(true)

  const reload = useCallback(async () => {
    if (favorites.isLoading) return
    if (!favorites.favoriteIds.length) {
      setCards([])
      setLoading(false)
      return
    }

    setLoading(true)
    const [listings, savedFromCart] = await Promise.all([
      fetchListingsByIds(favorites.favoriteIds.slice(0, 24)),
      readSavedFromCartWishlistMap(),
    ])
    const result = buildWishlistReactivation({ items: listings, savedFromCart })
    setCards(buildWishlistPriceDropCards(result.sections, limit))
    setLoading(false)
  }, [favorites.favoriteIds, favorites.isLoading, limit])

  useEffect(() => {
    void reload()
  }, [reload])

  useAutoRefresh([INVALIDATION_TOPICS.commerceWishlist, INVALIDATION_TOPICS.commerceListings], () => {
    if (favorites.isLoading) return
    void reload()
  })

  return useMemo(
    () => ({
      cards,
      loading: favorites.isLoading || loading,
      hasCards: cards.length > 0,
      refresh: reload,
    }),
    [cards, favorites.isLoading, loading, reload],
  )
}

export type { WishlistPriceDropCard }
