import { useShopFollow } from '~/commerce/hooks/useShopFollow'
import { Button, Spinner, Theme, XStack } from '~/components/ui'
import { BRAND_THEME } from '~/config/tokens'

type ShopActionButtonsProps = {
  shopId: string
  ownerUserId?: string | null
}

/** Shop actions — Follow for signed-in visitors (not the shop owner). */
export function ShopActionButtons({ shopId, ownerUserId }: ShopActionButtonsProps) {
  const follow = useShopFollow(shopId)

  if (!follow.isAuthenticated) {
    return null
  }

  if (ownerUserId && follow.user?.id === ownerUserId) {
    return null
  }

  if (follow.isLoading) {
    return (
      <XStack minHeight={36} alignItems="center">
        <Spinner size="small" />
      </XStack>
    )
  }

  return (
    <XStack gap="$2" flexWrap="wrap" alignItems="center">
      <Theme name={BRAND_THEME}>
        <Button
          tone={follow.isFollowing ? 'outline' : 'primary'}
          size="$3"
          borderRadius={999}
          paddingHorizontal="$5"
          disabled={follow.isToggling}
          onPress={follow.toggleFollow}
          icon={follow.isToggling ? <Spinner size="small" /> : undefined}
        >
          {follow.isFollowing ? 'Following' : 'Follow shop'}
        </Button>
      </Theme>
    </XStack>
  )
}