import { Icons, Text, XStack } from '~/components/ui'
import { SafeIcon } from '~/commerce/components/SafeIcon'
import type { ShopHeaderInfo } from '~/commerce/hooks/useShopHeaders'
import { formatRating } from '~/lib/format'
import { useAppUi } from '~/lib/theme/useAppUi'

import { StarRating } from '~/commerce/components/StarRating'

/** Compact shop rating + verified badge for cart/checkout shop groups. */
export function ShopRatingBadge({ info }: { info?: ShopHeaderInfo }) {
  const ui = useAppUi()
  if (!info) return null

  const hasRating = info.rating != null && info.rating > 0 && info.reviews > 0
  if (!hasRating && !info.verified) return null

  return (
    <XStack alignItems="center" gap="$2" flexWrap="wrap">
      {hasRating ? (
        <XStack alignItems="center" gap={4}>
          <StarRating rating={info.rating ?? 0} size={11} />
          <Text fontSize={12} color={ui.textSecondary} fontWeight="500">
            {formatRating(info.rating)}
            {info.reviews ? ` (${info.reviews})` : ''}
          </Text>
        </XStack>
      ) : null}
      {info.verified ? (
        <XStack alignItems="center" gap={2}>
          <SafeIcon icon={Icons.BadgeCheck} size={13} color={ui.brand} />
          <Text fontSize={11} color={ui.brand} fontWeight="600">
            Verified
          </Text>
        </XStack>
      ) : null}
    </XStack>
  )
}
