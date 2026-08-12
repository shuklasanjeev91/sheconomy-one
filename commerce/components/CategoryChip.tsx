import { Text, YStack } from '~/components/ui'
import { AppLink } from '~/components/navigation/AppLink'
import { getShadowStyle, radius } from '~/config/tokens'
import type { CategorySummary } from '~/lib/supabase/commerce'
import { getCategorySlug } from '~/lib/supabase/commerce'
import { commerceRoutes } from '~/lib/routes'
import { useAppUi } from '~/lib/theme/useAppUi'

import { CategoryImage } from '~/commerce/components/CategoryImage'

// Curated category artwork is authored at 300x450, so the tile keeps that 2:3
// ratio — a landscape tile would crop the covers to a thin horizontal slice.
const TILE_WIDTH = 116
const TILE_HEIGHT = 174

type CategoryChipProps = {
  category: CategorySummary
}

/** Category discovery tile — rounded rectangle card, brand fallback, label stack. */
export function CategoryChip({ category }: CategoryChipProps) {
  const ui = useAppUi()
  const label =
    category.category.length > 18
      ? `${category.category.slice(0, 16)}…`
      : category.category

  return (
    <AppLink href={commerceRoutes.category(getCategorySlug(category))} asChild>
      <YStack
        width={TILE_WIDTH}
        alignItems="center"
        gap="$2"
        cursor="pointer"
        animation="quick"
        hoverStyle={{ y: -3, borderColor: ui.brand, opacity: 0.95 }}
        pressStyle={{ scale: 0.97, y: 0 }}
      >
        <YStack
          width={TILE_WIDTH}
          height={TILE_HEIGHT}
          borderRadius={radius.card}
          overflow="hidden"
          backgroundColor={ui.imagePlaceholder}
          alignItems="center"
          justifyContent="center"
          borderWidth={1}
          borderColor={ui.borderSubtle}
          style={getShadowStyle('sm')}
          animation="quick"
          hoverStyle={{ borderColor: ui.brand }}
        >
          <CategoryImage
            src={category.category_image_url}
            icon={category.category_icon}
            width={TILE_WIDTH}
            height={TILE_HEIGHT}
            alt={category.category}
          />
        </YStack>
        <Text
          fontSize={12}
          fontWeight="600"
          textAlign="center"
          numberOfLines={2}
          lineHeight={16}
          color={ui.text}
          width="100%"
          letterSpacing={-0.1}
        >
          {label}
        </Text>
        {category.product_count ? (
          <Text fontSize={11} color={ui.textMuted} textAlign="center" fontWeight="500">
            {category.product_count} {category.product_count === 1 ? 'item' : 'items'}
          </Text>
        ) : null}
      </YStack>
    </AppLink>
  )
}
