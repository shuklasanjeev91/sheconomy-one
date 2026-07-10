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
}

/** Responsive listing grid — tight gaps, fluid columns. */
export function ListingGrid({ listings, columns = 5, compact, personalize = true }: ListingGridProps) {
  const marketplace = useOptionalMarketplacePersonalization()

  const visibleListings = useMemo(() => {
    const filtered = listings.filter((listing) =>
      hasListingImages(listing.image_urls, listing.image_url),
    )

    if (!personalize || !marketplace) return filtered
    return marketplace.personalizeListings(filtered, { sort: true })
  }, [listings, marketplace, personalize])

  const minWidth =
    columns === 6 ? 140 : columns === 5 ? 168 : columns === 4 ? 200 : columns === 3 ? 220 : 160

  const basis =
    columns === 6
      ? '15.5%'
      : columns === 5
        ? '18.5%'
        : columns === 4
          ? '23%'
          : columns === 3
            ? '31%'
            : '47%'

  return (
    <XStack gap="$4" flexWrap="wrap" width="100%">
      {visibleListings.map((listing) => (
        <XStack
          key={listing.id}
          flexBasis={basis}
          flexGrow={0}
          flexShrink={0}
          minWidth={minWidth}
          maxWidth={columns === 2 ? '47%' : 280}
        >
          <ListingCard listing={listing} compact={compact} />
        </XStack>
      ))}
    </XStack>
  )
}