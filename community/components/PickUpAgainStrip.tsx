import { useState } from 'react'

import { AppLink } from '~/components/navigation/AppLink'
import { useCart } from '~/commerce/hooks/useCart'

import { CommunityCard } from '~/community/components/CommunityCard'
import { useSavedPostRevisit } from '~/community/hooks/useSavedPostRevisit'
import { useCommunityUi } from '~/community/lib/community-theme'
import type { PickUpAgainCard } from '~/community/lib/saved-posts'
import { HorizontalScrollRow } from '~/components/layout'
import { Button, Icons, Image, Spinner, Text, XStack, YStack, useAppToast } from '~/components/ui'
import { commerceRoutes, communityRoutes } from '~/lib/routes'
import { navigateApp } from '~/lib/platform/navigate'

export function PickUpAgainStrip() {
  const communityUi = useCommunityUi()
  const { cards, loading, hasCards } = useSavedPostRevisit()

  if (!loading && !hasCards) return null

  return (
    <CommunityCard padding={16} gap={12}>
      <XStack alignItems="center" justifyContent="space-between" gap={8}>
        <YStack flex={1} minWidth={0} gap={2}>
          <Text fontSize={16} fontWeight="700" color={communityUi.text}>
            Pick up again
          </Text>
          <Text fontSize={13} color={communityUi.textMuted}>
            Saved posts worth another look — products, articles, and events you bookmarked.
          </Text>
        </YStack>
        {loading ? <Spinner size="small" /> : null}
        {hasCards ? (
          <AppLink href={communityRoutes.saved} asChild>
            <Button tone="ghost" size="$2" borderRadius={999}>
              View all
            </Button>
          </AppLink>
        ) : null}
      </XStack>

      {hasCards ? (
        <HorizontalScrollRow gap={10}>
          {cards.map((card) => (
            <PickUpAgainCardItem key={card.postId} card={card} />
          ))}
        </HorizontalScrollRow>
      ) : null}
    </CommunityCard>
  )
}

function PickUpAgainCardItem({ card }: { card: PickUpAgainCard }) {
  const communityUi = useCommunityUi()
  const toast = useAppToast()
  const { addToCart } = useCart()
  const [adding, setAdding] = useState(false)
  const href = card.lane === 'read_later' ? communityRoutes.article(card.postId) : communityRoutes.post(card.postId)
  const showAddToCart = card.lane === 'shop_now' && !!card.listingId

  async function handleAddToCart() {
    if (!card.listingId) return
    setAdding(true)
    try {
      const result = await addToCart(card.listingId)
      if (result.error) {
        toast.show('Could not add to cart', { tone: 'default', message: result.error })
        navigateApp(commerceRoutes.listing(card.listingSlug ?? card.listingId))
        return
      }
      toast.show('Added to cart', { tone: 'success' })
    } finally {
      setAdding(false)
    }
  }

  return (
    <YStack
      width={188}
      padding={12}
      gap={10}
      borderRadius={14}
      borderWidth={1}
      borderColor={communityUi.border}
      backgroundColor={communityUi.pageBg}
    >
      <AppLink href={href} asChild>
        <YStack
          gap={10}
          cursor="pointer"
          hoverStyle={{ opacity: 0.96 }}
          pressStyle={{ opacity: 0.9, scale: 0.98 }}
        >
          <YStack
            width="100%"
            height={96}
            borderRadius={10}
            overflow="hidden"
            backgroundColor={communityUi.surfaceMuted}
            alignItems="center"
            justifyContent="center"
          >
            {card.imageUrl ? (
              <Image src={card.imageUrl} width="100%" height={96} objectFit="cover" />
            ) : (
              <Icons.Bookmark size={22} color={communityUi.textMuted} />
            )}
          </YStack>

          <YStack gap={6} flex={1}>
            <XStack
              alignSelf="flex-start"
              paddingHorizontal={8}
              paddingVertical={4}
              borderRadius={999}
              backgroundColor={`${communityUi.brand}14`}
            >
              <Text fontSize={10} fontWeight="700" color={communityUi.brand}>
                {card.laneLabel}
              </Text>
            </XStack>
            <Text fontSize={14} fontWeight="700" color={communityUi.text} numberOfLines={2}>
              {card.title}
            </Text>
            {card.subtitle ? (
              <Text fontSize={12} color={communityUi.textMuted} numberOfLines={2}>
                {card.subtitle}
              </Text>
            ) : null}
          </YStack>
        </YStack>
      </AppLink>

      {showAddToCart ? (
        <Button
          tone="primary"
          size="$2.5"
          borderRadius={999}
          disabled={adding}
          onPress={() => void handleAddToCart()}
        >
          {adding ? 'Adding…' : 'Add to cart'}
        </Button>
      ) : null}
    </YStack>
  )
}
