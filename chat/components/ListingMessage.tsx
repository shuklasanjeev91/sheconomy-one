import { useState } from 'react'
import { Platform } from 'react-native'

import { useCart } from '~/commerce/hooks/useCart'
import { useFavorites } from '~/commerce/hooks/useFavorites'
import { useChatListingLive, chatListingPayloadFromEnriched } from '~/chat/hooks/useChatListingLive'
import { useChatTheme } from '~/chat/lib/chat-theme'
import type { ChatListingPayload } from '~/chat/lib/types'
import {
  trackCommunityCommerceShare,
  trackCommunityPostPdpOpen,
  trackCommunityPostWishlistToggle,
} from '~/community/lib/community-commerce-analytics'
import { appendCommunityAttribution } from '~/community/lib/post-product-live'
import { ShareButton } from '~/components/share/ShareButton'
import { buildSignInUrl } from '~/lib/auth/redirect'
import { formatMoneyLabel } from '~/lib/format'
import { feedback } from '~/lib/platform/feedback'
import { navigateApp } from '~/lib/platform/navigate'
import { commerceRoutes } from '~/lib/routes'
import { getCommunityListingShareUrl } from '~/lib/share/urls'
import { useSupabase } from '~/providers/SupabaseProvider'
import { Button, Icons, Image, Spinner, Text, XStack, YStack, useAppToast } from '~/components/ui'

type ListingMessageProps = {
  listing: ChatListingPayload
  isOwn: boolean
}

function listingHref(listing: ChatListingPayload) {
  if (Platform.OS !== 'web' && listing.listingId) {
    return commerceRoutes.listing(listing.listingId)
  }
  if (listing.slug || listing.listingId) {
    return commerceRoutes.listing(listing.slug ?? listing.listingId)
  }
  return null
}

/** Compact product card shared inside a chat thread. */
export function ListingMessage({ listing, isOwn }: ListingMessageProps) {
  const chat = useChatTheme()
  const toast = useAppToast()
  const { addToCart } = useCart()
  const { user } = useSupabase()
  const { isFavorite, toggleFavorite } = useFavorites()
  const live = useChatListingLive(listing)
  const display = chatListingPayloadFromEnriched(listing, live)
  const [adding, setAdding] = useState(false)
  const [wishlistBusy, setWishlistBusy] = useState(false)
  const titleColor = isOwn ? chat.bubbleOutText : chat.bubbleInText
  const metaColor = isOwn ? chat.bubbleMetaOut : chat.bubbleMetaIn
  const unavailable = live.liveStatus === 'unavailable'
  const soldOut = live.soldOut && !unavailable
  const href = listingHref(display)
  const priceLabel =
    display.price != null ? formatMoneyLabel(display.price, display.currency ?? 'INR') : null
  const saved = display.listingId ? isFavorite(display.listingId) : false
  const shareUrl =
    href && display.listingId
      ? getCommunityListingShareUrl(String(href), undefined, 'chat')
      : null

  function openPdp() {
    if (!href) return
    const path = appendCommunityAttribution(String(href), undefined, { source: 'chat' })
    trackCommunityPostPdpOpen({
      listingId: display.listingId,
      source: 'chat',
      ref: 'community',
    })
    navigateApp(path as never)
  }

  async function handleAddToCart() {
    if (!display.listingId) return
    if (soldOut || unavailable) {
      toast.show(unavailable ? 'Listing unavailable' : 'Sold out', { tone: 'default' })
      return
    }
    if (!user) {
      navigateApp(buildSignInUrl(String(commerceRoutes.listing(display.slug ?? display.listingId))))
      return
    }
    setAdding(true)
    try {
      const { error } = await addToCart(display.listingId)
      if (error) {
        toast.show('Choose options on the product page', {
          tone: 'default',
          message: error,
        })
        openPdp()
        return
      }
      toast.show('Added to cart', { tone: 'success' })
      void feedback('success')
    } finally {
      setAdding(false)
    }
  }

  async function handleWishlistToggle() {
    if (!display.listingId) return
    if (!user) {
      navigateApp(buildSignInUrl(String(commerceRoutes.listing(display.slug ?? display.listingId))))
      return
    }
    setWishlistBusy(true)
    try {
      await toggleFavorite(display.listingId)
      void feedback('selection')
      trackCommunityPostWishlistToggle({
        listingId: display.listingId,
        source: 'chat',
        saved: !saved,
      })
    } finally {
      setWishlistBusy(false)
    }
  }

  return (
    <YStack gap={8} minWidth={220} maxWidth={280} paddingVertical={2}>
      {display.imageUrl ? (
        <YStack borderRadius={10} overflow="hidden">
          <Image src={display.imageUrl} width="100%" height={120} objectFit="cover" alt="" />
        </YStack>
      ) : null}
      <XStack gap={9} alignItems="center">
        <YStack
          width={40}
          height={40}
          borderRadius={10}
          alignItems="center"
          justifyContent="center"
          backgroundColor={chat.reactionBg}
        >
          <Icons.Package size={20} color={chat.brand} />
        </YStack>
        <YStack flex={1} minWidth={0} gap={2}>
          <Text fontSize={15} fontWeight="700" color={titleColor} numberOfLines={2}>
            {display.title}
          </Text>
          {unavailable ? (
            <Text fontSize={12} fontWeight="600" color={metaColor}>
              No longer available
            </Text>
          ) : soldOut ? (
            <Text fontSize={12} fontWeight="600" color={metaColor}>
              {live.soldOutVariantGated ? 'All options sold out' : 'Sold out'}
            </Text>
          ) : (
            <>
              <XStack gap={6} alignItems="center" flexWrap="wrap">
                {priceLabel ? (
                  <Text fontSize={13} fontWeight="700" color={chat.brand}>
                    {priceLabel}
                  </Text>
                ) : null}
                {live.priceDropped ? (
                  <Text fontSize={11} fontWeight="700" color="#059669">
                    Price dropped
                  </Text>
                ) : live.priceUpdated ? (
                  <Text fontSize={11} fontWeight="600" color={metaColor}>
                    Price updated
                  </Text>
                ) : null}
              </XStack>
              {display.shopName ? (
                <Text fontSize={12} color={metaColor} numberOfLines={1}>
                  {display.shopName}
                </Text>
              ) : null}
            </>
          )}
        </YStack>
        {!unavailable && display.listingId ? (
          <XStack gap={2}>
            {shareUrl ? (
              <ShareButton
                variant="icon"
                size="$2"
                label="Share product"
                sheetTitle="Share product"
                copyLabel="Copy product link"
                copyToastMessage="Product link copied."
                onOpen={() =>
                  trackCommunityCommerceShare({
                    surface: 'chat_listing',
                    listingId: display.listingId,
                  })
                }
                payload={{
                  url: shareUrl,
                  title: display.title,
                  text: display.shopName ? `${display.title} · ${display.shopName}` : display.title,
                }}
              />
            ) : null}
            <XStack
              width={30}
              height={30}
              borderRadius={999}
              alignItems="center"
              justifyContent="center"
              cursor={wishlistBusy ? 'default' : 'pointer'}
              onPress={() => void handleWishlistToggle()}
            >
              {wishlistBusy ? (
                <Spinner size="small" />
              ) : (
                <Icons.Heart size={15} color={saved ? chat.brand : metaColor} />
              )}
            </XStack>
          </XStack>
        ) : null}
      </XStack>
      <XStack gap={8}>
        {href && !unavailable ? (
          <Button size="$2" tone="outline" borderRadius={999} flex={1} onPress={openPdp}>
            View
          </Button>
        ) : null}
        {display.listingId && !unavailable && !soldOut ? (
          <Button
            size="$2"
            tone="primary"
            borderRadius={999}
            flex={1}
            disabled={adding}
            icon={
              adding ? (
                <Spinner size="small" color="white" />
              ) : (
                <Icons.ShoppingBag size={14} color="white" />
              )
            }
            onPress={() => void handleAddToCart()}
          >
            {adding ? 'Adding…' : 'Add to cart'}
          </Button>
        ) : null}
      </XStack>
    </YStack>
  )
}
