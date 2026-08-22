import { useEffect, useState } from 'react'

import { useCart } from '~/commerce/hooks/useCart'
import { useFavorites } from '~/commerce/hooks/useFavorites'
import { useShopFollow } from '~/commerce/hooks/useShopFollow'
import { createDirectConversation } from '~/chat/lib/chats'
import { ShareListingSheet } from '~/chat/components/ShareListingSheet'
import { postProductToChatListing } from '~/chat/lib/listing-message'
import { usePostProductsLive } from '~/community/hooks/usePostProductsLive'
import type { PostProduct } from '~/community/lib/community'
import {
  trackCommunityPostAddToCart,
  trackCommunityPostCheckoutStart,
  trackCommunityPostMessageSeller,
  trackCommunityPostPdpOpen,
  trackCommunityPostProductImpression,
  trackCommunityPostWishlistToggle,
  type CommunityCommerceSource,
} from '~/community/lib/community-commerce-analytics'
import { useCommunityUi } from '~/community/lib/community-theme'
import {
  buildCommunityListingHref,
  type EnrichedPostProduct,
} from '~/community/lib/post-product-live'
import { useVendorShops } from '~/hooks/useVendorShops'
import { buildSignInUrl } from '~/lib/auth/redirect'
import { formatMoneyLabel } from '~/lib/format'
import { feedback } from '~/lib/platform/feedback'
import { navigateApp } from '~/lib/platform/navigate'
import { commerceRoutes, communityRoutes, chatRoutes } from '~/lib/routes'
import { useSupabase } from '~/providers/SupabaseProvider'
import { Button, Icons, Image, ScrollView, Spinner, Text, XStack, YStack, useAppToast } from '~/components/ui'
import { radius } from '~/config/tokens'

function formatPostPrice(price: number | null, currency: string | null) {
  if (price == null) return 'Free'
  return formatMoneyLabel(price, currency ?? 'INR')
}

function formatRatingLine(averageRating: number | null, totalReviews: number | null) {
  if (averageRating == null || totalReviews == null || totalReviews <= 0) return null
  return `${averageRating.toFixed(1)} · ${totalReviews} ${totalReviews === 1 ? 'review' : 'reviews'}`
}

export function PostProductStack({
  products,
  postId,
  source = 'feed',
  layout = 'stack',
}: {
  products: PostProduct[]
  postId: string
  source?: CommunityCommerceSource
  layout?: 'stack' | 'carousel'
}) {
  const enriched = usePostProductsLive(products)
  const multi = enriched.length > 1

  if (layout === 'carousel' && enriched.length > 1) {
    return (
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <XStack gap={12} paddingVertical={4}>
          {enriched.map((product, index) => (
            <YStack key={product.listingId ?? product.slug ?? `${product.title}-${index}`} width={300} maxWidth="85vw">
              <PostProductCard
                product={product}
                postId={postId}
                source={source}
                multi={false}
              />
            </YStack>
          ))}
        </XStack>
      </ScrollView>
    )
  }

  return (
    <YStack gap={multi ? 6 : 10}>
      {enriched.map((product, index) => (
        <PostProductCard
          key={product.listingId ?? product.slug ?? `${product.title}-${index}`}
          product={product}
          postId={postId}
          source={source}
          multi={multi}
        />
      ))}
    </YStack>
  )
}

function PostProductCard({
  product,
  postId,
  source,
  multi = false,
}: {
  product: EnrichedPostProduct
  postId: string
  source: CommunityCommerceSource
  multi?: boolean
}) {
  const communityUi = useCommunityUi()
  const toast = useAppToast()
  const { addToCart } = useCart()
  const { user } = useSupabase()
  const { isFavorite, toggleFavorite } = useFavorites()
  const { shops } = useVendorShops()
  const shopFollow = useShopFollow(product.shopId)
  const [adding, setAdding] = useState(false)
  const [buying, setBuying] = useState(false)
  const [wishlistBusy, setWishlistBusy] = useState(false)
  const [messaging, setMessaging] = useState(false)
  const [shareOpen, setShareOpen] = useState(false)
  const imageSize = multi ? 72 : 112
  const listingHref =
    product.liveStatus === 'available' ? buildCommunityListingHref(product, postId) : null
  const signInReturnPath = String(communityRoutes.post(postId))
  const unavailable = product.liveStatus === 'unavailable'
  const soldOut = product.soldOut && !unavailable
  const ratingLine = formatRatingLine(product.averageRating, product.totalReviews)
  const saved = product.listingId ? isFavorite(product.listingId) : false
  const ownsShop =
    !!product.shopId && shops.some((shop) => shop.id === product.shopId)
  const canMessageSeller =
    !!product.shopOwnerUserId && user?.id !== product.shopOwnerUserId
  const chatListing = postProductToChatListing(product)
  const canShareToChat = !!chatListing && !unavailable

  useEffect(() => {
    trackCommunityPostProductImpression({
      postId,
      listingId: product.listingId,
      source,
    })
  }, [postId, product.listingId, source])

  function requireSignIn(fallbackHref?: string | null) {
    navigateApp(buildSignInUrl(fallbackHref ?? signInReturnPath))
  }

  function openPdp() {
    if (unavailable) {
      toast.show('Listing unavailable', { tone: 'default' })
      return
    }
    if (!listingHref) return
    trackCommunityPostPdpOpen({
      postId,
      listingId: product.listingId,
      source,
      ref: 'community',
    })
    navigateApp(listingHref as never)
  }

  async function handleWishlistToggle() {
    if (!product.listingId) return
    if (!user) {
      requireSignIn(signInReturnPath)
      return
    }
    setWishlistBusy(true)
    try {
      await toggleFavorite(product.listingId)
      void feedback('selection')
      trackCommunityPostWishlistToggle({
        postId,
        listingId: product.listingId,
        source,
        saved: !saved,
      })
    } finally {
      setWishlistBusy(false)
    }
  }

  async function handleMessageSeller() {
    if (!product.shopOwnerUserId) {
      toast.show('Messaging unavailable', { tone: 'default' })
      return
    }
    if (!user) {
      requireSignIn(signInReturnPath)
      return
    }
    setMessaging(true)
    try {
      const { conversationId, error } = await createDirectConversation(product.shopOwnerUserId)
      if (error || !conversationId) {
        toast.show('Could not open chat', { tone: 'danger', message: error ?? undefined })
        return
      }
      trackCommunityPostMessageSeller({
        postId,
        listingId: product.listingId,
        source,
      })
      void feedback('selection')
      navigateApp(chatRoutes.conversation(conversationId))
    } finally {
      setMessaging(false)
    }
  }

  function visitShop() {
    if (!product.shopSlug) return
    navigateApp(commerceRoutes.shop(product.shopSlug))
  }

  async function handleShopFollow() {
    if (!user) {
      requireSignIn(signInReturnPath)
      return
    }
    await shopFollow.toggleFollow()
    void feedback('selection')
  }

  async function handleCartAction(goToCheckout: boolean) {
    if (unavailable) {
      toast.show('Listing unavailable', { tone: 'default' })
      return
    }
    if (soldOut) {
      toast.show('Sold out', { tone: 'default' })
      return
    }
    if (!product.listingId) {
      toast.show('Listing unavailable', { tone: 'default' })
      return
    }
    if (!user) {
      requireSignIn(goToCheckout ? String(commerceRoutes.checkout) : signInReturnPath)
      return
    }
    const setBusy = goToCheckout ? setBuying : setAdding
    setBusy(true)
    try {
      const { error } = await addToCart(product.listingId)
      if (error) {
        toast.show(goToCheckout ? 'Choose options on the product page' : 'Could not add to cart', {
          tone: 'default',
          message: error,
        })
        if (listingHref) navigateApp(listingHref as never)
        return
      }
      toast.show('Added to cart', { tone: 'success' })
      void feedback('success')
      if (goToCheckout) {
        trackCommunityPostCheckoutStart({
          postId,
          listingId: product.listingId,
          source,
        })
        navigateApp(commerceRoutes.checkout)
      } else {
        trackCommunityPostAddToCart({
          postId,
          listingId: product.listingId,
          source,
        })
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <YStack
      borderRadius={radius.card}
      overflow="hidden"
      borderWidth={1}
      borderColor={communityUi.border}
      backgroundColor={unavailable ? communityUi.pageBg : communityUi.cardBg}
      opacity={unavailable ? 0.72 : 1}
    >
      <XStack
        cursor={listingHref || unavailable ? 'pointer' : 'default'}
        hoverStyle={listingHref ? { borderColor: communityUi.brand } : undefined}
        animation="quick"
        onPress={listingHref || unavailable ? openPdp : undefined}
        alignItems="center"
      >
        <YStack
          width={imageSize}
          height={imageSize}
          backgroundColor={communityUi.pageBg}
          alignItems="center"
          justifyContent="center"
          flexShrink={0}
        >
          {product.imageUrl ? (
            <Image
              src={product.imageUrl}
              width={imageSize}
              height={imageSize}
              objectFit="cover"
              alt=""
            />
          ) : (
            <Icons.Package size={multi ? 20 : 26} color={communityUi.textMuted} />
          )}
        </YStack>
        <YStack
          flex={1}
          padding={multi ? 8 : 12}
          gap={multi ? 2 : 4}
          justifyContent="center"
          minWidth={0}
        >
          {!multi ? (
            <Text fontSize={11} fontWeight="700" color={communityUi.textMuted} letterSpacing={0.4}>
              PRODUCT
            </Text>
          ) : null}
          <Text
            fontSize={multi ? 13 : 15}
            fontWeight="700"
            color={communityUi.text}
            numberOfLines={multi ? 1 : 2}
          >
            {product.title}
          </Text>
          {unavailable ? (
            <Text fontSize={12} fontWeight="600" color={communityUi.textMuted}>
              No longer available
            </Text>
          ) : soldOut ? (
            <Text fontSize={12} fontWeight="600" color={communityUi.textMuted}>
              {product.soldOutVariantGated ? 'All options sold out' : 'Sold out'}
            </Text>
          ) : (
            <>
              <XStack gap={8} alignItems="center" flexWrap="wrap">
                <Text fontSize={multi ? 13 : 14} fontWeight="700" color={communityUi.brand}>
                  {formatPostPrice(product.price, product.currency)}
                </Text>
                {product.priceUpdated ? (
                  <Text fontSize={11} fontWeight="600" color={communityUi.textMuted}>
                    Price updated
                  </Text>
                ) : null}
                {product.shopName ? (
                  <Text fontSize={11} color={communityUi.textMuted} numberOfLines={1} flexShrink={1}>
                    {product.shopName}
                  </Text>
                ) : null}
              </XStack>
              {ratingLine ? (
                <Text fontSize={11} color={communityUi.textMuted}>
                  {ratingLine}
                </Text>
              ) : null}
            </>
          )}
        </YStack>
        {!unavailable && !soldOut && product.listingId ? (
          <YStack paddingRight={multi ? 8 : 10} flexShrink={0}>
            <XStack
              width={32}
              height={32}
              borderRadius={999}
              alignItems="center"
              justifyContent="center"
              cursor={wishlistBusy ? 'default' : 'pointer'}
              hoverStyle={{ backgroundColor: communityUi.divider }}
              onPress={(e) => {
                e?.stopPropagation?.()
                void handleWishlistToggle()
              }}
            >
              {wishlistBusy ? (
                <Spinner size="small" />
              ) : (
                <Icons.Heart
                  size={16}
                  color={saved ? communityUi.brand : communityUi.textMuted}
                />
              )}
            </XStack>
          </YStack>
        ) : null}
      </XStack>

      {!unavailable &&
      (product.shopSlug ||
        (product.shopId && product.shopName && !ownsShop) ||
        canMessageSeller ||
        canShareToChat) ? (
        <XStack
          paddingHorizontal={10}
          paddingBottom={multi ? 4 : 0}
          gap={8}
          alignItems="center"
          flexWrap="wrap"
        >
          {product.shopSlug ? (
            <Button
              size="$2"
              tone="ghost"
              borderRadius={999}
              icon={<Icons.Store size={14} />}
              onPress={visitShop}
              accessibilityLabel={`Visit ${product.shopName ?? 'shop'}`}
            >
              Visit shop
            </Button>
          ) : null}
          {product.shopId && product.shopName && !ownsShop ? (
            <Button
              size="$2"
              tone="ghost"
              borderRadius={999}
              disabled={shopFollow.isToggling || shopFollow.isLoading}
              onPress={() => void handleShopFollow()}
              accessibilityLabel={
                shopFollow.isFollowing ? `Following ${product.shopName}` : `Follow ${product.shopName}`
              }
            >
              {shopFollow.isFollowing ? 'Following' : `Follow ${product.shopName}`}
            </Button>
          ) : null}
          {canMessageSeller ? (
            <Button
              size="$2"
              tone="outline"
              borderRadius={999}
              disabled={messaging}
              icon={
                messaging ? (
                  <Spinner size="small" />
                ) : (
                  <Icons.MessageCircle size={14} color={communityUi.text} />
                )
              }
              onPress={() => void handleMessageSeller()}
              accessibilityLabel="Message seller"
            >
              Message
            </Button>
          ) : null}
          {canShareToChat ? (
            <Button
              size="$2"
              tone="ghost"
              borderRadius={999}
              icon={<Icons.Send size={14} />}
              onPress={() => {
                if (!user) {
                  requireSignIn(signInReturnPath)
                  return
                }
                setShareOpen(true)
              }}
              accessibilityLabel="Share product to chat"
            >
              Share
            </Button>
          ) : null}
        </XStack>
      ) : null}

      <ShareListingSheet
        open={shareOpen}
        onOpenChange={setShareOpen}
        currentUserId={user?.id ?? null}
        listing={chatListing}
        postId={postId}
        source={source}
      />

      {!unavailable && !soldOut && product.listingId ? (
        multi ? (
          <YStack padding={8} paddingTop={4} gap="$2">
            <Button
              size="$2"
              tone="outline"
              borderRadius={999}
              width="100%"
              disabled={adding || buying}
              icon={
                adding ? (
                  <Spinner size="small" />
                ) : (
                  <Icons.ShoppingBag size={14} color={communityUi.text} />
                )
              }
              onPress={() => void handleCartAction(false)}
              accessibilityLabel="Add to cart"
            >
              {adding ? 'Adding…' : 'Add to cart'}
            </Button>
            <Button
              size="$2"
              tone="primary"
              borderRadius={999}
              width="100%"
              disabled={adding || buying}
              icon={
                buying ? (
                  <Spinner size="small" color="white" />
                ) : (
                  <Icons.Zap size={14} color="white" />
                )
              }
              onPress={() => void handleCartAction(true)}
              accessibilityLabel="Buy now"
            >
              {buying ? 'Loading…' : 'Buy now'}
            </Button>
          </YStack>
        ) : (
          <XStack padding={10} paddingTop={0} gap="$2">
            <Button
              size="$2"
              tone="outline"
              borderRadius={999}
              flex={1}
              disabled={adding || buying}
              icon={
                adding ? (
                  <Spinner size="small" />
                ) : (
                  <Icons.ShoppingBag size={14} color={communityUi.text} />
                )
              }
              onPress={() => void handleCartAction(false)}
              accessibilityLabel="Add to cart"
            >
              {adding ? 'Adding…' : 'Add to cart'}
            </Button>
            <Button
              size="$2"
              tone="primary"
              borderRadius={999}
              flex={1}
              disabled={adding || buying}
              icon={
                buying ? (
                  <Spinner size="small" color="white" />
                ) : (
                  <Icons.Zap size={14} color="white" />
                )
              }
              onPress={() => void handleCartAction(true)}
              accessibilityLabel="Buy now"
            >
              {buying ? 'Loading…' : 'Buy now'}
            </Button>
          </XStack>
        )
      ) : null}
    </YStack>
  )
}
