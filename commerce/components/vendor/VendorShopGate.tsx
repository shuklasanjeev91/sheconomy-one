import type { ReactNode } from 'react'

import { AppLink } from '~/components/navigation'
import { PageCenter } from '~/components/layout'
import { Button, Icons, Spinner, Text, YStack } from '~/components/ui'
import { commerceRoutes } from '~/lib/routes'
import type { Shop } from '~/lib/shop/shop.type'
import { useAppSelector } from '~/lib/store/hooks'
import type { AppUiTokens } from '~/lib/theme/app-ui'
import { useAppUi } from '~/lib/theme/useAppUi'

type VendorShopGateProps = {
  children: (shop: Shop) => ReactNode
  /** Shown after shops have loaded and the vendor still has none. */
  emptyTitle?: string
  emptyBody?: string
  emptyActionLabel?: string
}

/**
 * Vendor pages share one shop-load race: `currentShop` is null until
 * `loadMyShops` settles. Rendering "no shop" during that window looks blank /
 * broken. Wait for the load, then either hand the shop to children or show an
 * actionable empty state.
 */
export function VendorShopGate({
  children,
  emptyTitle = 'No shop yet',
  emptyBody = 'Create your storefront to use this seller tool.',
  emptyActionLabel = 'Go to My Shops',
}: VendorShopGateProps) {
  const ui = useAppUi()
  const shop = useAppSelector((state) => state.shop.currentShop)
  const isLoadingMyShops = useAppSelector((state) => state.shop.isLoadingMyShops)
  const myShopsLoaded = useAppSelector((state) => state.shop.myShopsLoaded)

  if (!shop && (isLoadingMyShops || !myShopsLoaded)) {
    return (
      <PageCenter>
        <Spinner size="large" />
      </PageCenter>
    )
  }

  if (!shop) {
    return (
      <VendorNoShopState
        ui={ui}
        title={emptyTitle}
        body={emptyBody}
        actionLabel={emptyActionLabel}
      />
    )
  }

  return <>{children(shop)}</>
}

export function VendorNoShopState({
  ui,
  title,
  body,
  actionLabel = 'Go to My Shops',
}: {
  ui: AppUiTokens
  title: string
  body: string
  actionLabel?: string
}) {
  return (
    <YStack flex={1} alignItems="center" justifyContent="center" padding="$6" gap="$3" minHeight={360}>
      <YStack
        width={68}
        height={68}
        borderRadius={999}
        backgroundColor={ui.roseSurface}
        alignItems="center"
        justifyContent="center"
      >
        <Icons.Store size={30} color={ui.brand} />
      </YStack>
      <Text fontSize={18} fontWeight="800" color={ui.text} textAlign="center">
        {title}
      </Text>
      <Text fontSize={14} color={ui.textSecondary} textAlign="center" maxWidth={360} lineHeight={20}>
        {body}
      </Text>
      <AppLink href={commerceRoutes.manageShop()} asChild>
        <Button tone="primary" size="$4" borderRadius={999} marginTop="$2">
          {actionLabel}
        </Button>
      </AppLink>
    </YStack>
  )
}
