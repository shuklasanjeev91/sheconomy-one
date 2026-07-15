import { Icons, Text, XStack, YStack } from '~/components/ui'
import type { ListingFulfillmentInfo } from '~/commerce/lib/listing-fulfillment'
import type { ListingReturnPolicy } from '~/commerce/lib/return-policies'
import { radius } from '~/config/tokens'
import { useAppUi } from '~/lib/theme/useAppUi'

type ListingTrustStripProps = {
  fulfillment?: ListingFulfillmentInfo | null
  returnPolicy?: ListingReturnPolicy | null
  isDigital?: boolean
}

function returnPolicySummary(policy: ListingReturnPolicy) {
  if (!policy.acceptsReturns) return 'This shop does not accept returns.'
  if (policy.returnWindowDays) {
    return `Returns accepted within ${policy.returnWindowDays} days.`
  }
  return 'Returns accepted — see shop policies for details.'
}

/** Marketplace buyer-assurance strip under the buy box (marketplace). */
export function ListingTrustStrip({ fulfillment, returnPolicy, isDigital }: ListingTrustStripProps) {
  const ui = useAppUi()

  const rows: Array<{ icon: typeof Icons.ShieldCheck; title: string; body: string }> = [
    {
      icon: Icons.ShieldCheck,
      title: 'SHEconomy Purchase Protection',
      body: 'Shop with confidence — we stand behind every order.',
    },
  ]

  if (isDigital || fulfillment?.kind === 'digital') {
    rows.push({
      icon: Icons.Download,
      title: 'Instant digital delivery',
      body: 'Files are ready to download right after payment.',
    })
  } else {
    if (fulfillment?.processingLabel) {
      rows.push({
        icon: Icons.Clock,
        title: 'Processing time',
        body: fulfillment.processingLabel,
      })
    }
    if (fulfillment?.estimatedDeliveryLabel) {
      rows.push({
        icon: Icons.Truck,
        title: 'Estimated arrival',
        body: fulfillment.estimatedDeliveryLabel,
      })
    }
    if (returnPolicy) {
      rows.push({
        icon: Icons.RotateCcw,
        title: 'Returns & refunds',
        body: returnPolicySummary(returnPolicy),
      })
    } else if (fulfillment?.returnsLabel) {
      rows.push({
        icon: Icons.RotateCcw,
        title: 'Returns & exchanges',
        body: fulfillment.returnsLabel,
      })
    } else {
      rows.push({
        icon: Icons.RotateCcw,
        title: 'Seller policies apply',
        body: 'See Shipping & policies below for return and refund details.',
      })
    }
  }

  return (
    <YStack
      gap="$2.5"
      padding="$3.5"
      borderRadius={radius.card}
      borderWidth={1}
      borderColor={ui.borderSubtle}
      backgroundColor={ui.surfaceMuted}
      width="100%"
    >
      {rows.map((row) => {
        const Icon = row.icon
        return (
          <XStack key={row.title} gap="$2.5" alignItems="flex-start">
            <YStack
              width={28}
              height={28}
              borderRadius={999}
              backgroundColor={ui.chip}
              alignItems="center"
              justifyContent="center"
              flexShrink={0}
              marginTop={1}
            >
              <Icon size={14} color={ui.brand} />
            </YStack>
            <YStack flex={1} minWidth={0} gap={1}>
              <Text fontSize={13} fontWeight="700" color={ui.text}>
                {row.title}
              </Text>
              <Text fontSize={12} color={ui.textSecondary} lineHeight={17}>
                {row.body}
              </Text>
            </YStack>
          </XStack>
        )
      })}
    </YStack>
  )
}
