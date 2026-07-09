import { Button, Spinner, Text, Theme, XStack, YStack } from '~/components/ui'
import { BRAND_THEME, getShadowStyle } from '~/config/tokens'
import { formatCurrency } from '~/lib/format'
import { MOBILE_TAB_BAR_HEIGHT } from '~/components/navigation/constants'
import { bottomBarPositionStyle } from '~/lib/layout/styles'
import { useAppUi } from '~/lib/theme/useAppUi'

type ListingMobileStickyBuyBarProps = {
  price: number
  currency: string
  disabled?: boolean
  isLoading?: boolean
  label?: string
  onPress: () => void
}

const BAR_HEIGHT = 64

/** Cross-platform sticky buy bar above bottom tabs. */
export function ListingMobileStickyBuyBar({
  price,
  currency,
  disabled,
  isLoading,
  label = 'Add to cart',
  onPress,
}: ListingMobileStickyBuyBarProps) {
  const ui = useAppUi()

  return (
    <XStack
      height={BAR_HEIGHT}
      paddingHorizontal="$4"
      paddingVertical="$2.5"
      backgroundColor={ui.surface}
      borderTopWidth={1}
      borderTopColor={ui.panelBorder}
      alignItems="center"
      gap="$3"
      width="100%"
      style={{
        ...bottomBarPositionStyle(MOBILE_TAB_BAR_HEIGHT),
        ...getShadowStyle('md'),
      }}
    >
      <YStack flex={1} minWidth={0}>
        <Text fontSize={12} color={ui.textMuted}>
          Total
        </Text>
        <Text fontWeight="700" fontSize={18} color={ui.text} numberOfLines={1}>
          {formatCurrency(price, currency)}
        </Text>
      </YStack>
      <Theme name={BRAND_THEME}>
        <Button
          tone="primary"
          size="$4"
          flex={1}
          maxWidth="50%"
          borderRadius={999}
          disabled={disabled || isLoading}
          onPress={onPress}
          icon={isLoading ? <Spinner size="small" color="white" /> : undefined}
        >
          {disabled ? 'Out of stock' : isLoading ? 'Adding…' : label}
        </Button>
      </Theme>
    </XStack>
  )
}

export const LISTING_MOBILE_STICKY_BAR_HEIGHT = BAR_HEIGHT