import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { usePathname } from 'one'

import { useCart } from '~/commerce/hooks/useCart'
import { useFavorites } from '~/commerce/hooks/useFavorites'
import { useUserGeo } from '~/commerce/hooks/useUserGeo'
import {
  fetchMarketplaceDemandSignals,
  resolveListingBadge,
  scoreListing,
  personalizeListings,
  type EnrichedListingSummary,
  type ListingBadge,
  type MarketplaceSignals,
} from '~/commerce/lib/marketplace-personalization'
import { useProfile } from '~/hooks/useProfile'
import { useQueryParam } from '~/hooks/useQueryParams'

type MarketplacePersonalizationValue = {
  signals: MarketplaceSignals
  isReady: boolean
  getBadge: (listing: EnrichedListingSummary) => ListingBadge | null
  scoreListing: (listing: EnrichedListingSummary) => number
  personalizeListings: <T extends EnrichedListingSummary>(
    listings: T[],
    options?: { sort?: boolean },
  ) => T[]
}

const MarketplacePersonalizationContext =
  createContext<MarketplacePersonalizationValue | null>(null)

function readSearchQuery(pathname: string, qParam: string | null) {
  if (pathname !== '/search') return ''
  return qParam?.trim() ?? ''
}

export function MarketplacePersonalizationProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const searchQuery = useQueryParam('q')
  const { profile } = useProfile()
  const userGeo = useUserGeo(profile?.location)
  const { items: cartItems } = useCart()
  const { favoriteIds } = useFavorites()

  const [trendingIds, setTrendingIds] = useState<ReadonlySet<string>>(new Set())
  const [bestsellerRank, setBestsellerRank] = useState<ReadonlyMap<string, number>>(new Map())
  const [orderCounts, setOrderCounts] = useState<ReadonlyMap<string, number>>(new Map())
  const [isReady, setIsReady] = useState(false)

  useEffect(() => {
    let active = true

    fetchMarketplaceDemandSignals().then((result) => {
      if (!active) return
      setTrendingIds(result.trendingIds)
      setBestsellerRank(result.bestsellerRank)
      setOrderCounts(result.orderCounts)
      setIsReady(true)
    })

    return () => {
      active = false
    }
  }, [])

  const signals = useMemo<MarketplaceSignals>(
    () => ({
      userGeo,
      searchQuery: readSearchQuery(pathname, searchQuery),
      cartListingIds: new Set(cartItems.map((item) => item.listing_id)),
      favoriteListingIds: new Set(favoriteIds),
      trendingIds,
      bestsellerRank,
      orderCounts,
    }),
    [
      userGeo,
      pathname,
      searchQuery,
      cartItems,
      favoriteIds,
      trendingIds,
      bestsellerRank,
      orderCounts,
    ],
  )

  const value = useMemo<MarketplacePersonalizationValue>(
    () => ({
      signals,
      isReady,
      getBadge: (listing) => resolveListingBadge(listing, signals),
      scoreListing: (listing) => scoreListing(listing, signals),
      personalizeListings: (listings, options) =>
        personalizeListings(listings, signals, options),
    }),
    [signals, isReady],
  )

  return (
    <MarketplacePersonalizationContext.Provider value={value}>
      {children}
    </MarketplacePersonalizationContext.Provider>
  )
}

export function useMarketplacePersonalization() {
  const context = useContext(MarketplacePersonalizationContext)
  if (!context) {
    throw new Error('useMarketplacePersonalization must be used within MarketplacePersonalizationProvider')
  }
  return context
}

export function useOptionalMarketplacePersonalization() {
  return useContext(MarketplacePersonalizationContext)
}