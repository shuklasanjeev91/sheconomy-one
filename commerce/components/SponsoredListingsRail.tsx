import type { AppAdContext, AppAdPlacement } from '~/community/lib/app-ads'
import { CommerceSection } from '~/commerce/components/CommerceSection'
import { SponsoredListingCard } from '~/commerce/components/SponsoredListingCard'
import {
  useSponsoredCommerce,
  type SponsoredCommerceItem,
} from '~/commerce/hooks/useSponsoredCommerce'
import { PageSection } from '~/components/layout'
import { ScrollView, XStack, YStack } from '~/components/ui'
import { useAppLayout } from '~/hooks/useAppLayout'

type SponsoredListingsRailProps = {
  placement: AppAdPlacement
  context?: AppAdContext
  title?: string
  enabled?: boolean
  limit?: number
  listingOnly?: boolean
  shopOnly?: boolean
  items?: SponsoredCommerceItem[]
  onSponsoredEvent?: (
    item: SponsoredCommerceItem,
    event: 'impression' | 'click',
  ) => void
  inset?: boolean
}

/** Sparse sponsored listing/shop rail. Empty and failed requests render nothing. */
export function SponsoredListingsRail({
  placement,
  context,
  title = 'Sponsored picks',
  enabled = true,
  limit = 2,
  listingOnly = false,
  shopOnly = false,
  items: suppliedItems,
  onSponsoredEvent,
  inset = false,
}: SponsoredListingsRailProps) {
  const { listingCardWidth } = useAppLayout()
  const sponsored = useSponsoredCommerce({
    placement,
    context,
    enabled: enabled && suppliedItems === undefined,
    limit,
  })
  const sourceItems = suppliedItems ?? sponsored.items
  const items = listingOnly
    ? sourceItems.filter((item) => item.kind === 'listing')
    : shopOnly
      ? sourceItems.filter((item) => item.kind === 'shop')
      : sourceItems
  const track = (item: SponsoredCommerceItem, event: 'impression' | 'click') => {
    if (onSponsoredEvent) onSponsoredEvent(item, event)
    else void sponsored.track(item, event)
  }

  if (!items.length) return null

  const content = (
    <CommerceSection title={title} subtitle="Paid placements, clearly labelled">
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ flexGrow: 0 }}
        contentContainerStyle={{ flexGrow: 0, alignItems: 'stretch' }}
      >
        <XStack gap="$3" paddingRight="$4" alignItems="stretch">
          {items.map((item) => (
            <YStack
              key={`${item.ad.creative_id}:${item.entityId}`}
              width={item.kind === 'listing' ? listingCardWidth : 212}
              flexShrink={0}
            >
              <SponsoredListingCard
                item={item}
                compact={item.kind === 'listing'}
                onImpression={(next) => track(next, 'impression')}
                onClick={(next) => track(next, 'click')}
              />
            </YStack>
          ))}
        </XStack>
      </ScrollView>
    </CommerceSection>
  )
  return inset ? <PageSection>{content}</PageSection> : content
}
