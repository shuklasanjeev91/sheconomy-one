import { Platform } from 'react-native'

import { Button, Spinner, Text, Theme, XStack, YStack } from '~/components/ui'
import { BRAND_THEME, getShadowStyle } from '~/config/tokens'
import { formatCurrency } from '~/lib/format'
import { MOBILE_TAB_BAR_HEIGHT } from '~/components/navigation/constants'
import { bottomBarPositionStyle } from '~/lib/layout/styles'
import { chromeSurfaceStyle } from '~/lib/theme/surfaces'
import { useAppUi } from '~/lib/theme/useAppUi'

type ListingMobileStickyBuyBarProps = {
  price: number
  currency: string
  disabled?: boolean
  isLoading?: boolean
  label?: string
  buyNowLabel?: string
  onPress: () => void
  onBuyNow?: () => void
}

const BAR_HEIGHT = 76

/** Cross-platform sticky buy bar above bottom tabs — price + dual CTAs. */
export function ListingMobileStickyBuyBar({
  price,
  currency,
  disabled,
  isLoading,
  label = 'Add to cart',
  buyNowLabel = 'Buy now',
  onPress,
  onBuyNow,
}: ListingMobileStickyBuyBarProps) {
  const ui = useAppUi()

  return (
    <XStack
      minHeight={BAR_HEIGHT}
      paddingHorizontal="$4"
      paddingVertical="$3"
      backgroundColor={ui.surface}
      borderTopWidth={1}
      borderTopColor={ui.borderSubtle}
      alignItems="center"
      gap="$3"
      width="100%"
      style={{
        ...bottomBarPositionStyle(MOBILE_TAB_BAR_HEIGHT),
        ...getShadowStyle('md'),
        ...chromeSurfaceStyle(ui),
        ...(Platform.OS === 'web'
          ? {
              backdropFilter: 'blur(20px) saturate(180%)',
              WebkitBackdropFilter: 'blur(20px) saturate(180%)',
            }
          : {}),
      }}
    >
      <YStack flex={0} minWidth={88} gap={2}>
        <Text fontSize={11} color={ui.textMuted} fontWeight="600" letterSpacing={0.3} textTransform="uppercase">
          Price
        </Text>
        <Text fontWeight="800" fontSize={20} color={ui.text} numberOfLines={1} letterSpacing={-0.4}>
          {formatCurrency(price, currency)}
        </Text>
      </YStack>

      <XStack flex={1} gap="$2" justifyContent="flex-end" minWidth={0}>
        <Theme name={BRAND_THEME}>
          <Button
            tone="primary"
            size="$3.5"
            flex={1}
            maxWidth={onBuyNow ? 140 : 200}
            borderRadius={999}
            disabled={disabled || isLoading}
            onPress={onPress}
            icon={isLoading ? <Spinner size="small" color="white" /> : undefined}
          >
            {disabled ? 'Sold out' : isLoading ? 'Adding…' : label}
          </Button>
        </Theme>
        {onBuyNow ? (
          <Button
            tone="outline"
            size="$3.5"
            flex={1}
            maxWidth={120}
            borderRadius={999}
            disabled={disabled || isLoading}
            onPress={onBuyNow}
          >
            {buyNowLabel}
          </Button>
        ) : null}
      </XStack>
    </XStack>
  )
}

export const LISTING_MOBILE_STICKY_BAR_HEIGHT = BAR_HEIGHT
