import { Button, Spinner, Text, XStack, YStack } from '~/components/ui'
import { radius } from '~/config/tokens'
import { SALES_ANALYTICS_UI_COPY } from '~/lib/sales-analytics/sales-analytics-ui.copy'
import {
  formatSalesRecordDate,
  getSalesRecordStatusBadge,
  summarizeSalesRecord,
} from '~/lib/sales-analytics/sales-analytics-ui.utils'
import type { SalesAnalyticsPagination, SalesAnalyticsRecord } from '~/lib/sales-analytics/sales-analytics.type'
import type { AppUiTokens } from '~/lib/theme/app-ui'

type SalesAnalyticsRecordsListProps = {
  ui: AppUiTokens
  records: SalesAnalyticsRecord[]
  pagination: SalesAnalyticsPagination
  loading: boolean
  formatAmount: (value: number) => string
  onLoadMore?: () => void
}

function StatusBadge({ ui, tone, label }: { ui: AppUiTokens; tone: 'success' | 'warning' | 'danger' | 'muted'; label: string }) {
  const colors = {
    success: { bg: '#DCFCE7', text: '#166534' },
    warning: { bg: '#FEF3C7', text: '#92400E' },
    danger: { bg: '#FEE2E2', text: '#B91C1C' },
    muted: { bg: ui.chip, text: ui.textMuted },
  }[tone]

  return (
    <YStack paddingHorizontal="$2" paddingVertical={4} borderRadius={999} backgroundColor={colors.bg}>
      <Text fontSize={10} fontWeight="800" color={colors.text}>
        {label}
      </Text>
    </YStack>
  )
}

export function SalesAnalyticsRecordsList({
  ui,
  records,
  pagination,
  loading,
  formatAmount,
  onLoadMore,
}: SalesAnalyticsRecordsListProps) {
  if (loading && !records.length) {
    return (
      <YStack minHeight={220} alignItems="center" justifyContent="center">
        <Spinner size="large" />
      </YStack>
    )
  }

  if (!records.length) {
    return (
      <YStack padding="$5" alignItems="center">
        <Text fontSize={13} color={ui.textMuted}>
          {SALES_ANALYTICS_UI_COPY.emptyRecords}
        </Text>
      </YStack>
    )
  }

  return (
    <YStack gap="$3">
      {records.map((record) => {
        const badge = getSalesRecordStatusBadge(record.sale_status)
        return (
          <YStack
            key={record.id}
            gap="$2"
            padding="$4"
            borderRadius={radius.card}
            borderWidth={1}
            borderColor={ui.borderSubtle}
            backgroundColor={ui.surface}
          >
            <XStack alignItems="flex-start" justifyContent="space-between" gap="$3">
              <YStack flex={1} minWidth={0} gap="$1">
                <Text fontSize={14} fontWeight="800" color={ui.text} numberOfLines={2}>
                  {record.product_title}
                </Text>
                <Text fontSize={12} color={ui.textMuted}>
                  {summarizeSalesRecord(record)}
                </Text>
              </YStack>
              <StatusBadge ui={ui} tone={badge.tone} label={badge.label} />
            </XStack>

            <XStack gap="$4" flexWrap="wrap">
              <YStack gap="$0.5">
                <Text fontSize={11} color={ui.textMuted}>
                  Revenue
                </Text>
                <Text fontSize={14} fontWeight="800" color={ui.text}>
                  {formatAmount(Number(record.total_revenue ?? 0))}
                </Text>
              </YStack>
              <YStack gap="$0.5">
                <Text fontSize={11} color={ui.textMuted}>
                  Qty
                </Text>
                <Text fontSize={14} fontWeight="700" color={ui.text}>
                  {record.quantity}
                </Text>
              </YStack>
              <YStack gap="$0.5">
                <Text fontSize={11} color={ui.textMuted}>
                  Ordered
                </Text>
                <Text fontSize={14} fontWeight="700" color={ui.text}>
                  {formatSalesRecordDate(record.ordered_at)}
                </Text>
              </YStack>
              <YStack gap="$0.5">
                <Text fontSize={11} color={ui.textMuted}>
                  Delivered
                </Text>
                <Text fontSize={14} fontWeight="700" color={ui.text}>
                  {formatSalesRecordDate(record.delivered_at)}
                </Text>
              </YStack>
            </XStack>
          </YStack>
        )
      })}

      {pagination.hasMore ? (
        <Button tone="outline" size="$3" disabled={loading} onPress={onLoadMore}>
          {loading ? 'Loading…' : `Load more (${records.length} of ${pagination.totalRecords})`}
        </Button>
      ) : (
        <Text fontSize={12} color={ui.textMuted} textAlign="center">
          Showing {records.length} record{records.length === 1 ? '' : 's'}
        </Text>
      )}
    </YStack>
  )
}
