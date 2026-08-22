import { useCommunityPostSnapshotPrice } from '~/community/hooks/useCommunityPostSnapshotPrice'
import { useCommunityUi } from '~/community/lib/community-theme'
import { formatMoneyLabel } from '~/lib/format'
import { Text, XStack } from '~/components/ui'

export function PostedAtPriceChip({
  listingId,
  postId,
  livePrice,
  liveCurrency,
}: {
  listingId: string
  postId: string
  livePrice: number | null
  liveCurrency: string | null
}) {
  const communityUi = useCommunityUi()
  const { snapshotPrice, currency } = useCommunityPostSnapshotPrice(listingId, postId)

  if (snapshotPrice == null || livePrice == null || snapshotPrice === livePrice) return null

  return (
    <XStack gap={6} alignItems="center" flexWrap="wrap">
      <Text fontSize={12} fontWeight="600" color={communityUi.textMuted}>
        Posted at{' '}
        <Text textDecorationLine="line-through">
          {formatMoneyLabel(snapshotPrice, currency ?? liveCurrency ?? 'INR')}
        </Text>
      </Text>
      {livePrice < snapshotPrice ? (
        <Text fontSize={12} fontWeight="700" color="#059669">
          Price dropped
        </Text>
      ) : null}
    </XStack>
  )
}
