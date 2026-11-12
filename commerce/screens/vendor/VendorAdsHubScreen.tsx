import { useRouter } from 'one'

import { Button, Icons, Text, YStack } from '~/components/ui'
import { getShadowStyle, radius } from '~/config/tokens'
import { useAppLayout } from '~/hooks/useAppLayout'
import { communityRoutes, vendorRoutes } from '~/lib/routes'
import { useAppUi } from '~/lib/theme/useAppUi'

export function VendorAdsHubScreen() {
  const ui = useAppUi()
  const router = useRouter()
  const { isDesktop, safeBottom } = useAppLayout()

  return (
    <YStack
      width="100%"
      gap="$4"
      paddingHorizontal={isDesktop ? '$6' : '$4'}
      paddingTop={isDesktop ? '$6' : '$4'}
      paddingBottom={(isDesktop ? 32 : 24) + safeBottom}
    >
      <YStack gap="$1">
        <Text fontSize={isDesktop ? 26 : 22} fontWeight="800" color={ui.text}>
          Ads & Promo
        </Text>
        <Text fontSize={13} color={ui.textSecondary} lineHeight={19}>
          Boost community posts with prepaid wallet or PayU, or manage shop discounts.
        </Text>
      </YStack>

      <YStack
        gap="$3"
        padding="$5"
        borderRadius={radius.card}
        borderWidth={1}
        borderColor={ui.borderSubtle}
        backgroundColor={ui.surface}
        style={getShadowStyle('sm')}
      >
        <Text fontSize={16} fontWeight="800" color={ui.text}>
          Sponsored ads
        </Text>
        <Text fontSize={13} color={ui.textSecondary} lineHeight={19}>
          Create and pay for boost campaigns. Pay from your shop wallet when balance covers the
          budget, or checkout with PayU.
        </Text>
        <Button
          tone="primary"
          icon={<Icons.Megaphone size={15} />}
          onPress={() => router.push(communityRoutes.ads)}
        >
          Open Ads Manager
        </Button>
      </YStack>

      <YStack
        gap="$3"
        padding="$5"
        borderRadius={radius.card}
        borderWidth={1}
        borderColor={ui.borderSubtle}
        backgroundColor={ui.surface}
        style={getShadowStyle('sm')}
      >
        <Text fontSize={16} fontWeight="800" color={ui.text}>
          Discounts
        </Text>
        <Text fontSize={13} color={ui.textSecondary} lineHeight={19}>
          Coupons and promotions for your storefront.
        </Text>
        <Button
          tone="outline"
          icon={<Icons.Tag size={15} />}
          onPress={() => router.push(vendorRoutes.createDiscount)}
        >
          Create discount
        </Button>
        <Button
          tone="outline"
          onPress={() => router.push(vendorRoutes.discounts)}
        >
          Manage discounts
        </Button>
      </YStack>
    </YStack>
  )
}
