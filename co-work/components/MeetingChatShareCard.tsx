import type { ReactNode } from 'react'
import { Image } from '~/components/ui'
import { Button, Icons, Text, XStack, YStack } from '~/components/ui'
import { ProfileConnectButton } from '~/community/components/ProfileConnectButton'
import { ProfileFollowButton } from '~/community/components/ProfileFollowButton'
import { useShopFollow } from '~/commerce/hooks/useShopFollow'
import { navigateApp } from '~/lib/platform/navigate'
import type { MeetingChatShare } from '~/co-work/lib/meeting-chat-share'
import { useCoWorkTheme } from '~/co-work/lib/theme'

type MeetingChatShareCardProps = {
  share: MeetingChatShare
  currentUserId?: string | null
}

export function MeetingChatShareCard({ share, currentUserId }: MeetingChatShareCardProps) {
  if (share.kind === 'shop') {
    return <ShopShareCard share={share} currentUserId={currentUserId} />
  }
  if (share.kind === 'listing') {
    return <ListingShareCard share={share} currentUserId={currentUserId} />
  }
  return <ProfileShareCard share={share} />
}

function ShareShell({
  share,
  icon,
  children,
}: {
  share: MeetingChatShare
  icon: 'shop' | 'listing' | 'profile'
  children: ReactNode
}) {
  const { ui } = useCoWorkTheme()
  const Icon = icon === 'shop' ? Icons.Store : icon === 'listing' ? Icons.ShoppingBag : Icons.UserPlus

  return (
    <YStack
      marginTop="$1"
      padding="$2.5"
      gap="$2.5"
      borderRadius={14}
      borderWidth={1}
      borderColor={ui.borderSoft}
      backgroundColor={ui.meetingBarElevated}
      minWidth={250}
      maxWidth={340}
    >
      <XStack gap="$2.5" alignItems="center">
        <YStack
          width={46}
          height={46}
          borderRadius={12}
          overflow="hidden"
          backgroundColor={ui.meetingControl}
          alignItems="center"
          justifyContent="center"
        >
          {share.imageUrl ? (
            <Image source={{ uri: share.imageUrl }} width={46} height={46} resizeMode="cover" />
          ) : (
            <Icon size={21} color={ui.textMuted} />
          )}
        </YStack>
        <YStack flex={1} minWidth={0} gap={2}>
          <Text fontSize={11} fontWeight="800" color={ui.brandLight}>
            {share.kind === 'shop' ? 'Shop' : share.kind === 'listing' ? 'Product' : 'Participant'}
          </Text>
          <Text fontSize={14} fontWeight="800" color={ui.text} numberOfLines={2}>
            {share.title}
          </Text>
          {share.subtitle ? (
            <Text fontSize={12} color={ui.textMuted} numberOfLines={1}>
              {share.subtitle}
            </Text>
          ) : null}
        </YStack>
      </XStack>
      {children}
    </YStack>
  )
}

function ShopShareCard({ share, currentUserId }: MeetingChatShareCardProps) {
  const { ui } = useCoWorkTheme()
  const follow = useShopFollow(share.id)
  const isOwnShop = !!currentUserId && share.ownerUserId === currentUserId

  return (
    <ShareShell share={share} icon="shop">
      <XStack gap="$2" flexWrap="wrap">
        <Button tone="outline" size="$2" onPress={() => navigateApp(share.href as never)}>
          Open shop
        </Button>
        {!isOwnShop && follow.isAuthenticated ? (
          <Button
            tone={follow.isFollowing ? 'outline' : 'primary'}
            size="$2"
            disabled={follow.isToggling || follow.isLoading}
            onPress={() => void follow.toggleFollow()}
          >
            {follow.isFollowing ? 'Following' : 'Follow shop'}
          </Button>
        ) : null}
      </XStack>
      {isOwnShop ? (
        <Text fontSize={11} color={ui.textMuted}>
          Shared by the shop owner
        </Text>
      ) : null}
    </ShareShell>
  )
}

function ListingShareCard({ share, currentUserId }: MeetingChatShareCardProps) {
  const price =
    typeof share.price === 'number'
      ? new Intl.NumberFormat(undefined, {
          style: 'currency',
          currency: share.currency || 'INR',
          maximumFractionDigits: 0,
        }).format(share.price)
      : null

  return (
    <ShareShell
      share={{
        ...share,
        subtitle: price ? `${price} · ${share.subtitle ?? 'Product'}` : share.subtitle,
      }}
      icon="listing"
    >
      <XStack gap="$2" flexWrap="wrap">
        <Button tone="primary" size="$2" onPress={() => navigateApp(share.href as never)}>
          Buy / view
        </Button>
        {share.ownerUserId && share.ownerUserId !== currentUserId ? (
          <Button tone="outline" size="$2" onPress={() => navigateApp(share.href as never)}>
            Product details
          </Button>
        ) : null}
      </XStack>
    </ShareShell>
  )
}

function ProfileShareCard({ share }: { share: MeetingChatShare }) {
  return (
    <ShareShell share={share} icon="profile">
      <XStack gap="$2" flexWrap="wrap" alignItems="center">
        <Button tone="outline" size="$2" onPress={() => navigateApp(share.href as never)}>
          View profile
        </Button>
        <ProfileFollowButton targetUserId={share.id} size="sm" />
        <ProfileConnectButton targetUserId={share.id} size="sm" />
      </XStack>
    </ShareShell>
  )
}
