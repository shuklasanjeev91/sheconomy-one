import { useRouter } from 'one'
import { AppLink } from '~/components/navigation/AppLink'
import { useEffect, useMemo, useState } from 'react'
import { Share } from 'react-native'

import { Icons, Image, Spinner, Text, XStack, YStack, useAppToast } from '~/components/ui'
import { BRAND_NAME } from '~/config/brand'
import { FullWidthLayout, LAYOUT_STRETCH, PageSection, StickyRail } from '~/components/layout'
import { useCart } from '~/commerce/hooks/useCart'
import { useStorefrontCartItems } from '~/commerce/hooks/useStorefrontCartItems'
import { useShopPartners } from '~/commerce/hooks/useShopPartners'
import { useShopHeaders } from '~/commerce/hooks/useShopHeaders'
import {
  CartCoupon,
  CommerceButton,
  CommerceCheckbox,
  CommerceLink,
  CommerceMobileCheckoutBar,
  COMMERCE_MOBILE_CHECKOUT_BAR_HEIGHT,
  CartRecoveryNudge,
  CartShopOffers,
  CartFreeShippingBar,
  ListingRecommendationsSections,
  RecentlyViewedRail,
  ShopPartnerChips,
  ShopRatingBadge,
  useCommercePalette,
} from '~/commerce/components'
import {
  computeSelectedTotals,
  setCartItemsSelected,
  toggleCartItemSelected,
  useCartSelection,
} from '~/commerce/lib/cart-selection'
import type { CartItemRow } from '~/commerce/lib/cart'
import { paymentCollectionFor } from '~/commerce/lib/shop-commerce'
import { deliveryEstimateLabel } from '~/commerce/lib/delivery-estimate'
import { useFavorites } from '~/commerce/hooks/useFavorites'
import { fetchListingStockByIds } from '~/commerce/lib/listing-fulfillment'
import { fetchListingSlugMap, fetchListingTypesByIds, isDigitalListing } from '~/lib/supabase/commerce'
import { formatCurrency } from '~/lib/format'
import { copyToClipboard } from '~/lib/platform/clipboard'
import { commerceRoutes } from '~/lib/routes'
import { useAppLayout } from '~/hooks/useAppLayout'

const SUMMARY_WIDTH = 300

export function CartScreen() {
  const c = useCommercePalette()
  const { isDesktop } = useAppLayout()
  const { cart, items: cartItems, isLoading, error, updateQuantity, removeItem } = useCart()
  const { items, isChecking, hasInactiveItems } = useStorefrontCartItems(cartItems)
  const { favoriteIds, isFavorite, toggleFavorite } = useFavorites()
  const toast = useAppToast()
  const router = useRouter()
  const [listingSlugs, setListingSlugs] = useState<Map<string, string>>(new Map())
  const [listingTypes, setListingTypes] = useState<Map<string, string>>(new Map())
  const [listingStock, setListingStock] = useState<Map<string, number | null>>(new Map())

  useEffect(() => {
    const ids = items.map((item) => item.listing_id)
    if (!ids.length) {
      setListingSlugs(new Map())
      setListingTypes(new Map())
      setListingStock(new Map())
      return
    }
    void Promise.all([
      fetchListingSlugMap(ids),
      fetchListingTypesByIds(ids),
      fetchListingStockByIds(ids),
    ]).then(([slugs, types, stock]) => {
      setListingSlugs(slugs)
      setListingTypes(types)
      setListingStock(stock)
    })
  }, [items])

  const groupedByShop = useMemo(() => {
    const groups = new Map<string, CartItemRow[]>()
    for (const item of items) {
      const existing = groups.get(item.shop_id) ?? []
      existing.push(item)
      groups.set(item.shop_id, existing)
    }
    return [...groups.entries()]
  }, [items])

  const shopIds = useMemo(() => groupedByShop.map(([shopId]) => shopId), [groupedByShop])
  const { partners: shopPartners } = useShopPartners(shopIds)
  const shopHeaders = useShopHeaders(shopIds)

  const availableIds = useMemo(() => items.map((item) => item.id), [items])
  const { isSelected, allSelected, noneSelected } = useCartSelection(availableIds)

  const currency = cart?.currency ?? 'INR'
  const { subtotal, unitCount, discount, total } = computeSelectedTotals(cart, items, isSelected)
  const recommendationSeedId = items[0]?.listing_id ?? favoriteIds[0] ?? undefined
  const cartListingIds = useMemo(() => items.map((item) => item.listing_id), [items])
  const shippableSubtotal = useMemo(() => {
    return items.reduce((sum, item) => {
      if (!isSelected(item.id)) return sum
      const type = listingTypes.get(item.listing_id)
      if (type && isDigitalListing(type)) return sum
      return sum + item.total_price
    }, 0)
  }, [items, isSelected, listingTypes])

  function listingHref(listingId: string) {
    return commerceRoutes.listing(listingSlugs.get(listingId) ?? listingId)
  }

  async function handleQuantityChange(itemId: string, nextQuantity: number) {
    if (nextQuantity < 1) return
    const { error: updateError } = await updateQuantity(itemId, nextQuantity)
    if (updateError) toast.show('Could not update item', { tone: 'danger', message: updateError })
  }

  async function handleShareCartSummary() {
    const selected = items.filter((item) => isSelected(item.id))
    if (!selected.length) {
      toast.show('Select items to share', { tone: 'info' })
      return
    }
    const lines = selected.map((item) => {
      const variant =
        item.variant_name && item.variant_value
          ? ` (${item.variant_name}: ${item.variant_value})`
          : item.variant_name
            ? ` (${item.variant_name})`
            : ''
      return `• ${item.title}${variant} × ${item.quantity} — ${formatCurrency(
        item.unit_price * item.quantity,
        currency,
      )}`
    })
    const message = [
      `Cart on ${BRAND_NAME}`,
      `${selected.length} item${selected.length === 1 ? '' : 's'}`,
      '',
      ...lines,
      '',
      `Total: ${formatCurrency(total, currency)}`,
    ].join('\n')

    try {
      await Share.share({ title: 'Cart summary', message })
    } catch {
      const copied = await copyToClipboard(message)
      toast.show(copied ? 'Cart summary copied' : 'Could not share cart', {
        tone: copied ? 'success' : 'danger',
      })
    }
  }

  async function handleRemove(itemId: string) {
    const { error: removeError } = await removeItem(itemId)
    if (removeError) toast.show('Could not remove item', { tone: 'danger', message: removeError })
  }

  async function handleSaveForLater(itemId: string, listingId: string) {
    if (!isFavorite(listingId)) await toggleFavorite(listingId)
    const { error: removeError } = await removeItem(itemId)
    if (removeError) {
      toast.show('Could not move item', { tone: 'danger', message: removeError })
      return
    }
    toast.show('Saved for later', {
      tone: 'success',
      message: 'Moved to your favorites.',
    })
  }

  if ((isLoading || isChecking) && cartItems.length === 0) {
    return (
      <FullWidthLayout>
        <PageSection paddingVertical="$10" alignItems="center">
          <Spinner size="large" />
        </PageSection>
      </FullWidthLayout>
    )
  }

  const showMobileBar = !isDesktop && items.length > 0

  const subtotalLine = (
    <Text fontSize={18} color={c.text}>
      Subtotal ({unitCount} {unitCount === 1 ? 'item' : 'items'}):{' '}
      <Text fontSize={18} fontWeight="700" color={c.priceStrong}>
        {formatCurrency(subtotal, currency)}
      </Text>
    </Text>
  )

  const buyBox = (
    <YStack
      backgroundColor={c.panel}
      borderColor={c.border}
      borderWidth={1}
      borderRadius={12}
      padding="$4"
      gap="$3"
      width="100%"
    >
      {!noneSelected ? (
        <CartFreeShippingBar
          shippableSubtotal={shippableSubtotal}
          shopIds={shopIds}
          currency={currency}
        />
      ) : null}
      <CartRecoveryNudge itemCount={unitCount} />
      {subtotalLine}
      {discount > 0 ? (
        <XStack justifyContent="space-between">
          <Text fontSize={13} color={c.secondary}>
            Promotion{cart?.applied_discount_name ? ` (${cart.applied_discount_name})` : ''}
          </Text>
          <Text fontSize={13} color={c.inStock}>
            −{formatCurrency(discount, currency)}
          </Text>
        </XStack>
      ) : null}
      {discount > 0 && subtotal > 0 ? (
        <XStack
          alignItems="center"
          gap="$1.5"
          backgroundColor={c.chip}
          borderRadius={8}
          paddingHorizontal="$2.5"
          paddingVertical="$1.5"
        >
          <Icons.BadgePercent size={14} color={c.inStock} />
          <Text fontSize={12} fontWeight="700" color={c.inStock}>
            You&apos;re saving {formatCurrency(discount, currency)} (
            {Math.round((discount / (subtotal + discount)) * 100)}%)
          </Text>
        </XStack>
      ) : null}
      <CartCoupon />
      <CommerceButton
        variant="primary"
        disabled={noneSelected}
        onPress={() => router.push(commerceRoutes.checkout)}
        width="100%"
      >
        Proceed to buy ({unitCount} {unitCount === 1 ? 'item' : 'items'})
      </CommerceButton>
      <XStack alignItems="center" gap="$1.5" justifyContent="center">
        <Icons.ShieldCheck size={13} color={c.secondary} />
        <Text fontSize={11} color={c.secondary}>
          SHEconomy Purchase Protection on every order
        </Text>
      </XStack>
    </YStack>
  )

  const layout = (
    <FullWidthLayout scroll>
      <PageSection paddingVertical="$5" {...LAYOUT_STRETCH}>
        <YStack
          gap="$4"
          width="100%"
          maxWidth="100%"
          alignSelf="stretch"
          backgroundColor={c.page}
          padding={isDesktop ? '$4' : '$2'}
          borderRadius={12}
          paddingBottom={showMobileBar ? COMMERCE_MOBILE_CHECKOUT_BAR_HEIGHT + 12 : undefined}
        >

          {items.length === 0 ? (
            <YStack gap="$8" width="100%">
              <YStack
                backgroundColor={c.panel}
                borderColor={c.border}
                borderWidth={1}
                borderRadius={12}
                padding="$8"
                alignItems="center"
                gap="$4"
              >
                <Icons.ShoppingCart size={44} color={c.brand} />
                <Text fontSize={20} fontWeight="700" color={c.text}>
                  Your SHEconomy cart is empty
                </Text>
                <CommerceButton variant="primary" onPress={() => router.push(commerceRoutes.home)}>
                  Discover today&apos;s finds
                </CommerceButton>
              </YStack>
              <RecentlyViewedRail excludeIds={cartListingIds} />
              {recommendationSeedId ? (
                <ListingRecommendationsSections listingId={recommendationSeedId} />
              ) : null}
            </YStack>
          ) : (
            <YStack gap="$8" width="100%">
            <XStack
              width="100%"
              maxWidth="100%"
              alignSelf="stretch"
              flexDirection={isDesktop ? 'row' : 'column'}
              alignItems="flex-start"
              gap="$4"
            >
              <YStack flex={1} minWidth={0} width="100%" gap="$4">
                <YStack
                  backgroundColor={c.panel}
                  borderColor={c.border}
                  borderWidth={1}
                  borderRadius={12}
                  padding="$4"
                  gap="$3"
                >
                  <XStack justifyContent="space-between" alignItems="flex-end">
                    <Text fontSize={26} fontWeight="600" color={c.text} letterSpacing={-0.3}>
                      Shopping cart
                    </Text>
                    <Text fontSize={13} color={c.secondary} display={isDesktop ? 'flex' : 'none'}>
                      Price
                    </Text>
                  </XStack>

                  <XStack alignItems="center" gap="$3" flexWrap="wrap">
                    <CommerceLink onPress={() => setCartItemsSelected(availableIds, !allSelected)}>
                      {allSelected ? 'Deselect all items' : 'Select all items'}
                    </CommerceLink>
                    {!noneSelected ? (
                      <CommerceLink onPress={() => void handleShareCartSummary()}>
                        Share cart summary
                      </CommerceLink>
                    ) : null}
                  </XStack>

                  <YStack
                    height={1}
                    backgroundColor={c.divider}
                    marginHorizontal={-16}
                    marginTop="$1"
                  />

                  {groupedByShop.map(([shopId, shopItems], groupIndex) => {
                    const shopSelectedSubtotal = shopItems.reduce(
                      (sum, item) =>
                        isSelected(item.id) ? sum + item.unit_price * item.quantity : sum,
                      0,
                    )
                    return (
                      <YStack key={shopId} gap="$2" paddingTop={groupIndex > 0 ? '$3' : 0}>
                        <XStack alignItems="center" gap="$2" justifyContent="space-between">
                          <XStack alignItems="center" gap="$2" flex={1} minWidth={0}>
                            <Icons.Store size={14} color={c.secondary} />
                            <Text fontSize={13} color={c.secondary} numberOfLines={1}>
                              Sold by{' '}
                              <Text fontSize={13} color={c.text} fontWeight="600">
                                {shopItems[0]?.shop_name}
                              </Text>
                            </Text>
                          </XStack>
                          <XStack alignItems="center" gap="$1">
                            <Icons.Truck size={13} color={c.inStock} />
                            <Text fontSize={12} color={c.inStock} fontWeight="600">
                              FREE delivery
                            </Text>
                          </XStack>
                        </XStack>
                        <ShopRatingBadge info={shopHeaders.get(shopId)} />
                        <Text fontSize={12} color={c.secondary}>
                          {deliveryEstimateLabel()}
                        </Text>
                        <ShopPartnerChips info={shopPartners.get(shopId)} />
                        {paymentCollectionFor(shopPartners.get(shopId)) === 'direct' ? (
                          <XStack alignItems="center" gap="$1">
                            <Icons.BadgeCheck size={12} color={c.inStock} />
                            <Text fontSize={11} color={c.inStock}>
                              Paid directly to the seller · 0% commission
                            </Text>
                          </XStack>
                        ) : null}

                        {shopItems.map((item) => (
                          <CartRow
                            key={item.id}
                            item={item}
                            selected={isSelected(item.id)}
                            listingHref={listingHref(item.listing_id)}
                            listingType={listingTypes.get(item.listing_id)}
                            maxQuantity={listingStock.get(item.listing_id) ?? null}
                            currency={currency}
                            isDesktop={isDesktop}
                            onToggle={() => toggleCartItemSelected(item.id)}
                            onQuantityChange={handleQuantityChange}
                            onRemove={handleRemove}
                            onSaveForLater={handleSaveForLater}
                          />
                        ))}

                        <CartShopOffers
                          shopId={shopId}
                          shopName={shopItems[0]?.shop_name}
                          subtotal={subtotal}
                          currency={currency}
                        />

                        {groupedByShop.length > 1 ? (
                          <XStack justifyContent="flex-end" paddingTop="$1">
                            <Text fontSize={12} color={c.secondary}>
                              Subtotal ({shopItems[0]?.shop_name}):{' '}
                              <Text fontWeight="700" color={c.text}>
                                {formatCurrency(shopSelectedSubtotal, currency)}
                              </Text>
                            </Text>
                          </XStack>
                        ) : null}
                      </YStack>
                    )
                  })}

                  <XStack justifyContent="flex-end" paddingTop="$2">
                    {subtotalLine}
                  </XStack>
                </YStack>

                {hasInactiveItems ? (
                  <Text color={c.secondary} fontSize={13}>
                    Some items became unavailable and were removed from your cart.
                  </Text>
                ) : null}
                {error ? (
                  <Text color={c.brand} fontSize={14}>
                    {error}
                  </Text>
                ) : null}
              </YStack>

              {isDesktop ? (
                <StickyRail width={SUMMARY_WIDTH} maxWidth="100%">
                  {buyBox}
                </StickyRail>
              ) : (
                buyBox
              )}
            </XStack>
            <RecentlyViewedRail excludeIds={cartListingIds} />
            {recommendationSeedId ? (
              <ListingRecommendationsSections listingId={recommendationSeedId} />
            ) : null}
            </YStack>
          )}
        </YStack>
      </PageSection>
    </FullWidthLayout>
  )

  if (!showMobileBar) return layout

  return (
    <YStack flex={1} width="100%" position="relative">
      {layout}
      <CommerceMobileCheckoutBar
        total={total}
        currency={currency}
        caption={`Subtotal · ${unitCount} ${unitCount === 1 ? 'item' : 'items'}`}
        savings={discount || null}
        label="Proceed to buy"
        disabled={noneSelected}
        onPress={() => router.push(commerceRoutes.checkout)}
      />
    </YStack>
  )
}

function CartRow({
  item,
  selected,
  listingHref,
  listingType,
  maxQuantity,
  currency,
  isDesktop,
  onToggle,
  onQuantityChange,
  onRemove,
  onSaveForLater,
}: {
  item: CartItemRow
  selected: boolean
  listingHref: string
  listingType?: string
  maxQuantity?: number | null
  currency: string
  isDesktop: boolean
  onToggle: () => void
  onQuantityChange: (itemId: string, nextQuantity: number) => void
  onRemove: (itemId: string) => void
  onSaveForLater: (itemId: string, listingId: string) => void
}) {
  const c = useCommercePalette()
  const imageSize = isDesktop ? 120 : 90
  const atMax = typeof maxQuantity === 'number' && item.quantity >= maxQuantity
  const overStock = typeof maxQuantity === 'number' && item.quantity > maxQuantity
  const lowStock = typeof maxQuantity === 'number' && maxQuantity > 0 && maxQuantity <= 5

  return (
    <XStack
      gap="$3"
      paddingVertical="$4"
      borderTopWidth={1}
      borderTopColor={c.divider}
      alignItems="flex-start"
      opacity={selected ? 1 : 0.55}
    >
      <YStack paddingTop="$2">
        <CommerceCheckbox checked={selected} onPress={onToggle} />
      </YStack>

      <AppLink href={listingHref} asChild>
        <YStack
          width={imageSize}
          height={imageSize}
          borderRadius={8}
          overflow="hidden"
          backgroundColor={c.imagePlaceholder}
          flexShrink={0}
          cursor="pointer"
        >
          {item.image_url ? (
            <Image src={item.image_url} width={imageSize} height={imageSize} objectFit="contain" />
          ) : null}
        </YStack>
      </AppLink>

      <YStack flex={1} minWidth={0} gap="$1.5">
        <AppLink href={listingHref} asChild>
          <Text
            fontSize={isDesktop ? 18 : 15}
            color={c.link}
            numberOfLines={2}
            cursor="pointer"
            hoverStyle={{ color: c.linkHover }}
          >
            {item.title}
          </Text>
        </AppLink>

        <Text fontSize={12} color={c.inStock}>
          {listingType && isDigitalListing(listingType) ? 'In stock · Instant download' : 'In stock'}
        </Text>

        {item.variant_name ? (
          <Text fontSize={12} color={c.secondary}>
            {item.variant_name}
            {item.variant_value ? `: ${item.variant_value}` : ''}
          </Text>
        ) : null}

        {typeof (item.item_metadata as { personalization_note?: string } | null)?.personalization_note ===
        'string' &&
        (item.item_metadata as { personalization_note: string }).personalization_note.trim() ? (
          <Text fontSize={12} color={c.secondary} fontStyle="italic">
            Note: {(item.item_metadata as { personalization_note: string }).personalization_note.trim()}
          </Text>
        ) : null}

        {!isDesktop ? (
          <Text fontSize={16} fontWeight="700" color={c.priceStrong}>
            {formatCurrency(item.unit_price, currency)}
          </Text>
        ) : null}

        <XStack gap="$3" alignItems="center" flexWrap="wrap" paddingTop="$1">
          <XStack
            alignItems="center"
            backgroundColor={c.surfaceMuted}
            borderColor={c.border}
            borderWidth={1}
            borderRadius={8}
            overflow="hidden"
          >
            <Text
              onPress={() =>
                item.quantity <= 1
                  ? onRemove(item.id)
                  : onQuantityChange(item.id, item.quantity - 1)
              }
              width={34}
              height={30}
              textAlign="center"
              lineHeight={30}
              fontSize={16}
              color={c.text}
              cursor="pointer"
              hoverStyle={{ backgroundColor: c.surfaceHover }}
            >
              {item.quantity <= 1 ? '🗑' : '−'}
            </Text>
            <Text minWidth={30} textAlign="center" fontSize={14} fontWeight="600" color={c.text}>
              {item.quantity}
            </Text>
            <Text
              onPress={() => {
                if (atMax) return
                onQuantityChange(item.id, item.quantity + 1)
              }}
              width={34}
              height={30}
              textAlign="center"
              lineHeight={30}
              fontSize={16}
              color={atMax ? c.secondary : c.text}
              opacity={atMax ? 0.4 : 1}
              cursor={atMax ? 'not-allowed' : 'pointer'}
              hoverStyle={atMax ? undefined : { backgroundColor: c.surfaceHover }}
            >
              +
            </Text>
          </XStack>

          <Text height={16} width={1} backgroundColor={c.border} />
          <CommerceLink onPress={() => onSaveForLater(item.id, item.listing_id)}>
            Save for later
          </CommerceLink>
          <Text height={16} width={1} backgroundColor={c.border} />
          <CommerceLink onPress={() => onRemove(item.id)}>Delete</CommerceLink>
        </XStack>

        {overStock ? (
          <Text fontSize={12} color={c.brand}>
            Only {maxQuantity} in stock — reduce quantity to check out.
          </Text>
        ) : lowStock && atMax ? (
          <Text fontSize={12} color={c.secondary}>
            Max available: {maxQuantity} in stock.
          </Text>
        ) : null}
      </YStack>

      {isDesktop ? (
        <Text fontSize={18} fontWeight="700" color={c.priceStrong} flexShrink={0}>
          {formatCurrency(item.unit_price, currency)}
        </Text>
      ) : null}
    </XStack>
  )
}
