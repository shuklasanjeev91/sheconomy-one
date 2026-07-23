import { Button, Spinner, Text, XStack, YStack } from '~/components/ui'
import { radius } from '~/config/tokens'
import { SALES_ANALYTICS_UI_COPY } from '~/lib/sales-analytics/sales-analytics-ui.copy'
import { summarizeRegionalSale } from '~/lib/sales-analytics/sales-analytics-ui.utils'
import type { VendorRegionalSalesRow } from '~/lib/sales-analytics/sales-analytics.type'
import type { AppUiTokens } from '~/lib/theme/app-ui'

type SalesAnalyticsRegionalPanelProps = {
  ui: AppUiTokens
  regions: VendorRegionalSalesRow[]
  loading: boolean
  formatAmount: (value: number) => string
  limit?: number
  showViewAll?: boolean
  onViewAll?: () => void
}

export function SalesAnalyticsRegionalPanel({
  ui,
  regions,
  loading,
  formatAmount,
  limit,
  showViewAll,
  onViewAll,
}: SalesAnalyticsRegionalPanelProps) {
  const rows = limit ? regions.slice(0, limit) : regions

  if (loading) {
    return (
      <YStack minHeight={180} alignItems="center" justifyContent="center">
        <Spinner size="large" />
      </YStack>
    )
  }

  if (!rows.length) {
    return (
      <YStack padding="$5" alignItems="center">
        <Text fontSize={13} color={ui.textMuted}>
          {SALES_ANALYTICS_UI_COPY.emptyRegions}
        </Text>
      </YStack>
    )
  }

  return (
    <YStack gap="$3">
      {rows.map((region, index) => (
        <XStack
          key={`${region.delivery_region}-${region.delivery_country}-${index}`}
          gap="$3"
          alignItems="center"
          padding="$3"
          borderRadius={radius.card}
          borderWidth={1}
          borderColor={ui.borderSubtle}
          backgroundColor={ui.surface}
        >
          <YStack flex={1} minWidth={0} gap="$1">
            <Text fontSize={14} fontWeight="800" color={ui.text} numberOfLines={1}>
              {summarizeRegionalSale(region)}
            </Text>
            <Text fontSize={12} color={ui.textMuted}>
              {region.total_orders ?? 0} orders · {region.unique_customers ?? 0} customers
              {region.cod_percentage != null ? ` · COD ${Number(region.cod_percentage).toFixed(0)}%` : ''}
            </Text>
          </YStack>
          <Text fontSize={13} fontWeight="800" color={ui.textSecondary}>
            {formatAmount(Number(region.total_revenue ?? 0))}
          </Text>
        </XStack>
      ))}

      {showViewAll && regions.length > (limit ?? regions.length) ? (
        <Button tone="outline" size="$3" onPress={onViewAll}>
          View all regions
        </Button>
      ) : null}
    </YStack>
  )
}
