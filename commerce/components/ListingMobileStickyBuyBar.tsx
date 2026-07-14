import { Platform } from 'react-native'

import { Button, Spinner, Theme, XStack, YStack } from '~/components/ui'
import { ListingPriceBlock } from '~/commerce/components/ListingPriceBlock'
import { ListingQuantityStepper } from '~/commerce/components/ListingQuantityStepper'
import { BRAND_THEME, getShadowStyle } from '~/config/tokens'
import { MOBILE_TAB_BAR_HEIGHT } from '~/components/navigation/constants'
import { bottomBarPositionStyle } from '~/lib/layout/styles'
import { chromeSurfaceStyle } from '~/lib/theme/surfaces'
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

const BAR_HEIGHT = 76

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
      <YStack flex={0} minWidth={100} maxWidth={140} gap={0}>
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
        <XStack flex={1} gap="$2" justifyContent="flex-end" alignItems="center" minWidth={0}>
          <ListingQuantityStepper
            quantity={quantity}
            maxQuantity={maxQuantity}
            disabled={disabled || isUpdatingQuantity}
            size="sm"
            onDecrease={() => onDecreaseQuantity?.()}
            onIncrease={() => onIncreaseQuantity?.()}
          />
          <Theme name={BRAND_THEME}>
            <Button
              tone="primary"
              size="$3.5"
              flex={1}
              maxWidth={160}
              borderRadius={999}
              disabled={disabled}
              onPress={onCheckout}
            >
              Checkout
            </Button>
          </Theme>
        </XStack>
      ) : (
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
              {isLoading ? '…' : label}
            </Button>
          </Theme>
          {onBuyNow ? (
            <Button
              tone="outline"
              size="$3.5"
              flex={1}
              maxWidth={140}
              borderRadius={999}
              disabled={disabled || isLoading}
              onPress={onBuyNow}
            >
              {buyNowLabel}
            </Button>
          ) : null}
        </XStack>
      )}
    </XStack>
  )
}

export const LISTING_MOBILE_STICKY_BAR_HEIGHT = BAR_HEIGHT
