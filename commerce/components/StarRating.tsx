import { Icons, XStack } from '~/components/ui'
import { useAppUi } from '~/lib/theme/useAppUi'

type StarRatingProps = {
  rating: number
  size?: number
  max?: number
}

/** Etsy-style filled star row for a 0–5 rating. */
export function StarRating({ rating, size = 14, max = 5 }: StarRatingProps) {
  const ui = useAppUi()
  const safeRating = Math.max(0, Math.min(max, rating))

  return (
    <XStack gap={2} alignItems="center" aria-label={`${safeRating.toFixed(1)} out of ${max} stars`}>
      {Array.from({ length: max }, (_, index) => {
        const starValue = index + 1
        const filled = safeRating >= starValue - 0.25
        const half = !filled && safeRating > index && safeRating < starValue

        return (
          <Icons.Star
            key={starValue}
            size={size}
            color={filled || half ? ui.starFill : ui.starEmpty}
            fill={filled || half ? ui.starFill : 'transparent'}
            opacity={filled || half ? 1 : 0.28}
          />
        )
      })}
    </XStack>
  )
}