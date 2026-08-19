import { Button, Icons, Text, XStack, YStack } from '~/components/ui'
import { CommercePanel } from '~/commerce/components'
import { ShopActionButtons } from '~/commerce/components/ShopActionButtons'
import type {
  ListingTrustSnapshot as ListingTrustSnapshotModel,
  ListingTrustCue,
} from '~/commerce/lib/listing-trust-snapshot'
import { useAppUi } from '~/lib/theme/useAppUi'

type ListingTrustSnapshotProps = {
  snapshot: ListingTrustSnapshotModel
  shopId?: string | null
  ownerUserId?: string | null
  onOpenPolicies?: () => void
}

export function ListingTrustSnapshot({
  snapshot,
  shopId,
  ownerUserId,
  onOpenPolicies,
}: ListingTrustSnapshotProps) {
  const ui = useAppUi()

  return (
    <CommercePanel gap="$3" padding="$4">
      <YStack gap="$1">
        <Text fontSize={16} fontWeight="800" color={ui.text}>
          {snapshot.headline}
        </Text>
        <Text fontSize={13} color={ui.textSecondary}>
          {snapshot.subheadline}
        </Text>
      </YStack>

      <YStack gap="$2.5">
        {snapshot.cues.map((cue) => (
          <TrustCueRow key={cue.key} cue={cue} />
        ))}
      </YStack>

      <YStack gap="$2">
        <Text fontSize={12} color={ui.textMuted}>
          {snapshot.sellerPrompt}
        </Text>
        <XStack gap="$2" flexWrap="wrap">
          {shopId ? <ShopActionButtons shopId={shopId} ownerUserId={ownerUserId} borderRadius={999} /> : null}
          <Button
            tone="outline"
            size="$3"
            borderRadius={999}
            icon={<Icons.ShieldCheck size={15} />}
            onPress={onOpenPolicies}
          >
            Check policies
          </Button>
        </XStack>
      </YStack>
    </CommercePanel>
  )
}

export function VerifiedBuyerHighlight({
  snapshot,
}: {
  snapshot: ListingTrustSnapshotModel
}) {
  const ui = useAppUi()
  if (!snapshot.buyerHighlight) return null

  return (
    <CommercePanel gap="$2.5" padding="$4">
      <XStack gap="$2" alignItems="center">
        <Icons.BadgeCheck size={16} color={ui.brand} />
        <Text fontSize={13} fontWeight="800" color={ui.text}>
          {snapshot.buyerHighlight.title}
        </Text>
      </XStack>
      <Text fontSize={13} color={ui.textSecondary} lineHeight={20}>
        {snapshot.buyerHighlight.body}
      </Text>
      <Text fontSize={12} color={ui.textMuted}>
        Verified purchase reviews help other shoppers.
      </Text>
    </CommercePanel>
  )
}

function TrustCueRow({ cue }: { cue: ListingTrustCue }) {
  const ui = useAppUi()
  return (
    <XStack gap="$2.5" alignItems="flex-start">
      <XStack
        width={28}
        height={28}
        borderRadius={999}
        alignItems="center"
        justifyContent="center"
        backgroundColor={ui.roseSurface}
        flexShrink={0}
      >
        <Icons.ShieldCheck size={15} color={ui.brand} />
      </XStack>
      <YStack flex={1} gap={2}>
        <Text fontSize={13} fontWeight="700" color={ui.text}>
          {cue.label}
        </Text>
        <Text fontSize={12} color={ui.textSecondary} lineHeight={18}>
          {cue.description}
        </Text>
      </YStack>
    </XStack>
  )
}
