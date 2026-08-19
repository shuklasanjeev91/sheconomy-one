import { useCallback, useEffect, useMemo, useState } from 'react'

import { useFavorites } from '~/commerce/hooks/useFavorites'
import { fetchListingsByIds } from '~/commerce/lib/commerce'
import {
  buildWishlistActivityCards,
  type WishlistActivityCard,
} from '~/community/lib/wishlist-activity'
import { readSavedFromCartWishlistMap } from '~/commerce/lib/wishlist-reactivation'
import { buildWishlistReactivation } from '~/commerce/lib/wishlist-reactivation'
import { INVALIDATION_TOPICS } from '~/lib/cache/invalidation'
import { useAutoRefresh } from '~/lib/cache/useAutoRefresh'

export function useWishlistActivity(limit = 8) {
  const favorites = useFavorites()
  const [cards, setCards] = useState<WishlistActivityCard[]>([])
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
    setCards(buildWishlistActivityCards(result.sections, limit))
    setLoading(false)
  }, [favorites.favoriteIds, favorites.isLoading, limit])

  useEffect(() => {
    void reload()
  }, [reload])

  useAutoRefresh([INVALIDATION_TOPICS.commerceWishlist], () => {
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

export type { WishlistActivityCard }
