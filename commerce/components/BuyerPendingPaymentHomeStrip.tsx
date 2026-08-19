import { AppLink } from '~/components/navigation/AppLink'

import { CommercePanel } from '~/commerce/components'
import { useBuyerPendingPaymentHome } from '~/commerce/hooks/useBuyerPendingPaymentHome'
import type { BuyerPendingPaymentHomeCard } from '~/commerce/lib/buyer-pending-payment-home'
import { buyerPendingPaymentHref } from '~/commerce/lib/buyer-pending-payment-home'
import { Button, Icons, Text, XStack, YStack } from '~/components/ui'
import { useAppUi } from '~/lib/theme/useAppUi'

export function BuyerPendingPaymentHomeStrip({ inset = false }: { inset?: boolean }) {
  const ui = useAppUi()
  const { cards, hasCards } = useBuyerPendingPaymentHome()

  if (!hasCards) return null

  const body = (
    <CommercePanel gap="$3">
      <YStack gap="$1">
        <Text fontSize={18} fontWeight="800" color={ui.text}>
          Complete your payment
        </Text>
        <Text fontSize={13} color={ui.textSecondary}>
          Orders waiting for payment — finish checkout to confirm them.
        </Text>
      </YStack>

      <YStack gap="$3">
        {cards.map((card) => (
          <BuyerPendingPaymentHomeRow key={card.orderId} card={card} />
        ))}
      </YStack>

      <AppLink href={buyerPendingPaymentHref()} asChild>
        <Button tone="primary" size="$3" borderRadius={999}>
          View orders
        </Button>
      </AppLink>
    </CommercePanel>
  )

  if (inset) return body
  return body
}

function BuyerPendingPaymentHomeRow({ card }: { card: BuyerPendingPaymentHomeCard }) {
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
          <Icons.CreditCard size={18} color={ui.notification} />
        </YStack>
        <YStack flex={1} minWidth={0} gap="$1.5">
          <Text fontSize={10} fontWeight="700" color={ui.notification}>
            Payment pending · #{card.orderNumber}
          </Text>
          <Text fontSize={14} fontWeight="800" color={ui.text} numberOfLines={1}>
            {card.shopNames}
          </Text>
          <Text fontSize={13} color={ui.textSecondary} numberOfLines={1}>
            {card.amountLabel}
          </Text>
        </YStack>
        <Icons.ChevronRight size={18} color={ui.textMuted} />
      </XStack>
    </AppLink>
  )
}
