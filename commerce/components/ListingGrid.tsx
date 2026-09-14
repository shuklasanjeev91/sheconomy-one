import { useMemo } from 'react'

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
 * Rows are percentage slots with the gutter as slot padding, not `flexBasis`
 * plus a pixel `minWidth` and a percentage `maxWidth`: that combination wraps a
 * card early whenever the row cannot fit `columns` cards at the minimum, while
 * the cap stops the survivors from growing, so every row keeps a card-sized
 * hole at its end (an iPad-width grid asked for 4 and drew 3 plus a gap).
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

  const slotWidth = slotWidthForColumns(columns)

  return (
    <XStack flexWrap="wrap" width="100%" rowGap={GRID_GAP}>
      {mixedListings.map((entry, index) => (
        <XStack
          key={entry.key}
          width={slotWidth}
          minWidth={0}
          {...slotInsets(index % columns, columns)}
        >
          {entry.kind === 'organic' ? (
            <ListingCard listing={entry.item} compact={compact} showQuickAdd={showQuickAdd} />
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
