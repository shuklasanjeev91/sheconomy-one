import { useEffect, useState } from 'react'

import { useOptionalMarketplacePersonalization } from '~/commerce/context/MarketplacePersonalizationContext'
import {
  fetchMoreFromShop,
  fetchPersonalizedListings,
  fetchRelatedListings,
} from '~/commerce/lib/listing-recommendations'
import type { ListingSummary } from '~/lib/supabase/commerce'

type UseListingRecommendationsOptions = {
  limit?: number
  enabled?: boolean
  shopId?: string | null
}

export function useListingRecommendations(
  listingId?: string,
  options?: UseListingRecommendationsOptions,
) {
  const personalization = useOptionalMarketplacePersonalization()
  const limit = options?.limit ?? 12
  const enabled = options?.enabled !== false && !!listingId
  const shopId = options?.shopId ?? null

  const [related, setRelated] = useState<ListingSummary[]>([])
  const [personalized, setPersonalized] = useState<ListingSummary[]>([])
  const [fromShop, setFromShop] = useState<ListingSummary[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!enabled || !listingId) {
      setRelated([])
      setPersonalized([])
      setFromShop([])
      setIsLoading(false)
      setError(null)
      return
    }

    let active = true
    setIsLoading(true)
    setError(null)

    Promise.all([
      fetchRelatedListings(listingId, limit),
      fetchPersonalizedListings([listingId], limit),
      shopId ? fetchMoreFromShop(shopId, listingId, limit) : Promise.resolve([] as ListingSummary[]),
    ])
      .then(([relatedItems, personalizedItems, shopItems]) => {
        if (!active) return

        const relatedIds = new Set(relatedItems.map((item) => item.id))
        const shopIds = new Set(shopItems.map((item) => item.id))
        const dedupedPersonalized = personalizedItems.filter(
          (item) => item.id !== listingId && !relatedIds.has(item.id) && !shopIds.has(item.id),
        )
        const dedupedRelated = relatedItems.filter((item) => !shopIds.has(item.id))

        const sortedPersonalized =
          personalization?.personalizeListings(dedupedPersonalized, { sort: true }) ??
          dedupedPersonalized

        setRelated(dedupedRelated)
        setPersonalized(sortedPersonalized)
        setFromShop(shopItems)
      })
      .catch((err) => {
        if (!active) return
        setError(err instanceof Error ? err.message : 'Could not load recommendations')
        setRelated([])
        setPersonalized([])
        setFromShop([])
      })
      .finally(() => {
        if (active) setIsLoading(false)
      })

    return () => {
      active = false
    }
  }, [listingId, limit, enabled, shopId, personalization?.isReady])

  return { related, personalized, fromShop, isLoading, error }
}
