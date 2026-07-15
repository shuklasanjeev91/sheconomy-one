import { useMemo, useState } from 'react'
import { useParams } from 'one'

import { SpaRedirect } from '~/components/navigation/SpaRedirect'
import { AppLink } from '~/components/navigation/AppLink'
import {
  CommercePageHeader,
  CommercePanel,
} from '~/commerce/components'
import { CreateListingForm } from '~/commerce/components/seller/CreateListingForm'
import { SellerListingsPanel } from '~/commerce/components/seller/SellerListingsPanel'
import { SellerOverviewPanel } from '~/commerce/components/seller/SellerOverviewPanel'
import { ShopSettingsPanel } from '~/commerce/components/seller/ShopSettingsPanel'
import { ShopCommercePanel } from '~/commerce/components/seller/ShopCommercePanel'
import { useShopDashboard } from '~/commerce/hooks/useShopDashboard'
import { Button, Icons, Paragraph, Spinner, Text, XStack, YStack } from '~/components/ui'
import { PushPermissionBanner } from '~/components/notifications/PushPermissionBanner'
import { PageContent, PageCenter } from '~/components/layout'
import { commerceRoutes } from '~/lib/routes'
import { useVendorShops, type VendorShop } from '~/hooks/useVendorShops'
import { useAppUi } from '~/lib/theme/useAppUi'

type SellerTab = 'overview' | 'listings' | 'payments' | 'settings'

const TABS: { id: SellerTab; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'listings', label: 'Listings' },
  { id: 'payments', label: 'Payments & delivery' },
  { id: 'settings', label: 'Settings' },
]

export function SellerDashboardScreen() {
  const ui = useAppUi()
  const params = useParams<{ shopId: string }>()
  const shopId = params.shopId
  const { shops, isLoading, error, refresh, isAuthenticated } = useVendorShops()
  const shop = useMemo(() => shops.find((item) => item.id === shopId) ?? null, [shopId, shops])
  const { data: dashboard, isLoading: dashboardLoading, refresh: refreshDashboard } = useShopDashboard(
    shop?.id,
    !!shop,
  )

  const [tab, setTab] = useState<SellerTab>('overview')
  const [showCreateListing, setShowCreateListing] = useState(false)
  const [localShop, setLocalShop] = useState<VendorShop | null>(null)

  const activeShop = localShop ?? shop

  if (!isAuthenticated) {
    return <SpaRedirect href={commerceRoutes.myShops} />
  }

  if (isLoading) {
    return (
      <PageCenter>
        <Spinner size="large" />
      </PageCenter>
    )
  }

  if (!shopId || !activeShop) {
    // Prefer the owner's real hub over bouncing to /my-shops (which would redirect again).
    const fallbackShopId = shops[0]?.id
    if (fallbackShopId && fallbackShopId !== shopId) {
      return <SpaRedirect href={commerceRoutes.manageShop(fallbackShopId)} />
    }
    return <SpaRedirect href={`${commerceRoutes.myShops}?create=1`} />
  }

  function handleShopUpdated(next: VendorShop) {
    setLocalShop(next)
    void refresh()
  }

  function handleListingCreated() {
    setShowCreateListing(false)
    void refreshDashboard()
    setTab('listings')
  }

  return (
    <PageContent scroll paddingVertical="$4" paddingBottom="$10">
      <YStack gap="$5" width="100%">
        <PushPermissionBanner />
        <XStack alignItems="flex-start" justifyContent="space-between" gap="$3" flexWrap="wrap">
          <CommercePageHeader
            title={activeShop.shop_name}
            subtitle="Seller hub — manage listings, orders, and storefront settings."
          />
          <XStack gap="$2" flexWrap="wrap">
            {shops.length > 1 ? (
              <AppLink href={commerceRoutes.myShops} asChild>
                <Button tone="outline" size="$3" borderRadius={999}>
                  Switch shop
                </Button>
              </AppLink>
            ) : null}
            <AppLink href={commerceRoutes.shop(activeShop.slug ?? activeShop.id)} asChild>
              <Button tone="outline" size="$3" borderRadius={999}>
                View shop
              </Button>
            </AppLink>
          </XStack>
        </XStack>

        {error ? (
          <CommercePanel>
            <Paragraph color="$red10">{error}</Paragraph>
          </CommercePanel>
        ) : null}

        <XStack gap="$2" flexWrap="wrap">
          {TABS.map((item) => (
            <Button
              key={item.id}
              tone={tab === item.id ? 'primary' : 'outline'}
              size="$3"
              borderRadius={999}
              onPress={() => setTab(item.id)}
            >
              {item.label}
            </Button>
          ))}
        </XStack>

        {showCreateListing ? (
          <CreateListingForm
            shopId={activeShop.id}
            onCreated={handleListingCreated}
            onCancel={() => setShowCreateListing(false)}
          />
        ) : null}

        {tab === 'overview' ? (
          dashboardLoading && !dashboard ? (
            <YStack paddingVertical="$8" alignItems="center">
              <Spinner size="large" />
            </YStack>
          ) : dashboard ? (
            <SellerOverviewPanel
              shopId={activeShop.id}
              shopSlug={activeShop.slug}
              dashboard={dashboard}
              onAddListing={() => {
                setShowCreateListing(true)
                setTab('listings')
              }}
              onOpenListings={() => {
                setShowCreateListing(false)
                setTab('listings')
              }}
            />
          ) : (
            <CommercePanel>
              <XStack gap="$2" alignItems="center">
                <Icons.Store size={18} color={ui.brand} />
                <Text color={ui.textSecondary}>Dashboard data will appear once your shop is active.</Text>
              </XStack>
            </CommercePanel>
          )
        ) : null}

        {tab === 'listings' && !showCreateListing ? (
          <SellerListingsPanel
            shopId={activeShop.id}
            onAddListing={() => setShowCreateListing(true)}
          />
        ) : null}

        {tab === 'payments' ? <ShopCommercePanel shop={activeShop} /> : null}

        {tab === 'settings' ? (
          <ShopSettingsPanel shop={activeShop} onUpdated={handleShopUpdated} />
        ) : null}
      </YStack>
    </PageContent>
  )
}
