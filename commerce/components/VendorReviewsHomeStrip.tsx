import { AppLink } from '~/components/navigation/AppLink'

import { CommercePanel } from '~/commerce/components'
import { useVendorReviewsHome } from '~/commerce/hooks/useVendorReviewsHome'
import type { VendorReviewsHomeCard } from '~/commerce/lib/vendor-reviews-home'
import { vendorReviewsHomeHref } from '~/commerce/lib/vendor-reviews-home'
import { Button, Icons, Text, XStack, YStack } from '~/components/ui'
import { useAppUi } from '~/lib/theme/useAppUi'

export function VendorReviewsHomeStrip({ inset = false }: { inset?: boolean }) {
  const ui = useAppUi()
  const { cards, hasCards } = useVendorReviewsHome()

  if (!hasCards) return null

  const body = (
    <CommercePanel gap="$3">
      <YStack gap="$1">
        <Text fontSize={18} fontWeight="800" color={ui.text}>
          Reviews awaiting reply
        </Text>
        <Text fontSize={13} color={ui.textSecondary}>
          Recent buyer reviews your shop has not responded to yet.
        </Text>
      </YStack>

      <YStack gap="$3">
        {cards.map((card) => (
          <VendorReviewsHomeRow key={card.id} card={card} />
        ))}
      </YStack>

      <AppLink href={vendorReviewsHomeHref()} asChild>
        <Button tone="outline" size="$3" borderRadius={999}>
          Open reviews
        </Button>
      </AppLink>
    </CommercePanel>
  )

  if (inset) return body
  return body
}

function VendorReviewsHomeRow({ card }: { card: VendorReviewsHomeCard }) {
  const ui = useAppUi()

  return (
    <AppLink href={card.href} asChild>
      <XStack gap="$3" padding="$3" borderRadius={14} borderWidth={1} borderColor={ui.borderSubtle}>
        <YStack
          width={40}
          height={40}
          borderRadius={10}
          backgroundColor={ui.surfaceMuted}
          alignItems="center"
          justifyContent="center"
        >
          <Icons.Star size={18} color={ui.notification} />
        </YStack>
        <YStack flex={1} minWidth={0} gap="$1.5">
          <Text fontSize={10} fontWeight="700" color={ui.notification}>
            {card.rating.toFixed(1)} stars{card.verified ? ' · Verified purchase' : ''}
          </Text>
          <Text fontSize={14} fontWeight="800" color={ui.text} numberOfLines={1}>
            {card.listingTitle}
          </Text>
          <Text fontSize={13} color={ui.textSecondary} numberOfLines={2}>
            {card.preview}
          </Text>
        </YStack>
        <Icons.ChevronRight size={18} color={ui.textMuted} />
      </XStack>
    </AppLink>
  )
}
