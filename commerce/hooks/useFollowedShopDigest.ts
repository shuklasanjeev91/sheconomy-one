import { useCallback, useEffect, useState } from 'react'

import { useFavorites } from '~/commerce/hooks/useFavorites'
import { useFollowedShops } from '~/commerce/hooks/useFollowedShops'
import {
  loadFollowedShopDigest,
  type FollowedShopDigestResult,
} from '~/commerce/lib/followed-shop-digest'

const EMPTY_RESULT: FollowedShopDigestResult = {
  sections: [],
  counts: {
    followedShops: 0,
    newArrivals: 0,
    priceDrops: 0,
    savedOverlap: 0,
  },
  hasActivity: false,
}

export function useFollowedShopDigest() {
  const followedShops = useFollowedShops()
  const favorites = useFavorites()
  const [result, setResult] = useState<FollowedShopDigestResult>(EMPTY_RESULT)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    if (followedShops.isLoading || favorites.isLoading) return
    if (!followedShops.isAuthenticated) {
      setResult(EMPTY_RESULT)
      setError(null)
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    try {
      const next = await loadFollowedShopDigest({
        followedShops: followedShops.items,
        favoriteIds: favorites.favoriteIds,
      })
      setResult(next)
      setError(followedShops.error)
    } catch (loadError) {
      setResult(EMPTY_RESULT)
      setError(loadError instanceof Error ? loadError.message : 'Could not load followed-shop activity.')
    } finally {
      setIsLoading(false)
    }
  }, [
    favorites.favoriteIds,
    favorites.isLoading,
    followedShops.error,
    followedShops.isAuthenticated,
    followedShops.isLoading,
    followedShops.items,
  ])

  useEffect(() => {
    void reload()
  }, [reload])

  return {
    ...result,
    isLoading: followedShops.isLoading || favorites.isLoading || isLoading,
    error,
    refresh: reload,
    followedShops: followedShops.items,
  }
}
