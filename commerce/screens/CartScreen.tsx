import { AppLink } from '~/components/navigation/AppLink'
import { useCallback, useEffect, useMemo, useState } from 'react'
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
  CommerceCheckbox,
  CommerceLink,
  CommerceMobileCheckoutBar,
  COMMERCE_MOBILE_CHECKOUT_BAR_HEIGHT,
  CartRecoveryNudge,
  CartShopOffers,
  CartFreeShippingBar,
  MarketplaceCard,
  MarketplacePage,
  MarketplacePageTitle,
  MarketplacePrimaryButton,
  MarketplaceShopHeader,
  MarketplaceSummaryCard,
  MarketplaceTrustNote,
  ListingQuantityStepper,
  ListingRecommendationsSections,
  RecentlyViewedRail,
  ShipsToYouWidget,
  ShopPartnerChips,
  ShopRatingBadge,
  StockNotifyButton,
  useCommercePalette,
} from '~/commerce/components'
import { groupCartItemsBySeller } from '~/commerce/lib/cart-sellers'
import { QA } from '~/lib/qa/test-ids'
import {
  computeSelectedTotals,
  setCartItemsSelected,
  toggleCartItemSelected,
  useCartSelection,
} from '~/commerce/lib/cart-selection'
import type { CartItemRow } from '~/commerce/lib/cart'
import { deliveryEstimateLabel } from '~/commerce/lib/delivery-estimate'
import { useFavorites } from '~/commerce/hooks/useFavorites'
import { markWishlistItemSavedFromCart } from '~/commerce/lib/wishlist-reactivation'
import { fetchListingStockByIds } from '~/commerce/lib/listing-fulfillment'
import { fetchListingSlugMap, fetchListingTypesByIds, isDigitalListing } from '~/lib/supabase/commerce'
import {
  computeCartDisplayTotals,
  computeShopDisplaySubtotal,
  convertCartLineTotal,
  shopCurrencyFor,
} from '~/commerce/lib/checkout-display-pricing'
import { useFormatCurrency } from '~/hooks/useFormatCurrency'
import { copyToClipboard } from '~/lib/platform/clipboard'
import { commerceRoutes } from '~/lib/routes'
import { useAppLayout } from '~/hooks/useAppLayout'
import { navigateApp } from '~/lib/platform/navigate'
import { buildSignInUrl } from '~/lib/auth/redirect'
import { useSupabase } from '~/providers/SupabaseProvider'

const SUMMARY_WIDTH = 340

export function CartScreen() {
  const c = useCommercePalette()
  const { hasSideRails, mobileTabBarOffset } = useAppLayout()
  const { user } = useSupabase()
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
  const { formatMoney, convertMoney, preferredCurrency } = useFormatCurrency()
  const [checkoutBarHeight, setCheckoutBarHeight] = useState(COMMERCE_MOBILE_CHECKOUT_BAR_HEIGHT)
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

  const sellerGroups = useMemo(() => groupCartItemsBySeller(items), [items])

  const shopIds = useMemo(
    () => sellerGroups.map((group) => group.seller_id),
    [sellerGroups],
  )
  const { partners: shopPartners } = useShopPartners(shopIds)
  const shopHeaders = useShopHeaders(shopIds)

  const availableIds = useMemo(() => items.map((item) => item.id), [items])
  const { isSelected, allSelected, noneSelected } = useCartSelection(availableIds)

  function goToCheckout() {
    // Keep guest cart (session id) and return to checkout after auth.
    navigateApp(
      user ? commerceRoutes.checkout : buildSignInUrl(String(commerceRoutes.checkout)),
    )
  }

  const settlementCurrency = cart?.currency ?? 'INR'
  const shopCurrencies = useMemo(() => {
    const map = new Map<string, string>()
    for (const [shopId, header] of shopHeaders) {
      map.set(shopId, header.shopCurrency)
    }
    return map
  }, [shopHeaders])

  const selectedItems = useMemo(
    () => items.filter((item) => isSelected(item.id)),
    [items, isSelected],
  )

  const { subtotal, unitCount, discount, total } = computeSelectedTotals(cart, items, isSelected)

  const displayTotals = useMemo(
    () =>
      computeCartDisplayTotals({
        selectedItems,
        subtotal,
        discount,
        shopCurrencies,
        convertMoney,
        settlementCurrency,
      }),
    [convertMoney, discount, selectedItems, settlementCurrency, shopCurrencies, subtotal],
  )

  const formatCartMoney = useCallback(
    (amount: number, shopId?: string) =>
      formatMoney(
        amount,
        shopId
          ? shopCurrencyFor(shopId, shopCurrencies, settlementCurrency)
          : preferredCurrency,
        shopId ? undefined : { convert: false },
      ),
    [formatMoney, preferredCurrency, settlementCurrency, shopCurrencies],
  )

  const showSettlementCurrencyNote = preferredCurrency !== settlementCurrency
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
      return (
        sum +
        convertCartLineTotal(item, shopCurrencies, convertMoney, settlementCurrency)
      )
    }, 0)
  }, [convertMoney, items, isSelected, listingTypes, settlementCurrency, shopCurrencies])

  const selectedHasStockIssue = useMemo(() => {
    return items.some((item) => {
      if (!isSelected(item.id)) return false
      const stock = listingStock.get(item.listing_id)
      if (typeof stock !== 'number') return false
      return stock <= 0 || item.quantity > stock
    })
  }, [items, isSelected, listingStock])

  const checkoutBlocked = noneSelected || selectedHasStockIssue

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
      return `• ${item.title}${variant} × ${item.quantity} — ${formatCartMoney(
        item.unit_price * item.quantity,
        item.shop_id,
      )}`
    })
    const message = [
      `Cart on ${BRAND_NAME}`,
      `${selected.length} item${selected.length === 1 ? '' : 's'}`,
      '',
      ...lines,
      '',
      `Total: ${formatCartMoney(displayTotals.total)}`,
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
    await markWishlistItemSavedFromCart(listingId)
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

  const showMobileBar = !hasSideRails && items.length > 0

  const subtotalLine = (
    <Text fontSize={18} color={c.text}>
      Subtotal ({unitCount} {unitCount === 1 ? 'item' : 'items'}):{' '}
      <Text fontSize={18} fontWeight="700" color={c.priceStrong}>
        {formatCartMoney(displayTotals.itemsSubtotal)}
      </Text>
    </Text>
  )

  const discountBlock =
    displayTotals.promotion > 0 ? (
      <YStack gap="$2" width="100%">
        <XStack justifyContent="space-between">
          <Text fontSize={13} color={c.secondary}>
            Promotion{cart?.applied_discount_name ? ` (${cart.applied_discount_name})` : ''}
          </Text>
          <Text fontSize={13} color={c.inStock}>
            −{formatCartMoney(displayTotals.promotion)}
          </Text>
        </XStack>
        {displayTotals.itemsSubtotal > 0 ? (
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
              You&apos;re saving {formatCartMoney(displayTotals.promotion)} (
              {Math.round(
                (displayTotals.promotion /
                  (displayTotals.itemsSubtotal + displayTotals.promotion)) *
                  100,
              )}
              %)
            </Text>
          </XStack>
        ) : null}
      </YStack>
    ) : null

  const settlementCurrencyNote = showSettlementCurrencyNote ? (
    <Text fontSize={11} color={c.secondary} lineHeight={15} textAlign="center">
      Prices shown in {preferredCurrency}. You will be charged in {settlementCurrency} at checkout.
    </Text>
  ) : null

  /** Desktop sticky summary — full CTA lives here. */
  const desktopBuyBox = (
    <MarketplaceSummaryCard title="Order summary">
      {!noneSelected ? (
        <CartFreeShippingBar
          shippableSubtotal={shippableSubtotal}
          shopIds={shopIds}
          currency={preferredCurrency}
        />
      ) : null}
      <CartRecoveryNudge itemCount={unitCount} />
      {subtotalLine}
      {discountBlock}
      <CartCoupon />
      {selectedHasStockIssue ? (
        <Text fontSize={12} color={c.brand} lineHeight={18}>
          Update out-of-stock items or reduce quantities before checkout.
        </Text>
      ) : null}
      <MarketplacePrimaryButton disabled={checkoutBlocked} onPress={goToCheckout}>
        Proceed to checkout ({unitCount})
      </MarketplacePrimaryButton>
      {settlementCurrencyNote}
      <MarketplaceTrustNote>
        SHEconomy Purchase Protection included on every order.
      </MarketplaceTrustNote>
    </MarketplaceSummaryCard>
  )

  /**
   * Mobile summary — no primary CTA (sticky bar owns checkout).
   * Kept after the items panel so rails never collide with cart lines.
   */
  const mobileSummary = (
    <MarketplaceSummaryCard title="Order summary">
      {!noneSelected ? (
        <CartFreeShippingBar
          shippableSubtotal={shippableSubtotal}
          shopIds={shopIds}
          currency={preferredCurrency}
        />
      ) : null}
      <CartRecoveryNudge itemCount={unitCount} compact />
      {subtotalLine}
      {discountBlock}
      <CartCoupon />
      {selectedHasStockIssue ? (
        <Text fontSize={12} color={c.brand} lineHeight={18}>
          Update out-of-stock items or reduce quantities before checkout.
        </Text>
      ) : null}
      {settlementCurrencyNote}
      <MarketplaceTrustNote>
        SHEconomy Purchase Protection included on every order.
      </MarketplaceTrustNote>
    </MarketplaceSummaryCard>
  )

  const cartItemsPanel = (
    <YStack gap="$4" width="100%" position="relative" zIndex={1}>
      <YStack gap="$3" width="100%">
        <MarketplacePageTitle
          title="Cart"
          subtitle={`${unitCount} ${unitCount === 1 ? 'item' : 'items'} selected`}
          hasSideRails={hasSideRails}
        />
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
        <ShipsToYouWidget compact />
      </YStack>

      {sellerGroups.map((group) => {
        const shopId = group.seller_id
        const shopItems = group.items
        const shopSelectedItems = shopItems.filter((item) => isSelected(item.id))
        const shopSelectedSubtotal = shopSelectedItems.reduce(
          (sum, item) => sum + item.unit_price * item.quantity,
          0,
        )
        const shopDisplaySubtotal = computeShopDisplaySubtotal(
          shopSelectedItems,
          shopCurrencies,
          convertMoney,
          settlementCurrency,
        )
        const shopCurrency = shopCurrencyFor(shopId, shopCurrencies, settlementCurrency)
        return (
          <MarketplaceCard
            key={group.seller_id}
            hasSideRails={hasSideRails}
            gap="$3"
          >
            <YStack gap="$2.5" testID={`cart-seller-group-${group.seller_id}`} width="100%">
              <MarketplaceShopHeader shopName={group.shop_name} deliveryLabel="FREE delivery" />
              <ShopRatingBadge info={shopHeaders.get(shopId)} />
              <Text fontSize={12} color={c.secondary}>
                {deliveryEstimateLabel()}
              </Text>
              <ShopPartnerChips info={shopPartners.get(shopId)} />

              {shopItems.map((item) => {
                const stock = listingStock.get(item.listing_id)
                const outOfStock = typeof stock === 'number' && stock <= 0
                return (
                  <CartRow
                    key={item.id}
                    item={item}
                    selected={isSelected(item.id)}
                    listingHref={listingHref(item.listing_id)}
                    listingType={listingTypes.get(item.listing_id)}
                    maxQuantity={stock ?? null}
                    outOfStock={outOfStock}
                    formatPrice={(amount) => formatCartMoney(amount, item.shop_id)}
                    hasSideRails={hasSideRails}
                    onToggle={() => toggleCartItemSelected(item.id)}
                    onQuantityChange={handleQuantityChange}
                    onRemove={handleRemove}
                    onSaveForLater={handleSaveForLater}
                  />
                )
              })}

              <CartShopOffers
                shopId={shopId}
                shopName={group.shop_name}
                subtotal={shopSelectedSubtotal}
                currency={shopCurrency}
                items={shopSelectedItems.map((item) => ({
                  shop_id: item.shop_id,
                  listing_id: item.listing_id,
                  total_price: item.total_price,
                }))}
              />

              {sellerGroups.length > 1 ? (
                <XStack justifyContent="flex-end" paddingTop="$1">
                  <Text fontSize={13} color={c.secondary}>
                    Subtotal ({group.shop_name}):{' '}
                    <Text fontWeight="700" color={c.text}>
                      {formatCartMoney(shopDisplaySubtotal)}
                    </Text>
                  </Text>
                </XStack>
              ) : null}
            </YStack>
          </MarketplaceCard>
        )
      })}

      {hasSideRails ? (
        <XStack justifyContent="flex-end" paddingTop="$1">
          {subtotalLine}
        </XStack>
      ) : null}
    </YStack>
  )

  const savedForLaterShelf =
    savedItems.length > 0 ? (
      <MarketplaceCard hasSideRails={hasSideRails} gap="$3">
        <YStack gap="$1">
          <Text fontSize={hasSideRails ? 22 : 20} fontWeight="800" color={c.text} letterSpacing={-0.3}>
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
              formatPrice={(amount) => formatCartMoney(amount, item.shop_id)}
              hasSideRails={hasSideRails}
              outOfStock={outOfStock}
              onMoveToCart={() => void handleMoveToCart(item.id)}
              onDelete={() => void handleRemove(item.id)}
              onMoveToWishlist={() => void handleMoveSavedToWishlist(item.id, item.listing_id)}
            />
          )
        })}
      </MarketplaceCard>
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
        <ListingRecommendationsSections listingId={recommendationSeedId} sponsoredEnabled={false} />
      ) : null}
    </YStack>
  )

  const layout = (
    <FullWidthLayout scroll>
      <PageSection paddingVertical="$5" {...LAYOUT_STRETCH}>
        <MarketplacePage
          hasSideRails={hasSideRails}
          paddingBottom={showMobileBar ? checkoutBarHeight + mobileTabBarOffset + 24 : undefined}
        >
          {items.length === 0 ? (
            <YStack gap="$4" width="100%">
              <MarketplacePageTitle title="Cart" hasSideRails={hasSideRails} />
              <MarketplaceCard hasSideRails={hasSideRails} padding="$8">
                <YStack alignItems="center" gap="$4" width="100%">
                  <Icons.ShoppingCart size={48} color={c.brand} />
                  <Text fontSize={22} fontWeight="800" color={c.text} textAlign="center">
                    {savedItems.length > 0
                      ? 'No items ready for checkout'
                      : 'Your cart is empty'}
                  </Text>
                  <Text fontSize={14} color={c.secondary} textAlign="center" maxWidth={420}>
                    {savedItems.length > 0
                      ? 'Move items from Saved for later into your cart when you’re ready.'
                      : `Discover unique finds from ${BRAND_NAME} makers and shops.`}
                  </Text>
                  <YStack width={hasSideRails ? 280 : '100%'}>
                    <MarketplacePrimaryButton onPress={() => navigateApp(commerceRoutes.home)}>
                      Discover today&apos;s finds
                    </MarketplacePrimaryButton>
                  </YStack>
                  {savedItems.length > 0 ? (
                    <CommerceLink onPress={() => navigateApp(commerceRoutes.wishlist)}>
                      Open wishlist
                    </CommerceLink>
                  ) : null}
                </YStack>
              </MarketplaceCard>
              {savedForLaterShelf}
              {discoveryRails}
            </YStack>
          ) : hasSideRails ? (
            <YStack gap="$8" width="100%">
              <XStack
                width="100%"
                maxWidth="100%"
                alignSelf="stretch"
                flexDirection="row"
                alignItems="flex-start"
                gap="$5"
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
        </MarketplacePage>
      </PageSection>
    </FullWidthLayout>
  )

  if (!showMobileBar) return layout

  return (
    <YStack flex={1} width="100%" position="relative">
      {layout}
      <CommerceMobileCheckoutBar
        total={total}
        currency={settlementCurrency}
        formattedTotal={formatCartMoney(displayTotals.total)}
        formattedSavings={
          displayTotals.promotion > 0 ? formatCartMoney(displayTotals.promotion) : null
        }
        caption={`Subtotal · ${unitCount} ${unitCount === 1 ? 'item' : 'items'}`}
        savings={discount || null}
        label="Proceed to checkout"
        disabled={checkoutBlocked}
        onPress={goToCheckout}
        onHeightChange={setCheckoutBarHeight}
      />
    </YStack>
  )
}

function SavedForLaterRow({
  item,
  listingHref,
  formatPrice,
  hasSideRails,
  outOfStock,
  onMoveToCart,
  onDelete,
  onMoveToWishlist,
}: {
  item: CartItemRow
  listingHref: string
  formatPrice: (amount: number) => string
  hasSideRails: boolean
  outOfStock: boolean
  onMoveToCart: () => void
  onDelete: () => void
  onMoveToWishlist: () => void
}) {
  const c = useCommercePalette()
  const imageSize = hasSideRails ? 96 : 80
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
              fontSize={hasSideRails ? 16 : 14}
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
            {formatPrice(lineTotal)}
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
  outOfStock,
  formatPrice,
  hasSideRails,
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
  outOfStock: boolean
  formatPrice: (amount: number) => string
  hasSideRails: boolean
  onToggle: () => void
  onQuantityChange: (itemId: string, nextQuantity: number) => void
  onRemove: (itemId: string) => void
  onSaveForLater: (itemId: string) => void
}) {
  const c = useCommercePalette()
  const imageSize = hasSideRails ? 120 : 90
  const atMax = typeof maxQuantity === 'number' && item.quantity >= maxQuantity
  const overStock = typeof maxQuantity === 'number' && item.quantity > maxQuantity
  const lowStock =
    !outOfStock && typeof maxQuantity === 'number' && maxQuantity > 0 && maxQuantity <= 5

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
              fontSize={hasSideRails ? 18 : 15}
              fontWeight="600"
              color={c.link}
              numberOfLines={2}
              cursor="pointer"
              hoverStyle={{ color: c.linkHover }}
            >
              {item.title}
            </Text>
          </AppLink>

          <Text
            fontSize={12}
            color={outOfStock ? '#b45309' : c.inStock}
            fontWeight="600"
          >
            {outOfStock
              ? 'Out of stock'
              : listingType && isDigitalListing(listingType)
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

          {!hasSideRails ? (
            <YStack gap={2} paddingTop={2}>
              <Text fontSize={17} fontWeight="800" color={c.priceStrong} letterSpacing={-0.3}>
                {formatPrice(lineTotal)}
              </Text>
              {item.quantity > 1 ? (
                <Text fontSize={11} color={c.secondary}>
                  {formatPrice(item.unit_price)} each
                </Text>
              ) : null}
            </YStack>
          ) : null}
        </YStack>

        {hasSideRails ? (
          <YStack alignItems="flex-end" flexShrink={0} gap={2}>
            <Text fontSize={18} fontWeight="800" color={c.priceStrong}>
              {formatPrice(lineTotal)}
            </Text>
            {item.quantity > 1 ? (
              <Text fontSize={12} color={c.secondary}>
                {formatPrice(item.unit_price)} each
              </Text>
            ) : null}
          </YStack>
        ) : null}
      </XStack>

      <XStack
        gap="$3"
        alignItems="center"
        flexWrap="wrap"
        paddingLeft={hasSideRails ? imageSize + 40 : 0}
      >
        <ListingQuantityStepper
          size="sm"
          quantity={item.quantity}
          maxQuantity={outOfStock ? 0 : maxQuantity}
          onDecrease={() =>
            item.quantity <= 1 ? onRemove(item.id) : onQuantityChange(item.id, item.quantity - 1)
          }
          onIncrease={() => {
            if (outOfStock || atMax) return
            onQuantityChange(item.id, item.quantity + 1)
          }}
        />

        <YStack height={16} width={1} backgroundColor={c.border} />
        <CommerceLink onPress={() => onSaveForLater(item.id)}>
          Save for later
        </CommerceLink>
        <YStack height={16} width={1} backgroundColor={c.border} />
        <CommerceLink testID={QA.cartItemDelete} accessibilityLabel="Delete cart item" onPress={() => onRemove(item.id)}>
          Delete
        </CommerceLink>
      </XStack>

      {overStock ? (
        <Text fontSize={12} color={c.brand} paddingLeft={hasSideRails ? imageSize + 40 : 0}>
          Only {maxQuantity} in stock — reduce quantity to check out.
        </Text>
      ) : outOfStock ? (
        <YStack gap="$2" paddingLeft={hasSideRails ? imageSize + 40 : 0}>
          <Text fontSize={12} color="#b45309" fontWeight="600">
            Currently out of stock — remove this item or save it for later.
          </Text>
          <StockNotifyButton listingId={item.listing_id} outOfStock />
        </YStack>
      ) : lowStock ? (
        <Text fontSize={12} color={c.secondary} paddingLeft={hasSideRails ? imageSize + 40 : 0}>
          Available: {maxQuantity} in stock
        </Text>
      ) : null}
    </YStack>
  )
}
