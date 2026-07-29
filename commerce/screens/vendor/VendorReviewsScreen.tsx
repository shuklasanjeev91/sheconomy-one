import { useState } from 'react'

import { VendorListingReviewsHubPanel } from '~/commerce/screens/vendor/VendorListingReviewsHubPanel'
import { VendorShopReviewsHubPanel } from '~/commerce/screens/vendor/VendorShopReviewsHubPanel'
import { Text, XStack, YStack } from '~/components/ui'
import { useAppLayout } from '~/hooks/useAppLayout'
import { SHOP_REVIEW_UI_COPY } from '~/lib/shop-review/shop-review-ui.copy'
import { useAppSelector } from '~/lib/store/hooks'
import { useAppUi } from '~/lib/theme/useAppUi'

type ReviewKind = 'shop' | 'listing'

function KindToggle({
  kind,
  onChange,
  isDesktop,
}: {
  kind: ReviewKind
  onChange: (kind: ReviewKind) => void
  isDesktop: boolean
}) {
  const ui = useAppUi()

  return (
    <XStack
      alignSelf={isDesktop ? 'flex-start' : 'stretch'}
      padding={4}
      borderRadius={999}
      borderWidth={1}
      borderColor={ui.borderSubtle}
      backgroundColor={ui.surfaceMuted}
      gap={4}
    >
      {(['shop', 'listing'] as const).map((value) => {
        const active = kind === value
        const label =
          value === 'shop' ? SHOP_REVIEW_UI_COPY.shopReviewsTab : SHOP_REVIEW_UI_COPY.listingReviewsTab

        return (
          <XStack
            key={value}
            flex={isDesktop ? undefined : 1}
            paddingHorizontal="$4"
            paddingVertical="$2"
            borderRadius={999}
            backgroundColor={active ? ui.surface : 'transparent'}
            borderWidth={active ? 1 : 0}
            borderColor={active ? ui.borderSubtle : 'transparent'}
            cursor="pointer"
            animation="quick"
            pressStyle={{ opacity: 0.85 }}
            onPress={() => onChange(value)}
            justifyContent="center"
          >
            <Text fontSize={13} fontWeight="800" color={active ? ui.brand : ui.textSecondary}>
              {label}
            </Text>
          </XStack>
        )
      })}
    </XStack>
  )
}

export function VendorReviewsScreen() {
  const ui = useAppUi()
  const { isDesktop, safeBottom } = useAppLayout()
  const shop = useAppSelector((state) => state.shop.currentShop)
  const [kind, setKind] = useState<ReviewKind>('shop')

  if (!shop?.id) {
    return (
      <YStack padding="$6" alignItems="center">
        <Text color={ui.textSecondary}>Select or create a shop to manage reviews.</Text>
      </YStack>
    )
  }

  return (
    <YStack flex={1} minHeight={0} width="100%" maxWidth="100%">
      <YStack
        gap="$4"
        paddingHorizontal={isDesktop ? '$6' : '$4'}
        paddingTop={isDesktop ? '$6' : '$4'}
        paddingBottom={safeBottom + 24}
      >
        <KindToggle kind={kind} onChange={setKind} isDesktop={isDesktop} />

        {kind === 'shop' ? (
          <VendorShopReviewsHubPanel
            ui={ui}
            shopId={shop.id}
            shopName={shop.shop_name}
            isDesktop={isDesktop}
            safeBottom={safeBottom}
          />
        ) : (
          <VendorListingReviewsHubPanel
            ui={ui}
            shopId={shop.id}
            shopName={shop.shop_name}
            isDesktop={isDesktop}
            safeBottom={safeBottom}
          />
        )}
      </YStack>
    </YStack>
  )
}
