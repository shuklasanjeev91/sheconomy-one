import type { ReactNode } from 'react'

import { Spinner, Text, XStack, YStack } from '~/components/ui'
import { radius } from '~/config/tokens'
import { SALES_ANALYTICS_UI_COPY } from '~/lib/sales-analytics/sales-analytics-ui.copy'
import type {
  SalesAnalyticsCategoryPoint,
  SalesAnalyticsTrendPoint,
} from '~/lib/sales-analytics/sales-analytics-ui.utils'
import type { AppUiTokens } from '~/lib/theme/app-ui'

type SalesAnalyticsTrendPanelProps = {
  ui: AppUiTokens
  trendPoints: SalesAnalyticsTrendPoint[]
  categoryPoints: SalesAnalyticsCategoryPoint[]
  loading: boolean
  formatAmount: (value: number) => string
}

function MiniBarChart({
  ui,
  points,
  valueKey,
  color,
  formatValue,
}: {
  ui: AppUiTokens
  points: Array<{ label: string; revenue: number; orders: number; returns: number }>
  valueKey: 'revenue' | 'orders' | 'returns'
  color: string
  formatValue: (value: number) => string
}) {
  const max = Math.max(1, ...points.map((point) => point[valueKey]))

  return (
    <XStack gap="$2" alignItems="flex-end" minHeight={120}>
      {points.map((point) => (
        <YStack key={point.label} flex={1} alignItems="center" gap="$1.5" minWidth={28}>
          <YStack
            width="100%"
            maxWidth={28}
            height={Math.max(8, (point[valueKey] / max) * 96)}
            borderRadius={8}
            backgroundColor={color}
          />
          <Text fontSize={10} color={ui.textMuted} fontWeight="600" textAlign="center" numberOfLines={1}>
            {point.label}
          </Text>
          <Text fontSize={10} color={ui.textSecondary} textAlign="center" numberOfLines={1}>
            {formatValue(point[valueKey])}
          </Text>
        </YStack>
      ))}
    </XStack>
  )
}

function Panel({
  ui,
  title,
  subtitle,
  children,
}: {
  ui: AppUiTokens
  title: string
  subtitle: string
  children: ReactNode
}) {
  return (
    <YStack
      gap="$3"
      padding="$4"
      borderRadius={radius.card}
      borderWidth={1}
      borderColor={ui.borderSubtle}
      backgroundColor={ui.surface}
    >
      <YStack gap="$1">
        <Text fontSize={16} fontWeight="800" color={ui.text}>
          {title}
        </Text>
        <Text fontSize={12} color={ui.textMuted}>
          {subtitle}
        </Text>
      </YStack>
      {children}
    </YStack>
  )
}

export function SalesAnalyticsTrendPanel({
  ui,
  trendPoints,
  categoryPoints,
  loading,
  formatAmount,
}: SalesAnalyticsTrendPanelProps) {
  if (loading) {
    return (
      <YStack minHeight={220} alignItems="center" justifyContent="center">
        <Spinner size="large" />
      </YStack>
    )
  }

  if (!trendPoints.length) {
    return (
      <YStack
        padding="$5"
        borderRadius={radius.card}
        borderWidth={1}
        borderColor={ui.borderSubtle}
        backgroundColor={ui.surface}
        alignItems="center"
      >
        <Text fontSize={13} color={ui.textMuted}>
          {SALES_ANALYTICS_UI_COPY.emptyTrend}
        </Text>
      </YStack>
    )
  }

  return (
    <YStack gap="$4">
      <Panel ui={ui} title="Sales trend" subtitle="Revenue over the selected period">
        <MiniBarChart
          ui={ui}
          points={trendPoints}
          valueKey="revenue"
          color={ui.brand}
          formatValue={formatAmount}
        />
      </Panel>

      <XStack gap="$4" flexWrap="wrap">
        <YStack flex={1} minWidth={280}>
          <Panel ui={ui} title="Orders vs returns" subtitle="Daily order volume and returns">
            <MiniBarChart
              ui={ui}
              points={trendPoints}
              valueKey="orders"
              color="#2563EB"
              formatValue={(value) => String(value)}
            />
          </Panel>
        </YStack>

        <YStack flex={1} minWidth={280}>
          <Panel ui={ui} title="Top categories" subtitle="Revenue by leading category">
            {categoryPoints.length ? (
              <YStack gap="$2">
                {categoryPoints.map((point) => (
                  <XStack key={point.name} alignItems="center" justifyContent="space-between" gap="$3">
                    <YStack flex={1} minWidth={0}>
                      <Text fontSize={13} fontWeight="700" color={ui.text} numberOfLines={1}>
                        {point.name}
                      </Text>
                      <Text fontSize={12} color={ui.textMuted}>
                        {point.orders} orders
                      </Text>
                    </YStack>
                    <Text fontSize={13} fontWeight="700" color={ui.textSecondary}>
                      {formatAmount(point.revenue)}
                    </Text>
                  </XStack>
                ))}
              </YStack>
            ) : (
              <Text fontSize={13} color={ui.textMuted}>
                {SALES_ANALYTICS_UI_COPY.emptyTrend}
              </Text>
            )}
          </Panel>
        </YStack>
      </XStack>
    </YStack>
  )
}
