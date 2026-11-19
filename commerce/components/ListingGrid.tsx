import { useMemo, type CSSProperties } from 'react'
import { Platform } from 'react-native'

import { XStack } from '~/components/ui'
import { useOptionalMarketplacePersonalization } from '~/commerce/context/MarketplacePersonalizationContext'
import { hasListingImages } from '~/lib/listing-images'
import type { ListingSummary } from '~/lib/supabase/commerce'

import { ListingCard } from '~/commerce/components/ListingCard'
import { SponsoredListingCard } from '~/commerce/components/SponsoredListingCard'
import {
  mixSponsoredPlacements,
  type SponsoredCommerceItem,
} from '~/commerce/hooks/useSponsoredCommerce'

type ListingGridProps = {
  listings: ListingSummary[]
  columns?: 2 | 3 | 4 | 5 | 6
  compact?: boolean
  personalize?: boolean
  showQuickAdd?: boolean
  /** Forwarded to each organic card (e.g. close SHERPA then navigate). */
  onOpenListing?: (listing: ListingSummary) => void
  sponsoredItems?: SponsoredCommerceItem[]
  onSponsoredEvent?: (
    item: SponsoredCommerceItem,
    event: 'impression' | 'click',
  ) => void
}

const GRID_GAP = 12

/**
 * Slot width as a share of the row.
 *
 * Floored so `columns` slots can never add up past 100% once Yoga rounds to
 * device pixels — a fraction over and the last card of every row wraps.
 */
function slotWidthForColumns(columns: 2 | 3 | 4 | 5 | 6) {
  return `${Math.floor((100 / columns) * 1000) / 1000}%` as const
}

/**
 * Gutter carried inside each slot, so the row stays flush with the page gutters
 * while every card keeps the same width: the shares add up to one `GRID_GAP`
 * between neighbours and none at the row edges.
 */
function slotInsets(indexInRow: number, columns: number) {
  return {
    paddingLeft: (indexInRow * GRID_GAP) / columns,
    paddingRight: ((columns - 1 - indexInRow) * GRID_GAP) / columns,
  }
}

/**
 * Responsive listing grid for page-scroll hosts (Home, browse, shop).
 *
 * Web uses a plain CSS Grid `div` so host height always includes every row —
 * Tamagui/Yoga `flexWrap` (and even `display:grid` on a YStack) can under-measure
 * wrapped rows and park the commerce footer mid-grid over product cards.
 *
 * Native keeps percentage slots with the gutter as slot padding.
 *
 * Do not nest a non-scrolling FlashList here — FlashList under-measures inside
 * parent ScrollViews and leaves large blank regions under the first row.
 */
export function ListingGrid({
  listings,
  columns = 5,
  compact,
  personalize = true,
  showQuickAdd,
  onOpenListing,
  sponsoredItems = [],
  onSponsoredEvent,
}: ListingGridProps) {
  const marketplace = useOptionalMarketplacePersonalization()

  const visibleListings = useMemo(() => {
    const filtered = listings.filter((listing) =>
      hasListingImages(listing.image_urls, listing.image_url),
    )

    if (!personalize || !marketplace) return filtered
    return marketplace.personalizeListings(filtered, { sort: true })
  }, [listings, marketplace, personalize])

  const mixedListings = useMemo(
    () =>
      mixSponsoredPlacements(
        visibleListings,
        sponsoredItems.filter(
          (item): item is Extract<SponsoredCommerceItem, { kind: 'listing' }> =>
            item.kind === 'listing',
        ),
        {
          getOrganicId: (listing) => listing.id,
          getSponsoredId: (item) => item.entityId,
          after: 6,
          every: 12,
          maxSponsored: 2,
        },
      ),
    [sponsoredItems, visibleListings],
  )

  if (Platform.OS === 'web') {
    const gridStyle: CSSProperties = {
      display: 'grid',
      gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
      gap: GRID_GAP,
      width: '100%',
      alignContent: 'start',
    }
    return (
      <div data-listing-grid="true" style={gridStyle}>
        {mixedListings.map((entry) => (
          <div key={entry.key} style={{ width: '100%', minWidth: 0 }}>
            {entry.kind === 'organic' ? (
              <ListingCard
                listing={entry.item}
                compact={compact}
                showQuickAdd={showQuickAdd}
                onOpen={onOpenListing}
              />
            ) : (
              <SponsoredListingCard
                item={entry.item}
                compact={compact}
                onImpression={(item) => onSponsoredEvent?.(item, 'impression')}
                onClick={(item) => onSponsoredEvent?.(item, 'click')}
              />
            )}
          </div>
        ))}
      </div>
    )
  }

  return (
    <XStack flexWrap="wrap" width="100%" rowGap={GRID_GAP} alignContent="flex-start">
      {mixedListings.map((entry, index) => (
        <XStack
          key={entry.key}
          width={slotWidthForColumns(columns)}
          minWidth={0}
          {...slotInsets(index % columns, columns)}
        >
          {entry.kind === 'organic' ? (
            <ListingCard
              listing={entry.item}
              compact={compact}
              showQuickAdd={showQuickAdd}
              onOpen={onOpenListing}
            />
          ) : (
            <SponsoredListingCard
              item={entry.item}
              compact={compact}
              onImpression={(item) => onSponsoredEvent?.(item, 'impression')}
              onClick={(item) => onSponsoredEvent?.(item, 'click')}
            />
          )}
        </XStack>
      ))}
    </XStack>
  )
}
