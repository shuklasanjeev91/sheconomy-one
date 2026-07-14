import { Link } from 'one'

import { SellerStatCard } from '~/commerce/components/seller/SellerStatCard'
import { SellerDraftsCard } from '~/commerce/components/seller/SellerDraftsCard'
import { SellerLowStockCard } from '~/commerce/components/seller/SellerLowStockCard'
import { CommercePanel } from '~/commerce/components'
import type { ShopDashboardData } from '~/commerce/lib/seller-dashboard'
import { ShareButton } from '~/components/share'
import { Button, Icons, Text, XStack, YStack } from '~/components/ui'
import { BRAND_NAME } from '~/config/brand'
import { commerceRoutes, vendorRoutes } from '~/lib/routes'
import { getShopShareUrl } from '~/lib/share'
import { useAppUi } from '~/lib/theme/useAppUi'

type SellerOverviewPanelProps = {
  shopId: string
  shopSlug: string | null
  dashboard: ShopDashboardData
  onAddListing: () => void
  onOpenListings: () => void
}

function formatCurrency(value: number, currency = 'INR') {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(value)
}

export function SellerOverviewPanel({
  shopId,
  shopSlug,
  dashboard,
  onAddListing,
  onOpenListings,
}: SellerOverviewPanelProps) {
  const ui = useAppUi()
  const summary = dashboard.summary
  const sales = dashboard.sales
  const publicHref = commerceRoutes.shop(shopSlug ?? shopId)
  const shopShareSlug = shopSlug ?? shopId

  return (
    <YStack gap="$4" width="100%">
      <SellerLowStockCard shopId={shopId} />
      <SellerDraftsCard shopId={shopId} onOpenListings={onOpenListings} />
      <XStack gap="$3" flexWrap="wrap" width="100%">
        <SellerStatCard
          label="Active listings"
          value={String(summary?.activeListings ?? 0)}
          hint={`${summary?.draftListings ?? 0} drafts waiting`}
        />
        <SellerStatCard
          label="Total orders"
          value={String(sales.totalOrders)}
          hint="Lifetime shop orders"
        />
        <SellerStatCard
          label="Revenue"
          value={formatCurrency(sales.totalRevenue)}
          hint={`${sales.uniqueCustomers} customers`}
        />
        <SellerStatCard
          label="Units sold"
          value={String(sales.totalUnitsSold)}
          hint={summary?.shopVerified ? 'Verified shop' : 'Complete profile to build trust'}
        />
      </XStack>

      <CommercePanel>
        <YStack gap="$3">
          <Text fontSize={16} fontWeight="700" color={ui.text}>
            Quick actions
          </Text>
          <XStack gap="$2" flexWrap="wrap">
            <Button tone="primary" size="$3" borderRadius={999} onPress={onAddListing}>
              Add listing
            </Button>
            <Link href={vendorRoutes.orders} asChild>
              <Button tone="outline" size="$3" borderRadius={999} icon={<Icons.ShoppingBag size={15} />}>
                Orders
              </Button>
            </Link>
            <Link href={vendorRoutes.createListing} asChild>
              <Button tone="outline" size="$3" borderRadius={999} icon={<Icons.Plus size={15} />}>
                Create listing
              </Button>
            </Link>
            <Link href={vendorRoutes.settings} asChild>
              <Button tone="outline" size="$3" borderRadius={999} icon={<Icons.Settings size={15} />}>
                Settings
              </Button>
            </Link>
            <Link href={publicHref} asChild>
              <Button tone="outline" size="$3" borderRadius={999}>
                View storefront
              </Button>
            </Link>
            <ShareButton
              size="$3"
              label="Share shop"
              sheetTitle="Share storefront"
              payload={{
                url: getShopShareUrl(shopShareSlug),
                title: `Shop on ${BRAND_NAME}`,
                text: `Browse my shop on ${BRAND_NAME}`,
              }}
            />
          </XStack>
          <XStack gap="$2" alignItems="flex-start">
            <Icons.TrendingUp size={16} color={ui.brand} />
            <Text fontSize={13} color={ui.textSecondary} lineHeight={20} flex={1}>
              Keep listings active, respond to buyers quickly, and update shipping details to improve
              visibility from your seller dashboard.
            </Text>
          </XStack>
        </YStack>
      </CommercePanel>
    </YStack>
  )
}
