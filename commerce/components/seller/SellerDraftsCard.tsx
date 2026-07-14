import { useEffect, useState } from 'react'

import { CommercePanel } from '~/commerce/components'
import { fetchSellerListings, type SellerListingRow } from '~/commerce/lib/seller-dashboard'
import { Button, Icons, Spinner, Text, XStack, YStack } from '~/components/ui'
import { useAppUi } from '~/lib/theme/useAppUi'

type SellerDraftsCardProps = {
  shopId: string
  onOpenListings: () => void
}

/** Reminds sellers to finish unpublished drafts — web + native. */
export function SellerDraftsCard({ shopId, onOpenListings }: SellerDraftsCardProps) {
  const ui = useAppUi()
  const [drafts, setDrafts] = useState<SellerListingRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    setLoading(true)
    void fetchSellerListings(shopId, { status: 'draft', limit: 5 })
      .then((rows) => {
        if (active) setDrafts(rows)
      })
      .catch(() => {
        if (active) setDrafts([])
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [shopId])

  if (loading) {
    return (
      <CommercePanel padding="$4">
        <Spinner size="small" color={ui.brand} />
      </CommercePanel>
    )
  }

  if (drafts.length === 0) return null

  return (
    <CommercePanel padding="$4" gap="$3">
      <XStack alignItems="center" gap="$2">
        <Icons.FileText size={16} color={ui.brand} />
        <Text fontSize={15} fontWeight="700" color={ui.text}>
          Finish drafts ({drafts.length})
        </Text>
      </XStack>
      <YStack gap="$1.5">
        {drafts.map((listing) => (
          <Text key={listing.id} fontSize={13} color={ui.textSecondary} numberOfLines={1}>
            {listing.title || 'Untitled listing'}
          </Text>
        ))}
      </YStack>
      <Button tone="primary" size="$3" borderRadius={999} alignSelf="flex-start" onPress={onOpenListings}>
        Open listings
      </Button>
    </CommercePanel>
  )
}
