import { useState } from 'react'
import { useRouter } from 'one'
import { Platform } from 'react-native'

import { ShopActionButtons } from '~/commerce/components/ShopActionButtons'
import type { ShopAddress, ShopOwnerProfile } from '~/commerce/lib/shop-location'
import { formatShopCountry, formatShopLocation } from '~/commerce/lib/shop-location'
import { Avatar, Button, Icons, Image, Spinner, Text, XStack, YStack, useAppToast } from '~/components/ui'
import { ProfileLink } from '~/community/components/ProfileLink'
import { createDirectConversation } from '~/chat/lib/chats'
import { appRoutes, chatRoutes, commerceRoutes } from '~/lib/routes'
import { useAppUi } from '~/lib/theme/useAppUi'
import { useSupabase } from '~/providers/SupabaseProvider'

type ShopSellerBuyBoxProps = {
  shopId: string
  shopName: string
  shopSlug: string
  logoUrl?: string | null
  owner: ShopOwnerProfile | null
  address: ShopAddress | null
  shopCreatedAt?: string | null
  shopCurrency?: string | null
  listingsCount: number
  ownerUserId?: string | null
  /** Prefer scrolling to products over navigating to the same shop URL. */
  onBrowseProducts?: () => void
}

function formatMemberSince(value?: string | null): string | null {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return date.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })
}

function ownerDisplayName(owner: ShopOwnerProfile): string {
  return owner.full_name?.trim() || owner.business_name?.trim() || owner.username
}

/**
 * Amazon-style sticky seller box — primary CTAs + short seller facts.
 */
export function ShopSellerBuyBox({
  shopId,
  shopName,
  shopSlug,
  logoUrl,
  owner,
  address,
  shopCreatedAt,
  shopCurrency,
  listingsCount,
  ownerUserId,
  onBrowseProducts,
}: ShopSellerBuyBoxProps) {
  const ui = useAppUi()
  const toast = useAppToast()
  const router = useRouter()
  const { user } = useSupabase()
  const [messaging, setMessaging] = useState(false)

  const location = formatShopLocation(address, owner?.location)
  const country = formatShopCountry(address)
  const memberSince = formatMemberSince(shopCreatedAt)
  const isOwner = !!user && !!ownerUserId && user.id === ownerUserId

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
      width="100%"
      gap="$3.5"
      padding="$4"
      borderRadius={8}
      borderWidth={1}
      borderColor={ui.borderSubtle}
      backgroundColor={ui.surface}
      style={
        Platform.OS === 'web'
          ? { boxShadow: '0 2px 5px rgba(15,17,17,0.08)' }
          : undefined
      }
    >
      <XStack gap="$3" alignItems="center">
        <YStack
          width={48}
          height={48}
          borderRadius={4}
          overflow="hidden"
          borderWidth={1}
          borderColor={ui.borderSubtle}
          backgroundColor={ui.surfaceMuted}
        >
          {logoUrl ? (
            <Image src={logoUrl} width="100%" height="100%" objectFit="cover" />
          ) : (
            <YStack flex={1} alignItems="center" justifyContent="center">
              <Icons.Store size={20} color={ui.textMuted} />
            </YStack>
          )}
        </YStack>
        <YStack flex={1} gap={2} minWidth={0}>
          <Text fontSize={15} fontWeight="700" color={ui.text} numberOfLines={2}>
            {shopName}
          </Text>
          <Text fontSize={12} color={ui.textMuted}>
            {listingsCount} product{listingsCount === 1 ? '' : 's'} available
          </Text>
        </YStack>
      </XStack>

      <YStack gap="$2">
        <Button
          size="$4"
          borderRadius={8}
          backgroundColor="#FFD814"
          borderColor="#FCD200"
          borderWidth={1}
          color="#0F1111"
          fontWeight="700"
          hoverStyle={{ backgroundColor: '#F7CA00' }}
          pressStyle={{ backgroundColor: '#F0B800' }}
          onPress={() => {
            if (onBrowseProducts) {
              onBrowseProducts()
              return
            }
            router.push(commerceRoutes.shop(shopSlug))
          }}
        >
          Browse products
        </Button>

        {!isOwner && ownerUserId ? (
          <Button
            tone="outline"
            size="$4"
            borderRadius={8}
            disabled={messaging}
            icon={messaging ? <Spinner size="small" /> : <Icons.MessageCircle size={16} />}
            onPress={() => void handleMessageSeller()}
          >
            Contact seller
          </Button>
        ) : null}

        <ShopActionButtons shopId={shopId} ownerUserId={ownerUserId} />
      </YStack>

      <YStack height={1} backgroundColor={ui.borderSubtle} width="100%" />

      <YStack gap="$2">
        <Text fontSize={14} fontWeight="700" color={ui.text}>
          About the seller
        </Text>
        {owner ? (
          <ProfileLink userId={owner.id} username={owner.username}>
            <XStack gap="$2.5" alignItems="center">
              <Avatar
                name={ownerDisplayName(owner)}
                src={owner.avatar_url ?? undefined}
                size="$3"
              />
              <YStack flex={1} minWidth={0} gap={1}>
                <Text fontSize={14} fontWeight="600" color="#007185" numberOfLines={1}>
                  {ownerDisplayName(owner)}
                </Text>
                <Text fontSize={12} color={ui.textMuted} numberOfLines={1}>
                  @{owner.username}
                </Text>
              </YStack>
            </XStack>
          </ProfileLink>
        ) : null}

        <Fact label="Ships from" value={country ?? location ?? 'India'} />
        {memberSince ? <Fact label="Selling since" value={memberSince} /> : null}
        {shopCurrency ? <Fact label="Currency" value={shopCurrency} /> : null}
      </YStack>
    </YStack>
  )
}

function Fact({ label, value }: { label: string; value: string }) {
  const ui = useAppUi()
  return (
    <XStack justifyContent="space-between" gap="$3" alignItems="flex-start">
      <Text fontSize={12} color={ui.textMuted} flexShrink={0}>
        {label}
      </Text>
      <Text fontSize={12} color={ui.text} fontWeight="500" textAlign="right" flex={1}>
        {value}
      </Text>
    </XStack>
  )
}
