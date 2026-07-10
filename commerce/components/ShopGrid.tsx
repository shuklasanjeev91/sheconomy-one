import { ShopSpotlightCard } from '~/commerce/components/ShopSpotlightCard'
import type { ShopSummary } from '~/commerce/lib/commerce'
import { XStack } from '~/components/ui'

type ShopGridProps = {
  shops: ShopSummary[]
  columns?: 1 | 2 | 3 | 4 | 5 | 6
}

/** Full-width responsive shop grid — cards stretch to fill each row. */
export function ShopGrid({ shops, columns = 4 }: ShopGridProps) {
  const minWidth =
    columns === 6 ? 140 : columns === 5 ? 168 : columns === 4 ? 200 : columns === 3 ? 220 : columns === 2 ? 240 : 280

  const basis =
    columns === 6
      ? '15.5%'
      : columns === 5
        ? '18.5%'
        : columns === 4
          ? '23%'
          : columns === 3
            ? '31%'
            : columns === 2
              ? '47%'
              : '100%'

  return (
    <XStack gap="$4" flexWrap="wrap" width="100%" alignItems="stretch">
      {shops.map((shop) => (
        <XStack
          key={shop.id}
          flexBasis={basis}
          flexGrow={1}
          flexShrink={0}
          minWidth={minWidth}
          maxWidth={columns === 1 ? '100%' : undefined}
          alignSelf="stretch"
        >
          <ShopSpotlightCard shop={shop} fill />
        </XStack>
      ))}
    </XStack>
  )
}
