import { AppLink } from '~/components/navigation/AppLink'
import { Button, Icons, Image, Text, XStack, YStack } from '~/components/ui'
import { CommercePanel } from '~/commerce/components'
import type {
  WishlistReactivationItem,
  WishlistReactivationSection as WishlistReactivationSectionType,
} from '~/commerce/lib/wishlist-reactivation'
import { formatCurrency } from '~/lib/format'
import { commerceRoutes } from '~/lib/routes'
import { useAppUi } from '~/lib/theme/useAppUi'

type WishlistReactivationSectionProps = {
  section: WishlistReactivationSectionType
  onMoveToCart: (item: WishlistReactivationItem) => void
  onBuyNow: (item: WishlistReactivationItem) => void
  onMoveToCollection: (item: WishlistReactivationItem) => void
  onBulkPrimary?: (section: WishlistReactivationSectionType) => void
}

export function WishlistReactivationSection({
  section,
  onMoveToCart,
  onBuyNow,
  onMoveToCollection,
  onBulkPrimary,
}: WishlistReactivationSectionProps) {
  const ui = useAppUi()

  return (
    <CommercePanel gap="$3">
      <XStack justifyContent="space-between" gap="$3" flexWrap="wrap" alignItems="center">
        <YStack gap="$1" flex={1} minWidth={220}>
          <Text fontSize={16} fontWeight="800" color={ui.text}>
            {section.title}
          </Text>
          <Text fontSize={13} color={ui.textSecondary}>
            {section.subtitle}
          </Text>
        </YStack>
        {section.canBulkMoveToCart ? (
          <Button
            tone="outline"
            size="$3"
            borderRadius={999}
            icon={<Icons.ShoppingCart size={14} />}
            onPress={() => onBulkPrimary?.(section)}
          >
            {section.actionLabel}
          </Button>
        ) : null}
      </XStack>

      <YStack gap="$3">
        {section.items.map((item) => (
          <WishlistRow
            key={`${section.key}-${item.id}`}
            item={item}
            onMoveToCart={onMoveToCart}
            onBuyNow={onBuyNow}
            onMoveToCollection={onMoveToCollection}
          />
        ))}
      </YStack>
    </CommercePanel>
  )
}

function WishlistRow({
  item,
  onMoveToCart,
  onBuyNow,
  onMoveToCollection,
}: {
  item: WishlistReactivationItem
  onMoveToCart: (item: WishlistReactivationItem) => void
  onBuyNow: (item: WishlistReactivationItem) => void
  onMoveToCollection: (item: WishlistReactivationItem) => void
}) {
  const ui = useAppUi()

  return (
    <YStack gap="$2.5" padding="$3" borderRadius={14} borderWidth={1} borderColor={ui.borderSubtle}>
      <XStack gap="$3" alignItems="flex-start">
        <YStack
          width={72}
          height={72}
          borderRadius={12}
          overflow="hidden"
          backgroundColor={ui.imagePlaceholder}
          alignItems="center"
          justifyContent="center"
          flexShrink={0}
        >
          {item.image_url ? (
            <Image src={item.image_url} width={72} height={72} objectFit="cover" />
          ) : (
            <Icons.Image size={22} color={ui.textMuted} />
          )}
        </YStack>

        <YStack flex={1} minWidth={0} gap="$1.5">
          <XStack gap="$1.5" flexWrap="wrap">
            {item.source === 'saved_from_cart' ? (
              <Tag label="Saved from cart" />
            ) : null}
            {item.discountAmount > 0 ? <Tag label={`Save ${formatCurrency(item.discountAmount, item.currency)}`} /> : null}
          </XStack>

          <AppLink href={commerceRoutes.listing(item.slug ?? item.id)} asChild>
            <Text fontSize={14} fontWeight="800" color={ui.text} numberOfLines={2}>
              {item.title}
            </Text>
          </AppLink>

          <XStack gap="$2" flexWrap="wrap" alignItems="center">
            <Text fontSize={14} fontWeight="800" color={ui.text}>
              {formatCurrency(item.price, item.currency)}
            </Text>
            {typeof item.mrp === 'number' && item.mrp > item.price ? (
              <Text fontSize={12} color={ui.textMuted} textDecorationLine="line-through">
                {formatCurrency(item.mrp, item.currency)}
              </Text>
            ) : null}
            {item.shop_name ? (
              <Text fontSize={12} color={ui.textSecondary}>
                {item.shop_name}
              </Text>
            ) : null}
          </XStack>
        </YStack>
      </XStack>

      <XStack gap="$2" flexWrap="wrap">
        <Button
          tone="primary"
          size="$3"
          borderRadius={999}
          icon={<Icons.ShoppingCart size={14} />}
          onPress={() => onMoveToCart(item)}
        >
          Move to cart
        </Button>
        <Button
          tone="outline"
          size="$3"
          borderRadius={999}
          icon={<Icons.Zap size={14} />}
          onPress={() => onBuyNow(item)}
        >
          Buy now
        </Button>
        <Button
          tone="outline"
          size="$3"
          borderRadius={999}
          icon={<Icons.FolderInput size={14} />}
          onPress={() => onMoveToCollection(item)}
        >
          Move
        </Button>
      </XStack>
    </YStack>
  )
}

function Tag({ label }: { label: string }) {
  const ui = useAppUi()
  return (
    <XStack
      paddingHorizontal="$2"
      paddingVertical="$1"
      borderRadius={999}
      backgroundColor={ui.roseSurface}
      borderWidth={1}
      borderColor={ui.borderSubtle}
    >
      <Text fontSize={11} fontWeight="700" color={ui.brand}>
        {label}
      </Text>
    </XStack>
  )
}
