import { useMemo } from 'react'
import { FlashList } from '@shopify/flash-list'
import { Platform } from 'react-native'

import { XStack, YStack } from '~/components/ui'
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
  /**
   * When true (default on native for large grids), use FlashList with numColumns.
   * Nested page-scroll contexts still recycle within the drawn window when bounded.
   */
  virtualized?: boolean
}

type ColumnLayout = {
  basis: `${number}%`
  maxWidth: `${number}%` | number
  minWidth: number
}

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

/** Responsive listing grid — FlashList on native for larger catalogs. */
export function ListingGrid({
  listings,
  columns = 5,
  compact,
  personalize = true,
  showQuickAdd,
  virtualized = Platform.OS !== 'web',
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
  const useFlash = virtualized && visibleListings.length > 10

  if (useFlash) {
    return (
      <FlashList
        data={visibleListings}
        keyExtractor={(item) => item.id}
        numColumns={columns}
        scrollEnabled={false}
        drawDistance={400}
        renderItem={({ item: listing }) => (
          <YStack flex={1} padding="$1.5" minWidth={0}>
            <ListingCard listing={listing} compact={compact} showQuickAdd={showQuickAdd} />
          </YStack>
        )}
        style={{ width: '100%' }}
      />
    )
  }

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
