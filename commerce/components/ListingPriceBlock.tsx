import { Text, XStack, YStack } from '~/components/ui'
import {
  resolveListingPrice,
  type ListingPriceInput,
} from '~/commerce/lib/listing-pricing'
import { useAppUi } from '~/lib/theme/useAppUi'

type ListingPriceBlockProps = ListingPriceInput & {
  /** Larger PDP headline vs compact card/sticky. */
  size?: 'lg' | 'md' | 'sm'
  /** Hide the tax line (e.g. dense listing cards). */
  hideTaxLabel?: boolean
}

/**
 * Marketplace price block — selling price, MRP strike-through, % off,
 * and “Inclusive of all taxes” disclosure (marketplace style).
 */
export function ListingPriceBlock({
  size = 'lg',
  hideTaxLabel,
  ...input
}: ListingPriceBlockProps) {
  const ui = useAppUi()
  const display = resolveListingPrice(input)

  const priceSize = size === 'lg' ? 28 : size === 'md' ? 20 : 17
  const mrpSize = size === 'lg' ? 15 : size === 'md' ? 13 : 12

  return (
    <YStack gap={size === 'sm' ? 2 : '$1.5'} width="100%">
      <XStack alignItems="baseline" gap="$2" flexWrap="wrap">
        <Text
          fontWeight="800"
          fontSize={priceSize}
          color={ui.text}
          letterSpacing={-0.5}
          lineHeight={priceSize + 6}
        >
          {display.priceLabel}
        </Text>
        {display.mrpLabel ? (
          <Text
            fontSize={mrpSize}
            color={ui.textMuted}
            textDecorationLine="line-through"
            fontWeight="500"
          >
            MRP {display.mrpLabel}
          </Text>
        ) : null}
        {display.discountLabel ? (
          <Text fontSize={mrpSize} color={ui.success} fontWeight="700">
            {display.discountLabel}
          </Text>
        ) : null}
      </XStack>

      {display.saveLabel && size !== 'sm' ? (
        <Text fontSize={13} color={ui.success} fontWeight="600">
          {display.saveLabel}
        </Text>
      ) : null}

      {!hideTaxLabel ? (
        <Text fontSize={size === 'sm' ? 11 : 12} color={ui.textSecondary} fontWeight="500">
          {display.taxLabel}
        </Text>
      ) : null}
    </YStack>
  )
}
