import { useEffect, useState } from 'react'

import { CommercePanel } from '~/commerce/components/CommercePanel'
import { priceWatchHit, usePriceWatches, type PriceWatch } from '~/commerce/lib/price-watches'
import { PageSection } from '~/components/layout'
import { AppLink } from '~/components/navigation/AppLink'
import { Text, XStack, YStack } from '~/components/ui'
import { formatCurrency } from '~/lib/format'
import { commerceRoutes } from '~/lib/routes'
import { fetchListingsByIds, type ListingSummary } from '~/commerce/lib/commerce'
import { useAppUi } from '~/lib/theme/useAppUi'

/** Home strip for listings the buyer is watching against a target price. */
export function PriceWatchHomeStrip({ inset = false }: { inset?: boolean }) {
  const ui = useAppUi()
  const watches = usePriceWatches()
  const [listings, setListings] = useState<ListingSummary[]>([])
  const watchKey = watches.map((watch) => `${watch.listingId}:${watch.targetPrice}`).join('|')

  useEffect(() => {
    if (watches.length === 0) {
      setListings([])
      return
    }
    let active = true
    void fetchListingsByIds(watches.map((watch) => watch.listingId)).then((rows) => {
      if (active) setListings(rows)
    })
    return () => {
      active = false
    }
  }, [watchKey])

  if (watches.length === 0) return null

  const byId = new Map(listings.map((row) => [row.id, row]))
  const body = (
    <CommercePanel gap="$3">
      <YStack gap="$1">
        <Text fontSize={18} fontWeight="800" color={ui.text}>
          Your price watches
        </Text>
        <Text fontSize={13} color={ui.textSecondary}>
          Listings you asked to flag when they reach your price.
        </Text>
      </YStack>
      <YStack gap="$2">
        {watches.map((watch) => (
          <PriceWatchRow key={watch.listingId} watch={watch} listing={byId.get(watch.listingId)} />
        ))}
      </YStack>
    </CommercePanel>
  )

  if (!inset) return body
  return <PageSection paddingTop="$2">{body}</PageSection>
}

function PriceWatchRow({
  watch,
  listing,
}: {
  watch: PriceWatch
  listing: ListingSummary | undefined
}) {
  const ui = useAppUi()
  const current = listing?.price ?? null
  const hit = priceWatchHit(watch.targetPrice, current)
  const href = listing?.slug ? commerceRoutes.listing(listing.slug) : commerceRoutes.home

  return (
    <AppLink href={href}>
      <XStack
        justifyContent="space-between"
        alignItems="center"
        gap="$3"
        paddingVertical="$2"
      >
        <YStack flex={1} gap="$1">
          <Text fontSize={14} fontWeight="700" color={ui.text} numberOfLines={1}>
            {listing?.title || watch.title}
          </Text>
          <Text fontSize={12} color={hit ? ui.success : ui.textMuted}>
            {hit
              ? `At your price · ${formatCurrency(current ?? watch.targetPrice, watch.currency)}`
              : current != null
                ? `Now ${formatCurrency(current, listing?.currency ?? watch.currency)} · target ${formatCurrency(watch.targetPrice, watch.currency)}`
                : `Target ${formatCurrency(watch.targetPrice, watch.currency)}`}
          </Text>
        </YStack>
      </XStack>
    </AppLink>
  )
}
