import { AppLink } from '~/components/navigation/AppLink'

import { CommercePanel } from '~/commerce/components'
import { usePendingReviewsHome } from '~/commerce/hooks/usePendingReviewsHome'
import type { PendingReviewHomeCard } from '~/commerce/lib/pending-reviews-home'
import { Button, Icons, Image, Text, XStack, YStack } from '~/components/ui'
import { commerceRoutes } from '~/lib/routes'
import { useAppUi } from '~/lib/theme/useAppUi'

export function PendingReviewsHomeStrip({ inset = false }: { inset?: boolean }) {
  const ui = useAppUi()
  const { cards, hasCards } = usePendingReviewsHome()

  if (!hasCards) return null

  const body = (
    <CommercePanel gap="$3">
      <YStack gap="$1">
        <Text fontSize={18} fontWeight="800" color={ui.text}>
          Reviews to write
        </Text>
        <Text fontSize={13} color={ui.textSecondary}>
          Delivered items waiting for your feedback before you buy again.
        </Text>
      </YStack>

      <YStack gap="$3">
        {cards.map((card) => (
          <PendingReviewHomeRow key={card.itemId} card={card} />
        ))}
      </YStack>

      <AppLink href={commerceRoutes.orders} asChild>
        <Button tone="outline" size="$3" borderRadius={999}>
          View orders
        </Button>
      </AppLink>
    </CommercePanel>
  )

  if (inset) return body
  return body
}

function PendingReviewHomeRow({ card }: { card: PendingReviewHomeCard }) {
  const ui = useAppUi()

  return (
    <AppLink href={card.href} asChild>
      <XStack gap="$3" padding="$3" borderRadius={14} borderWidth={1} borderColor={ui.borderSubtle}>
        <YStack
          width={72}
          height={72}
          borderRadius={12}
          overflow="hidden"
          backgroundColor={ui.imagePlaceholder}
          alignItems="center"
          justifyContent="center"
        >
          {card.imageUrl ? (
            <Image src={card.imageUrl} width={72} height={72} objectFit="cover" />
          ) : (
            <Icons.Star size={22} color={ui.brand} />
          )}
        </YStack>
        <YStack flex={1} minWidth={0} gap="$1.5">
          <Text fontSize={10} fontWeight="700" color={ui.brand}>
            Leave a review
          </Text>
          <Text fontSize={14} fontWeight="800" color={ui.text} numberOfLines={2}>
            {card.title}
          </Text>
          <Text fontSize={13} color={ui.textSecondary} numberOfLines={2}>
            {card.detail}
          </Text>
        </YStack>
        <Icons.ChevronRight size={18} color={ui.textMuted} />
      </XStack>
    </AppLink>
  )
}
