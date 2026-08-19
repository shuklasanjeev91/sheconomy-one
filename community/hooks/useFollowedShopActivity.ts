import { useMemo } from 'react'

import { useFollowedShopDigest } from '~/commerce/hooks/useFollowedShopDigest'
import { buildFollowedShopActivityCards } from '~/community/lib/followed-shop-activity'

export function useFollowedShopActivity(limit = 8) {
  const digest = useFollowedShopDigest()

  const cards = useMemo(
    () => buildFollowedShopActivityCards(digest.sections, limit),
    [digest.sections, limit],
  )

  return useMemo(
    () => ({
      cards,
      loading: digest.isLoading,
      hasCards: cards.length > 0,
      refresh: digest.refresh,
    }),
    [cards, digest.isLoading, digest.refresh],
  )
}
