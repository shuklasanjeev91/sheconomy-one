import { useShopFollow } from '~/commerce/hooks/useShopFollow'
import { Button, Spinner, Theme, XStack, useAppToast } from '~/components/ui'
import { BRAND_THEME } from '~/config/tokens'

type ShopActionButtonsProps = {
  shopId: string
  ownerUserId?: string | null
  size?: '$2' | '$3' | '$4'
  borderRadius?: number
}

/** Shop actions — Follow for signed-in visitors (not the shop owner). */
export function ShopActionButtons({
  shopId,
  ownerUserId,
  size = '$3',
  borderRadius = 8,
}: ShopActionButtonsProps) {
  const toast = useAppToast()
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
          size={size}
          borderRadius={borderRadius}
          paddingHorizontal="$5"
          disabled={follow.isToggling}
          onPress={async () => {
            const wasFollowing = follow.isFollowing
            const result = await follow.toggleFollow()
            if (result.error) {
              toast.show(wasFollowing ? 'Could not unfollow' : 'Could not follow shop', {
                tone: 'danger',
                message: result.error,
              })
            }
          }}
          icon={follow.isToggling ? <Spinner size="small" /> : undefined}
        >
          {follow.isFollowing ? 'Following' : 'Follow shop'}
        </Button>
      </Theme>
    </XStack>
  )
}
