import { Platform } from 'react-native'

import { Button, Spinner, Text, Theme, XStack, YStack } from '~/components/ui'
import { BRAND_THEME, getShadowStyle } from '~/config/tokens'
import { bottomBarPositionStyle } from '~/lib/layout/styles'
import { chromeSurfaceStyle } from '~/lib/theme/surfaces'
import { formatCurrency } from '~/lib/format'
import { useAppLayout } from '~/hooks/useAppLayout'
import { useAppUi } from '~/lib/theme/useAppUi'

type CommerceMobileCheckoutBarProps = {
  total: number
  currency: string
  label: string
  onPress: () => void
  disabled?: boolean
  isLoading?: boolean
  /** Pre-formatted total label (e.g. after currency conversion). */
  formattedTotal?: string
  /** Pre-formatted savings label. */
  formattedSavings?: string | null
  /** Small line above the total, e.g. "3 items". */
  caption?: string
  /** When set, shows a "You save …" hint. */
  savings?: number | null
  /**
   * Reports the bar's rendered height. `BAR_HEIGHT` is only a minimum — the bar
   * grows past it once the caption or savings lines wrap, so hosts that pad
   * content by the constant alone hide their last row behind it.
   */
  onHeightChange?: (height: number) => void
}

const BAR_HEIGHT = 72

/** Sticky bottom action bar for mobile cart/checkout — total + primary CTA. */
export function CommerceMobileCheckoutBar({
  total,
  currency,
  label,
  onPress,
  disabled,
  isLoading,
  formattedTotal,
  formattedSavings,
  caption,
  savings,
  onHeightChange,
}: CommerceMobileCheckoutBarProps) {
  const ui = useAppUi()
  const { mobileTabBarOffset } = useAppLayout()

  return (
    <XStack
      minHeight={BAR_HEIGHT}
      onLayout={(event) => onHeightChange?.(event.nativeEvent.layout.height)}
      paddingHorizontal="$4"
      paddingVertical="$3"
      backgroundColor={ui.surface}
      borderTopWidth={1}
      borderTopColor={ui.borderSubtle}
      alignItems="center"
      gap="$3"
      width="100%"
      style={{
        ...bottomBarPositionStyle(mobileTabBarOffset),
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
      <YStack flex={1} minWidth={0} gap={1}>
        {caption ? (
          <Text fontSize={11} color={ui.textMuted} fontWeight="600" numberOfLines={1}>
            {caption}
          </Text>
        ) : null}
        <Text fontWeight="800" fontSize={20} color={ui.text} numberOfLines={1} letterSpacing={-0.4}>
          {formattedTotal ?? formatCurrency(total, currency)}
        </Text>
        {savings && savings > 0 ? (
          <Text fontSize={11} fontWeight="700" color={ui.success} numberOfLines={1}>
            You save {formattedSavings ?? formatCurrency(savings, currency)}
          </Text>
        ) : null}
      </YStack>

      <Theme name={BRAND_THEME}>
        <Button
          tone="primary"
          size="$4"
          minWidth={168}
          borderRadius={8}
          disabled={disabled || isLoading}
          onPress={onPress}
          icon={isLoading ? <Spinner size="small" color="white" /> : undefined}
        >
          {label}
        </Button>
      </Theme>
    </XStack>
  )
}

export const COMMERCE_MOBILE_CHECKOUT_BAR_HEIGHT = BAR_HEIGHT
