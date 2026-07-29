import { Button, Spinner, Text, XStack, YStack } from '~/components/ui'
import { radius } from '~/config/tokens'
import { SALES_ANALYTICS_UI_COPY } from '~/lib/sales-analytics/sales-analytics-ui.copy'
import { summarizeTopProduct } from '~/lib/sales-analytics/sales-analytics-ui.utils'
import type { VendorTopProductRow } from '~/lib/sales-analytics/sales-analytics.type'
import type { AppUiTokens } from '~/lib/theme/app-ui'

type SalesAnalyticsTopProductsPanelProps = {
  ui: AppUiTokens
  products: VendorTopProductRow[]
  loading: boolean
  formatAmount: (value: number) => string
  limit?: number
  showViewAll?: boolean
  onViewAll?: () => void
}

export function SalesAnalyticsTopProductsPanel({
  ui,
  products,
  loading,
  formatAmount,
  limit,
  showViewAll,
  onViewAll,
}: SalesAnalyticsTopProductsPanelProps) {
  const rows = limit ? products.slice(0, limit) : products

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
          {SALES_ANALYTICS_UI_COPY.emptyProducts}
        </Text>
      </YStack>
    )
  }

  return (
    <YStack gap="$3">
      {rows.map((product, index) => (
        <XStack
          key={`${product.listing_id ?? product.product_title}-${index}`}
          gap="$3"
          alignItems="center"
          padding="$3"
          borderRadius={radius.card}
          borderWidth={1}
          borderColor={ui.borderSubtle}
          backgroundColor={ui.surface}
        >
          <YStack
            width={28}
            height={28}
            borderRadius={999}
            backgroundColor={ui.roseSurface}
            alignItems="center"
            justifyContent="center"
          >
            <Text fontSize={12} fontWeight="800" color={ui.brand}>
              {index + 1}
            </Text>
          </YStack>
          <YStack flex={1} minWidth={0} gap="$1">
            <Text fontSize={14} fontWeight="800" color={ui.text} numberOfLines={2}>
              {product.product_title ?? 'Untitled product'}
            </Text>
            <Text fontSize={12} color={ui.textMuted}>
              {summarizeTopProduct(product)}
              {product.product_category ? ` · ${product.product_category}` : ''}
            </Text>
          </YStack>
          <Text fontSize={13} fontWeight="800" color={ui.textSecondary}>
            {formatAmount(Number(product.total_revenue ?? 0))}
          </Text>
        </XStack>
      ))}

      {showViewAll && products.length > (limit ?? products.length) ? (
        <Button tone="outline" size="$3" onPress={onViewAll}>
          View all products
        </Button>
      ) : null}
    </YStack>
  )
}
