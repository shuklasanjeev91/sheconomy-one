import { YStack } from '~/components/ui'

type IndianFlagBadgeProps = {
  /** Flag height in px; width is 1.5× height. */
  size?: number
}

/** Compact India tricolor for brand-mark corners (saffron / white / green + chakra). */
export function IndianFlagBadge({ size = 12 }: IndianFlagBadgeProps) {
  const stripeH = Math.max(2, Math.round(size / 3))
  const width = Math.round(size * 1.5)
  const height = stripeH * 3
  const chakra = Math.max(3, Math.round(size * 0.28))

  return (
    <YStack
      width={width}
      height={height}
      borderRadius={2}
      overflow="hidden"
      borderWidth={0.5}
      borderColor="rgba(0,0,0,0.18)"
      backgroundColor="#FFFFFF"
      accessibilityLabel="India"
    >
      <YStack height={stripeH} width="100%" backgroundColor="#FF9933" />
      <YStack
        height={stripeH}
        width="100%"
        backgroundColor="#FFFFFF"
        alignItems="center"
        justifyContent="center"
      >
        <YStack
          width={chakra}
          height={chakra}
          borderRadius={999}
          borderWidth={Math.max(1, Math.round(chakra / 4))}
          borderColor="#000080"
          backgroundColor="transparent"
        />
      </YStack>
      <YStack height={stripeH} width="100%" backgroundColor="#138808" />
    </YStack>
  )
}
