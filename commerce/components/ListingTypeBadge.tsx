import { Icons, Text, XStack, YStack } from '~/components/ui'
import { isDigitalListing } from '~/commerce/lib/listing-fulfillment'
import { useAppUi } from '~/lib/theme/useAppUi'

type ListingTypeBadgeProps = {
  listingType: string
  compact?: boolean
  deliveryHint?: string | null
}

export function ListingTypeBadge({ listingType, compact, deliveryHint }: ListingTypeBadgeProps) {
  const ui = useAppUi()
  const isDigital = isDigitalListing(listingType)
  const label = isDigital ? 'Instant download' : deliveryHint ?? 'Physical goods'

  return (
    <XStack
      gap={4}
      alignItems="flex-start"
      paddingHorizontal={compact ? 6 : 8}
      paddingVertical={compact ? 3 : 4}
      borderRadius={4}
      backgroundColor={isDigital ? ui.digitalBg : ui.deliveryBg}
      width="100%"
      maxWidth="100%"
      flexShrink={1}
    >
      <YStack paddingTop={2} flexShrink={0}>
        {isDigital ? (
          <Icons.Download size={compact ? 10 : 11} color={ui.digitalText} />
        ) : (
          <Icons.Truck size={compact ? 10 : 11} color={ui.deliveryText} />
        )}
      </YStack>
      <Text
        flex={1}
        flexShrink={1}
        fontSize={compact ? 10 : 11}
        fontWeight="600"
        color={isDigital ? ui.digitalText : ui.deliveryText}
        lineHeight={compact ? 14 : 15}
      >
        {label}
      </Text>
    </XStack>
  )
}