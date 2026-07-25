import { useEffect, useState } from 'react'
import { Platform } from 'react-native'

import { useOptionalMarketplacePersonalization } from '~/commerce/context/MarketplacePersonalizationContext'
import {
  fetchMoreFromShop,
  fetchPersonalizedListings,
  fetchRelatedListings,
  listingCardsFromHomeCache,
  type RelatedListingContext,
} from '~/commerce/lib/listing-recommendations'
import type { ListingSummary } from '~/lib/supabase/commerce'

type UseListingRecommendationsOptions = {
  limit?: number
  enabled?: boolean
  shopId?: string | null
  category?: string | null
  listingType?: string | null
}

const NATIVE_LIMIT = 6

function dedupe(
  items: ListingSummary[],
  exclude: Set<string>,
): ListingSummary[] {
  return items.filter((item) => {
    if (exclude.has(item.id)) return false
    exclude.add(item.id)
    return true
  })
}

/**
 * Progressive recommendation rails — paint from home cache immediately,
 * then upgrade each rail independently with no blocking spinner.
 */
export function useListingRecommendations(
  listingId?: string,
  options?: UseListingRecommendationsOptions,
) {
  const personalization = useOptionalMarketplacePersonalization()
  const limit = options?.limit ?? (Platform.OS === 'web' ? 12 : NATIVE_LIMIT)
  const enabled = options?.enabled !== false && !!listingId
  const shopId = options?.shopId ?? null
  const category = options?.category ?? null
  const listingType = options?.listingType ?? null

  const seed = listingId ? listingCardsFromHomeCache(listingId, limit) : []
  const [related, setRelated] = useState<ListingSummary[]>(seed)
  const [personalized, setPersonalized] = useState<ListingSummary[]>([])
  const [fromShop, setFromShop] = useState<ListingSummary[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!enabled || !listingId) {
      setRelated([])
      setPersonalized([])
      setFromShop([])
      setError(null)
      return
    }

    let active = true
    setError(null)

    // Instant seed from home feeds so the bottom of PDP is never empty/spinner.
    const homeSeed = listingCardsFromHomeCache(listingId, limit)
    if (homeSeed.length) {
      setRelated(homeSeed)
      setPersonalized(homeSeed.slice(0, Math.min(limit, homeSeed.length)))
    }

    const context: RelatedListingContext = { shopId, category, listingType }
    const used = new Set<string>([listingId])

    void fetchMoreFromShop(shopId ?? '', listingId, limit)
      .then((items) => {
        if (!active || !shopId) return
        setFromShop(items)
        for (const item of items) used.add(item.id)
      })
      .catch(() => {})

    void fetchRelatedListings(listingId, limit, context)
      .then((items) => {
        if (!active) return
        setRelated(dedupe(items, new Set(used)))
      })
      .catch((err) => {
        if (active) {
          setError(err instanceof Error ? err.message : 'Could not load recommendations')
        }
      })

    void fetchPersonalizedListings([listingId], limit)
      .then((items) => {
        if (!active) return
        const exclude = new Set(used)
        const deduped = dedupe(items, exclude)
        setPersonalized(
          personalization?.personalizeListings(deduped, { sort: true }) ?? deduped,
        )
      })
      .catch(() => {
        if (active) setPersonalized([])
      })

    return () => {
      active = false
    }
  }, [
    listingId,
    limit,
    enabled,
    shopId,
    category,
    listingType,
    personalization?.isReady,
  ])

  const hasAny = fromShop.length > 0 || related.length > 0 || personalized.length > 0

  return {
    related,
    personalized,
    fromShop,
    isLoading: false,
    loadingShop: false,
    loadingRelated: false,
    loadingPersonalized: false,
    hasAny,
    error,
  }
}
