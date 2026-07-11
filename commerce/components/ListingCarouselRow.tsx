import { ScrollView, XStack, YStack, useMedia } from '~/components/ui'
import type { ListingSummary } from '~/lib/supabase/commerce'

import { ListingCard } from './ListingCard'

type ListingCarouselRowProps = {
  listings: ListingSummary[]
  compact?: boolean
}

/** Horizontal listing row for product detail recommendations. */
export function ListingCarouselRow({ listings, compact = true }: ListingCarouselRowProps) {
  const media = useMedia()
  const cardWidth = media.gtLg ? 220 : media.gtMd ? 200 : 168

  if (!listings.length) return null

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      <XStack gap="$3" paddingRight="$4" alignItems="stretch">
        {listings.map((listing) => (
          <YStack key={listing.id} width={cardWidth} flexShrink={0}>
            <ListingCard listing={listing} compact={compact} />
          </YStack>
        ))}
      </XStack>
    </ScrollView>
  )
}
