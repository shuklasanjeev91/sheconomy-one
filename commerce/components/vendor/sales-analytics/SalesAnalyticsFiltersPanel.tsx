import { useMemo } from 'react'

import { Input, ScrollView, Text, XStack, YStack } from '~/components/ui'
import { radius } from '~/config/tokens'
import {
  DELIVERY_STATUS_OPTIONS,
  PAYMENT_MODE_OPTIONS,
  SALES_DATE_RANGE_OPTIONS,
  SALES_STATUS_OPTIONS,
  countActiveSalesFilters,
} from '~/lib/sales-analytics/sales-analytics-ui.utils'
import type { SalesAnalyticsFilterInput } from '~/lib/sales-analytics/sales-analytics.type'
import type { AppUiTokens } from '~/lib/theme/app-ui'

type SalesAnalyticsFiltersPanelProps = {
  ui: AppUiTokens
  filters: SalesAnalyticsFilterInput
  loading?: boolean
  onChange: (filters: Partial<SalesAnalyticsFilterInput>) => void
  onReset: () => void
}

function FilterChip({
  ui,
  label,
  active,
  onPress,
}: {
  ui: AppUiTokens
  label: string
  active: boolean
  onPress: () => void
}) {
  return (
    <XStack
      alignItems="center"
      paddingHorizontal="$3"
      paddingVertical="$2"
      borderRadius={999}
      borderWidth={1}
      borderColor={active ? ui.brand : ui.borderSubtle}
      backgroundColor={active ? ui.roseSurface : ui.surface}
      cursor="pointer"
      pressStyle={{ opacity: 0.85 }}
      onPress={onPress}
    >
      <Text fontSize={12} fontWeight="700" color={active ? ui.brand : ui.textSecondary}>
        {label}
      </Text>
    </XStack>
  )
}

export function SalesAnalyticsFiltersPanel({
  ui,
  filters,
  loading,
  onChange,
  onReset,
}: SalesAnalyticsFiltersPanelProps) {
  const activeCount = useMemo(() => countActiveSalesFilters(filters), [filters])

  return (
    <YStack
      gap="$3"
      padding="$4"
      borderRadius={radius.card}
      borderWidth={1}
      borderColor={ui.borderSubtle}
      backgroundColor={ui.surface}
    >
      <XStack alignItems="center" justifyContent="space-between" gap="$2" flexWrap="wrap">
        <Text fontSize={15} fontWeight="800" color={ui.text}>
          Filters{activeCount ? ` (${activeCount})` : ''}
        </Text>
        <XStack
          alignItems="center"
          paddingHorizontal="$3"
          paddingVertical="$2"
          borderRadius={999}
          borderWidth={1}
          borderColor={ui.borderSubtle}
          backgroundColor={ui.surface}
          cursor="pointer"
          pressStyle={{ opacity: 0.85 }}
          onPress={onReset}
        >
          <Text fontSize={12} fontWeight="700" color={ui.textSecondary}>
            Reset
          </Text>
        </XStack>
      </XStack>

      <YStack gap="$2">
        <Text fontSize={12} fontWeight="700" color={ui.textMuted}>
          DATE RANGE
        </Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <XStack gap="$2">
            {SALES_DATE_RANGE_OPTIONS.map((option) => (
              <FilterChip
                key={option.value}
                ui={ui}
                label={option.label}
                active={filters.dateRange === option.value}
                onPress={() => onChange({ dateRange: option.value, startDate: null, endDate: null })}
              />
            ))}
          </XStack>
        </ScrollView>
      </YStack>

      <XStack gap="$3" flexWrap="wrap">
        <YStack flex={1} minWidth={160} gap="$2">
          <Text fontSize={12} fontWeight="700" color={ui.textMuted}>
            SALE STATUS
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <XStack gap="$2">
              {SALES_STATUS_OPTIONS.map((option) => (
                <FilterChip
                  key={option.value}
                  ui={ui}
                  label={option.label}
                  active={(filters.saleStatus ?? 'all') === option.value}
                  onPress={() =>
                    onChange({
                      saleStatus: option.value === 'all' ? null : option.value,
                    })
                  }
                />
              ))}
            </XStack>
          </ScrollView>
        </YStack>
      </XStack>

      <XStack gap="$3" flexWrap="wrap">
        <YStack flex={1} minWidth={160} gap="$2">
          <Text fontSize={12} fontWeight="700" color={ui.textMuted}>
            PAYMENT MODE
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <XStack gap="$2">
              {PAYMENT_MODE_OPTIONS.map((option) => (
                <FilterChip
                  key={option.value}
                  ui={ui}
                  label={option.label}
                  active={(filters.paymentMode ?? 'all') === option.value}
                  onPress={() =>
                    onChange({
                      paymentMode: option.value === 'all' ? null : option.value,
                    })
                  }
                />
              ))}
            </XStack>
          </ScrollView>
        </YStack>
      </XStack>

      <XStack gap="$3" flexWrap="wrap">
        <YStack flex={1} minWidth={160} gap="$2">
          <Text fontSize={12} fontWeight="700" color={ui.textMuted}>
            DELIVERY STATUS
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <XStack gap="$2">
              {DELIVERY_STATUS_OPTIONS.map((option) => (
                <FilterChip
                  key={option.value}
                  ui={ui}
                  label={option.label}
                  active={(filters.deliveryStatus ?? 'all') === option.value}
                  onPress={() =>
                    onChange({
                      deliveryStatus: option.value === 'all' ? null : option.value,
                    })
                  }
                />
              ))}
            </XStack>
          </ScrollView>
        </YStack>
      </XStack>

      <XStack gap="$3" flexWrap="wrap">
        <YStack flex={1} minWidth={180} gap="$2">
          <Text fontSize={12} fontWeight="700" color={ui.textMuted}>
            SEARCH
          </Text>
          <Input
            value={filters.searchTerm ?? ''}
            onChangeText={(value) => onChange({ searchTerm: value })}
            placeholder="Order, product, SKU…"
          />
        </YStack>
        <YStack flex={1} minWidth={180} gap="$2">
          <Text fontSize={12} fontWeight="700" color={ui.textMuted}>
            REGION
          </Text>
          <Input
            value={filters.region ?? ''}
            onChangeText={(value) => onChange({ region: value || null })}
            placeholder="State or region"
          />
        </YStack>
        <YStack flex={1} minWidth={180} gap="$2">
          <Text fontSize={12} fontWeight="700" color={ui.textMuted}>
            CATEGORY
          </Text>
          <Input
            value={filters.category ?? ''}
            onChangeText={(value) => onChange({ category: value || null })}
            placeholder="Product category"
          />
        </YStack>
      </XStack>
    </YStack>
  )
}
