import { useState } from 'react'

import { useCart } from '~/commerce/hooks/useCart'
import { findCartItemForListing } from '~/commerce/lib/cart-listing'
import type { CommunitySuggestion } from '~/community/lib/community-personalization'
import { AppLink } from '~/components/navigation/AppLink'
import { useCommunityUi } from '~/community/lib/community-theme'
import { buildSignInUrl } from '~/lib/auth/redirect'
import { navigateApp } from '~/lib/platform/navigate'
import { formatMoneyLabel } from '~/lib/format'
import { commerceRoutes } from '~/lib/routes'
import { useSupabase } from '~/providers/SupabaseProvider'
import { Button, Icons, Image, Spinner, Text, XStack, YStack, useAppToast } from '~/components/ui'
import { radius } from '~/config/tokens'

export function CommunityProductSuggestionRow({
  item,
  compact = false,
}: {
  item: CommunitySuggestion
  compact?: boolean
}) {
  const communityUi = useCommunityUi()
  const toast = useAppToast()
  const { addToCart, items } = useCart()
  const { user } = useSupabase()
  const [adding, setAdding] = useState(false)
  const [buying, setBuying] = useState(false)

  const meta = item.listingMeta
  const slug = meta?.slug ?? item.id
  const listingHref = commerceRoutes.listing(slug)
  // Suggestions add without a variant selection, so match the default cart line.
  // `addToCart` inserts optimistically, so this flips as soon as the add resolves
  // and clears again if the line is removed from the cart screen.
  const inCart = Boolean(findCartItemForListing(items, item.id, null))
  const priceLabel =
    meta?.price != null && !Number.isNaN(meta.price)
      ? formatMoneyLabel(meta.price, meta?.currency ?? 'INR')
      : ''
  const imageSize = compact ? 72 : 96

  function goToCheckout() {
    if (!user) {
      navigateApp(buildSignInUrl(String(commerceRoutes.checkout)))
      return
    }
    navigateApp(commerceRoutes.checkout)
  }

  async function runCartAction(checkoutAfterAdd: boolean) {
    const setBusy = checkoutAfterAdd ? setBuying : setAdding
    setBusy(true)
    try {
      const { error } = await addToCart(item.id)
      if (error) {
        toast.show(checkoutAfterAdd ? 'Choose options on the product page' : 'Could not add to cart', {
          tone: 'default',
          message: error,
        })
        navigateApp(listingHref)
        return
      }
      toast.show('Added to cart', { tone: 'success' })
      if (checkoutAfterAdd) goToCheckout()
    } finally {
      setBusy(false)
    }
  }

  // Sidebar rail stacks the actions; the wider in-feed card sits them side by side.
  const fill = compact ? ({ width: '100%' } as const) : ({ flex: 1 } as const)

  const cartButton = inCart ? (
    <Button
      size="$2"
      tone="outline"
      borderRadius={999}
      {...fill}
      icon={<Icons.Check size={14} color={communityUi.brand} />}
      onPress={() => navigateApp(commerceRoutes.cart)}
    >
      In cart
    </Button>
  ) : (
    <Button
      size="$2"
      tone="outline"
      borderRadius={999}
      {...fill}
      disabled={adding || buying}
      icon={
        adding ? <Spinner size="small" /> : <Icons.ShoppingBag size={14} color={communityUi.text} />
      }
      onPress={() => void runCartAction(false)}
    >
      {adding ? 'Adding…' : 'Add to cart'}
    </Button>
  )

  const payButton = inCart ? (
    <Button
      size="$2"
      tone="primary"
      borderRadius={999}
      {...fill}
      icon={<Icons.CreditCard size={14} color="white" />}
      onPress={goToCheckout}
    >
      Checkout
    </Button>
  ) : (
    <Button
      size="$2"
      tone="primary"
      borderRadius={999}
      {...fill}
      disabled={adding || buying}
      icon={
        buying ? <Spinner size="small" color="white" /> : <Icons.Zap size={14} color="white" />
      }
      onPress={() => void runCartAction(true)}
    >
      {buying ? 'Loading…' : 'Buy now'}
    </Button>
  )

  return (
    <YStack
      width="100%"
      borderRadius={radius.card}
      overflow="hidden"
      borderWidth={1}
      borderColor={communityUi.border}
      backgroundColor={communityUi.cardBg}
      marginBottom={10}
    >
      <AppLink href={listingHref as never} asChild>
        <XStack
          cursor="pointer"
          hoverStyle={{ opacity: 0.96 }}
          pressStyle={{ opacity: 0.92 }}
        >
          <YStack
            width={imageSize}
            height={imageSize}
            backgroundColor={communityUi.pageBg}
            alignItems="center"
            justifyContent="center"
            flexShrink={0}
          >
            {item.imageUrl ? (
              <Image
                src={item.imageUrl}
                width={imageSize}
                height={imageSize}
                objectFit="cover"
                alt=""
              />
            ) : (
              <Icons.Package size={compact ? 20 : 24} color={communityUi.textMuted} />
            )}
          </YStack>
          <YStack flex={1} padding={compact ? 8 : 10} gap={3} justifyContent="center" minWidth={0}>
            <Text fontSize={14} fontWeight="700" color={communityUi.text} numberOfLines={2}>
              {item.title}
            </Text>
            {priceLabel ? (
              <Text fontSize={14} fontWeight="700" color={communityUi.brand}>
                {priceLabel}
              </Text>
            ) : null}
            {meta?.shopName ? (
              <Text fontSize={12} color={communityUi.textMuted} numberOfLines={1}>
                {meta.shopName}
              </Text>
            ) : null}
            {item.reason ? (
              <Text fontSize={11} fontWeight="600" color={communityUi.brand} numberOfLines={1}>
                {item.reason}
              </Text>
            ) : null}
          </YStack>
        </XStack>
      </AppLink>

      {compact ? (
        <YStack padding={8} paddingTop={0} gap="$2">
          {cartButton}
          {payButton}
        </YStack>
      ) : (
        <XStack padding={10} paddingTop={0} gap="$2">
          {cartButton}
          {payButton}
        </XStack>
      )}
    </YStack>
  )
}
