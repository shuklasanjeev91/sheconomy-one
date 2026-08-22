import { useState } from 'react'
import { Platform } from 'react-native'

import { useCart } from '~/commerce/hooks/useCart'
import { useChatTheme } from '~/chat/lib/chat-theme'
import type { ChatListingPayload } from '~/chat/lib/types'
import { buildSignInUrl } from '~/lib/auth/redirect'
import { formatMoneyLabel } from '~/lib/format'
import { feedback } from '~/lib/platform/feedback'
import { navigateApp } from '~/lib/platform/navigate'
import { commerceRoutes } from '~/lib/routes'
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
  const [adding, setAdding] = useState(false)
  const titleColor = isOwn ? chat.bubbleOutText : chat.bubbleInText
  const metaColor = isOwn ? chat.bubbleMetaOut : chat.bubbleMetaIn
  const href = listingHref(listing)
  const priceLabel =
    listing.price != null ? formatMoneyLabel(listing.price, listing.currency ?? 'INR') : null

  async function handleAddToCart() {
    if (!listing.listingId) return
    if (!user) {
      navigateApp(buildSignInUrl(String(commerceRoutes.listing(listing.slug ?? listing.listingId))))
      return
    }
    setAdding(true)
    try {
      const { error } = await addToCart(listing.listingId)
      if (error) {
        toast.show('Choose options on the product page', {
          tone: 'default',
          message: error,
        })
        if (href) navigateApp(href)
        return
      }
      toast.show('Added to cart', { tone: 'success' })
      void feedback('success')
    } finally {
      setAdding(false)
    }
  }

  return (
    <YStack gap={8} minWidth={220} maxWidth={280} paddingVertical={2}>
      {listing.imageUrl ? (
        <YStack borderRadius={10} overflow="hidden">
          <Image src={listing.imageUrl} width="100%" height={120} objectFit="cover" alt="" />
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
            {listing.title}
          </Text>
          {priceLabel ? (
            <Text fontSize={13} fontWeight="700" color={chat.brand}>
              {priceLabel}
            </Text>
          ) : null}
          {listing.shopName ? (
            <Text fontSize={12} color={metaColor} numberOfLines={1}>
              {listing.shopName}
            </Text>
          ) : null}
        </YStack>
      </XStack>
      <XStack gap={8}>
        {href ? (
          <Button
            size="$2"
            tone="outline"
            borderRadius={999}
            flex={1}
            onPress={() => navigateApp(href)}
          >
            View
          </Button>
        ) : null}
        {listing.listingId ? (
          <Button
            size="$2"
            tone="primary"
            borderRadius={999}
            flex={1}
            disabled={adding}
            icon={adding ? <Spinner size="small" color="white" /> : <Icons.ShoppingBag size={14} color="white" />}
            onPress={() => void handleAddToCart()}
          >
            {adding ? 'Adding…' : 'Add to cart'}
          </Button>
        ) : null}
      </XStack>
    </YStack>
  )
}
