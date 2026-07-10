import { Icons, XStack, YStack } from '~/components/ui'
import { useAppUi } from '~/lib/theme/useAppUi'

type StarRatingProps = {
  rating: number | string
  size?: number
  max?: number
}

function normalizeRating(rating: number | string, max: number) {
  const value = Number(rating)
  if (!Number.isFinite(value)) return 0
  return Math.max(0, Math.min(max, value))
}

function RatingStar({
  filled,
  half,
  size,
}: {
  filled: boolean
  half: boolean
  size: number
}) {
  const ui = useAppUi()

  if (half) {
    return (
      <XStack width={size} height={size} position="relative" alignItems="center" justifyContent="center">
        <YStack position="absolute" left={0} top={0}>
          <Icons.Star size={size} color={ui.starEmpty} fill="transparent" opacity={0.28} />
        </YStack>
        <YStack
          position="absolute"
          left={0}
          top={0}
          width={size / 2}
          height={size}
          overflow="hidden"
        >
          <Icons.Star size={size} color={ui.starFill} fill={ui.starFill} />
        </YStack>
      </XStack>
    )
  }

  return (
    <Icons.Star
      size={size}
      color={filled ? ui.starFill : ui.starEmpty}
      fill={filled ? ui.starFill : 'transparent'}
      opacity={filled ? 1 : 0.28}
    />
  )
}

/** Etsy-style filled star row for a 0–5 rating. */
export function StarRating({ rating, size = 14, max = 5 }: StarRatingProps) {
  const safeRating = normalizeRating(rating, max)

  return (
    <XStack gap={2} alignItems="center" aria-label={`${safeRating.toFixed(1)} out of ${max} stars`}>
      {Array.from({ length: max }, (_, index) => {
        const starValue = index + 1
        const filled = safeRating >= starValue
        const half = !filled && safeRating >= starValue - 0.5

        return <RatingStar key={starValue} filled={filled} half={half} size={size} />
      })}
    </XStack>
  )
}