import { Link } from 'one'

import { SellerStatCard } from '~/commerce/components/seller/SellerStatCard'
import { CommercePanel } from '~/commerce/components'
import type { ShopDashboardData } from '~/commerce/lib/seller-dashboard'
import { Button, Icons, Text, XStack, YStack } from '~/components/ui'
import { commerceRoutes } from '~/lib/routes'
import { useAppUi } from '~/lib/theme/useAppUi'

type SellerOverviewPanelProps = {
  shopId: string
  shopSlug: string | null
  dashboard: ShopDashboardData
  onAddListing: () => void
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
}: SellerOverviewPanelProps) {
  const ui = useAppUi()
  const summary = dashboard.summary
  const sales = dashboard.sales
  const publicHref = commerceRoutes.shop(shopSlug ?? shopId)

  return (
    <YStack gap="$4" width="100%">
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
            <Link href={publicHref} asChild>
              <Button tone="outline" size="$3" borderRadius={999}>
                View storefront
              </Button>
            </Link>
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
