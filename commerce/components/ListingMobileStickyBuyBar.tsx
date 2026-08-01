import { Platform } from 'react-native'

import { Button, Spinner, Theme, XStack, YStack } from '~/components/ui'
import { ListingPriceBlock } from '~/commerce/components/ListingPriceBlock'
import { ListingQuantityStepper } from '~/commerce/components/ListingQuantityStepper'
import { BRAND_THEME, getShadowStyle } from '~/config/tokens'
import { bottomBarPositionStyle } from '~/lib/layout/styles'
import { chromeSurfaceStyle } from '~/lib/theme/surfaces'
import { useAppLayout } from '~/hooks/useAppLayout'
import { useAppUi } from '~/lib/theme/useAppUi'

type ListingMobileStickyBuyBarProps = {
  price: number
  currency: string
  mrp?: number | null
  priceIncludesTax?: boolean | null
  taxPercent?: number | null
  disabled?: boolean
  isLoading?: boolean
  /** When the selected listing/variant is already in the cart. */
  inCart?: boolean
  quantity?: number
  maxQuantity?: number | null
  isUpdatingQuantity?: boolean
  label?: string
  buyNowLabel?: string
  onPress: () => void
  onBuyNow?: () => void
  onIncreaseQuantity?: () => void
  onDecreaseQuantity?: () => void
  onCheckout?: () => void
}

/** Cross-platform sticky buy bar above bottom tabs — price + dual CTAs or qty + checkout. */
export function ListingMobileStickyBuyBar({
  price,
  currency,
  mrp,
  priceIncludesTax,
  taxPercent,
  disabled,
  isLoading,
  inCart = false,
  quantity = 1,
  maxQuantity,
  isUpdatingQuantity,
  label = 'Add to cart',
  buyNowLabel = 'Buy now',
  onPress,
  onBuyNow,
  onIncreaseQuantity,
  onDecreaseQuantity,
  onCheckout,
}: ListingMobileStickyBuyBarProps) {
  const ui = useAppUi()
  const { mobileTabBarOffset } = useAppLayout()
  const isNative = Platform.OS !== 'web'

  return (
    <YStack
      width="100%"
      paddingHorizontal={isNative ? '$3' : '$4'}
      paddingTop="$2.5"
      paddingBottom="$2.5"
      backgroundColor={ui.surface}
      borderTopWidth={1}
      borderTopColor={ui.borderSubtle}
      gap="$2"
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
      <XStack alignItems="center" justifyContent="space-between" gap="$2" minWidth={0}>
        <YStack flexShrink={1} minWidth={0} maxWidth={isNative ? 128 : 160}>
          <ListingPriceBlock
            price={price}
            mrp={mrp}
            currency={currency}
            priceIncludesTax={priceIncludesTax}
            taxPercent={taxPercent}
            size="sm"
          />
        </YStack>

        {inCart ? (
          <ListingQuantityStepper
            quantity={quantity}
            maxQuantity={maxQuantity}
            disabled={disabled || isUpdatingQuantity}
            size="sm"
            onDecrease={() => onDecreaseQuantity?.()}
            onIncrease={() => onIncreaseQuantity?.()}
          />
        ) : null}
      </XStack>

      {inCart ? (
        <Theme name={BRAND_THEME}>
          <Button
            tone="primary"
            size="$4"
            width="100%"
            borderRadius={999}
            disabled={disabled}
            onPress={onCheckout}
            letterSpacing={0}
          >
            Checkout
          </Button>
        </Theme>
      ) : (
        <XStack gap="$2" width="100%" minWidth={0}>
          <Theme name={BRAND_THEME}>
            <Button
              tone="primary"
              size="$4"
              flex={1}
              minWidth={0}
              borderRadius={999}
              disabled={disabled || isLoading}
              onPress={onPress}
              letterSpacing={0}
              fontSize={isNative ? 14 : 15}
              paddingHorizontal={isNative ? '$3' : '$4'}
              icon={isLoading ? <Spinner size="small" color="white" /> : undefined}
            >
              {isLoading ? '…' : label}
            </Button>
          </Theme>
          {onBuyNow ? (
            <Button
              tone="outline"
              size="$4"
              flex={1}
              minWidth={0}
              borderRadius={999}
              disabled={disabled || isLoading}
              onPress={onBuyNow}
              letterSpacing={0}
              fontSize={isNative ? 14 : 15}
              paddingHorizontal={isNative ? '$3' : '$4'}
            >
              {buyNowLabel}
            </Button>
          ) : null}
        </XStack>
      )}
    </YStack>
  )
}

/** Approx height for scroll padding under the sticky bar (two-row native layout). */
export const LISTING_MOBILE_STICKY_BAR_HEIGHT = Platform.OS === 'web' ? 76 : 108
