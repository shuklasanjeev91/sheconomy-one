import { useMemo } from 'react'

import { XStack } from '~/components/ui'
import { useOptionalMarketplacePersonalization } from '~/commerce/context/MarketplacePersonalizationContext'
import { hasListingImages } from '~/lib/listing-images'
import type { ListingSummary } from '~/lib/supabase/commerce'

import { ListingCard } from './ListingCard'

type ListingGridProps = {
  listings: ListingSummary[]
  columns?: 2 | 3 | 4 | 5 | 6
  compact?: boolean
  personalize?: boolean
  showQuickAdd?: boolean
}

type ColumnLayout = {
  basis: `${number}%`
  maxWidth: `${number}%` | number
  minWidth: number
}

/**
 * Overflow-proof column layouts:
 * - 2/3 cols: no pixel minWidth (phones would wrap to 1 col), grow into the gap,
 *   capped maxWidth so an odd last card never stretches full-row.
 * - 4+ cols: keep desktop mins so cards don't get tiny on wide screens.
 */
function layoutForColumns(columns: 2 | 3 | 4 | 5 | 6): ColumnLayout {
  switch (columns) {
    case 2:
      return { basis: '44%', maxWidth: '48.5%', minWidth: 0 }
    case 3:
      return { basis: '29%', maxWidth: '32%', minWidth: 0 }
    case 4:
      return { basis: '22%', maxWidth: '24.5%', minWidth: 180 }
    case 5:
      return { basis: '17.5%', maxWidth: '19.5%', minWidth: 160 }
    case 6:
      return { basis: '14.5%', maxWidth: '16.5%', minWidth: 140 }
  }
}

/** Responsive listing grid — tight gaps, fluid columns. */
export function ListingGrid({
  listings,
  columns = 5,
  compact,
  personalize = true,
  showQuickAdd,
}: ListingGridProps) {
  const marketplace = useOptionalMarketplacePersonalization()

  const visibleListings = useMemo(() => {
    const filtered = listings.filter((listing) =>
      hasListingImages(listing.image_urls, listing.image_url),
    )

    if (!personalize || !marketplace) return filtered
    return marketplace.personalizeListings(filtered, { sort: true })
  }, [listings, marketplace, personalize])

  const { basis, maxWidth, minWidth } = layoutForColumns(columns)

  return (
    <XStack gap="$3" flexWrap="wrap" width="100%">
      {visibleListings.map((listing) => (
        <XStack
          key={listing.id}
          flexBasis={basis}
          flexGrow={1}
          flexShrink={1}
          minWidth={minWidth}
          maxWidth={maxWidth}
        >
          <ListingCard listing={listing} compact={compact} showQuickAdd={showQuickAdd} />
        </XStack>
      ))}
    </XStack>
  )
}
