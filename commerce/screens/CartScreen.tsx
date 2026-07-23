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
  ListingQuantityStepper,
  ListingRecommendationsSections,
  RecentlyViewedRail,
  ShopPartnerChips,
  ShopRatingBadge,
  StockNotifyButton,
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
  const {
    cart,
    items: cartItems,
    savedItems,
    isLoading,
    error,
    updateQuantity,
    removeItem,
    addToCart,
    saveForLater,
    moveToCart,
    removeSavedItem,
  } = useCart()
  const { items, isChecking, hasInactiveItems } = useStorefrontCartItems(cartItems)
  const { favoriteIds, isFavorite, toggleFavorite } = useFavorites()
  const toast = useAppToast()
  const router = useRouter()
  const [listingSlugs, setListingSlugs] = useState<Map<string, string>>(new Map())
  const [listingTypes, setListingTypes] = useState<Map<string, string>>(new Map())
  const [listingStock, setListingStock] = useState<Map<string, number | null>>(new Map())

  useEffect(() => {
    const ids = [
      ...new Set([
        ...items.map((item) => item.listing_id),
        ...savedItems.map((item) => item.listing_id),
      ]),
    ]
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
  }, [items, savedItems])

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
  const recommendationSeedId =
    items[0]?.listing_id ?? savedItems[0]?.listing_id ?? favoriteIds[0] ?? undefined
  const cartListingIds = useMemo(
    () => [
      ...new Set([
        ...items.map((item) => item.listing_id),
        ...savedItems.map((item) => item.listing_id),
      ]),
    ],
    [items, savedItems],
  )
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
    const removed =
      cartItems.find((item) => item.id === itemId) ??
      savedItems.find((item) => item.id === itemId)
    const { error: removeError } = await removeItem(itemId)
    if (removeError) {
      toast.show('Could not remove item', { tone: 'danger', message: removeError })
      return
    }
    toast.show('Removed from cart', {
      tone: 'default',
      duration: 6000,
      actionLabel: 'Undo',
      onAction: () => {
        if (!removed?.listing_id) return
        void addToCart(removed.listing_id, {
          quantity: removed.quantity,
          variantId: removed.variant_id,
        }).then((result) => {
          if (result.error) {
            toast.show('Could not restore item', { tone: 'danger', message: result.error })
            return
          }
          toast.show('Item restored', { tone: 'success' })
        })
      },
    })
  }

  async function handleSaveForLater(itemId: string) {
    const { error: saveError } = await saveForLater(itemId)
    if (saveError) {
      toast.show('Could not save for later', { tone: 'danger', message: saveError })
      return
    }
    toast.show('Saved for later', {
      tone: 'success',
      message: 'Moved below your cart. It won’t be included at checkout.',
    })
  }

  async function handleMoveToCart(itemId: string) {
    const { error: moveError } = await moveToCart(itemId)
    if (moveError) {
      toast.show('Could not move to cart', { tone: 'danger', message: moveError })
      return
    }
    toast.show('Moved to cart', { tone: 'success' })
  }

  async function handleMoveSavedToWishlist(itemId: string, listingId: string) {
    if (!isFavorite(listingId)) await toggleFavorite(listingId)
    const { error: removeError } = await removeSavedItem(itemId)
    if (removeError) {
      toast.show('Saved to wishlist', {
        tone: 'success',
        message: 'Could not remove from Saved for later — remove it manually if needed.',
      })
      return
    }
    toast.show('Moved to wishlist', {
      tone: 'success',
      message: 'Find it anytime under Wishlist.',
    })
  }

  if ((isLoading || isChecking) && cartItems.length === 0 && savedItems.length === 0) {
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

  const discountBlock =
    discount > 0 ? (
      <YStack gap="$2" width="100%">
        <XStack justifyContent="space-between">
          <Text fontSize={13} color={c.secondary}>
            Promotion{cart?.applied_discount_name ? ` (${cart.applied_discount_name})` : ''}
          </Text>
          <Text fontSize={13} color={c.inStock}>
            −{formatCurrency(discount, currency)}
          </Text>
        </XStack>
        {subtotal > 0 ? (
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
      </YStack>
    ) : null

  const protectionNote = (
    <XStack alignItems="center" gap="$1.5" justifyContent="center">
      <Icons.ShieldCheck size={13} color={c.secondary} />
      <Text fontSize={11} color={c.secondary}>
        SHEconomy Purchase Protection on every order
      </Text>
    </XStack>
  )

  /** Desktop sticky summary — full CTA lives here. */
  const desktopBuyBox = (
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
      {discountBlock}
      <CartCoupon />
      <CommerceButton
        variant="primary"
        disabled={noneSelected}
        onPress={() => router.push(commerceRoutes.checkout)}
        width="100%"
      >
        Proceed to buy ({unitCount} {unitCount === 1 ? 'item' : 'items'})
      </CommerceButton>
      {protectionNote}
    </YStack>
  )

  /**
   * Mobile summary — no primary CTA (sticky bar owns checkout).
   * Kept after the items panel so rails never collide with cart lines.
   */
  const mobileSummary = (
    <YStack
      backgroundColor={c.panel}
      borderColor={c.border}
      borderWidth={1}
      borderRadius={12}
      padding="$3.5"
      gap="$3"
      width="100%"
      position="relative"
      zIndex={1}
    >
      {!noneSelected ? (
        <CartFreeShippingBar
          shippableSubtotal={shippableSubtotal}
          shopIds={shopIds}
          currency={currency}
        />
      ) : null}
      <CartRecoveryNudge itemCount={unitCount} compact />
      {subtotalLine}
      {discountBlock}
      <CartCoupon />
      {protectionNote}
    </YStack>
  )

  const cartItemsPanel = (
    <YStack
      backgroundColor={c.panel}
      borderColor={c.border}
      borderWidth={1}
      borderRadius={12}
      padding={isDesktop ? '$4' : '$3.5'}
      gap="$3"
      width="100%"
      position="relative"
      zIndex={1}
      overflow="hidden"
    >
      <XStack justifyContent="space-between" alignItems="flex-end">
        <YStack gap="$1" flex={1} minWidth={0}>
          <Text
            fontSize={isDesktop ? 26 : 22}
            fontWeight="700"
            color={c.text}
            letterSpacing={-0.4}
          >
            Shopping cart
          </Text>
          <Text fontSize={13} color={c.secondary}>
            {unitCount} {unitCount === 1 ? 'item' : 'items'} selected
          </Text>
        </YStack>
        {isDesktop ? (
          <Text fontSize={13} color={c.secondary}>
            Price
          </Text>
        ) : null}
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

      <YStack height={1} backgroundColor={c.divider} marginHorizontal={isDesktop ? -16 : -14} />

      {groupedByShop.map(([shopId, shopItems], groupIndex) => {
        const shopSelectedSubtotal = shopItems.reduce(
          (sum, item) => (isSelected(item.id) ? sum + item.unit_price * item.quantity : sum),
          0,
        )
        return (
          <YStack key={shopId} gap="$2.5" paddingTop={groupIndex > 0 ? '$3' : 0}>
            {groupIndex > 0 ? (
              <YStack height={1} backgroundColor={c.divider} marginBottom="$1" />
            ) : null}
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
              subtotal={shopSelectedSubtotal}
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

      {isDesktop ? (
        <XStack justifyContent="flex-end" paddingTop="$2">
          {subtotalLine}
        </XStack>
      ) : null}
    </YStack>
  )

  const savedForLaterShelf =
    savedItems.length > 0 ? (
      <YStack
        backgroundColor={c.panel}
        borderColor={c.border}
        borderWidth={1}
        borderRadius={12}
        padding={isDesktop ? '$4' : '$3.5'}
        gap="$3"
        width="100%"
        position="relative"
        zIndex={1}
      >
        <YStack gap="$1">
          <Text fontSize={isDesktop ? 22 : 20} fontWeight="700" color={c.text} letterSpacing={-0.3}>
            Saved for later ({savedItems.length})
          </Text>
          <Text fontSize={13} color={c.secondary}>
            These items stay on your cart page but aren’t included at checkout.
          </Text>
        </YStack>
        {savedItems.map((item) => {
          const stock = listingStock.get(item.listing_id)
          const outOfStock = typeof stock === 'number' && stock <= 0
          return (
          <SavedForLaterRow
            key={item.id}
            item={item}
            listingHref={listingHref(item.listing_id)}
            currency={currency}
            isDesktop={isDesktop}
            outOfStock={outOfStock}
            onMoveToCart={() => void handleMoveToCart(item.id)}
            onDelete={() => void handleRemove(item.id)}
            onMoveToWishlist={() => void handleMoveSavedToWishlist(item.id, item.listing_id)}
          />
          )
        })}
      </YStack>
    ) : null

  const discoveryRails = (
    <YStack
      gap="$6"
      width="100%"
      position="relative"
      zIndex={0}
      paddingTop={items.length > 0 ? '$4' : '$2'}
      marginTop={items.length > 0 ? '$2' : 0}
      borderTopWidth={items.length > 0 ? 1 : 0}
      borderTopColor={c.divider}
    >
      <RecentlyViewedRail excludeIds={cartListingIds} />
      {recommendationSeedId ? (
        <ListingRecommendationsSections listingId={recommendationSeedId} />
      ) : null}
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
          paddingBottom={showMobileBar ? COMMERCE_MOBILE_CHECKOUT_BAR_HEIGHT + 24 : undefined}
        >
          {items.length === 0 ? (
            <YStack gap="$4" width="100%">
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
                  {savedItems.length > 0
                    ? 'No items ready for checkout'
                    : 'Your SHEconomy cart is empty'}
                </Text>
                <Text fontSize={14} color={c.secondary} textAlign="center">
                  {savedItems.length > 0
                    ? 'Move items from Saved for later into your cart when you’re ready.'
                    : 'Browse shops and add something you love.'}
                </Text>
                <CommerceButton variant="primary" onPress={() => router.push(commerceRoutes.home)}>
                  Discover today&apos;s finds
                </CommerceButton>
                {savedItems.length > 0 ? (
                  <CommerceLink onPress={() => router.push(commerceRoutes.wishlist)}>
                    Open wishlist
                  </CommerceLink>
                ) : null}
              </YStack>
              {savedForLaterShelf}
              {discoveryRails}
            </YStack>
          ) : isDesktop ? (
            <YStack gap="$8" width="100%">
              <XStack
                width="100%"
                maxWidth="100%"
                alignSelf="stretch"
                flexDirection="row"
                alignItems="flex-start"
                gap="$4"
              >
                <YStack flex={1} minWidth={0} width="100%" gap="$4">
                  {cartItemsPanel}
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
                  {savedForLaterShelf}
                </YStack>
                <StickyRail width={SUMMARY_WIDTH} maxWidth="100%">
                  {desktopBuyBox}
                </StickyRail>
              </XStack>
              {discoveryRails}
            </YStack>
          ) : (
            <YStack gap="$4" width="100%" flexShrink={0}>
              {cartItemsPanel}
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
              {mobileSummary}
              {savedForLaterShelf}
              {discoveryRails}
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

function SavedForLaterRow({
  item,
  listingHref,
  currency,
  isDesktop,
  outOfStock,
  onMoveToCart,
  onDelete,
  onMoveToWishlist,
}: {
  item: CartItemRow
  listingHref: string
  currency: string
  isDesktop: boolean
  outOfStock: boolean
  onMoveToCart: () => void
  onDelete: () => void
  onMoveToWishlist: () => void
}) {
  const c = useCommercePalette()
  const imageSize = isDesktop ? 96 : 80
  const lineTotal = item.unit_price * item.quantity

  return (
    <YStack gap="$2.5" paddingVertical="$3" borderTopWidth={1} borderTopColor={c.divider} width="100%">
      <XStack gap="$3" alignItems="flex-start" width="100%">
        <AppLink href={listingHref} asChild>
          <YStack
            width={imageSize}
            height={imageSize}
            borderRadius={10}
            overflow="hidden"
            backgroundColor={c.imagePlaceholder}
            flexShrink={0}
            cursor="pointer"
            borderWidth={1}
            borderColor={c.border}
          >
            {item.image_url ? (
              <Image src={item.image_url} width={imageSize} height={imageSize} objectFit="contain" />
            ) : null}
          </YStack>
        </AppLink>
        <YStack flex={1} minWidth={0} gap="$1.5">
          <AppLink href={listingHref} asChild>
            <Text
              fontSize={isDesktop ? 16 : 14}
              fontWeight="600"
              color={c.link}
              numberOfLines={2}
              cursor="pointer"
              hoverStyle={{ color: c.linkHover }}
            >
              {item.title}
            </Text>
          </AppLink>
          {item.variant_name ? (
            <Text fontSize={12} color={c.secondary}>
              {item.variant_name}
              {item.variant_value ? `: ${item.variant_value}` : ''}
            </Text>
          ) : null}
          <Text fontSize={16} fontWeight="800" color={c.priceStrong}>
            {formatCurrency(lineTotal, currency)}
          </Text>
          <Text fontSize={12} color={c.secondary}>
            Qty {item.quantity}
          </Text>
          {outOfStock ? (
            <Text fontSize={12} fontWeight="600" color="#b45309">
              Currently out of stock
            </Text>
          ) : null}
        </YStack>
      </XStack>
      <XStack gap="$3" alignItems="center" flexWrap="wrap">
        {!outOfStock ? <CommerceLink onPress={onMoveToCart}>Move to cart</CommerceLink> : null}
        {!outOfStock ? <YStack height={16} width={1} backgroundColor={c.border} /> : null}
        <CommerceLink onPress={onMoveToWishlist}>Move to wishlist</CommerceLink>
        <YStack height={16} width={1} backgroundColor={c.border} />
        <CommerceLink onPress={onDelete}>Delete</CommerceLink>
      </XStack>
      {outOfStock ? (
        <StockNotifyButton listingId={item.listing_id} outOfStock />
      ) : null}
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
  onSaveForLater: (itemId: string) => void
}) {
  const c = useCommercePalette()
  const imageSize = isDesktop ? 120 : 90
  const atMax = typeof maxQuantity === 'number' && item.quantity >= maxQuantity
  const overStock = typeof maxQuantity === 'number' && item.quantity > maxQuantity
  const lowStock = typeof maxQuantity === 'number' && maxQuantity > 0 && maxQuantity <= 5

  const lineTotal = item.unit_price * item.quantity

  return (
    <YStack
      gap="$3"
      paddingVertical="$3.5"
      borderTopWidth={1}
      borderTopColor={c.divider}
      opacity={selected ? 1 : 0.55}
      width="100%"
    >
      <XStack gap="$3" alignItems="flex-start" width="100%">
        <YStack paddingTop="$2">
          <CommerceCheckbox checked={selected} onPress={onToggle} />
        </YStack>

        <AppLink href={listingHref} asChild>
          <YStack
            width={imageSize}
            height={imageSize}
            borderRadius={10}
            overflow="hidden"
            backgroundColor={c.imagePlaceholder}
            flexShrink={0}
            cursor="pointer"
            borderWidth={1}
            borderColor={c.border}
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
              fontWeight="600"
              color={c.link}
              numberOfLines={2}
              cursor="pointer"
              hoverStyle={{ color: c.linkHover }}
            >
              {item.title}
            </Text>
          </AppLink>

          <Text fontSize={12} color={c.inStock} fontWeight="600">
            {listingType && isDigitalListing(listingType)
              ? 'In stock · Instant download'
              : 'In stock'}
          </Text>

          {item.variant_name ? (
            <Text fontSize={12} color={c.secondary}>
              {item.variant_name}
              {item.variant_value ? `: ${item.variant_value}` : ''}
            </Text>
          ) : null}

          {typeof (item.item_metadata as { personalization_note?: string } | null)
            ?.personalization_note === 'string' &&
          (item.item_metadata as { personalization_note: string }).personalization_note.trim() ? (
            <Text fontSize={12} color={c.secondary} fontStyle="italic">
              Note:{' '}
              {(item.item_metadata as { personalization_note: string }).personalization_note.trim()}
            </Text>
          ) : null}

          {!isDesktop ? (
            <YStack gap={2} paddingTop={2}>
              <Text fontSize={17} fontWeight="800" color={c.priceStrong} letterSpacing={-0.3}>
                {formatCurrency(lineTotal, currency)}
              </Text>
              {item.quantity > 1 ? (
                <Text fontSize={11} color={c.secondary}>
                  {formatCurrency(item.unit_price, currency)} each
                </Text>
              ) : null}
            </YStack>
          ) : null}
        </YStack>

        {isDesktop ? (
          <YStack alignItems="flex-end" flexShrink={0} gap={2}>
            <Text fontSize={18} fontWeight="800" color={c.priceStrong}>
              {formatCurrency(lineTotal, currency)}
            </Text>
            {item.quantity > 1 ? (
              <Text fontSize={12} color={c.secondary}>
                {formatCurrency(item.unit_price, currency)} each
              </Text>
            ) : null}
          </YStack>
        ) : null}
      </XStack>

      <XStack
        gap="$3"
        alignItems="center"
        flexWrap="wrap"
        paddingLeft={isDesktop ? imageSize + 40 : 0}
      >
        <ListingQuantityStepper
          size="sm"
          quantity={item.quantity}
          maxQuantity={maxQuantity}
          onDecrease={() =>
            item.quantity <= 1 ? onRemove(item.id) : onQuantityChange(item.id, item.quantity - 1)
          }
          onIncrease={() => {
            if (atMax) return
            onQuantityChange(item.id, item.quantity + 1)
          }}
        />

        <YStack height={16} width={1} backgroundColor={c.border} />
        <CommerceLink onPress={() => onSaveForLater(item.id)}>
          Save for later
        </CommerceLink>
        <YStack height={16} width={1} backgroundColor={c.border} />
        <CommerceLink onPress={() => onRemove(item.id)}>Delete</CommerceLink>
      </XStack>

      {overStock ? (
        <Text fontSize={12} color={c.brand} paddingLeft={isDesktop ? imageSize + 40 : 0}>
          Only {maxQuantity} in stock — reduce quantity to check out.
        </Text>
      ) : lowStock ? (
        <Text fontSize={12} color={c.secondary} paddingLeft={isDesktop ? imageSize + 40 : 0}>
          Available: {maxQuantity} in stock
        </Text>
      ) : null}
    </YStack>
  )
}
