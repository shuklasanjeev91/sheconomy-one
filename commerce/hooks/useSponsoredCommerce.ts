import { useCallback, useEffect, useMemo, useState } from 'react'

import {
  fetchAppAds,
  trackAppAd,
  type AppAd,
  type AppAdContext,
  type AppAdPlacement,
} from '~/community/lib/app-ads'
import { fetchListingsByIds, type ListingSummary, type ShopSummary } from '~/commerce/lib/commerce'
import { getPublicShops } from '~/lib/shop/shop.service'

const sponsoredCommerceSessionId =
  `commerce-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`

export type SponsoredCommerceItem =
  | {
      kind: 'listing'
      ad: AppAd
      entityId: string
      listing: ListingSummary
    }
  | {
      kind: 'shop'
      ad: AppAd
      entityId: string
      shop: ShopSummary
    }

export type SponsoredPlacementItem<T, A> =
  | { kind: 'organic'; key: string; item: T }
  | { kind: 'sponsored'; key: string; item: A }

type MixSponsoredOptions<T, A> = {
  getOrganicId: (item: T) => string
  getSponsoredId: (item: A) => string
  /** Number of organic cards before the first sponsored card. */
  after?: number
  /** Minimum number of organic cards between sponsored cards. */
  every?: number
  maxSponsored?: number
}

/**
 * Pure sparse placement mixer. A sponsored entity takes the place of the same
 * organic entity so a shopper never sees both versions in one result set.
 */
export function mixSponsoredPlacements<T, A>(
  organic: T[],
  sponsored: A[],
  options: MixSponsoredOptions<T, A>,
): SponsoredPlacementItem<T, A>[] {
  const after = Math.max(1, options.after ?? 6)
  const every = Math.max(4, options.every ?? 12)
  const maxSponsored = Math.max(0, options.maxSponsored ?? 2)
  const seenSponsoredIds = new Set<string>()
  const eligibleSponsored = sponsored.filter((item) => {
    const id = options.getSponsoredId(item)
    if (!id || seenSponsoredIds.has(id)) return false
    seenSponsoredIds.add(id)
    return true
  }).slice(0, maxSponsored)
  const sponsoredIds = new Set(eligibleSponsored.map(options.getSponsoredId))
  const uniqueOrganic = organic.filter((item, index, all) => {
    const id = options.getOrganicId(item)
    return !sponsoredIds.has(id) && all.findIndex((candidate) => options.getOrganicId(candidate) === id) === index
  })

  const mixed: SponsoredPlacementItem<T, A>[] = []
  let adIndex = 0
  uniqueOrganic.forEach((item, index) => {
    mixed.push({ kind: 'organic', key: `organic:${options.getOrganicId(item)}`, item })
    const organicCount = index + 1
    const shouldInsert =
      adIndex < eligibleSponsored.length &&
      organicCount >= after &&
      (organicCount - after) % every === 0
    if (shouldInsert) {
      const ad = eligibleSponsored[adIndex++]
      mixed.push({
        kind: 'sponsored',
        key: `sponsored:${options.getSponsoredId(ad)}`,
        item: ad,
      })
    }
  })

  // Short result sets may still carry one ad, but never lead with it.
  if (adIndex === 0 && eligibleSponsored.length > 0 && uniqueOrganic.length >= 2) {
    mixed.push({
      kind: 'sponsored',
      key: `sponsored:${options.getSponsoredId(eligibleSponsored[0])}`,
      item: eligibleSponsored[0],
    })
  }
  return mixed
}

type UseSponsoredCommerceOptions = {
  placement: AppAdPlacement
  context?: AppAdContext
  enabled?: boolean
  limit?: number
}

export function useSponsoredCommerce({
  placement,
  context,
  enabled = true,
  limit = 2,
}: UseSponsoredCommerceOptions) {
  const [items, setItems] = useState<SponsoredCommerceItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Serialize once per render — do not depend on `context` object identity
  // (callers often pass inline objects every render).
  const contextKey = JSON.stringify(context ?? {})
  const parsedContext = useMemo((): AppAdContext => {
    try {
      return JSON.parse(contextKey) as AppAdContext
    } catch {
      return {}
    }
  }, [contextKey])

  const refresh = useCallback(async () => {
    if (!enabled || limit <= 0) {
      setItems([])
      setError(null)
      return
    }

    setLoading(true)
    const result = await fetchAppAds({ placement, context: parsedContext, limit })
    if (result.error || !result.data?.ads.length) {
      setItems([])
      setError(result.error)
      setLoading(false)
      return
    }

    const ads = result.data.ads
    const listingIds = ads
      .filter((ad) => ad.promoted_entity.type === 'listing')
      .map((ad) => ad.promoted_entity.id)
    const shopIds = ads
      .filter((ad) => ad.promoted_entity.type === 'shop')
      .map((ad) => ad.promoted_entity.id)

    const [listings, shopsResult] = await Promise.all([
      fetchListingsByIds(listingIds),
      shopIds.length
        ? getPublicShops({ shopIds }, { limit: shopIds.length })
        : Promise.resolve({ data: { items: [] as ShopSummary[], count: 0, hasMore: false }, error: null }),
    ])
    const listingsById = new Map(listings.map((listing) => [listing.id, listing]))
    const shopsById = new Map((shopsResult.data?.items ?? []).map((shop) => [shop.id, shop]))

    setItems(
      ads.flatMap((ad): SponsoredCommerceItem[] => {
        if (ad.promoted_entity.type === 'listing') {
          const listing = listingsById.get(ad.promoted_entity.id)
          return listing ? [{ kind: 'listing', ad, entityId: ad.promoted_entity.id, listing }] : []
        }
        if (ad.promoted_entity.type === 'shop') {
          const shop = shopsById.get(ad.promoted_entity.id)
          return shop ? [{ kind: 'shop', ad, entityId: ad.promoted_entity.id, shop }] : []
        }
        return []
      }),
    )
    setError(shopsResult.error)
    setLoading(false)
  }, [contextKey, parsedContext, enabled, limit, placement])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const track = useCallback(
    (item: SponsoredCommerceItem, eventType: 'impression' | 'click') =>
      trackAppAd({
        ad: {
          ...item.ad,
          promoted_entity_type: item.kind,
          promoted_entity_id: item.entityId,
        },
        eventType,
        eventKey:
          eventType === 'impression'
            ? `${item.ad.campaign_id}:${item.ad.creative_id}:${sponsoredCommerceSessionId}:impression`
            : `${item.ad.campaign_id}:${item.ad.creative_id}:${sponsoredCommerceSessionId}:click:${Date.now()}`,
        sessionId: sponsoredCommerceSessionId,
      }),
    [],
  )

  return { items, loading, error, refresh, track }
}
