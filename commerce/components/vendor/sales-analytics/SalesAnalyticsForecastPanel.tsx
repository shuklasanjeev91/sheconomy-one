import { Text, XStack, YStack } from '~/components/ui'
import type { ListingDemandForecast } from '~/commerce/lib/demand-forecast'
import type { AppUiTokens } from '~/lib/theme/app-ui'

export function SalesAnalyticsForecastPanel({
  ui,
  rows,
  loading,
  formatAmount,
}: {
  ui: AppUiTokens
  rows: ListingDemandForecast[]
  loading?: boolean
  formatAmount: (value: number) => string
}) {
  if (loading) {
    return (
      <Text fontSize={13} color={ui.textSecondary}>
        Computing cover days…
      </Text>
    )
  }
  if (!rows.length) {
    return (
      <Text fontSize={13} color={ui.textSecondary}>
        Forecasts appear after sales history is refreshed overnight, or tap Refresh on this tab.
      </Text>
    )
  }

  return (
    <YStack gap="$2">
      {rows.map((row) => (
        <YStack
          key={row.listing_id}
          padding="$3"
          borderWidth={1}
          borderColor={ui.borderSubtle}
          borderRadius={14}
          gap="$1"
        >
          <XStack justifyContent="space-between" gap="$2">
            <Text fontSize={14} fontWeight="800" color={ui.text} flex={1} numberOfLines={2}>
              {row.title ?? row.listing_id}
            </Text>
            <Text fontSize={13} fontWeight="700" color={ui.brand}>
              {row.stock_cover_days != null ? `${row.stock_cover_days}d cover` : 'No velocity'}
            </Text>
          </XStack>
          <Text fontSize={12} color={ui.textSecondary}>
            On hand {row.on_hand} · 28d sold {row.units_28d} · 30d forecast{' '}
            {Math.round(row.forecast_units_30d)} · restock {row.suggested_restock_qty}
          </Text>
          <Text fontSize={12} color={ui.textMuted}>
            Reorder point {row.reorder_point ?? '—'} · daily avg {row.average_daily_sales}
          </Text>
        </YStack>
      ))}
    </YStack>
  )
}
