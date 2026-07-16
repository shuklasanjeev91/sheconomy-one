import { useMemo, useState } from 'react'
import { AppLink } from '~/components/navigation/AppLink'

import { CommercePanel } from '~/commerce/components'
import { useSellerListings } from '~/commerce/hooks/useSellerListings'
import { updateSellerListing } from '~/commerce/lib/seller-listings'
import type { Database } from '~/lib/supabase'
import {
  Badge,
  Button,
  Icons,
  Image,
  Paragraph,
  Spinner,
  Text,
  XStack,
  YStack,
  useAppToast,
} from '~/components/ui'
import { commerceRoutes } from '~/lib/routes'
import { useAppUi } from '~/lib/theme/useAppUi'

type ListingStatus = Database['public']['Enums']['listing_status_enum'] | 'all'

const STATUS_FILTERS: { label: string; value: ListingStatus }[] = [
  { label: 'All', value: 'all' },
  { label: 'Active', value: 'active' },
  { label: 'Draft', value: 'draft' },
  { label: 'Paused', value: 'paused' },
]

type SellerListingsPanelProps = {
  shopId: string
  onAddListing: () => void
}

export function SellerListingsPanel({ shopId, onAddListing }: SellerListingsPanelProps) {
  const ui = useAppUi()
  const toast = useAppToast()
  const [status, setStatus] = useState<ListingStatus>('all')
  const [busyId, setBusyId] = useState<string | null>(null)
  const { items, isLoading, error, refresh } = useSellerListings(shopId, { status })

  const counts = useMemo(() => {
    return {
      all: items.length,
    }
  }, [items.length])

  async function setListingStatus(
    listingId: string,
    listingStatus: Database['public']['Enums']['listing_status_enum'],
  ) {
    setBusyId(listingId)
    const { error: updateError } = await updateSellerListing(listingId, shopId, { listingStatus })
    setBusyId(null)

    if (updateError) {
      toast.show('Update failed', { tone: 'danger', message: updateError })
      return
    }

    toast.show('Listing updated', { tone: 'success' })
    void refresh()
  }

  return (
    <YStack gap="$4" width="100%">
      <XStack gap="$2" flexWrap="wrap">
        {STATUS_FILTERS.map((filter) => {
          const active = status === filter.value
          return (
            <Button
              key={filter.value}
              tone={active ? 'primary' : 'outline'}
              size="$2.5"
              borderRadius={999}
              onPress={() => setStatus(filter.value)}
            >
              {filter.label}
            </Button>
          )
        })}
        <XStack flex={1} />
        <Button tone="primary" size="$2.5" borderRadius={999} onPress={onAddListing}>
          New listing
        </Button>
      </XStack>

      {error ? (
        <CommercePanel>
          <Paragraph color="$red10">{error}</Paragraph>
        </CommercePanel>
      ) : null}

      {isLoading ? (
        <YStack paddingVertical="$8" alignItems="center">
          <Spinner size="large" />
        </YStack>
      ) : items.length === 0 ? (
        <CommercePanel gap="$3" alignItems="center">
          <Icons.Package size={28} color={ui.brand} />
          <Text fontWeight="700" fontSize={16} color={ui.text}>
            No listings yet
          </Text>
          <Paragraph color={ui.textSecondary} textAlign="center">
            Create your first product listing to start selling.
          </Paragraph>
          <Button tone="primary" size="$3" borderRadius={999} onPress={onAddListing}>
            Create listing
          </Button>
        </CommercePanel>
      ) : (
        <YStack gap="$3" width="100%">
          {items.map((listing) => {
            const href = listing.slug
              ? commerceRoutes.listing(listing.slug)
              : commerceRoutes.listing(listing.id)
            const isBusy = busyId === listing.id

            return (
              <CommercePanel key={listing.id} padding="$4" gap="$3">
                <XStack gap="$3" alignItems="flex-start" width="100%">
                  <YStack
                    width={72}
                    height={72}
                    borderRadius={12}
                    overflow="hidden"
                    backgroundColor={ui.surfaceMuted}
                    alignItems="center"
                    justifyContent="center"
                  >
                    {listing.primaryImageUrl ? (
                      <Image src={listing.primaryImageUrl} width={72} height={72} objectFit="cover" alt="" />
                    ) : (
                      <Icons.Image size={24} color={ui.icon} />
                    )}
                  </YStack>

                  <YStack flex={1} minWidth={0} gap="$1.5">
                    <XStack gap="$2" alignItems="center" flexWrap="wrap">
                      <Text fontWeight="700" fontSize={15} color={ui.text} numberOfLines={2}>
                        {listing.title}
                      </Text>
                      <Badge
                        tone={
                          listing.listingStatus === 'active'
                            ? 'success'
                            : listing.listingStatus === 'draft'
                              ? 'warning'
                              : 'neutral'
                        }
                        size="sm"
                      >
                        {listing.listingStatus}
                      </Badge>
                    </XStack>
                    <Text fontSize={13} color={ui.textSecondary}>
                      {new Intl.NumberFormat('en-IN', {
                        style: 'currency',
                        currency: 'INR',
                      }).format(listing.price)}
                      {' · '}
                      {listing.listingType}
                      {listing.quantity != null ? ` · Qty ${listing.quantity}` : ''}
                    </Text>
                  </YStack>
                </XStack>

                <XStack gap="$2" flexWrap="wrap">
                  <AppLink href={href} asChild>
                    <Button tone="outline" size="$2.5" borderRadius={999}>
                      Preview
                    </Button>
                  </AppLink>
                  {listing.listingStatus === 'draft' || listing.listingStatus === 'paused' ? (
                    <Button
                      tone="primary"
                      size="$2.5"
                      borderRadius={999}
                      disabled={isBusy}
                      onPress={() => void setListingStatus(listing.id, 'active')}
                    >
                      {isBusy ? 'Publishing…' : 'Publish'}
                    </Button>
                  ) : null}
                  {listing.listingStatus === 'active' ? (
                    <Button
                      tone="outline"
                      size="$2.5"
                      borderRadius={999}
                      disabled={isBusy}
                      onPress={() => void setListingStatus(listing.id, 'paused')}
                    >
                      Pause
                    </Button>
                  ) : null}
                </XStack>
              </CommercePanel>
            )
          })}
        </YStack>
      )}

      {counts.all > 0 ? (
        <Text fontSize={12} color={ui.textMuted}>
          Showing {items.length} listing{items.length === 1 ? '' : 's'}
        </Text>
      ) : null}
    </YStack>
  )
}
