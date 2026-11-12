import { useShopFollow } from '~/commerce/hooks/useShopFollow'
import { Button, Spinner, Theme, XStack, useAppToast } from '~/components/ui'
import { BRAND_THEME } from '~/config/tokens'

type ShopActionButtonsProps = {
  shopId: string
  ownerUserId?: string | null
  size?: '$2' | '$3' | '$4'
  borderRadius?: number
  /** Stretch to fill the parent row (seller card / buy-box layouts). */
  fullWidth?: boolean
}

/** Shop actions — Follow for signed-in visitors (not the shop owner). */
export function ShopActionButtons({
  shopId,
  ownerUserId,
  size = '$3',
  borderRadius = 8,
  fullWidth = false,
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
      <XStack
        minHeight={36}
        alignItems="center"
        justifyContent="center"
        flex={fullWidth ? 1 : undefined}
        width={fullWidth ? '100%' : undefined}
        minWidth={0}
      >
        <Spinner size="small" />
      </XStack>
    )
  }

  return (
    <XStack
      flex={fullWidth ? 1 : undefined}
      width={fullWidth ? '100%' : undefined}
      minWidth={0}
      alignItems="stretch"
    >
      <Theme name={BRAND_THEME}>
        <Button
          tone={follow.isFollowing ? 'outline' : 'primary'}
          size={size}
          borderRadius={borderRadius}
          paddingHorizontal={fullWidth ? undefined : '$5'}
          width={fullWidth ? '100%' : undefined}
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
