import { AppLink } from '~/components/navigation/AppLink'
import { Button, Icons, Text, XStack, YStack } from '~/components/ui'
import { CommercePanel } from '~/commerce/components'
import { useFollowedShopDigest } from '~/commerce/hooks/useFollowedShopDigest'
import { commerceRoutes } from '~/lib/routes'
import { useAppUi } from '~/lib/theme/useAppUi'

type FollowedShopDigestEntryCardProps = {
  inset?: boolean
}

export function FollowedShopDigestEntryCard(_props: FollowedShopDigestEntryCardProps) {
  const ui = useAppUi()
  const digest = useFollowedShopDigest()

  if (digest.isLoading || !digest.hasActivity) return null

  return (
    <CommercePanel gap="$3">
      <YStack gap="$1">
        <Text fontSize={18} fontWeight="800" color={ui.text}>
          Activity from shops you follow
        </Text>
        <Text fontSize={13} color={ui.textSecondary}>
          See new arrivals, price drops, and saved-item momentum from sellers you already trust.
        </Text>
      </YStack>

      <XStack gap="$3" flexWrap="wrap">
        <MetricPill label="New" value={digest.counts.newArrivals} />
        <MetricPill label="Price drops" value={digest.counts.priceDrops} />
        <MetricPill label="Saved overlap" value={digest.counts.savedOverlap} />
      </XStack>

      <AppLink href={commerceRoutes.following} asChild>
        <Button tone="primary" size="$3.5" borderRadius={999} icon={<Icons.Store size={16} />}>
          Open digest
        </Button>
      </AppLink>
    </CommercePanel>
  )
}

function MetricPill({ label, value }: { label: string; value: number }) {
  const ui = useAppUi()
  return (
    <XStack
      alignItems="center"
      gap="$2"
      paddingHorizontal="$3"
      paddingVertical="$2"
      borderRadius={999}
      borderWidth={1}
      borderColor={ui.borderSubtle}
      backgroundColor={ui.surface}
    >
      <Text fontSize={13} fontWeight="800" color={ui.text}>
        {value}
      </Text>
      <Text fontSize={12} color={ui.textSecondary}>
        {label}
      </Text>
    </XStack>
  )
}
