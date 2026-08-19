import { AppLink } from '~/components/navigation/AppLink'

import { CommercePanel } from '~/commerce/components'
import { useCart } from '~/commerce/hooks/useCart'
import { buildCartHomeCards, cartHomeHref } from '~/commerce/lib/cart-home'
import type { CartHomeCard } from '~/commerce/lib/cart-home'
import { Button, Icons, Image, Text, XStack, YStack } from '~/components/ui'
import { useAppUi } from '~/lib/theme/useAppUi'

export function CartHomeStrip({ inset = false }: { inset?: boolean }) {
  const ui = useAppUi()
  const { items, isLoading } = useCart()
  const cards = buildCartHomeCards(items, 4)

  if (isLoading || cards.length === 0) return null

  const body = (
    <CommercePanel gap="$3">
      <YStack gap="$1">
        <Text fontSize={18} fontWeight="800" color={ui.text}>
          Ready to checkout
        </Text>
        <Text fontSize={13} color={ui.textSecondary}>
          Items waiting in your cart — finish checkout before they sell out.
        </Text>
      </YStack>

      <YStack gap="$3">
        {cards.map((card) => (
          <CartHomeRow key={card.cartItemId} card={card} />
        ))}
      </YStack>

      <AppLink href={cartHomeHref()} asChild>
        <Button tone="primary" size="$3" borderRadius={999}>
          Go to cart
        </Button>
      </AppLink>
    </CommercePanel>
  )

  if (inset) return body
  return body
}

function CartHomeRow({ card }: { card: CartHomeCard }) {
  const ui = useAppUi()

  return (
    <AppLink href={card.href} asChild>
      <XStack gap="$3" padding="$3" borderRadius={14} borderWidth={1} borderColor={ui.borderSubtle}>
        <YStack
          width={56}
          height={56}
          borderRadius={12}
          overflow="hidden"
          backgroundColor={ui.imagePlaceholder}
          alignItems="center"
          justifyContent="center"
        >
          {card.imageUrl ? (
            <Image src={card.imageUrl} width={56} height={56} objectFit="cover" />
          ) : (
            <Icons.ShoppingCart size={20} color={ui.textMuted} />
          )}
        </YStack>
        <YStack flex={1} minWidth={0} gap="$1">
          <Text fontSize={14} fontWeight="800" color={ui.text} numberOfLines={2}>
            {card.title}
          </Text>
          <Text fontSize={12} color={ui.textSecondary} numberOfLines={1}>
            {card.shopName} · Qty {card.quantity} · ₹{card.unitPrice.toLocaleString('en-IN')}
          </Text>
        </YStack>
        <Icons.ChevronRight size={18} color={ui.textMuted} />
      </XStack>
    </AppLink>
  )
}
