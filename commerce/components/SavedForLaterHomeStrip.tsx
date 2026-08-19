import { AppLink } from '~/components/navigation/AppLink'

import { CommercePanel } from '~/commerce/components'
import { useCart } from '~/commerce/hooks/useCart'
import type { CartItemRow } from '~/commerce/lib/cart'
import { Button, Icons, Image, Text, XStack, YStack } from '~/components/ui'
import { commerceRoutes } from '~/lib/routes'
import { useAppUi } from '~/lib/theme/useAppUi'

export function SavedForLaterHomeStrip({ inset = false }: { inset?: boolean }) {
  const ui = useAppUi()
  const { savedItems, moveToCart, isLoading } = useCart()

  if (isLoading || savedItems.length === 0) return null

  const body = (
    <CommercePanel gap="$3">
      <YStack gap="$1">
        <Text fontSize={18} fontWeight="800" color={ui.text}>
          Saved for later
        </Text>
        <Text fontSize={13} color={ui.textSecondary}>
          Items you parked in cart — move them back when you are ready to checkout.
        </Text>
      </YStack>

      <YStack gap="$3">
        {savedItems.slice(0, 4).map((item) => (
          <SavedForLaterRow key={item.id} item={item} onMoveToCart={() => moveToCart(item.id)} />
        ))}
      </YStack>

      <AppLink href={commerceRoutes.cart} asChild>
        <Button tone="outline" size="$3" borderRadius={999}>
          Open cart
        </Button>
      </AppLink>
    </CommercePanel>
  )

  if (inset) return body
  return body
}

function SavedForLaterRow({
  item,
  onMoveToCart,
}: {
  item: CartItemRow
  onMoveToCart: () => void
}) {
  const ui = useAppUi()
  const href = commerceRoutes.listing(item.listing_id)

  return (
    <YStack gap="$2" padding="$3" borderRadius={14} borderWidth={1} borderColor={ui.borderSubtle}>
      <AppLink href={href} asChild>
        <XStack gap="$3" alignItems="center">
          <YStack
            width={56}
            height={56}
            borderRadius={12}
            overflow="hidden"
            backgroundColor={ui.imagePlaceholder}
            alignItems="center"
            justifyContent="center"
          >
            {item.image_url ? (
              <Image src={item.image_url} width={56} height={56} objectFit="cover" />
            ) : (
              <Icons.ShoppingBag size={20} color={ui.textMuted} />
            )}
          </YStack>
          <YStack flex={1} minWidth={0} gap="$1">
            <Text fontSize={14} fontWeight="800" color={ui.text} numberOfLines={2}>
              {item.title}
            </Text>
            <Text fontSize={12} color={ui.textSecondary} numberOfLines={1}>
              {item.shop_name} · ₹{item.unit_price.toLocaleString('en-IN')}
            </Text>
          </YStack>
          <Icons.ChevronRight size={18} color={ui.textMuted} />
        </XStack>
      </AppLink>
      <Button tone="primary" size="$2" borderRadius={999} alignSelf="flex-start" onPress={onMoveToCart}>
        Move to cart
      </Button>
    </YStack>
  )
}
