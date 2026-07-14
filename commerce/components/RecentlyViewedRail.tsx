import { useEffect, useState } from 'react'

import { fetchListingsByIds, type ListingSummary } from '~/lib/supabase/commerce'
import { useRecentlyViewed } from '~/commerce/lib/recently-viewed'

import { CommerceSection } from './CommerceSection'
import { ListingCarouselRow } from './ListingCarouselRow'

type RecentlyViewedRailProps = {
  /** Listing ids to hide (e.g. items already in the cart). */
  excludeIds?: string[]
  title?: string
  subtitle?: string
}

/** Horizontal "Recently viewed" rail backed by the local recently-viewed store. */
export function RecentlyViewedRail({
  excludeIds = [],
  title = 'Recently viewed',
  subtitle = 'Pick up where you left off',
}: RecentlyViewedRailProps) {
  const recentIds = useRecentlyViewed(excludeIds)
  const [items, setItems] = useState<ListingSummary[]>([])

  useEffect(() => {
    if (recentIds.length === 0) {
      setItems([])
      return
    }
    let active = true
    void fetchListingsByIds(recentIds.slice(0, 12)).then((listings) => {
      if (!active) return
      const order = new Map(recentIds.map((id, index) => [id, index]))
      setItems([...listings].sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0)))
    })
    return () => {
      active = false
    }
  }, [recentIds.join(',')])

  if (items.length === 0) return null

  return (
    <CommerceSection title={title} subtitle={subtitle}>
      <ListingCarouselRow listings={items} />
    </CommerceSection>
  )
}
