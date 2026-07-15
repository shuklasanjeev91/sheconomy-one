import { useState } from 'react'
import { Link, useRouter } from 'one'

import { ShopActionButtons } from '~/commerce/components/ShopActionButtons'
import { RatingSummary } from '~/commerce/components/RatingSummary'
import { hasVisibleReviews, type ReviewSummary } from '~/commerce/lib/reviews'
import { Avatar, Button, Icons, Spinner, Text, XStack, YStack, useAppToast } from '~/components/ui'
import { createDirectConversation } from '~/chat/lib/chats'
import { getShadowStyle, radius } from '~/config/tokens'
import { commerceRoutes, chatRoutes, appRoutes } from '~/lib/routes'
import { useAppUi } from '~/lib/theme/useAppUi'
import { useSupabase } from '~/providers/SupabaseProvider'

type ListingSellerCardProps = {
  shopId: string
  shopName: string
  shopSlug: string
  logoUrl?: string | null
  verified?: boolean
  reviewSummary?: ReviewSummary | null
  ownerUserId?: string | null
  listingsCountHint?: string | null
}

/** marketplace seller card on listing pages — visit shop, follow, message. */
export function ListingSellerCard({
  shopId,
  shopName,
  shopSlug,
  logoUrl,
  verified,
  reviewSummary,
  ownerUserId,
  listingsCountHint,
}: ListingSellerCardProps) {
  const ui = useAppUi()
  const toast = useAppToast()
  const router = useRouter()
  const { user } = useSupabase()
  const [messaging, setMessaging] = useState(false)

  async function handleMessageSeller() {
    if (!ownerUserId) {
      toast.show('Messaging unavailable', {
        tone: 'default',
        message: 'This seller cannot be messaged right now.',
      })
      return
    }
    if (!user) {
      toast.show('Sign in to message', {
        tone: 'default',
        message: 'Create an account or sign in to chat with the seller.',
      })
      router.push(appRoutes.signIn)
      return
    }
    if (user.id === ownerUserId) return

    setMessaging(true)
    const { conversationId, error } = await createDirectConversation(ownerUserId)
    setMessaging(false)
    if (error || !conversationId) {
      toast.show('Could not open chat', { tone: 'danger', message: error ?? undefined })
      return
    }
    router.push(chatRoutes.conversation(conversationId))
  }

  return (
    <YStack
      gap="$3.5"
      padding="$4"
      borderRadius={radius.card}
      borderWidth={1}
      borderColor={ui.borderSubtle}
      backgroundColor={ui.surface}
      width="100%"
      style={getShadowStyle('sm')}
    >
      <XStack alignItems="center" gap="$1.5">
        <Icons.Store size={15} color={ui.brand} />
        <Text fontSize={13} fontWeight="700" color={ui.textSecondary} letterSpacing={0.2}>
          Sold by
        </Text>
      </XStack>

      <Link href={commerceRoutes.shop(shopSlug)} asChild>
        <XStack gap="$3" alignItems="center" cursor="pointer" pressStyle={{ opacity: 0.9 }}>
          <Avatar name={shopName} src={logoUrl ?? undefined} size="$5" />
          <YStack flex={1} minWidth={0} gap={3}>
            <XStack alignItems="center" gap="$1.5" flexWrap="wrap">
              <Text fontWeight="700" fontSize={16} color={ui.text} numberOfLines={1}>
                {shopName}
              </Text>
              {verified ? <Icons.BadgeCheck size={16} color={ui.brand} /> : null}
            </XStack>
            {reviewSummary && hasVisibleReviews(reviewSummary) ? (
              <RatingSummary summary={reviewSummary} size="sm" />
            ) : (
              <Text fontSize={12} color={ui.textMuted}>
                {listingsCountHint ?? 'Visit shop'}
              </Text>
            )}
          </YStack>
          <Icons.ChevronRight size={18} color={ui.textSecondary} />
        </XStack>
      </Link>

      <XStack gap="$2" flexWrap="wrap" alignItems="center">
        <ShopActionButtons shopId={shopId} ownerUserId={ownerUserId} />
        {ownerUserId && user?.id !== ownerUserId ? (
          <Button
            tone="outline"
            size="$3"
            borderRadius={999}
            icon={messaging ? <Spinner size="small" /> : <Icons.MessageCircle size={15} />}
            disabled={messaging}
            onPress={() => void handleMessageSeller()}
          >
            Message seller
          </Button>
        ) : null}
      </XStack>
    </YStack>
  )
}
