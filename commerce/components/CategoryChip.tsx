import { Link } from 'one'

import { Text, YStack } from '~/components/ui'
import { getShadowStyle, radius } from '~/config/tokens'
import type { CategorySummary } from '~/lib/supabase/commerce'
import { getCategorySlug } from '~/lib/supabase/commerce'
import { commerceRoutes } from '~/lib/routes'
import { useAppUi } from '~/lib/theme/useAppUi'

import { CategoryImage } from './CategoryImage'

const CIRCLE_SIZE = 88

type CategoryChipProps = {
  category: CategorySummary
}

/** Category discovery tile — elevated circle, brand fallback, crisp label stack. */
export function CategoryChip({ category }: CategoryChipProps) {
  const ui = useAppUi()
  const label =
    category.category.length > 18
      ? `${category.category.slice(0, 16)}…`
      : category.category

  return (
    <Link href={commerceRoutes.category(getCategorySlug(category))} asChild>
      <YStack
        width={108}
        alignItems="center"
        gap="$2"
        cursor="pointer"
        animation="quick"
        hoverStyle={{ y: -3, borderColor: ui.brand, opacity: 0.95 }}
        pressStyle={{ scale: 0.97, y: 0 }}
      >
        <YStack
          width={CIRCLE_SIZE}
          height={CIRCLE_SIZE}
          borderRadius={radius.pill}
          overflow="hidden"
          backgroundColor={ui.imagePlaceholder}
          alignItems="center"
          justifyContent="center"
          borderWidth={2}
          borderColor={ui.borderSubtle}
          style={getShadowStyle('sm')}
          animation="quick"
          hoverStyle={{ borderColor: ui.brand }}
        >
          <CategoryImage
            src={category.category_image_url}
            size={CIRCLE_SIZE}
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
    </Link>
  )
}
