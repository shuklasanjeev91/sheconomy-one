import { useMemo } from 'react'
import { Platform } from 'react-native'

import { XStack, YStack } from '~/components/ui'
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
 * Web uses CSS Grid so the host height always includes every row — Yoga
 * `flexWrap` can under-measure wrapped rows, which parks the commerce footer
 * mid-grid over product cards.
 *
 * Native keeps percentage slots with the gutter as slot padding (not
 * `flexBasis` + pixel `minWidth` + percentage `maxWidth`): that combination
 * wraps early and leaves a card-sized hole at the end of every row.
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

  const cards = mixedListings.map((entry, index) => {
    const card =
      entry.kind === 'organic' ? (
        <ListingCard listing={entry.item} compact={compact} showQuickAdd={showQuickAdd} />
      ) : (
        <SponsoredListingCard
          item={entry.item}
          compact={compact}
          onImpression={(item) => onSponsoredEvent?.(item, 'impression')}
          onClick={(item) => onSponsoredEvent?.(item, 'click')}
        />
      )

    if (Platform.OS === 'web') {
      return (
        <YStack key={entry.key} width="100%" minWidth={0}>
          {card}
        </YStack>
      )
    }

    return (
      <XStack
        key={entry.key}
        width={slotWidthForColumns(columns)}
        minWidth={0}
        {...slotInsets(index % columns, columns)}
      >
        {card}
      </XStack>
    )
  })

  if (Platform.OS === 'web') {
    return (
      <YStack
        width="100%"
        style={
          {
            display: 'grid',
            gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
            gap: GRID_GAP,
            alignContent: 'start',
          } as const
        }
      >
        {cards}
      </YStack>
    )
  }

  return (
    <XStack flexWrap="wrap" width="100%" rowGap={GRID_GAP} alignContent="flex-start">
      {cards}
    </XStack>
  )
}
