import { useEffect, useState } from 'react'

import { useOptionalMarketplacePersonalization } from '~/commerce/context/MarketplacePersonalizationContext'
import {
  fetchPersonalizedListings,
  fetchRelatedListings,
} from '~/commerce/lib/listing-recommendations'
import type { ListingSummary } from '~/lib/supabase/commerce'

type UseListingRecommendationsOptions = {
  limit?: number
  enabled?: boolean
}

export function useListingRecommendations(
  listingId?: string,
  options?: UseListingRecommendationsOptions,
) {
  const personalization = useOptionalMarketplacePersonalization()
  const limit = options?.limit ?? 12
  const enabled = options?.enabled !== false && !!listingId

  const [related, setRelated] = useState<ListingSummary[]>([])
  const [personalized, setPersonalized] = useState<ListingSummary[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!enabled || !listingId) {
      setRelated([])
      setPersonalized([])
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
    ])
      .then(([relatedItems, personalizedItems]) => {
        if (!active) return

        const relatedIds = new Set(relatedItems.map((item) => item.id))
        const dedupedPersonalized = personalizedItems.filter(
          (item) => item.id !== listingId && !relatedIds.has(item.id),
        )

        const sortedPersonalized =
          personalization?.personalizeListings(dedupedPersonalized, { sort: true }) ??
          dedupedPersonalized

        setRelated(relatedItems)
        setPersonalized(sortedPersonalized)
      })
      .catch((err) => {
        if (!active) return
        setError(err instanceof Error ? err.message : 'Could not load recommendations')
        setRelated([])
        setPersonalized([])
      })
      .finally(() => {
        if (active) setIsLoading(false)
      })

    return () => {
      active = false
    }
  }, [listingId, limit, enabled, personalization?.isReady])

  return { related, personalized, isLoading, error }
}
