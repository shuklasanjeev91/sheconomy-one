import { AppLink } from '~/components/navigation/AppLink'
import { Button, Icons, Image, Text, XStack, YStack } from '~/components/ui'
import { CommercePanel } from '~/commerce/components'
import type {
  FollowedShopDigestItem,
  FollowedShopDigestSection as FollowedShopDigestSectionType,
} from '~/commerce/lib/followed-shop-digest'
import { formatCurrency } from '~/lib/format'
import { commerceRoutes } from '~/lib/routes'
import { useAppUi } from '~/lib/theme/useAppUi'

type FollowedShopDigestSectionProps = {
  section: FollowedShopDigestSectionType
  onMoveToCart: (item: FollowedShopDigestItem) => void
  onBuyNow: (item: FollowedShopDigestItem) => void
  onBulkPrimary?: (section: FollowedShopDigestSectionType) => void
}

export function FollowedShopDigestSection({
  section,
  onMoveToCart,
  onBuyNow,
  onBulkPrimary,
}: FollowedShopDigestSectionProps) {
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
          <DigestRow
            key={`${section.key}-${item.id}`}
            item={item}
            onMoveToCart={onMoveToCart}
            onBuyNow={onBuyNow}
          />
        ))}
      </YStack>
    </CommercePanel>
  )
}

function DigestRow({
  item,
  onMoveToCart,
  onBuyNow,
}: {
  item: FollowedShopDigestItem
  onMoveToCart: (item: FollowedShopDigestItem) => void
  onBuyNow: (item: FollowedShopDigestItem) => void
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
            {item.source === 'new_arrival' ? <Tag label="New from followed shop" /> : null}
            {item.source === 'saved_overlap' ? <Tag label="Saved item" /> : null}
            {item.priceDropAmount > 0 ? (
              <Tag label={`Dropped ${formatCurrency(item.priceDropAmount, item.currency)}`} />
            ) : null}
            {item.freshnessDays != null && item.freshnessDays <= 7 ? <Tag label="Fresh this week" /> : null}
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
            {item.previousPrice && item.previousPrice > item.price ? (
              <Text fontSize={12} color={ui.textMuted} textDecorationLine="line-through">
                {formatCurrency(item.previousPrice, item.currency)}
              </Text>
            ) : typeof item.mrp === 'number' && item.mrp > item.price ? (
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
        {item.shop_name && item.shopSlug ? (
          <AppLink href={commerceRoutes.shop(item.shopSlug)} asChild>
            <Button tone="outline" size="$3" borderRadius={999} icon={<Icons.Store size={14} />}>
              Open shop
            </Button>
          </AppLink>
        ) : null}
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
