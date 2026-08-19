import { AppLink } from '~/components/navigation/AppLink'

import { CommercePanel } from '~/commerce/components'
import { useSaleEventsHome } from '~/commerce/hooks/useSaleEventsHome'
import type { BuyerSaleEventHomeCard } from '~/commerce/lib/sale-events-home'
import { buyerSaleEventsHomeHref } from '~/commerce/lib/sale-events-home'
import { Button, Icons, Image, Text, XStack, YStack } from '~/components/ui'
import { useAppUi } from '~/lib/theme/useAppUi'

export function SaleEventsHomeStrip({ inset = false }: { inset?: boolean }) {
  const ui = useAppUi()
  const { cards, hasCards } = useSaleEventsHome()

  if (!hasCards) return null

  const body = (
    <CommercePanel gap="$3">
      <YStack gap="$1">
        <Text fontSize={18} fontWeight="800" color={ui.text}>
          More live sales
        </Text>
        <Text fontSize={13} color={ui.textSecondary}>
          Additional sale events running right now on the marketplace.
        </Text>
      </YStack>

      <YStack gap="$3">
        {cards.map((card) => (
          <SaleEventHomeRow key={card.id} card={card} />
        ))}
      </YStack>

      <AppLink href={buyerSaleEventsHomeHref()} asChild>
        <Button tone="outline" size="$3" borderRadius={999}>
          Shop featured deals
        </Button>
      </AppLink>
    </CommercePanel>
  )

  if (inset) return body
  return body
}

function SaleEventHomeRow({ card }: { card: BuyerSaleEventHomeCard }) {
  const ui = useAppUi()

  return (
    <AppLink href={card.href} asChild>
      <XStack gap="$3" padding="$3" borderRadius={14} borderWidth={1} borderColor={ui.borderSubtle}>
        {card.bannerImage ? (
          <Image src={card.bannerImage} width={72} height={72} borderRadius={10} objectFit="cover" />
        ) : (
          <YStack
            width={72}
            height={72}
            borderRadius={10}
            backgroundColor={ui.surfaceMuted}
            alignItems="center"
            justifyContent="center"
          >
            <Icons.Sparkles size={20} color={ui.brand} />
          </YStack>
        )}
        <YStack flex={1} minWidth={0} gap="$1.5">
          <Text fontSize={10} fontWeight="700" color={ui.brand}>
            LIVE SALE
          </Text>
          <Text fontSize={14} fontWeight="800" color={ui.text} numberOfLines={1}>
            {card.title}
          </Text>
          {card.detail ? (
            <Text fontSize={13} color={ui.textSecondary} numberOfLines={2}>
              {card.detail}
            </Text>
          ) : null}
        </YStack>
        <Icons.ChevronRight size={18} color={ui.textMuted} />
      </XStack>
    </AppLink>
  )
}
